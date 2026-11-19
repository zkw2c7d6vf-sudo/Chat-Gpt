"""Run the current browser suites against an isolated backend. Never targets the installed app."""
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parents[1]
if not os.environ.get('PLAYWRIGHT_MODULE'):raise SystemExit('Set PLAYWRIGHT_MODULE to the installed Playwright module directory; see AUDIT-IMPLEMENTATION.md.')
port=os.environ.get('MIDNIGHT_TEST_PORT','8895');env=os.environ|{'MIDNIGHT_TEST_PORT':port,'MIDNIGHT_TEST_URL':'http://127.0.0.1:'+port,'PLAYWRIGHT_CHANNEL':os.environ.get('PLAYWRIGHT_CHANNEL','chrome')}
server=subprocess.Popen([sys.executable,'tests/browser_server.py'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL)
try:
 for _ in range(100):
  try:
   with urlopen(env['MIDNIGHT_TEST_URL']) as response:
    if response.status==200:break
  except OSError:time.sleep(.1)
 else:raise RuntimeError('Isolated test server did not start.')
 for name in ['capture','focus-drive','calendar','notifications','toolbar','unified-layout','audit-regressions','recovery','polish','spotify-shelf','privacy-motion','file-tools']:
  subprocess.run(['node',f'tests/{name}.e2e.cjs'],cwd=ROOT,env=env,check=True,timeout=240)
 if os.environ.get('MIDNIGHT_AUDIO_TESTS')=='1':subprocess.run(['node','tests/sounds.e2e.cjs'],cwd=ROOT,env=env,check=True,timeout=240)
finally:server.terminate();server.wait(timeout=10)
