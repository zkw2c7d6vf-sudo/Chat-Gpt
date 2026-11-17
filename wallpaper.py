"""Bounded Pexels background cache. Keys never leave the server except to Pexels' API."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import re
import time
from urllib.parse import urlsplit

import httpx

LIMIT = 256 * 1024 * 1024
FALLBACKS = {
    'nature': {'src': '/static/wallpapers/nature-long.mp4', 'poster': '/static/wallpapers/nature-long.jpg',
               'author': 'Tom Fisk', 'page': 'https://www.pexels.com/video/32329775/', 'width': 3840, 'height': 2160, 'duration': 60.43},
    'rain': {'src': '/static/wallpapers/rain-long.mp4', 'poster': '/static/wallpapers/rain-long.jpg',
             'author': 'Engin Akyurt', 'page': 'https://www.pexels.com/video/11887609/', 'width': 4096, 'height': 2160, 'duration': 59.26},
}


def trusted(url, hosts):
    try:
        parts = urlsplit(url)
        return parts.scheme == 'https' and parts.hostname in hosts and not parts.username and not parts.password and parts.port in (None, 443)
    except (TypeError, ValueError):
        return False


def select_video(videos, slot, quality):
    candidates = []
    for video in videos:
        if not isinstance(video, dict) or not trusted(video.get('url', ''), {'www.pexels.com', 'pexels.com'}):
            continue
        duration = video.get('duration', 0)
        if not isinstance(duration, (int, float)) or not 60 <= duration <= 600:
            continue
        files = [f for f in video.get('video_files', []) if isinstance(f, dict)
                 and f.get('file_type') == 'video/mp4' and trusted(f.get('link', ''), {'videos.pexels.com'})
                 and isinstance(f.get('width'), int) and isinstance(f.get('height'), int)
                 and 1280 <= f['width'] <= 4096 and 0 < f['height'] <= f['width']]
        if not files:
            continue
        target = 3840 if quality == '4k' else 1920
        chosen = min(files, key=lambda f: (abs(f['width'] - target), f.get('fps', 30) or 30))
        candidates.append((video, chosen))
    if not candidates:
        raise ValueError('No longer landscape clips are available. Using the saved scene.')
    return candidates[slot % len(candidates)]


class WallpaperService:
    def __init__(self, data):
        self.data = data
        self.lock = asyncio.Lock()
        self.catalogs = {}
        self.retry_at = {}
        self.next_at = {}

    def read(self, name, default):
        try:
            return json.loads((self.data() / name).read_text())
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
        return {'key': '', 'interval': 30, 'quality': '4k'} | self.read('wallpaper.json', {})

    def public_preferences(self):
        prefs = self.preferences()
        return {'configured': bool(prefs['key']), 'interval': prefs['interval'], 'quality': prefs['quality']}

    async def save(self, key, interval, quality):
        async with self.lock:
            prefs = self.preferences()
            if key is not None:
                prefs['key'] = key.strip()
            prefs.update(interval=interval, quality=quality)
            self.write('wallpaper.json', prefs)
            self.catalogs.clear()
            self.retry_at.clear()
        return self.public_preferences()

    async def catalog(self, theme, key):
        cached = self.catalogs.get(theme)
        if cached and cached[0] > time.time():
            return cached[1]
        query = 'misty forest mountains lake' if theme == 'nature' else 'rain forest landscape'
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
            response = await client.get('https://api.pexels.com/v1/videos/search',
                                        params={'query': query, 'orientation': 'landscape', 'per_page': 50},
                                        headers={'Authorization': key})
        if response.status_code in (401, 403):
            raise ValueError('Pexels rejected this key. Replace it in Settings.')
        if response.status_code == 429:
            raise ValueError('Pexels request limit reached. Your saved scene is still available.')
        response.raise_for_status()
        videos = response.json().get('videos', [])
        self.catalogs[theme] = (time.time() + 21600, videos)
        return videos

    async def download(self, url, path):
        temp = path.with_suffix('.part')
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(90, connect=15), follow_redirects=False) as client:
                async with client.stream('GET', url) as response:
                    response.raise_for_status()
                    if response.headers.get('content-type', '').split(';')[0] not in ('video/mp4', 'application/octet-stream'):
                        raise ValueError('Unexpected video format')
                    if int(response.headers.get('content-length', '0')) > LIMIT:
                        raise ValueError('Video is too large')
                    size = 0
                    with temp.open('wb') as stream:
                        async for chunk in response.aiter_bytes():
                            size += len(chunk)
                            if size > LIMIT:
                                raise ValueError('Video is too large')
                            stream.write(chunk)
                    if size < 1024:
                        raise ValueError('Incomplete video')
                    with temp.open('rb') as stream:
                        if stream.read(12)[4:8] != b'ftyp':
                            raise ValueError('Invalid MP4')
            os.replace(temp, path)
        finally:
            temp.unlink(missing_ok=True)

    async def scene(self, theme):
        async with self.lock:
            prefs = self.preferences()
            fallback = dict(FALLBACKS[theme], source='included', configured=bool(prefs['key']), interval=prefs['interval'])
            if not prefs['key']:
                return dict(fallback, notice='Add a Pexels key in Settings to rotate scenes.')
            name = f"{theme}-{prefs['quality']}"
            manifest = self.read('wallpapers/manifest.json', {})
            saved = manifest.get(name)
            if saved and (saved.get('duration', 0)<60 or not (self.data() / 'wallpapers' / (saved.get('file', '') + '.mp4')).is_file()):
                saved = None
            slot = int(time.time() // (prefs['interval'] * 60)) + prefs.get('offsets', {}).get(theme, 0)
            if saved and saved.get('slot') == slot:
                return dict(saved, configured=True, interval=prefs['interval'], notice='')
            retry = self.retry_at.get(name)
            if retry and retry[0] > time.time():
                return dict(saved or fallback, notice=retry[1], configured=True, interval=prefs['interval'])
            try:
                videos = await self.catalog(theme, prefs['key'])
                video, file = select_video(videos, slot, prefs['quality'])
                async def prepare(selected):
                    fingerprint = hashlib.sha256(selected['link'].encode()).hexdigest()[:16]
                    filename = name + '-' + fingerprint
                    path = self.data() / 'wallpapers' / (filename + '.mp4')
                    if not path.is_file():
                        await self.download(selected['link'], path)
                    return filename, path
                try:
                    filename, path = await prepare(file)
                except ValueError as error:
                    if str(error) != 'Video is too large':
                        raise
                    _, smaller = select_video([video], 0, 'hd')
                    if smaller['link'] == file['link']:
                        raise
                    file = smaller
                    filename, path = await prepare(file)
                scene = {'src': '/api/wallpaper/media/' + filename, 'poster': FALLBACKS[theme]['poster'],
                         'file': filename, 'source': 'pexels', 'author': str(video.get('user', {}).get('name', 'Pexels creator'))[:100],
                         'page': video['url'], 'width': file['width'], 'height': file['height'], 'duration': video['duration'], 'slot': slot}
                manifest[name] = scene
                self.write('wallpapers/manifest.json', manifest)
                # Keep the current and previous clip per theme/quality, so a playing tab never loses its current source.
                keep = {filename}
                if saved:
                    keep.add(saved['file'])
                for old in path.parent.glob(name + '-*.mp4'):
                    if old.stem not in keep:
                        old.unlink(missing_ok=True)
                return dict(scene, configured=True, interval=prefs['interval'], notice='')
            except Exception as error:
                message = str(error) if isinstance(error, ValueError) else 'Pexels is unavailable. Using a locally saved scene.'
                self.retry_at[name] = (time.time() + 1800, message)
                return dict(saved or fallback, notice=message, configured=True, interval=prefs['interval'])

    async def advance(self, theme):
        async with self.lock:
            if self.next_at.get(theme, 0) > time.time():
                raise ValueError('Please wait a moment before changing the scene again.')
            prefs = self.preferences()
            if not prefs['key']:
                raise ValueError('Add a Pexels key to rotate scenes.')
            offsets = prefs.setdefault('offsets', {})
            offsets[theme] = offsets.get(theme, 0) + 1
            self.write('wallpaper.json', prefs)
            self.next_at[theme] = time.time() + 10
        return await self.scene(theme)

    def media(self, filename):
        if not re.fullmatch(r'(nature|rain)-(4k|hd)-[a-f0-9]{16}', filename):
            return None
        path = self.data() / 'wallpapers' / (filename + '.mp4')
        return path if path.is_file() else None
