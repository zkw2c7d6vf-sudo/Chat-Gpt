import hashlib
import importlib.util
import io
from pathlib import Path
from types import SimpleNamespace
import pytest
spec=importlib.util.spec_from_file_location('fetch_assets',Path(__file__).resolve().parents[1]/'scripts/fetch_assets.py')
assets=importlib.util.module_from_spec(spec);spec.loader.exec_module(assets)
CONTENT=b'\0\0\0\x18ftypisom'+b'0'*2048

def fixture(tmp_path,monkeypatch,checksum=None):
    monkeypatch.setattr(assets,'ROOT',tmp_path)
    class Response(io.BytesIO):
        url='https://cdn.pixabay.com/fixture.mp4'
        headers={'Content-Length':str(len(CONTENT))}
    monkeypatch.setattr(assets,'urlopen',lambda *a,**k:Response(CONTENT))
    return {'name':'Test','path':'static/wallpapers/test.mp4','url':Response.url,'sha256':checksum or hashlib.sha256(CONTENT).hexdigest()}

def test_download_is_verified_before_install(tmp_path,monkeypatch):
    asset=fixture(tmp_path,monkeypatch);assets.fetch(asset)
    assert (tmp_path/asset['path']).read_bytes()==CONTENT
    assert not list(tmp_path.rglob('*.download'))

def test_invalid_download_is_removed_without_install(tmp_path,monkeypatch):
    asset=fixture(tmp_path,monkeypatch,'0'*64)
    with pytest.raises(ValueError,match='verification'):assets.fetch(asset)
    assert not (tmp_path/asset['path']).exists() and not list(tmp_path.rglob('*.download'))

def test_existing_bundled_video_does_not_use_network(tmp_path,monkeypatch):
    asset=fixture(tmp_path,monkeypatch);path=tmp_path/asset['path'];path.parent.mkdir(parents=True);path.write_bytes(CONTENT)
    monkeypatch.setattr(assets,'urlopen',lambda *a,**k:pytest.fail('No download for an existing video'))
    assets.fetch(asset)

def test_untrusted_source_and_local_path_are_rejected(tmp_path,monkeypatch):
    asset=fixture(tmp_path,monkeypatch)
    with pytest.raises(ValueError):assets.fetch({**asset,'url':'http://127.0.0.1/private'})
    with pytest.raises(ValueError):assets.fetch({**asset,'path':'../private.mp4'})
