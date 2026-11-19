"""Fetch optional public Pixabay assets; legacy providers are never contacted."""
import hashlib
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
LIMIT = 256 * 1024 * 1024


def available(path):
    if not path.is_file() or path.stat().st_size < 1024:
        return False
    with path.open('rb') as stream:
        return stream.read(12)[4:8] == b'ftyp'


def fetch(asset):
    relative = Path(asset['path'])
    if relative.is_absolute() or '..' in relative.parts or relative.suffix != '.mp4':
        raise ValueError('Invalid local asset path.')
    target = ROOT / relative
    if available(target):
        return
    url = urlsplit(asset['url'])
    if url.scheme != 'https' or url.hostname != 'cdn.pixabay.com':
        raise ValueError('Only the credited public video source is allowed.')
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix('.download')
    print('Downloading '+asset['name']+' background…', flush=True)
    try:
        with urlopen(Request(asset['url'], headers={'User-Agent': 'Midnight-Asset-Setup/1.0'}), timeout=120) as response:
            final = urlsplit(response.url)
            if final.scheme != 'https' or final.hostname != 'cdn.pixabay.com':
                raise ValueError('Unexpected download destination.')
            if int(response.headers.get('Content-Length', '0')) > LIMIT:
                raise ValueError('The video exceeds the download limit.')
            digest = hashlib.sha256()
            total = 0
            with temporary.open('wb') as stream:
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > LIMIT:
                        raise ValueError('The video exceeds the download limit.')
                    digest.update(chunk)
                    stream.write(chunk)
        if digest.hexdigest() != asset['sha256'] or not available(temporary):
            raise ValueError('Video verification failed. The previous file was kept.')
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    assets = json.loads((ROOT / 'assets.json').read_text())['videos']
    errors = []
    for asset in assets:
        try:
            fetch(asset)
        except Exception as error:
            errors.append(asset['name'])
            print(asset['name']+': '+str(error), file=sys.stderr)
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
