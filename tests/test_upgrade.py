"""Installer tests only write temporary fixture installations."""
import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

spec=importlib.util.spec_from_file_location('midnight_upgrade',Path(__file__).resolve().parents[1]/'scripts/apply_upgrade.py')
upgrade=importlib.util.module_from_spec(spec)
spec.loader.exec_module(upgrade)

@pytest.fixture
def installation(tmp_path,monkeypatch):
    release=tmp_path/'release';target=tmp_path/'installed'
    names=['file_tools.py','ambient-recordings.json','scripts/fetch_ambient.py','CLAUDE-REVIEW.md','VERIFICATION.md','AUDIT-IMPLEMENTATION.md','PLATFORM-ACCEPTANCE.md','scripts/activate_local.py','scripts/local-activation-manifest.json','scripts/responsive-manifest.json','spotify_recent.py','drive_recent.py','requirements.txt','requirements.lock','Apply Midnight Update.command','scripts/start.py','scripts/apply_upgrade.py','assets.json','scripts/fetch_assets.py','Start Dashboard.cmd','server.py','wallpaper.py','places.py','sw.js','README.md','TODAY-VERIFICATION.md','CALM-VERIFICATION.md','LIVE-VERIFICATION.md','WIDGETS-VERIFICATION.md','ASSET-CREDITS.md','AGENTS.md','Start Dashboard.command','Open Dashboard.ps1','static/index.html','static/today.js']
    for root,content in [(release,'new source'),(target,'old source')]:
        for name in names:
            path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content+' '+name)
    baseline={name:hashlib.sha256((target/name).read_bytes()).hexdigest() for name in names}
    (release/'upgrade-baseline.json').write_text(json.dumps(baseline))
    (target/'data').mkdir();(target/'data/settings.json').write_text('private settings fixture')
    monkeypatch.setattr(upgrade,'ROOT',release)
    return release,target

def test_upgrade_keeps_data_and_backups_replaced_source(installation):
    release,target=installation
    upgrade.apply(target)
    assert (target/'server.py').read_text()=='new source server.py'
    assert (target/'data/settings.json').read_text()=='private settings fixture'
    backups=list((target/'upgrade-backups').glob('*/server.py'))
    assert len(backups)==1 and backups[0].read_text()=='old source server.py'

def test_changed_source_is_rejected_before_writing(installation):
    _,target=installation
    (target/'server.py').write_text('a newer local edit')
    with pytest.raises(SystemExit,match='differs from the reviewed version'):
        upgrade.apply(target)
    assert (target/'server.py').read_text()=='a newer local edit'
    assert not (target/'upgrade-backups').exists()

def test_midway_failure_restores_previous_source(installation,monkeypatch):
    _,target=installation
    original=upgrade.os.replace
    count=0
    def fail_once(source,dest):
        nonlocal count
        count+=1
        if count==2:raise OSError('simulated disk failure')
        return original(source,dest)
    monkeypatch.setattr(upgrade.os,'replace',fail_once)
    with pytest.raises(OSError,match='simulated disk failure'):
        upgrade.apply(target)
    assert (target/'server.py').read_text()=='old source server.py'
    assert (target/'sw.js').read_text()=='old source sw.js'
    assert (target/'data/settings.json').read_text()=='private settings fixture'

def test_broken_startup_restores_and_restarts_real_previous_app(installation,monkeypatch):
    """Use an ephemeral port and tiny fixture app, never the production listener."""
    import socket
    import sys
    import types
    release,target=installation
    with socket.socket() as probe:
        probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
    working="""from http.server import BaseHTTPRequestHandler,HTTPServer
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  self.send_response(200);self.end_headers();self.wfile.write(b'{"ok":true}')
 def log_message(self,*args):pass
HTTPServer(('127.0.0.1',PORT),Handler).serve_forever()
""".replace('PORT',str(port))
    (target/'server.py').write_text(working)
    baseline=json.loads((release/'upgrade-baseline.json').read_text());baseline['server.py']=hashlib.sha256(working.encode()).hexdigest();(release/'upgrade-baseline.json').write_text(json.dumps(baseline))
    (release/'server.py').write_text('import deliberately_missing_midnight_module\n')
    (target/'.runtime-python').write_text(sys.executable)
    monkeypatch.setattr(upgrade,'HEALTH_URL',f'http://127.0.0.1:{port}/api/bootstrap')
    monkeypatch.setattr(upgrade,'prepare_runtime',lambda _:Path(sys.executable))
    original=upgrade.start(target,Path(sys.executable));upgrade.health(original)
    children=[];real_start=upgrade.start
    def start(root,python):
        child=real_start(root,python);children.append(child);return child
    monkeypatch.setattr(upgrade,'start',start)
    def stop(servers):original.terminate();original.wait(timeout=5)
    monkeypatch.setitem(sys.modules,'activate_local',types.SimpleNamespace(midnight_servers=lambda:{original.pid:target},listener_pids=lambda:{original.pid},stop_servers=stop))
    try:
        with pytest.raises(RuntimeError,match='exited during startup'):
            upgrade.apply(target,restart=True)
        assert (target/'server.py').read_text()==working
        assert len(children)==2 and children[0].poll() is not None and children[1].poll() is None
        upgrade.health(children[1])
        assert (target/'data/settings.json').read_text()=='private settings fixture'
    finally:
        for child in [original,*children]:
            if child.poll() is None:child.terminate();child.wait(timeout=5)
