"""Apply one reviewed release with dependency preflight and rollback after failed startup."""
import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]
RELEASE='2026.11.18-r46-review'
HEALTH_URL='http://127.0.0.1:8765/api/bootstrap'
RETIRED={'spaces.js','spaces-store.js','home-search.js','home-search.css','index.html.backup','command-spaces.css'}


def release_files():
    names=['file_tools.py','ambient-recordings.json','scripts/fetch_ambient.py','assets.json','server.py','wallpaper.py','places.py','spotify_recent.py','drive_recent.py','sw.js',
           'requirements.txt','requirements.lock','CLAUDE-REVIEW.md','VERIFICATION.md','PLATFORM-ACCEPTANCE.md','README.md','AGENTS.md','ASSET-CREDITS.md',
           'Start Dashboard.command','Start Dashboard.cmd','Open Dashboard.ps1','Apply Midnight Update.command',
           'scripts/fetch_assets.py','scripts/apply_upgrade.py','scripts/start.py','scripts/activate_local.py','scripts/local-activation-manifest.json','scripts/responsive-manifest.json']
    files=[Path(name) for name in names]
    files += [p.relative_to(ROOT) for folder in ('static','geodata') for p in (ROOT/folder).rglob('*') if p.is_file() and p.name not in RETIRED and '__pycache__' not in p.parts and p.suffix not in ('.mp3','.wav','.ogg','.part','.download','.source-download')]
    files += [p.relative_to(ROOT) for p in (ROOT/'scripts').glob('install_*.py')]
    return files


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def plan(target):
    if target==ROOT or not (target/'server.py').is_file() or not (target/'static/index.html').is_file():
        raise SystemExit('Choose the existing Midnight installation. Nothing was changed.')
    manifest=json.loads((ROOT/'upgrade-baseline.json').read_text())
    changed=[]
    for name,accepted in manifest.items():
        path=target/name
        if isinstance(accepted,str):accepted=[accepted]
        if (digest(path) if path.is_file() else None) not in accepted:changed.append(name)
    if changed:raise SystemExit('Existing source differs from the reviewed version. Nothing was changed. Review: '+', '.join(changed))
    files=release_files()
    missing=[str(p) for p in files if not (ROOT/p).is_file()]
    if missing:raise SystemExit('Release is incomplete: '+', '.join(missing))
    # A distribution carries its own source hashes. A checkout generates these at build time.
    build=ROOT/'BUILD-MANIFEST.json'
    if build.is_file():
        reviewed=json.loads(build.read_text())['files']
        for p in files:
            if reviewed.get(str(p))!=digest(ROOT/p):raise SystemExit('Release source changed: '+str(p))
    return files


def prepare_runtime(target):
    environment=target/'.runtime'/RELEASE
    python=environment/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
    if not python.is_file():subprocess.run([sys.executable,'-m','venv',str(environment)],check=True)
    # Hashes pin direct and transitive dependencies. Keep the prior environment for rollback.
    if shutil.which('uv'):command=['uv','pip','sync','--python',str(python),'--require-hashes',str(ROOT/'requirements.lock')]
    else:command=[str(python),'-m','pip','install','--require-hashes','-r',str(ROOT/'requirements.lock')]
    subprocess.run(command,check=True,stdout=subprocess.DEVNULL)
    with tempfile.TemporaryDirectory(prefix='midnight-preflight-') as folder:
        env=os.environ|{'MIDNIGHT_DATA':folder,'PYTHONPATH':str(ROOT),'PYDANTIC_DISABLE_PLUGINS':'__all__'}
        subprocess.run([str(python),'-c','import server; assert server.app'],cwd=ROOT,env=env,check=True,timeout=60,stdout=subprocess.DEVNULL)
    return python


def start(target,python):
    logs=target/'logs';logs.mkdir(exist_ok=True)
    with (logs/'midnight-server.log').open('ab') as output:
        return subprocess.Popen([str(python),'-u','server.py'],cwd=target,env=os.environ|{'MIDNIGHT_DATA':str(target/'data')},stdin=subprocess.DEVNULL,stdout=output,stderr=output,start_new_session=True)


def health(child,release=None,timeout=45):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        if child.poll() is not None:raise RuntimeError('Midnight exited during startup.')
        try:
            with urlopen(HEALTH_URL,timeout=1) as response:data=json.load(response)
            if not release or data.get('release')==release:return
        except OSError:pass
        time.sleep(.2)
    raise RuntimeError('Midnight did not become ready.')


def apply(target,restart=False,check=False):
    target=target.expanduser().resolve();files=plan(target)
    if check:print('Reviewed release and installation match. Nothing changed.');return
    python=prepare_runtime(target) if restart else None
    servers={};old_python=None
    if restart:
        from activate_local import midnight_servers,listener_pids,stop_servers
        servers={pid:cwd for pid,cwd in midnight_servers().items() if cwd.resolve()==target}
        if listener_pids()-set(servers):raise RuntimeError('Port 8765 belongs to another installation; nothing stopped.')
        selected=target/'.runtime-python'
        old_python=Path(selected.read_text().strip()) if selected.is_file() else target/('.venv/Scripts/python.exe' if os.name=='nt' else '.venv/bin/python')
    backup=target/'upgrade-backups'/('release-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'));backup.mkdir(parents=True);backup.chmod(0o700)
    originals=set();installed=[];removed=[];child=None
    retired=[Path('static')/name for name in RETIRED if (target/'static'/name).is_file()]
    for p in files+retired:
        if (target/p).is_file():out=backup/p;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target/p,out);originals.add(p)
    # Preserve a legacy private ChatGPT destination outside served/public source.
    legacy=re.search(r'href="(https://chatgpt.com/c/[^"<>]+)"', (target/'static/index.html').read_text())
    if restart:stop_servers(servers)
    try:
        for p in files:
            destination=target/p;destination.parent.mkdir(parents=True,exist_ok=True)
            temporary=destination.with_name(destination.name+'.midnight-upgrade-tmp')
            try:shutil.copy2(ROOT/p,temporary);os.replace(temporary,destination);installed.append(p)
            finally:temporary.unlink(missing_ok=True)
        for p in retired:(target/p).unlink();removed.append(p)
        if restart:
            child=start(target,python);health(child,RELEASE)
            selected=target/'.runtime-python';selected.write_text(str(python)+'\n')
        if legacy:
            destination=target/'data/chatgpt-link.json'
            if not destination.exists():destination.parent.mkdir(exist_ok=True);destination.write_text(json.dumps({'url':legacy[1]}));destination.chmod(0o600)
    except BaseException:
        if child and child.poll() is None:child.terminate();child.wait(timeout=10)
        for p in removed:shutil.copy2(backup/p,target/p)
        for p in reversed(installed):
            if p in originals:shutil.copy2(backup/p,target/p)
            else:(target/p).unlink(missing_ok=True)
        if restart and servers:
            previous=start(target,old_python)
            try:health(previous)
            except RuntimeError:raise RuntimeError('Source restored, but previous runtime could not start. See logs. Backup: '+str(backup))
        raise
    (backup/'RESTORE.txt').write_text('Previous source. Restore these files while stopped. Data and prior runtime are retained.\n')
    print('Midnight '+RELEASE+' installed'+(' and healthy.' if restart else '. Restart using the normal launcher.'))
    print('Source backup: '+str(backup))
    return backup


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--target',type=Path,required=True);parser.add_argument('--restart',action='store_true');parser.add_argument('--check',action='store_true')
    options=parser.parse_args();apply(options.target,options.restart,options.check)
