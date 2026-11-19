"""Build a clean release from the same runtime allowlist used by the installer."""
import ast
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import zipfile
from apply_upgrade import release_files,RELEASE
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist/Midnight'
files=release_files()
for path in ROOT.glob('*.py'):ast.parse(path.read_text())
for path in [*ROOT.joinpath('static').glob('*.js'),ROOT/'sw.js']:subprocess.run(['node','--check',str(path)],check=True)
for asset in re.findall(r'(?:src|href)="(/static/[^"?#]+)',(ROOT/'static/index.html').read_text()):
    if not (ROOT/asset.lstrip('/')).is_file():raise SystemExit('Missing app asset: '+asset)
if OUT.exists():shutil.rmtree(OUT)
OUT.mkdir(parents=True)
files += [Path('upgrade-baseline.json'),Path('scripts/build.py'),Path('scripts/activate_local.py'),Path('pytest.ini')]
files += [p.relative_to(ROOT) for p in ROOT.glob('*VERIFICATION.md')]
files += [p.relative_to(ROOT) for p in (ROOT/'tests').glob('*') if p.is_file()]
files += [p.relative_to(ROOT) for p in (ROOT/'scripts').glob('install_*.py')]
# Historical tests stay out of the release along with retired Spaces runtime.
files=[p for p in files if p.name!='test_command_spaces.cjs']
for relative in dict.fromkeys(files):
    destination=OUT/relative;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/relative,destination)
manifest={str(p.relative_to(OUT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.rglob('*')) if p.is_file()}
(OUT/'BUILD-MANIFEST.json').write_text(json.dumps({'format':2,'release':RELEASE,'files':manifest},indent=2)+'\n')
archive=ROOT/'dist/Midnight.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as package:
    for p in sorted(OUT.rglob('*')):
        if p.is_file():package.write(p,Path('Midnight')/p.relative_to(OUT))
print(f'Built {archive} ({len(manifest)} files; no credentials or user data).')
