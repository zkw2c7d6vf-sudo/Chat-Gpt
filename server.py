"""Midnight: single-user, loopback-only dashboard. No cloud account writes on startup."""
import asyncio
import base64
import hashlib
import http.client
import ipaddress
import json
import os
from pathlib import Path
from html.parser import HTMLParser
import re
import secrets
import socket
import ssl
import time
import tempfile
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlencode, urljoin, urlsplit

import feedparser
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from icalendar import Calendar
from kasa import Credentials, Discover
import recurring_ical_events
import trafilatura
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Literal
from zoneinfo import ZoneInfo
from wallpaper import WallpaperService
from places import nearest_town

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get('MIDNIGHT_DATA', str(ROOT / 'data')))
DATA.mkdir(parents=True, exist_ok=True)
try:
    DATA.chmod(0o700)
except OSError:
    pass
BASE = 'http://127.0.0.1:8765'
CALLBACK = BASE + '/api/spotify/callback'
DEFAULTS = {'plug_ip': '192.168.18.154', 'plug_enabled': False, 'spotify_client_id': '',
            'calendar_url': '', 'feeds': [], 'units': 'fahrenheit'}
CSRF = secrets.token_urlsafe(32)
OAUTH = {}
CACHE = {}
cache_generation = 0
feed_pending = {}
feed_slots = asyncio.Semaphore(4)
spotify_lock = asyncio.Lock()
plug_lock = asyncio.Lock()
spotify_retry_at = 0.0
wallpapers = WallpaperService(lambda: DATA)
app = FastAPI(title='Midnight Dashboard', docs_url=None, redoc_url=None, openapi_url=None)


def read_json(name, fallback):
    try:
        return json.loads((DATA / name).read_text('utf-8'))
    except (OSError, ValueError):
        return fallback


def save_json(name, value):
    target = DATA / name
    temp = DATA / (name + '.tmp')
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        json.dump(value, f)
    os.replace(temp, target)


def config():
    return DEFAULTS | read_json('settings.json', {})


def invalidate_cache():
    global cache_generation
    cache_generation += 1
    CACHE.clear()


async def cached_feed(url):
    """Share feed work across tabs; cap blocking fetches at four at a time."""
    key = ('rss', url)
    generation = cache_generation
    cached = CACHE.get(key)
    if cached and cached[0] > time.time():
        return cached[1]
    pending_key = (generation, url)
    task = feed_pending.get(pending_key)
    if task is None:
        async def load():
            async with feed_slots:
                entries = await asyncio.to_thread(news_fetch, url)
            # A preferences change must not repopulate an invalidated cache.
            if generation == cache_generation:
                CACHE[key] = (time.time() + 900, entries)
            return entries
        task = asyncio.create_task(load())
        feed_pending[pending_key] = task
        def finished(done):
            feed_pending.pop(pending_key, None)
            if not done.cancelled():
                done.exception()  # Retrieve errors even if the requesting tab closed.
        task.add_done_callback(finished)
    return await asyncio.shield(task)


@app.middleware('http')
async def local_guard(request: Request, call_next):
    # Host validation defeats DNS rebinding; no CORS; mutations require per-process CSRF.
    if request.headers.get('host') not in ('127.0.0.1:8765', 'localhost:8765'):
        return JSONResponse({'detail': 'Use http://127.0.0.1:8765 on this PC.'}, 403)
    origin = request.headers.get('origin')
    if origin and origin not in (BASE, 'http://localhost:8765'):
        return JSONResponse({'detail': 'Foreign origin blocked.'}, 403)
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        if not secrets.compare_digest(request.headers.get('x-midnight-token', ''), CSRF):
            return JSONResponse({'detail': 'Reload the dashboard before making changes.'}, 403)
        if int(request.headers.get('content-length', '0')) > 2_000_000:
            return JSONResponse({'detail': 'Maximum request size is 2 MB.'}, 413)
    response = await call_next(request)
    # Public source assets may be retained and revalidated with ETag/Last-Modified.
    # HTML, service worker updates and all API/personal responses stay uncached.
    static_asset = (request.url.path.startswith('/static/') and request.url.path != '/static/index.html'
                    and (200 <= response.status_code < 300 or response.status_code == 304))
    response.headers.update({'Cache-Control': 'no-cache' if static_asset else 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; media-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"})
    return response


class Settings(BaseModel):
    plug_ip: str = '192.168.18.154'
    plug_enabled: bool = False
    spotify_client_id: str = ''
    calendar_url: str = ''
    feeds: list[str] = Field(default_factory=list, max_length=12)
    units: str = 'fahrenheit'

    @field_validator('plug_ip')
    @classmethod
    def private_ip(cls, value):
        ip = ipaddress.ip_address(value)
        if ip.version != 4 or not any(ip in ipaddress.ip_network(n) for n in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')):
            raise ValueError('Use a private LAN IPv4 address.')
        return str(ip)

    @field_validator('spotify_client_id')
    @classmethod
    def client_id(cls, value):
        if value and not re.fullmatch(r'[a-fA-F0-9]{32}', value):
            raise ValueError('Spotify Client ID must be 32 hexadecimal characters.')
        return value

    @field_validator('calendar_url')
    @classmethod
    def calendar(cls, value):
        if value:
            validate_url(value)
        return value

    @field_validator('feeds')
    @classmethod
    def feeds_valid(cls, values):
        for value in values:
            validate_url(value)
        return list(dict.fromkeys(values))

    @field_validator('units')
    @classmethod
    def unit(cls, value):
        if value not in ('fahrenheit', 'celsius'):
            raise ValueError('Choose fahrenheit or celsius.')
        return value


def validate_url(url):
    p = urlsplit(url)
    if len(url) > 2048 or p.scheme != 'https' or not p.hostname or p.username or p.password or p.port not in (None, 443):
        raise ValueError('Use a public HTTPS URL with no login or custom port.')
    return p


class PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, host, address):
        super().__init__(host, timeout=12, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        raw = socket.create_connection((self.address, 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except Exception:
            raw.close()
            raise


def public_fetch(url, allow_html=False):
    """HTTPS only; public DNS addresses only; pin each connection; recheck redirects."""
    for _ in range(4):
        p = validate_url(url)
        addresses = socket.getaddrinfo(p.hostname, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise ValueError('Private, loopback and reserved feed servers are blocked.')
        conn = PinnedHTTPS(p.hostname, addresses[0][4][0])
        try:
            path = p.path or '/'
            if p.query:
                path += '?' + p.query
            conn.request('GET', path, headers={'User-Agent': 'MidnightDashboard/1.0', 'Accept-Encoding': 'identity'})
            response = conn.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                url = urljoin(url, response.getheader('Location', ''))
                continue
            if response.status != 200:
                raise ValueError(f'Source returned HTTP {response.status}.')
            body = response.read(2_000_001)
            if len(body) > 2_000_000:
                raise ValueError('Source exceeds 2 MB.')
            checked = re.sub(br'<!doctype\s+html\s*>', b'', body, flags=re.I) if allow_html else body
            if b'<!DOCTYPE' in checked.upper() or b'<!ENTITY' in checked.upper():
                raise ValueError('XML declarations with entities are not supported.')
            return body
        finally:
            conn.close()
    raise ValueError('Too many redirects.')


@app.get('/api/bootstrap')
async def bootstrap():
    return {'csrf': CSRF, 'settings': config(), 'spotify_connected': bool(read_json('spotify.json', {}).get('refresh_token')),
            'calendar_imported': (DATA / 'calendar.ics').exists()}


@app.post('/api/settings')
async def settings(body: Settings):
    old = config()
    save_json('settings.json', body.model_dump())
    invalidate_cache()
    if old['spotify_client_id'] != body.spotify_client_id:
        (DATA / 'spotify.json').unlink(missing_ok=True)
        OAUTH.clear()
    return {'ok': True}



class WallpaperPreferences(BaseModel):
    key: str | None = Field(default=None, max_length=200)
    interval: int = 30
    quality: str = 'hd'

    @field_validator('key')
    @classmethod
    def valid_key(cls, value):
        if value is not None and value.strip() and not re.fullmatch(r'\d{1,12}-[A-Za-z0-9]{20,100}', value.strip()):
            raise ValueError('Paste a valid Pixabay API key, or leave the field empty to keep it.')
        return value

    @field_validator('interval')
    @classmethod
    def valid_interval(cls, value):
        if value not in (15, 30, 60, 1440):
            raise ValueError('Choose 15, 30, 60 or 1440 minutes.')
        return value

    @field_validator('quality')
    @classmethod
    def valid_quality(cls, value):
        if value not in ('4k', 'hd'):
            raise ValueError('Choose 4k or hd.')
        return value


@app.get('/api/wallpaper/settings')
async def wallpaper_preferences():
    return wallpapers.public_preferences()


@app.post('/api/wallpaper/settings')
async def save_wallpaper_preferences(body: WallpaperPreferences):
    return await wallpapers.save(body.key, body.interval, body.quality)


@app.get('/api/wallpaper')
async def wallpaper_scene(theme: str = 'nature'):
    if theme not in ('nature', 'rain'):
        raise HTTPException(422, 'Choose nature or rain.')
    return await wallpapers.scene(theme)


@app.post('/api/wallpaper/next')
async def next_wallpaper(theme: str = 'nature'):
    if theme not in ('nature', 'rain'):
        raise HTTPException(422, 'Choose nature or rain.')
    try:
        return await wallpapers.advance(theme)
    except ValueError as error:
        raise HTTPException(409, str(error))


@app.get('/api/wallpaper/media/{filename}')
async def wallpaper_media(filename: str):
    path = wallpapers.media(filename)
    if path is None:
        raise HTTPException(404, 'Scene not found.')
    return FileResponse(path, media_type='video/mp4')


@app.post('/api/spotify/connect')
async def spotify_connect():
    client = config()['spotify_client_id']
    if not client:
        raise HTTPException(400, 'Add your Spotify Client ID in settings first.')
    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
    OAUTH.clear()
    OAUTH[state] = (verifier, time.time() + 600, client)
    return {'url': 'https://accounts.spotify.com/authorize?' + urlencode({'client_id': client,
        'response_type': 'code', 'redirect_uri': CALLBACK, 'state': state, 'code_challenge_method': 'S256',
        'code_challenge': challenge, 'scope': 'user-read-playback-state user-read-currently-playing user-modify-playback-state'})}


async def token_exchange(data):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post('https://accounts.spotify.com/api/token', data=data)
    if r.status_code != 200:
        raise HTTPException(401, 'Spotify authorization expired or was rejected. Connect again.')
    token = r.json()
    token['expires_at'] = time.time() + token.get('expires_in', 3600) - 60
    return token


@app.get('/api/spotify/callback')
async def spotify_callback(state: str = '', code: str = '', error: str = ''):
    pending = OAUTH.pop(state, None)
    if not pending or pending[1] < time.time():
        raise HTTPException(400, 'Invalid or expired Spotify sign-in. Start again from the dashboard.')
    if error or not code:
        return RedirectResponse('/?spotify=denied', status_code=303)
    token = await token_exchange({'grant_type': 'authorization_code', 'client_id': pending[2],
        'code': code, 'redirect_uri': CALLBACK, 'code_verifier': pending[0]})
    save_json('spotify.json', token)
    return RedirectResponse('/?spotify=connected', status_code=303)


async def spotify_request(method, path, *, json_body=None):
    global spotify_retry_at
    if time.time() < spotify_retry_at:
        raise HTTPException(429, f'Spotify rate limit. Retry in {max(1, int(spotify_retry_at-time.time()))} seconds.')
    async with spotify_lock:
        token = read_json('spotify.json', {})
        if not token:
            raise HTTPException(401, 'Connect Spotify in settings.')
        if token.get('expires_at', 0) <= time.time():
            fresh = await token_exchange({'grant_type': 'refresh_token', 'client_id': config()['spotify_client_id'],
                'refresh_token': token.get('refresh_token', '')})
            token.update(fresh)
            save_json('spotify.json', token)
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.request(method, 'https://api.spotify.com/v1/me/player' + path,
                headers={'Authorization': 'Bearer ' + token['access_token']}, **({'json': json_body} if json_body is not None else {}))
        if r.status_code == 429:
            try:
                wait = max(1, int(r.headers.get('Retry-After', '30')))
            except ValueError:
                wait = 30
            spotify_retry_at = time.time() + wait
            raise HTTPException(429, f'Spotify rate limit. Retry in {wait} seconds.')
        errors = {401: 'Spotify sign-in expired. Reconnect in settings.',
            403: 'Spotify denied access. Check Premium, app allowlist, scopes and development-mode endpoint access.',
            404: 'No active Spotify player. Open Spotify and start a song on your PC or phone first.'}
        if r.status_code >= 400:
            raise HTTPException(r.status_code, errors.get(r.status_code, f'Spotify returned HTTP {r.status_code}. Try again later.'))
        return None if r.status_code == 204 else r.json()


def release_year(item):
    # Spotify supplies the date for this album/release, not guaranteed original recording year.
    value = item.get('album', {}).get('release_date', item.get('release_date', ''))
    return value[:4] if re.match(r'^\d{4}(?:-|$)', value or '') else None


@app.get('/api/spotify')
async def spotify_state():
    data = await spotify_request('GET', '')
    if not data or not data.get('item'):
        return {'active': False}
    item = data['item']
    return {'active': True, 'playing': data.get('is_playing', False), 'title': item.get('name', 'Unknown title'),
        'artist': ', '.join(a['name'] for a in item.get('artists', [])) or item.get('show', {}).get('name', ''),
        'album': item.get('album', {}).get('name', ''),
        'release_year': release_year(item),
        'image': next(iter(item.get('album', item).get('images', [])), {}).get('url'),
        'duration': item.get('duration_ms', 0), 'progress': data.get('progress_ms', 0),
        'device': data.get('device', {}).get('name', 'Spotify'),
        'volume': data.get('device', {}).get('volume_percent'),
        'supports_volume': bool(data.get('device', {}).get('supports_volume', False)),
        'shuffle': bool(data.get('shuffle_state', False)), 'repeat': data.get('repeat_state', 'off'),
        'url': item.get('external_urls', {}).get('spotify', ''), 'type': item.get('type', 'track'),
        'disallows': data.get('actions', {}).get('disallows', {})}


@app.post('/api/spotify/control/{action}')
async def spotify_control(action: str):
    routes = {'play': ('PUT', '/play'), 'pause': ('PUT', '/pause'), 'next': ('POST', '/next'), 'previous': ('POST', '/previous')}
    if action not in routes:
        raise HTTPException(400, 'Unknown playback action.')
    await spotify_request(*routes[action])
    return {'ok': True}


class PlaybackOptions(BaseModel):
    model_config = {'extra': 'forbid'}
    position_ms: int | None = Field(default=None, strict=True, ge=0, le=86400000)
    volume: int | None = Field(default=None, strict=True, ge=0, le=100)
    shuffle: bool | None = Field(default=None, strict=True)
    repeat: Literal['off', 'context', 'track'] | None = None

    @model_validator(mode='after')
    def one_action(self):
        if sum(value is not None for value in self.model_dump().values()) != 1:
            raise ValueError('Send one playback change at a time.')
        return self


@app.post('/api/spotify/options')
async def spotify_options(body: PlaybackOptions):
    if body.position_ms is not None:
        # Spotify seeks past the track into the next song; keep this action within the current item.
        current = await spotify_request('GET', '')
        if not current or not current.get('item'):
            raise HTTPException(409, 'Start a song in Spotify first.')
        if current.get('actions', {}).get('disallows', {}).get('seeking'):
            raise HTTPException(409, 'Spotify does not allow seeking in this item.')
        length = current['item'].get('duration_ms', 0)
        position = min(body.position_ms, max(0, length-1))
        await spotify_request('PUT', '/seek?' + urlencode({'position_ms': position}))
    elif body.volume is not None:
        await spotify_request('PUT', '/volume?' + urlencode({'volume_percent': body.volume}))
    elif body.shuffle is not None:
        await spotify_request('PUT', '/shuffle?' + urlencode({'state': str(body.shuffle).lower()}))
    else:
        await spotify_request('PUT', '/repeat?' + urlencode({'state': body.repeat}))
    return {'ok': True}


@app.post('/api/spotify/disconnect')
async def spotify_disconnect():
    (DATA / 'spotify.json').unlink(missing_ok=True)
    OAUTH.clear()
    return {'ok': True}


class PlugState(BaseModel):
    on: bool


async def use_plug(on=None):
    cfg = config()
    if not cfg['plug_enabled']:
        raise HTTPException(409, 'Enable local plug access in settings before connecting.')
    async with plug_lock:
        device = None
        try:
            credentials = None
            if os.getenv('KASA_USERNAME') and os.getenv('KASA_PASSWORD'):
                credentials = Credentials(os.environ['KASA_USERNAME'], os.environ['KASA_PASSWORD'])
            device = await Discover.discover_single(cfg['plug_ip'], credentials=credentials, timeout=4)
            if device is None:
                raise RuntimeError('Not found')
            await device.update()
            if on is not None:
                if on:
                    await device.turn_on()
                else:
                    await device.turn_off()
                await device.update()
            return {'on': bool(device.is_on), 'alias': device.alias, 'ip': cfg['plug_ip']}
        except Exception:
            raise HTTPException(503, 'Plug unavailable. Check LAN IP, same Wi-Fi/LAN and firewall. New firmware may need KASA_USERNAME and KASA_PASSWORD environment variables. State is unknown; do not assume a command succeeded.')
        finally:
            if device is not None:
                try:
                    await device.disconnect()
                except Exception:
                    pass


@app.get('/api/plug')
async def plug_state():
    return await use_plug()


@app.post('/api/plug')
async def plug_set(body: PlugState):
    # Explicit desired state: never a race-prone blind toggle, no retry or startup writes.
    return await use_plug(body.on)


@app.get('/api/weather')
async def weather(lat: float, lon: float, refresh: bool = False):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(400, 'Invalid location.')
    unit = config()['units']
    key = ('weather', round(lat, 3), round(lon, 3), unit)
    if not refresh and key in CACHE and CACHE[key][0] > time.time():
        return CACHE[key][1]
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get('https://api.open-meteo.com/v1/forecast', params={'latitude': lat, 'longitude': lon,
            'current': 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m',
            'hourly': 'temperature_2m,weather_code,precipitation_probability',
            'daily': 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,wind_speed_10m_max,uv_index_max,precipitation_sum',
            'temperature_unit': unit, 'wind_speed_unit': 'mph' if unit == 'fahrenheit' else 'kmh',
            'timezone': 'auto', 'timeformat': 'unixtime', 'forecast_days': 7})
    if r.status_code != 200:
        raise HTTPException(502, 'Weather service unavailable. Try again later.')
    data = r.json()
    CACHE[key] = (time.time() + 900, data)
    return data


@app.get('/api/weather/place')
async def weather_place(lat: float, lon: float):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(400, 'Invalid location.')
    try:
        return await asyncio.to_thread(nearest_town, round(lat, 5), round(lon, 5))
    except (OSError, ValueError):
        raise HTTPException(503, 'Town lookup unavailable. Choose a town with city search.')


@app.get('/api/weather/search')
async def weather_search(q: str):
    q = q.strip()
    if not 2 <= len(q) <= 80:
        raise HTTPException(400, 'Enter a city name between 2 and 80 characters.')
    async with httpx.AsyncClient(timeout=12) as client:
        r = await client.get('https://geocoding-api.open-meteo.com/v1/search',
            params={'name': q, 'count': 6, 'language': 'en', 'format': 'json'})
    if r.status_code != 200:
        raise HTTPException(502, 'City search unavailable. Try again later.')
    return {'results': [{'name': place['name'], 'region': place.get('admin1', ''),
        'country': place.get('country', ''), 'latitude': place['latitude'], 'longitude': place['longitude']}
        for place in r.json().get('results', [])]}


def safe_link(value):
    return value if urlsplit(value or '').scheme in ('http', 'https') else ''


class FeedImageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag.lower() == 'img' and attrs.get('src'):
            self.images.append(attrs['src'])


def feed_image(entry, feed_url):
    candidates = []
    for media in entry.get('media_thumbnail', []) + entry.get('media_content', []):
        if media.get('url') and (media.get('medium') in (None, 'image') and not media.get('type', '').startswith(('audio/', 'video/'))):
            candidates.append(media['url'])
    candidates += [e['href'] for e in entry.get('enclosures', []) if e.get('type', '').startswith('image/') and e.get('href')]
    parser = FeedImageParser()
    for content in entry.get('content', []) + [{'value': entry.get('summary', '')}]:
        parser.feed(content.get('value', ''))
    candidates += parser.images
    for value in candidates:
        value = urljoin(feed_url, value)
        try:
            validate_url(value)
            return value
        except ValueError:
            continue
    return None


class PlainTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
        elif tag in ('p', 'br', 'div', 'li', 'h1', 'h2', 'h3') and not self.skip:
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)
        elif tag in ('p', 'div', 'li') and not self.skip:
            self.parts.append('\n')

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def plain_text(html):
    parser = PlainTextParser()
    parser.feed(html or '')
    return '\n\n'.join(line.strip() for line in ''.join(parser.parts).splitlines() if line.strip())


def news_fetch(url):
    parsed = feedparser.parse(public_fetch(url))
    if not parsed.entries:
        raise ValueError('No RSS or Atom articles found.')
    return [{'title': e.get('title', 'Untitled'), 'url': safe_link(e.get('link', '')),
             'source': parsed.feed.get('title', urlsplit(url).hostname),
             'image': feed_image(e, url),
             'summary': plain_text('\n'.join(c.get('value', '') for c in e.get('content', [])) or e.get('summary', ''))[:100000],
             'published': e.get('published', e.get('updated', ''))} for e in parsed.entries[:10]]


@app.get('/api/news/image')
async def news_image(url: str):
    # Only proxy images present in a configured, fetched feed. No arbitrary URL relay.
    permitted = {article.get('image') for feed in config()['feeds']
                 for article in CACHE.get(('rss', feed), (0, []))[1]}
    if url not in permitted:
        raise HTTPException(404, 'Preview unavailable.')
    try:
        body = await asyncio.to_thread(public_fetch, url)
    except Exception:
        raise HTTPException(502, 'Preview unavailable.')
    if body.startswith(b'\xff\xd8\xff'):
        mime = 'image/jpeg'
    elif body.startswith(b'\x89PNG\r\n\x1a\n'):
        mime = 'image/png'
    elif body.startswith((b'GIF87a', b'GIF89a')):
        mime = 'image/gif'
    elif body.startswith(b'RIFF') and body[8:12] == b'WEBP':
        mime = 'image/webp'
    else:
        raise HTTPException(415, 'Unsupported preview format.')
    return Response(body, media_type=mime)


@app.get('/api/news')
async def news():
    feeds = config()['feeds']
    articles, errors = [], []
    results = await asyncio.gather(*(cached_feed(url) for url in feeds), return_exceptions=True)
    for url, result in zip(feeds, results):
        if isinstance(result, BaseException):
            errors.append({'source': urlsplit(url).hostname, 'message': 'Feed could not load. Check the HTTPS RSS/Atom URL or try again later.'})
        else:
            articles.extend(result)
    return {'articles': articles[:120], 'errors': errors}


def article_text(url):
    raw = public_fetch(url, allow_html=True)
    # Do not attempt to uncover subscription-only content from publisher markup.
    if re.search(br'"isAccessibleForFree"\s*:\s*(?:false|"false")', raw, flags=re.I):
        return None
    text = trafilatura.extract(raw, url=url, include_comments=False, include_tables=False,
        include_images=False, include_links=False, output_format='txt', favor_precision=True)
    if text:
        text = '\n'.join(line for line in text.splitlines() if not re.fullmatch(r'[-\s]*(Published|Updated|Share|Copy link)[\s:]*', line, flags=re.I))
    return text


@app.get('/api/news/article')
async def news_article(url: str):
    article = next((a for feed in config()['feeds'] for a in CACHE.get(('rss', feed), (0, []))[1]
                    if a.get('url') == url and url), None)
    if article is None:
        raise HTTPException(404, 'Refresh the news feed and choose a current article.')
    key = ('article', url)
    if key in CACHE and CACHE[key][0] > time.time():
        return CACHE[key][1]
    text = None
    try:
        text = await asyncio.to_thread(article_text, url)
    except Exception:
        pass
    extracted = bool(text and len(text.strip()) >= 120)
    content = (text if extracted else article.get('summary', '')) or 'The publisher did not provide readable text for this article.'
    result = {'title': article['title'], 'source': article.get('source', ''),
        'published': article.get('published', ''), 'url': url, 'content': content[:200000],
        'mode': 'article' if extracted else 'feed',
        'notice': '' if extracted else 'Full article unavailable. Showing the text supplied by the RSS feed.'}
    # Bound article cache separately so browsing does not retain an unlimited reading history.
    for old in [k for k in CACHE if k[0] == 'article'][:-23]:
        CACHE.pop(old, None)
    CACHE[key] = (time.time() + 1800, result)
    return result


def calendar_events(raw, tz_name, start_date=None, end_date=None):
    tz = ZoneInfo(tz_name)
    now = datetime.now(tz)
    calendar = Calendar.from_ical(raw)
    window_start = datetime.combine(start_date, datetime.min.time(), tzinfo=tz) if start_date else now - timedelta(days=1)
    window_end = datetime.combine(end_date, datetime.min.time(), tzinfo=tz) if end_date else now + timedelta(days=14)
    events = recurring_ical_events.of(calendar).between(window_start, window_end)
    result = []
    for e in events:
        if str(e.get('STATUS', '')) == 'CANCELLED':
            continue
        start = e.decoded('DTSTART')
        all_day = not isinstance(start, datetime)
        duration = e.decoded('DURATION', timedelta(days=1) if all_day else timedelta(hours=1))
        end = e.decoded('DTEND', start + duration)
        def aware(value):
            if not isinstance(value, datetime):
                return datetime.combine(value, datetime.min.time(), tzinfo=tz)
            return value.replace(tzinfo=tz) if value.tzinfo is None else value.astimezone(tz)
        start, end = aware(start), aware(end)
        if end <= (window_start if start_date else now):
            continue
        result.append({'title': str(e.get('SUMMARY', 'Untitled')), 'start': start.isoformat(), 'end': end.isoformat(),
            'all_day': all_day, 'location': str(e.get('LOCATION', '')), 'description': str(e.get('DESCRIPTION', ''))[:6000]})
    return sorted(result, key=lambda e: datetime.fromisoformat(e['start']))[:2001 if start_date else 30]


class CalendarImport(BaseModel):
    content: str = Field(max_length=1_500_000)


@app.post('/api/calendar/import')
async def calendar_import(body: CalendarImport):
    try:
        cal = Calendar.from_ical(body.content)
        if cal.name != 'VCALENDAR' or cal.errors:
            raise ValueError()
        for event in cal.walk('VEVENT'):
            if str(event.get('STATUS', '')) == 'CANCELLED' and 'RECURRENCE-ID' in event:
                continue
            if event.errors or 'DTSTART' not in event or not isinstance(event.decoded('DTSTART'), (date, datetime)):
                raise ValueError()
            if 'DTEND' in event and not isinstance(event.decoded('DTEND'), (date, datetime)):
                raise ValueError()
        # Exercise recurrence parsing before replacing a working snapshot.
        calendar_events(body.content, 'UTC')
    except Exception:
        raise HTTPException(400, 'Choose a valid .ics iCalendar file.')
    target = DATA / 'calendar.ics'
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=DATA, suffix='.ics', delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(body.content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    try:
        target.chmod(0o600)
    except OSError:
        pass
    cfg = config()
    cfg['calendar_url'] = ''
    save_json('settings.json', cfg)
    invalidate_cache()
    return {'ok': True, 'source': 'Imported file'}


@app.post('/api/calendar/clear')
async def calendar_clear():
    (DATA / 'calendar.ics').unlink(missing_ok=True)
    cfg = config()
    cfg['calendar_url'] = ''
    save_json('settings.json', cfg)
    invalidate_cache()
    return {'ok': True}


@app.get('/api/calendar')
async def calendar(tz: str = 'UTC', start: str | None = None, end: str | None = None):
    start_date = end_date = None
    if start is not None or end is not None:
        try:
            start_date, end_date = date.fromisoformat(start or ''), date.fromisoformat(end or '')
            if not 1 <= (end_date - start_date).days <= 93:
                raise ValueError()
        except ValueError:
            raise HTTPException(400, 'Choose a calendar range of 1–93 days with both start and end dates.')
    cfg = config()
    try:
        ZoneInfo(tz)
        url = cfg['calendar_url']
        if url:
            key = ('ics', url)
            if key not in CACHE or CACHE[key][0] < time.time():
                CACHE[key] = (time.time() + 900, await asyncio.to_thread(public_fetch, url))
            raw = CACHE[key][1]
        elif (DATA / 'calendar.ics').exists():
            raw = (DATA / 'calendar.ics').read_bytes()
        else:
            return {'configured': False, 'events': []}
        events = await asyncio.to_thread(calendar_events, raw, tz, start_date, end_date)
        return {'configured': True, 'events': events[:2000], 'truncated': len(events) > 2000, 'source': 'Subscription' if url else 'Imported file'}
    except Exception:
        raise HTTPException(502, 'Calendar could not load. Check the iCalendar source and timezone. Imported files are snapshots; subscriptions refresh every 15 minutes.')


@app.exception_handler(httpx.RequestError)
async def network_error(request, exc):
    return JSONResponse({'detail': 'Network unavailable. Check your connection and try again.'}, 502)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    if request.url.path == '/api/wallpaper/settings':
        # Validation errors must not reflect even a mistyped credential to the client.
        return JSONResponse({'detail': [{key: error[key] for key in ('type', 'loc', 'msg')}
                                        for error in exc.errors()]}, 422)
    return await request_validation_exception_handler(request, exc)


app.mount('/static', StaticFiles(directory=ROOT / 'static'), name='static')


@app.get('/sw.js')
async def service_worker():
    return FileResponse(ROOT / 'sw.js', media_type='application/javascript')


@app.get('/app')
@app.get('/')
async def index():
    return FileResponse(ROOT / 'static' / 'index.html')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8765, access_log=False)
