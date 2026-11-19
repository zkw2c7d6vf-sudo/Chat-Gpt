"""Restore four credited long field recordings. No key or account required."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import urllib.request
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]


def digest(path):
    value=hashlib.sha256()
    with path.open('rb') as stream:
        while block:=stream.read(1024*1024):value.update(block)
    return value.hexdigest()


def normalize_mp3(source,target):
    import imageio_ffmpeg
    # The provider's long MP3 has a stale original-duration header. Rebuild only the
    # container/index; copying audio frames preserves the supplied field recording.
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y',
        '-i',str(source),'-map','0:a:0','-c:a','copy','-map_metadata','-1',
        '-fflags','+bitexact','-flags:a','+bitexact','-id3v2_version','0',str(target)],
        check=True,capture_output=True,timeout=60)


def main():
    catalog=json.loads((ROOT/'ambient-recordings.json').read_text())
    out=ROOT/'static/ambient';out.mkdir(parents=True,exist_ok=True)
    for item in catalog['recordings']:
        if Path(item['file']).name!=item['file'] or Path(item['file']).suffix!='.mp3':
            raise ValueError('Invalid recording filename.')
        url=urlsplit(item['download'])
        if url.scheme!='https' or url.hostname!='cdn.freesound.org' or not url.path.startswith('/previews/') or url.username or url.password:
            raise ValueError('Use the fixed credited Freesound recording source.')
        path=out/item['file'];expected=item['sha256']
        existing=digest(path) if path.is_file() else None
        if existing==expected:
            print(item['label']+': installed',flush=True);continue
        raw=path.with_suffix('.source-download');temporary=path.with_suffix('.normalized.mp3')
        try:
            source_hash=item.get('source_sha256',expected)
            if existing==source_hash:shutil.copy2(path,raw)
            else:
                request=urllib.request.Request(item['download'],headers={'User-Agent':'MidnightDashboard/1.0'})
                with urllib.request.urlopen(request,timeout=60) as response,raw.open('wb') as handle:
                    count=0
                    while block:=response.read(1024*1024):
                        count+=len(block)
                        if count>200*1024*1024:raise ValueError('Recording exceeds 200 MB.')
                        handle.write(block)
            if digest(raw)!=source_hash:raise ValueError('Recording source checksum did not match.')
            if item.get('normalize_mp3'):normalize_mp3(raw,temporary)
            else:os.replace(raw,temporary)
            if digest(temporary)!=expected:raise ValueError('Recording checksum did not match.')
            os.replace(temporary,path);print(item['label']+': restored',flush=True)
        finally:
            raw.unlink(missing_ok=True);temporary.unlink(missing_ok=True)


if __name__=='__main__':main()
