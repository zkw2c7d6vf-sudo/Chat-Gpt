"""Apply the reviewed release to a matching installation, retaining private data and a rollback copy."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]

def apply(target):
    target=target.expanduser().resolve()
    if target==ROOT or not (target/'server.py').is_file() or not (target/'static/index.html').is_file():
        raise SystemExit('Choose the existing MidnightDashboard folder. Nothing was changed.')
    baseline=json.loads((ROOT/'upgrade-baseline.json').read_text())
    changed=[]
    for name,digest in baseline.items():
        path=target/name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:
            changed.append(name)
    if changed:
        raise SystemExit('Existing source differs from the reviewed version. Nothing was changed. Review: '+', '.join(changed))
    # Fixed, narrow allowlist. No data, credentials, dependencies, user settings or captures.
    files=[Path('assets.json'),Path('scripts/fetch_assets.py'),Path('Start Dashboard.cmd'),Path('server.py'),Path('wallpaper.py'),Path('places.py'),Path('sw.js'),Path('README.md'),Path('TODAY-VERIFICATION.md'),Path('CALM-VERIFICATION.md'),Path('LIVE-VERIFICATION.md'),Path('WIDGETS-VERIFICATION.md'),Path('ASSET-CREDITS.md'),Path('AGENTS.md'),Path('Start Dashboard.command'),Path('Open Dashboard.ps1')]
    files += [p.relative_to(ROOT) for folder in ('static','geodata') for p in (ROOT/folder).rglob('*') if p.is_file()]
    missing=[str(p) for p in files if not (ROOT/p).is_file()]
    if missing:raise SystemExit('Upgrade is incomplete: '+', '.join(missing))
    backup=target/'upgrade-backups'/datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup.mkdir(parents=True)
    originals=set()
    for relative in files:
        path=target/relative
        if path.exists():
            out=backup/relative;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,out);originals.add(relative)
    installed=[]
    try:
        for relative in files:
            path=target/relative;path.parent.mkdir(parents=True,exist_ok=True)
            staged=path.with_name(path.name+'.midnight-upgrade-tmp')
            try:
                shutil.copy2(ROOT/relative,staged);os.replace(staged,path);installed.append(relative)
            finally:staged.unlink(missing_ok=True)
    except Exception:
        for relative in reversed(installed):
            if relative in originals:shutil.copy2(backup/relative,target/relative)
            else:(target/relative).unlink(missing_ok=True)
        raise
    (backup/'RESTORE.txt').write_text('Previous application source only. Copy these files over the installation to roll back. Your data directory was not changed.\n')
    print('Midnight upgraded. Settings, account connections and browser captures were kept.')
    print('Previous source: '+str(backup))
    print('Restart Midnight with its existing launcher, then reopen the dashboard to load the new release.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target',type=Path,required=True)
    apply(parser.parse_args().target)
