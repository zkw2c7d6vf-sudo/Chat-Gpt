"""Wallpaper tests only use temporary files, synthetic keys and mocked HTTP."""
import hashlib
import json
import asyncio
import time

import httpx
import pytest
from fastapi.testclient import TestClient
import server
import wallpaper
from wallpaper import WallpaperService, select_video, trusted

KEY = '12345678-' + 'x' * 25
URL = 'https://cdn.pixabay.com/video/2026/01/01/123_large.mp4'
VIDEO = {'id': 123, 'pageURL': 'https://pixabay.com/videos/id-123/', 'duration': 90,
         'user': 'Test creator', 'videos': {
             'large': {'url': URL, 'width': 3840, 'height': 2160, 'size': 2048},
             'medium': {'url': 'https://cdn.pixabay.com/video/2026/01/01/123_medium.mp4', 'width': 1920, 'height': 1080, 'size': 2048}}}

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
    assert client.get('/api/wallpaper/settings').json()['provider'] == 'pixabay'
    assert client.get('/api/wallpaper/settings').json()['quality'] == 'hd'
    stored = json.loads((server.DATA / 'wallpaper.json').read_text())
    assert stored['pixabay_key'] == KEY and 'key' not in stored
    assert server.config()['calendar_url'] == 'https://example.com/private.ics'
    assert save(client, key='').json()['configured'] is False


def test_validation_and_csrf(client):
    assert client.post('/api/wallpaper/settings', json={'key': KEY}).status_code == 403
    assert save(client, interval=0).status_code == 422
    assert save(client, quality='8k').status_code == 422
    assert save(client, key='invalid\nkey').status_code == 422
    assert client.get('/api/wallpaper?theme=private-url').status_code == 422
    assert client.get('/api/wallpaper/media/pixabay-nature-hd-not-a-hash').status_code == 404
    assert client.post('/api/wallpaper/next?theme=nature', json={}, headers={'X-Midnight-Token': server.CSRF}).status_code == 409


def test_settings_ui_uses_pixabay_without_old_provider_controls(client):
    page = client.get('/app').text
    assert 'id="pixabayKey"' in page and 'id="removePixabay"' in page
    assert 'sent only to Pixabay' in page
    assert 'pexelsKey' not in page and 'removePexels' not in page


def test_mistyped_key_is_not_reflected_in_validation_errors(client):
    response = save(client, key=KEY + '!')
    assert response.status_code == 422 and KEY not in response.text
    assert 'input' not in response.json()['detail'][0]


def test_included_scene_needs_no_key_or_network(client, monkeypatch):
    mock_network(monkeypatch, lambda request: pytest.fail('Included scenes must not use the internet'))
    for theme in ('nature', 'rain'):
        scene = client.get('/api/wallpaper?theme=' + theme).json()
        assert scene['source'] == 'still' and not scene['configured']
        assert scene['width'] == 0
        assert scene['src'] == ''


def test_landscape_quality_and_trusted_hosts():
    assert select_video([VIDEO], 0, '4k')[1]['width'] == 3840
    assert select_video([VIDEO], 0, 'hd')[1]['width'] == 1920
    for url in ('http://cdn.pixabay.com/a', 'https://cdn.pixabay.com.evil.test/a', 'https://user@cdn.pixabay.com/a', 'https://cdn.pixabay.com:8443/a', 'https://cdn.pixabay.com/a?key=secret'):
        assert not trusted(url, {'cdn.pixabay.com'})
    with pytest.raises(ValueError):
        select_video([{**VIDEO, 'videos': {'large': {**VIDEO['videos']['large'], 'url': 'https://127.0.0.1/a.mp4'}}}], 0, '4k')


def test_hd_uses_actual_1080p_dimensions_and_never_substitutes_720p_or_4k():
    older = {**VIDEO, 'videos': {'large': {**VIDEO['videos']['medium']},
                               'medium': {**VIDEO['videos']['medium'], 'width': 1280, 'height': 720}}}
    assert select_video([older], 0, 'hd')[1]['width'] == 1920
    for file in [VIDEO['videos']['large'], older['videos']['medium']]:
        with pytest.raises(ValueError):
            select_video([{**VIDEO, 'videos': {'only': file}}], 0, 'hd')


def test_legacy_provider_key_is_not_sent_to_pixabay(client, monkeypatch):
    server.wallpapers.write('wallpaper.json', {'key': 'old-provider-credential', 'quality': '4k', 'interval': 60})
    mock_network(monkeypatch, lambda request: pytest.fail('A legacy key must never be used'))
    assert server.wallpapers.public_preferences() == {'provider': 'pixabay', 'configured': False, 'interval': 60, 'quality': 'hd'}
    assert client.get('/api/wallpaper').json()['configured'] is False
    save(client)
    assert 'old-provider-credential' not in (server.DATA / 'wallpaper.json').read_text()



def test_download_is_local_authenticated_api_only_and_cached(client, monkeypatch):
    calls = []
    def handler(request):
        calls.append(request)
        if request.url.host == 'pixabay.com':
            assert request.url.params['key'] == KEY
            assert request.url.params['min_height'] == '1080'
            assert request.url.path == '/api/videos/'
            return httpx.Response(200, json={'hits': [VIDEO]})
        assert request.url.host == 'cdn.pixabay.com'
        assert 'Authorization' not in request.headers
        assert 'key' not in request.url.params
        return httpx.Response(200, content=b'\0\0\0\x18ftypisom' + b'0' * 2048, headers={'Content-Type': 'video/mp4'})
    mock_network(monkeypatch, handler)
    save(client)
    scene = client.get('/api/wallpaper').json()
    assert scene['source'] == 'pixabay' and scene['width'] == 1920
    assert scene['src'].startswith('/api/wallpaper/media/pixabay-nature-hd-')
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
        assert scene['source'] == 'still'
        assert 'rejected' in scene['notice'] and KEY not in scene['notice']
    assert len(calls) == 1


@pytest.mark.parametrize('status', [400, 403, 429, 500])
def test_api_errors_never_expose_credential_or_request_url(client, monkeypatch, status):
    mock_network(monkeypatch, lambda request: httpx.Response(status, text=str(request.url)))
    save(client)
    response = client.get('/api/wallpaper')
    assert response.status_code == 200
    assert KEY not in response.text and '?key=' not in response.text


def test_catalog_is_cached_for_24_hours_across_restart_and_reused_after_preferences_save(client, monkeypatch):
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={'hits': [VIDEO]})
    mock_network(monkeypatch, handler)
    save(client)
    first = asyncio.run(server.wallpapers.catalog('nature', KEY))
    cached = server.wallpapers.read('wallpapers/catalog-nature.json', {})
    assert cached['expires'] >= time.time() + 86390
    assert KEY not in json.dumps(cached)
    fresh = WallpaperService(lambda: server.DATA)
    assert asyncio.run(fresh.catalog('nature', KEY)) == first
    asyncio.run(fresh.save(None, 60, 'hd'))
    assert asyncio.run(fresh.catalog('nature', KEY)) == first
    assert len(calls) == 1


def test_changing_api_key_does_not_reuse_another_keys_catalog(client, monkeypatch):
    calls = []
    def handler(request):
        calls.append(request.url.params['key'])
        return httpx.Response(200, json={'hits': [VIDEO]})
    mock_network(monkeypatch, handler)
    save(client)
    asyncio.run(server.wallpapers.catalog('nature', KEY))
    changed = '87654321-' + 'z' * 25
    asyncio.run(server.wallpapers.save(changed, 30, 'hd'))
    asyncio.run(server.wallpapers.catalog('nature', changed))
    assert calls == [KEY, changed]


def test_failed_rotation_keeps_previous_download(client, monkeypatch):
    save(client)
    service = server.wallpapers
    filename = 'pixabay-nature-hd-' + 'a' * 16
    folder = server.DATA / 'wallpapers'
    folder.mkdir()
    (folder / (filename + '.mp4')).write_bytes(b'previous video')
    service.write('wallpapers/manifest.json', {'pixabay-nature-hd': {'file': filename, 'src': '/api/wallpaper/media/' + filename, 'source': 'pixabay', 'duration':90, 'slot': -1}})
    mock_network(monkeypatch, lambda request: httpx.Response(503))
    scene = client.get('/api/wallpaper').json()
    assert scene['file'] == filename and 'locally saved' in scene['notice']
    assert (folder / (filename + '.mp4')).read_bytes() == b'previous video'


def test_oversize_download_never_replaces_cached_files(client, monkeypatch):
    save(client)
    def handler(request):
        if request.url.host == 'pixabay.com':
            return httpx.Response(200, json={'hits': [VIDEO]})
        return httpx.Response(200, content=b'bad', headers={'Content-Type': 'video/mp4', 'Content-Length': str(wallpaper.LIMIT + 1)})
    mock_network(monkeypatch, handler)
    scene = client.get('/api/wallpaper').json()
    assert scene['source'] == 'still' and 'large' in scene['notice']
    assert not list((server.DATA / 'wallpapers').glob('*.mp4'))
    assert not list((server.DATA / 'wallpapers').glob('*.part'))


def test_next_scene_advances_consecutively_without_exposing_key(client, monkeypatch):
    save(client)
    second = {**VIDEO, 'id': 124, 'pageURL': 'https://pixabay.com/videos/id-124/', 'videos': {'medium': {**VIDEO['videos']['medium'], 'url': 'https://cdn.pixabay.com/video/2026/01/01/124_medium.mp4'}}}
    def handler(request):
        if request.url.host == 'pixabay.com':
            return httpx.Response(200, json={'hits': [VIDEO, second]})
        return httpx.Response(200, content=b'\0\0\0\x18ftypisom' + b'0' * 2048, headers={'Content-Type': 'video/mp4'})
    mock_network(monkeypatch, handler)
    first = client.get('/api/wallpaper').json()
    result = client.post('/api/wallpaper/next?theme=nature', json={}, headers={'X-Midnight-Token': server.CSRF})
    assert result.status_code == 200 and result.json()['src'] != first['src']
    assert KEY not in result.text
    # Crossing an automatic rotation boundary must still change the scene.
    later = time.time() + 1800
    monkeypatch.setattr(wallpaper.time, 'time', lambda: later)
    for _ in range(5):
        previous = result.json()['src']
        result = client.post('/api/wallpaper/next?theme=nature', json={}, headers={'X-Midnight-Token': server.CSRF})
        assert result.status_code == 200 and result.json()['src'] != previous
        assert client.get('/api/wallpaper').json()['src'] == result.json()['src']


def test_short_clips_are_rejected_in_favor_of_longer_clips():
    short={**VIDEO,'duration':8}
    assert select_video([short,VIDEO],0,'4k')[0]['duration']==90
    with pytest.raises(ValueError):
        select_video([short],0,'4k')


def test_long_4k_clip_can_fall_back_to_hd_if_it_exceeds_size_cap(client,monkeypatch):
    save(client,quality='4k')
    def handler(request):
        if request.url.host=='pixabay.com':return httpx.Response(200,json={'hits':[VIDEO]})
        if request.url.path.endswith('_large.mp4'):return httpx.Response(200,content=b'x',headers={'Content-Type':'video/mp4','Content-Length':str(wallpaper.LIMIT+1)})
        return httpx.Response(200,content=b'\0\0\0\x18ftypisom'+b'0'*2048,headers={'Content-Type':'video/mp4'})
    mock_network(monkeypatch,handler)
    scene=client.get('/api/wallpaper').json()
    assert scene['source']=='pixabay' and scene['duration']==90 and scene['width']==1920


def test_simultaneous_advances_skip_duplicate_footage_and_persist_across_restart(client, monkeypatch):
    save(client)
    second = {**VIDEO, 'id': 124, 'pageURL': 'https://pixabay.com/videos/id-124/',
              'videos': {'medium': {**VIDEO['videos']['medium'], 'url': URL.replace('123_large', '124_medium')}}}
    def handler(request):
        if request.url.host == 'pixabay.com':
            return httpx.Response(200, json={'hits': [VIDEO, VIDEO, second, second]})
        return httpx.Response(200, content=b'\0\0\0\x18ftypisom' + b'0' * 2048, headers={'Content-Type': 'video/mp4'})
    mock_network(monkeypatch, handler)
    first = client.get('/api/wallpaper').json()
    async def advances():
        return await asyncio.gather(*(server.wallpapers.advance('nature') for _ in range(5)))
    scenes = asyncio.run(advances())
    for previous, current in zip([first] + scenes, scenes):
        assert previous['src'] != current['src'] and not current['notice']
    restarted = WallpaperService(lambda: server.DATA)
    assert asyncio.run(restarted.scene('nature'))['src'] == scenes[-1]['src']


def test_single_scene_catalog_explains_why_it_cannot_change(client, monkeypatch):
    save(client)
    def handler(request):
        if request.url.host == 'pixabay.com':
            return httpx.Response(200, json={'hits': [VIDEO]})
        return httpx.Response(200, content=b'\0\0\0\x18ftypisom' + b'0' * 2048, headers={'Content-Type': 'video/mp4'})
    mock_network(monkeypatch, handler)
    first = client.get('/api/wallpaper').json()
    result = client.post('/api/wallpaper/next?theme=nature', json={}, headers={'X-Midnight-Token': server.CSRF}).json()
    assert result['src'] == first['src'] and 'No other background' in result['notice']


def test_sparse_legacy_catalog_expands_pages_once_and_survives_restart(client, monkeypatch):
    save(client)
    service = server.wallpapers
    short = {**VIDEO, 'duration': 8}
    service.write('wallpapers/catalog-nature.json', {
        'fingerprint': hashlib.sha256(KEY.encode()).hexdigest(),
        'expires': time.time() + 3600, 'videos': [VIDEO] + [short] * 199})
    more = [{**VIDEO, 'id': n, 'pageURL': f'https://pixabay.com/videos/id-{n}/',
             'videos': {'medium': {**VIDEO['videos']['medium'],
                                  'url': f'https://cdn.pixabay.com/video/2026/01/01/{n}_medium.mp4'}}}
            for n in (124, 125, 126)]
    calls = []
    def handler(request):
        calls.append((request.url.params['q'], request.url.params['page']))
        return httpx.Response(200, json={'hits': more, 'totalHits': 203})
    mock_network(monkeypatch, handler)
    assert len(asyncio.run(service.catalog('nature', KEY))) == 200
    expanded = asyncio.run(service.catalog('nature', KEY, expand=True))
    assert len(expanded) == 203 and calls == [('nature', '2')]
    restarted = WallpaperService(lambda: server.DATA)
    assert asyncio.run(restarted.catalog('nature', KEY, expand=True)) == expanded
    assert calls == [('nature', '2')]
    assert service.read('wallpapers/catalog-nature.json', {})['expires'] >= time.time() + 86390


def test_sparse_exhausted_catalog_searches_related_landscapes_without_repeating_pages(client, monkeypatch):
    save(client)
    calls = []
    def handler(request):
        query, page = request.url.params['q'], request.url.params['page']
        calls.append((query, page))
        hits = [VIDEO] if query == 'nature' else [
            {**VIDEO, 'id': n, 'pageURL': f'https://pixabay.com/videos/id-{n}/',
             'videos': {'medium': {**VIDEO['videos']['medium'],
                                  'url': f'https://cdn.pixabay.com/video/2026/01/01/{n}_medium.mp4'}}}
            for n in (124, 125, 126)]
        return httpx.Response(200, json={'hits': hits, 'totalHits': len(hits)})
    mock_network(monkeypatch, handler)
    expanded = asyncio.run(server.wallpapers.catalog('nature', KEY, expand=True))
    assert len(expanded) == 4 and calls == [('nature', '1'), ('landscape', '1')]
