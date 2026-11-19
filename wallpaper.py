"""Bounded Pixabay video cache. Credentials stay in local, private settings."""
import asyncio
import hashlib
import json
import math
import os
from pathlib import Path
import re
import time
from urllib.parse import urlsplit

import httpx

LIMIT = 256 * 1024 * 1024
CATALOG_TTL = 86400
PROVIDER = 'pixabay'
# Bundled offline footage retains its original credits; its provider is never contacted.
FALLBACKS = json.loads((Path(__file__).resolve().parent / 'static/wallpapers/scenes.json').read_text('utf-8'))['scenes']


class WallpaperError(ValueError):
    """Only locally written messages may appear in public responses."""


def trusted(url, hosts):
    try:
        parts = urlsplit(url)
        return (parts.scheme == 'https' and parts.hostname in hosts and not parts.username
                and not parts.password and parts.port in (None, 443) and not parts.query and not parts.fragment)
    except (TypeError, ValueError):
        return False


def select_video(videos, slot, quality):
    candidates = []
    for video in videos:
        if not isinstance(video, dict) or not trusted(video.get('pageURL', ''), {'pixabay.com', 'www.pixabay.com'}):
            continue
        duration = video.get('duration', 0)
        if not isinstance(duration, (int, float)) or not math.isfinite(duration) or not 60 <= duration <= 600:
            continue
        renditions = video.get('videos', {})
        if not isinstance(renditions, dict):
            continue
        files = []
        for file in renditions.values():
            if not isinstance(file, dict) or not trusted(file.get('url', ''), {'cdn.pixabay.com'}):
                continue
            width, height = file.get('width'), file.get('height')
            if (not isinstance(width, int) or not isinstance(height, int)
                    or not 1920 <= width <= 4096 or not 1080 <= height <= width
                    or not urlsplit(file['url']).path.endswith('.mp4')):
                continue
            files.append({'link': file['url'], 'width': width, 'height': height, 'size': file.get('size', 0)})
        if not files:
            continue
        if quality == 'hd':
            files = [file for file in files if file['width'] == 1920 and file['height'] == 1080]
            if not files:
                continue
        target = 3840 if quality == '4k' else 1920
        chosen = min(files, key=lambda f: abs(f['width'] - target))
        candidates.append((video, chosen))
    if not candidates:
        raise WallpaperError('No 1–10 minute landscape clips at 1080p or above are available. Using the saved scene.')
    return candidates[slot % len(candidates)]


class WallpaperService:
    def __init__(self, data):
        self.data = data
        self.lock = asyncio.Lock()
        self.catalogs = {}
        self.retry_at = {}

    def read(self, name, default):
        try:
            value=json.loads((self.data()/name).read_text())
            return value if isinstance(value,type(default)) else default
        except (OSError, ValueError):
            return default

    def write(self, name, value):
        path = self.data() / name
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix('.tmp')
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream)
        os.replace(temp, path)

    def preferences(self):
        saved = self.read('wallpaper.json', {})
        # Never reuse a legacy provider's generic key for Pixabay.
        return {'provider': PROVIDER, 'key': saved.get('pixabay_key', ''),
                'interval': saved.get('interval', 30),
                'quality': saved.get('quality', 'hd') if saved.get('provider') == PROVIDER else 'hd',
                'offsets': saved.get('offsets', {})}

    def public_preferences(self):
        prefs = self.preferences()
        return {'provider': PROVIDER, 'configured': bool(prefs['key']), 'interval': prefs['interval'], 'quality': prefs['quality']}

    def write_preferences(self, prefs):
        self.write('wallpaper.json', {'provider': PROVIDER, 'pixabay_key': prefs['key'],
                   'interval': prefs['interval'], 'quality': prefs['quality'], 'offsets': prefs.get('offsets', {})})

    async def save(self, key, interval, quality):
        async with self.lock:
            prefs = self.preferences()
            if key is not None:
                prefs['key'] = key.strip()
            prefs.update(interval=interval, quality=quality)
            self.write_preferences(prefs)
            self.catalogs.clear()
            self.retry_at.clear()
        return self.public_preferences()

    async def catalog_page(self, query, page, key):
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
            response = await client.get('https://pixabay.com/api/videos/', params={
                'key': key, 'q': query, 'category': 'nature', 'video_type': 'film',
                'safesearch': 'true', 'min_width': 1920, 'min_height': 1080,
                'per_page': 200, 'page': page})
        # Never expose response bodies, HTTP exception strings or credential-bearing URLs.
        if response.status_code in (400, 401, 403):
            raise WallpaperError('Pixabay rejected this key. Replace it in Settings.')
        if response.status_code == 429:
            raise WallpaperError('Pixabay request limit reached. Your saved scene is still available.')
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict) or not isinstance(payload.get('hits'), list):
            raise WallpaperError('Pixabay returned an unreadable catalog. Your saved scene is still available.')
        return payload

    async def catalog(self, theme, key, *, expand=False, quality='hd'):
        fingerprint = hashlib.sha256(key.encode()).hexdigest()
        cached = self.catalogs.get(theme) or self.read('wallpapers/catalog-' + theme + '.json', {})
        query = 'nature' if theme == 'nature' else 'rain'

        def remember():
            # Each newly fetched page remains cached for at least 24 hours.
            cached['expires'] = time.time() + CATALOG_TTL
            self.write('wallpapers/catalog-' + theme + '.json', cached)
            self.catalogs[theme] = cached

        if not (isinstance(cached, dict) and cached.get('fingerprint') == fingerprint
                and cached.get('expires', 0) > time.time()):
            payload = await self.catalog_page(query, 1, key)
            cached = {'fingerprint': fingerprint, 'videos': payload['hits'],
                      'primary_count': len(payload['hits']),
                      'total_hits': payload.get('totalHits', len(payload['hits']))}
            remember()
        self.catalogs[theme] = cached
        videos = cached['videos']

        def usable_count():
            pages = set()
            for video in videos:
                try:
                    pages.add(select_video([video], 0, quality)[0]['pageURL'])
                except WallpaperError:
                    pass
            return len(pages)

        # Only a manual request expands a sparse catalog. Most popular results
        # are shorter than our one-minute minimum, so page one may contain only
        # a single eligible background even though hundreds of hits were saved.
        if not expand or quality in cached.get('expanded_for', []) or usable_count() >= 4:
            return videos
        searched = cached.setdefault('searched', [query + ':1'])
        terms = ['landscape', 'forest', 'mountains'] if theme == 'nature' else ['rain forest', 'rain window']
        searches = [(query, 2), (query, 3)] + [(term, 1) for term in terms]
        for term, page in searches:
            if usable_count() >= 4:
                break
            search = term + ':' + str(page)
            if search in searched:
                continue
            if page > 1 and (cached.get('primary_count', min(len(videos), 200)) < 200
                             or cached.get('total_hits', 500) <= (page - 1) * 200):
                continue
            payload = await self.catalog_page(term, page, key)
            videos.extend(payload['hits'])
            searched.append(search)
            if term == query:
                cached['total_hits'] = payload.get('totalHits', (page - 1) * 200 + len(payload['hits']))
            remember()
        cached.setdefault('expanded_for', []).append(quality)
        remember()
        return videos

    async def download(self, url, path):
        if not trusted(url, {'cdn.pixabay.com'}) or not urlsplit(url).path.endswith('.mp4'):
            raise WallpaperError('The video download source is not supported.')
        temp = path.with_suffix('.part')
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(90, connect=15), follow_redirects=False) as client:
                async with client.stream('GET', url) as response:
                    response.raise_for_status()
                    if response.headers.get('content-type', '').split(';')[0] not in ('video/mp4', 'application/octet-stream'):
                        raise WallpaperError('Unexpected video format')
                    if int(response.headers.get('content-length', '0')) > LIMIT:
                        raise WallpaperError('Video is too large')
                    size = 0
                    with temp.open('wb') as stream:
                        async for chunk in response.aiter_bytes():
                            size += len(chunk)
                            if size > LIMIT:
                                raise WallpaperError('Video is too large')
                            stream.write(chunk)
                    if size < 1024:
                        raise WallpaperError('Incomplete video')
                    with temp.open('rb') as stream:
                        if stream.read(12)[4:8] != b'ftyp':
                            raise WallpaperError('Invalid MP4')
            os.replace(temp, path)
        finally:
            temp.unlink(missing_ok=True)

    async def scene(self, theme, *, advance=False):
        async with self.lock:
            prefs = self.preferences()
            fallback = dict(FALLBACKS[theme], source='included', configured=bool(prefs['key']), interval=prefs['interval'])
            if not (Path(__file__).resolve().parent/fallback['src'].lstrip('/')).is_file():
                fallback.update(src='',source='still',width=0,height=0,duration=0,title='Still background')
            name = f"pixabay-{theme}-{prefs['quality']}"
            manifest = self.read('wallpapers/manifest.json', {})
            saved = manifest.get(name)
            if saved and (saved.get('source') != PROVIDER or saved.get('duration', 0) < 60
                          or not re.fullmatch(r'pixabay-(nature|rain)-(4k|hd)-[a-f0-9]{16}', saved.get('file', ''))
                          or not (self.data() / 'wallpapers' / (saved['file'] + '.mp4')).is_file()):
                saved = None
            if not prefs['key'] and advance:
                raise WallpaperError('Add a Pixabay key to rotate scenes.')
            if not prefs['key']:
                return dict(saved or fallback, configured=False, interval=prefs['interval'], notice='Add a Pixabay key in Settings to rotate scenes.')
            slot = int(time.time() // (prefs['interval'] * 60)) + prefs.get('offsets', {}).get(theme, 0)
            if advance:
                slot = (saved.get('slot', slot) if saved else slot) + 1
            if not advance and saved and saved.get('slot') == slot:
                return dict(saved, configured=True, interval=prefs['interval'], notice='')
            retry = self.retry_at.get(name)
            if retry and retry[0] > time.time():
                return dict(saved or fallback, notice=retry[1], configured=True, interval=prefs['interval'])
            try:
                videos = await self.catalog(theme, prefs['key'], expand=advance, quality=prefs['quality'])
                video, file = select_video(videos, slot, prefs['quality'])
                if advance and saved:
                    # Skip duplicate catalog entries and the current footage, even
                    # when the automatic interval changed since the last click.
                    for step in range(len(videos)):
                        video, file = select_video(videos, slot + step, prefs['quality'])
                        fingerprint = hashlib.sha256(file['link'].encode()).hexdigest()[:16]
                        if video['pageURL'] != saved.get('page') and not saved['file'].endswith(fingerprint):
                            slot += step
                            break
                    else:
                        return dict(saved, configured=True, interval=prefs['interval'],
                                    notice='No other background is available in this catalog. Your current background is still showing.')
                async def prepare(selected):
                    fingerprint = hashlib.sha256(selected['link'].encode()).hexdigest()[:16]
                    filename = name + '-' + fingerprint
                    path = self.data() / 'wallpapers' / (filename + '.mp4')
                    if not path.is_file():
                        if isinstance(selected['size'], (int, float)) and selected['size'] > LIMIT:
                            raise WallpaperError('Video is too large')
                        await self.download(selected['link'], path)
                    return filename, path
                try:
                    filename, path = await prepare(file)
                except WallpaperError as error:
                    if str(error) != 'Video is too large':
                        raise
                    _, smaller = select_video([video], 0, 'hd')
                    if smaller['link'] == file['link']:
                        raise
                    file = smaller
                    filename, path = await prepare(file)
                scene = {'src': '/api/wallpaper/media/' + filename, 'poster': FALLBACKS[theme]['poster'],
                         'file': filename, 'source': PROVIDER, 'author': str(video.get('user', 'Pixabay creator'))[:100],
                         'page': video['pageURL'], 'width': file['width'], 'height': file['height'], 'duration': video['duration'], 'slot': slot}
                manifest[name] = scene
                self.write('wallpapers/manifest.json', manifest)
                if advance:
                    prefs.setdefault('offsets', {})[theme] = slot - int(time.time() // (prefs['interval'] * 60))
                    self.write_preferences(prefs)
                # Keep the current and previous clip per theme/quality, so a playing tab never loses its current source.
                keep = {filename}
                if saved:
                    keep.add(saved['file'])
                for old in path.parent.glob(name + '-*.mp4'):
                    if old.stem not in keep:
                        old.unlink(missing_ok=True)
                return dict(scene, configured=True, interval=prefs['interval'], notice='')
            except Exception as error:
                message = str(error) if isinstance(error, WallpaperError) else 'Pixabay is unavailable. Using a locally saved scene.'
                self.retry_at[name] = (time.time() + 1800, message)
                return dict(saved or fallback, notice=message, configured=True, interval=prefs['interval'])

    async def advance(self, theme):
        # Selection and persistence share scene's lock; rapid requests cannot
        # choose the same previous scene or overwrite one another's offsets.
        return await self.scene(theme, advance=True)

    def media(self, filename):
        if not re.fullmatch(r'(pixabay-)?(nature|rain)-(4k|hd)-[a-f0-9]{16}', filename):
            return None
        path = self.data() / 'wallpapers' / (filename + '.mp4')
        return path if path.is_file() else None
