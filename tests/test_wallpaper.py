"""Wallpaper tests only use temporary files, synthetic keys and mocked HTTP."""
import hashlib
import json

import httpx
import pytest
from fastapi.testclient import TestClient
import server
import wallpaper
from wallpaper import WallpaperService, select_video, trusted

KEY = 'synthetic_test_key_' + 'x' * 40
URL = 'https://videos.pexels.com/video-files/123/4k.mp4'
VIDEO = {'id': 123, 'url': 'https://www.pexels.com/video/123/', 'duration': 90,
         'user': {'name': 'Test creator'}, 'video_files': [
             {'file_type': 'video/mp4', 'link': URL, 'width': 3840, 'height': 2160, 'fps': 30},
             {'file_type': 'video/mp4', 'link': 'https://videos.pexels.com/video-files/123/hd.mp4', 'width': 1920, 'height': 1080, 'fps': 30}]}

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(server, 'DATA', tmp_path)
    monkeypatch.setattr(server, 'wallpapers', WallpaperService(lambda: tmp_path))
    with TestClient(server.app, base_url=server.BASE) as client:
        yield client


def save(client, **changes):
    return client.post('/api/wallpaper/settings', json={'key': KEY, **changes}, headers={'X-Midnight-Token': server.CSRF})


def mock_network(monkeypatch, handler):
    original = httpx.AsyncClient
    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(wallpaper.httpx, 'AsyncClient', lambda **kwargs: original(transport=transport, **kwargs))


def test_preferences_are_separate_and_secret_never_returned(client):
    server.save_json('settings.json', {'calendar_url': 'https://example.com/private.ics'})
    assert save(client).status_code == 200
    assert KEY not in client.get('/api/bootstrap').text
    assert KEY not in client.get('/api/wallpaper/settings').text
    assert KEY not in save(client, key=None, interval=60).text
    assert server.wallpapers.preferences()['key'] == KEY
    assert server.config()['calendar_url'] == 'https://example.com/private.ics'
    assert save(client, key='').json()['configured'] is False


def test_validation_and_csrf(client):
    assert client.post('/api/wallpaper/settings', json={'key': KEY}).status_code == 403
    assert save(client, interval=0).status_code == 422
    assert save(client, quality='8k').status_code == 422
    assert save(client, key='invalid\nkey').status_code == 422
    assert client.get('/api/wallpaper?theme=private-url').status_code == 422
    assert client.get('/api/wallpaper/media/nature-4k-not-a-hash').status_code == 404
    assert client.post('/api/wallpaper/next?theme=nature', json={}, headers={'X-Midnight-Token': server.CSRF}).status_code == 409


def test_included_scene_needs_no_key_or_network(client, monkeypatch):
    mock_network(monkeypatch, lambda request: pytest.fail('Included scenes must not use the internet'))
    for theme in ('nature', 'rain'):
        scene = client.get('/api/wallpaper?theme=' + theme).json()
        assert scene['source'] == 'included' and not scene['configured']
        assert scene['width'] >= 3840
        assert scene['src'].startswith('/static/wallpapers/')


def test_landscape_quality_and_trusted_hosts():
    assert select_video([VIDEO], 0, '4k')[1]['width'] == 3840
    assert select_video([VIDEO], 0, 'hd')[1]['width'] == 1920
    for url in ('http://videos.pexels.com/a', 'https://videos.pexels.com.evil.test/a', 'https://user@videos.pexels.com/a', 'https://videos.pexels.com:8443/a'):
        assert not trusted(url, {'videos.pexels.com'})
    with pytest.raises(ValueError):
        select_video([{**VIDEO, 'video_files': [{**VIDEO['video_files'][0], 'link': 'https://127.0.0.1/a'}]}], 0, '4k')


def test_download_is_local_authenticated_api_only_and_cached(client, monkeypatch):
    calls = []
    def handler(request):
        calls.append(request)
        if request.url.host == 'api.pexels.com':
            assert request.headers['Authorization'] == KEY
            return httpx.Response(200, json={'videos': [VIDEO]})
        assert request.url.host == 'videos.pexels.com'
        assert 'Authorization' not in request.headers
        return httpx.Response(200, content=b'\0\0\0\x18ftypisom' + b'0' * 2048, headers={'Content-Type': 'video/mp4'})
    mock_network(monkeypatch, handler)
    save(client)
    scene = client.get('/api/wallpaper').json()
    assert scene['source'] == 'pexels' and scene['width'] >= 3840
    assert scene['src'].startswith('/api/wallpaper/media/nature-4k-')
    assert KEY not in json.dumps(scene)
    assert client.get(scene['src']).status_code == 200
    assert client.get('/api/wallpaper').json()['src'] == scene['src']
    assert len(calls) == 2


def test_bad_key_falls_back_with_retry_backoff(client, monkeypatch):
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(401)
    mock_network(monkeypatch, handler)
    save(client)
    for _ in range(2):
        scene = client.get('/api/wallpaper').json()
        assert scene['source'] == 'included'
        assert 'rejected' in scene['notice'] and KEY not in scene['notice']
    assert len(calls) == 1


def test_failed_rotation_keeps_previous_download(client, monkeypatch):
    save(client)
    service = server.wallpapers
    filename = 'nature-4k-' + 'a' * 16
    folder = server.DATA / 'wallpapers'
    folder.mkdir()
    (folder / (filename + '.mp4')).write_bytes(b'previous video')
    service.write('wallpapers/manifest.json', {'nature-4k': {'file': filename, 'src': '/api/wallpaper/media/' + filename, 'source': 'pexels', 'duration':90, 'slot': -1}})
    mock_network(monkeypatch, lambda request: httpx.Response(503))
    scene = client.get('/api/wallpaper').json()
    assert scene['file'] == filename and 'locally saved' in scene['notice']
    assert (folder / (filename + '.mp4')).read_bytes() == b'previous video'


def test_oversize_download_never_replaces_cached_files(client, monkeypatch):
    save(client)
    def handler(request):
        if request.url.host == 'api.pexels.com':
            return httpx.Response(200, json={'videos': [VIDEO]})
        return httpx.Response(200, content=b'bad', headers={'Content-Type': 'video/mp4', 'Content-Length': str(wallpaper.LIMIT + 1)})
    mock_network(monkeypatch, handler)
    scene = client.get('/api/wallpaper').json()
    assert scene['source'] == 'included' and 'large' in scene['notice']
    assert not list((server.DATA / 'wallpapers').glob('*.mp4'))
    assert not list((server.DATA / 'wallpapers').glob('*.part'))


def test_next_scene_advances_without_exposing_key_and_has_cooldown(client, monkeypatch):
    save(client)
    second = {**VIDEO, 'id': 124, 'url': 'https://www.pexels.com/video/124/', 'video_files': [{**VIDEO['video_files'][0], 'link': 'https://videos.pexels.com/video-files/124/4k.mp4'}]}
    def handler(request):
        if request.url.host == 'api.pexels.com':
            return httpx.Response(200, json={'videos': [VIDEO, second]})
        return httpx.Response(200, content=b'\0\0\0\x18ftypisom' + b'0' * 2048, headers={'Content-Type': 'video/mp4'})
    mock_network(monkeypatch, handler)
    first = client.get('/api/wallpaper').json()
    result = client.post('/api/wallpaper/next?theme=nature', json={}, headers={'X-Midnight-Token': server.CSRF})
    assert result.status_code == 200 and result.json()['src'] != first['src']
    assert KEY not in result.text
    assert client.post('/api/wallpaper/next?theme=nature', json={}, headers={'X-Midnight-Token': server.CSRF}).status_code == 409


def test_short_clips_are_rejected_in_favor_of_longer_clips():
    short={**VIDEO,'duration':8}
    assert select_video([short,VIDEO],0,'4k')[0]['duration']==90
    with pytest.raises(ValueError):
        select_video([short],0,'4k')


def test_long_4k_clip_can_fall_back_to_hd_if_it_exceeds_size_cap(client,monkeypatch):
    save(client)
    def handler(request):
        if request.url.host=='api.pexels.com':return httpx.Response(200,json={'videos':[VIDEO]})
        if request.url.path.endswith('4k.mp4'):return httpx.Response(200,content=b'x',headers={'Content-Type':'video/mp4','Content-Length':str(wallpaper.LIMIT+1)})
        return httpx.Response(200,content=b'\0\0\0\x18ftypisom'+b'0'*2048,headers={'Content-Type':'video/mp4'})
    mock_network(monkeypatch,handler)
    scene=client.get('/api/wallpaper').json()
    assert scene['source']=='pexels' and scene['duration']==90 and scene['width']==1920
