"""Build a clean, dependency-free source distribution for Midnight's FastAPI runtime."""
import ast
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist' / 'Midnight'
ast.parse((ROOT / 'server.py').read_text())
for source in [*sorted((ROOT / 'static').glob('*.js')), ROOT / 'sw.js']:
    subprocess.run(['node', '--check', str(source)], check=True)
for asset in re.findall(r'(?:src|href)="(/static/[^"?#]+)', (ROOT / 'static' / 'index.html').read_text()):
    if not (ROOT / asset.lstrip('/')).is_file():
        raise SystemExit(f'Missing app asset: {asset}')
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
for name in ['.gitignore', 'assets.json', 'server.py', 'wallpaper.py', 'places.py', 'sw.js', 'requirements.txt', 'README.md', 'AGENTS.md', 'ASSET-CREDITS.md',
             'Start Dashboard.command', 'Start Dashboard.cmd', 'Open Dashboard.ps1',
             'COMMAND-SPACES-VERIFICATION.md', 'NOTIFICATIONS-VERIFICATION.md', 'UI-VERIFICATION.md', 'CAPTURE-VERIFICATION.md',
             'DESIGN-NOTES.md', 'VERIFICATION.md', 'PERFORMANCE.md', 'TODAY-VERIFICATION.md', 'CALM-VERIFICATION.md', 'LIVE-VERIFICATION.md', 'WIDGETS-VERIFICATION.md',
             'Apply Midnight Update.command', 'upgrade-baseline.json']:
    shutil.copy2(ROOT / name, OUT / name)
shutil.copytree(ROOT / 'static', OUT / 'static')
shutil.copytree(ROOT / 'geodata', OUT / 'geodata')
(OUT / 'scripts').mkdir()
shutil.copy2(ROOT / 'scripts' / 'apply_upgrade.py', OUT / 'scripts' / 'apply_upgrade.py')
shutil.copy2(ROOT / 'scripts' / 'build.py', OUT / 'scripts' / 'build.py')
shutil.copy2(ROOT / 'scripts' / 'fetch_assets.py', OUT / 'scripts' / 'fetch_assets.py')
shutil.copytree(ROOT / 'tests', OUT / 'tests', ignore=shutil.ignore_patterns('__pycache__'))
shutil.copy2(ROOT / 'pytest.ini', OUT / 'pytest.ini')
manifest = {str(path.relative_to(OUT)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(OUT.rglob('*')) if path.is_file()}
(OUT / 'BUILD-MANIFEST.json').write_text(json.dumps({'format': 1, 'files': manifest}, indent=2) + '\n')
archive = ROOT / 'dist' / 'Midnight.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    for path in sorted(OUT.rglob('*')):
        if path.is_file():
            package.write(path, Path('Midnight') / path.relative_to(OUT))
print(f'Built {archive} ({len(manifest)} app files; no data, credentials or test profiles).')
