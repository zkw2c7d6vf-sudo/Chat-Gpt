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
    names=['assets.json','scripts/fetch_assets.py','Start Dashboard.cmd','server.py','wallpaper.py','places.py','sw.js','README.md','TODAY-VERIFICATION.md','CALM-VERIFICATION.md','LIVE-VERIFICATION.md','WIDGETS-VERIFICATION.md','ASSET-CREDITS.md','AGENTS.md','Start Dashboard.command','Open Dashboard.ps1','static/index.html','static/today.js']
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
