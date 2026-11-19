from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient
import server
from spotify_recent import recent_tracks, recent_collections


def entry(index, **fields):
    return {'track': {'uri': f'spotify:track:Song{index}', 'name': f'Song {index}',
            'album': {'uri': f'spotify:album:Album{index}', 'name': f'Album {index}',
                      'images': [{'url': f'https://images.test/{index}.jpg'}]},
            'artists': [{'name': 'Artist'}], **fields}}


def test_ten_latest_distinct_playable_songs_keep_covers_and_skip_local_or_unavailable():
    history = [entry(0, is_local=True), entry(1, is_playable=False), entry(2), entry(2), {}, *[entry(n) for n in range(3, 18)]]
    tracks = recent_tracks(history)
    assert len(tracks) == 10
    assert [t['uri'] for t in tracks] == [f'spotify:track:Song{n}' for n in range(2, 12)]
    assert tracks[0]['image'] == 'https://images.test/2.jpg'
    assert tracks[0]['artist'] == 'Artist'
    assert tracks[0]['album'] == 'Album 2'
    assert len(recent_collections([entry(n) for n in range(25)])) == 20


def test_source_playlist_is_retained_without_replacing_song_artwork():
    value = entry(0)
    value['context'] = {'uri': 'spotify:playlist:Playlist1'}
    track = recent_tracks([value])[0]
    assert track['context_uri'] == 'spotify:playlist:Playlist1'
    assert track['image'] == 'https://images.test/0.jpg'
    value['context'] = {'uri': 'spotify:artist:Artist1'}
    assert list(recent_collections([value])) == ['spotify:album:Album0']


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(server, 'DATA', tmp_path)
    server.CACHE.clear()
    with TestClient(server.app, base_url=server.BASE) as client:
        yield client


def test_one_press_track_play_sends_exact_song(client, monkeypatch):
    request = AsyncMock(return_value=None)
    monkeypatch.setattr(server, 'spotify_request', request)
    response = client.post('/api/spotify/play-track', json={'track_uri':'spotify:track:Song2'}, headers={'X-Midnight-Token':server.CSRF})
    assert response.status_code == 200
    request.assert_awaited_once_with('PUT', '/play', json_body={'uris':['spotify:track:Song2']})


def test_bad_uri_extra_fields_and_missing_csrf_never_send_playback(client, monkeypatch):
    request = AsyncMock()
    monkeypatch.setattr(server, 'spotify_request', request)
    for body in [{'track_uri':'https://other.test'}, {'track_uri':'spotify:playlist:Song2'}, {'track_uri':'spotify:track:Song2','device_id':'other'}]:
        assert client.post('/api/spotify/play-track',json=body,headers={'X-Midnight-Token':server.CSRF}).status_code == 422
    assert client.post('/api/spotify/play-track',json={'track_uri':'spotify:track:Song2'}).status_code == 403
    request.assert_not_awaited()


def test_recent_endpoint_returns_tracks_and_keeps_album_shelf(client, monkeypatch):
    monkeypatch.setattr(server, 'read_json', lambda *args: {'scope':'user-read-recently-played'})
    request = AsyncMock(return_value={'items':[entry(n) for n in range(12)]})
    monkeypatch.setattr(server,'spotify_request',request)
    response = client.get('/api/spotify/recent')
    assert response.status_code == 200
    assert len(response.json()['tracks']) == 10
    assert len(response.json()['albums']) == len(response.json()['items']) == 12
    assert response.json()['playlists'] == []
    request.assert_awaited_once_with('GET','/recently-played?limit=50')


def test_like_adds_only_the_clicked_song_to_library_and_confirms_after_save(client, monkeypatch):
    monkeypatch.setattr(server,'read_json',lambda *args:{'scope':'user-library-read user-library-modify'})
    request=AsyncMock(return_value=None)
    monkeypatch.setattr(server,'spotify_request',request)
    response=client.post('/api/spotify/liked',json={'track_uri':'spotify:track:Song2'},headers={'X-Midnight-Token':server.CSRF})
    assert response.json()=={'saved':True,'track_uri':'spotify:track:Song2'}
    request.assert_awaited_once_with('PUT','/me/library?uris=spotify%3Atrack%3ASong2',player=False)
    assert client.get('/api/spotify/liked?track_uri=spotify:track:Song2').json()['saved'] is True
    assert request.await_count == 1


def test_like_permission_missing_never_mutates_library(client, monkeypatch):
    monkeypatch.setattr(server,'read_json',lambda *args:{'scope':'user-read-playback-state'})
    request=AsyncMock()
    monkeypatch.setattr(server,'spotify_request',request)
    assert client.get('/api/spotify/liked?track_uri=spotify:track:Song2').json()=={'saved':None,'can_save':False,'needs_consent':True}
    assert client.post('/api/spotify/liked',json={'track_uri':'spotify:track:Song2'},headers={'X-Midnight-Token':server.CSRF}).status_code==403
    assert client.post('/api/spotify/liked',json={'track_uri':'spotify:track:Song2'}).status_code==403
    assert client.get('/api/spotify/liked?track_uri=spotify:episode:Other').status_code==422
    request.assert_not_awaited()


def test_failed_like_does_not_cache_or_report_success(client, monkeypatch):
    from fastapi import HTTPException
    monkeypatch.setattr(server,'read_json',lambda *args:{'scope':'user-library-modify'})
    request=AsyncMock(side_effect=HTTPException(503,'Spotify unavailable'))
    monkeypatch.setattr(server,'spotify_request',request)
    response=client.post('/api/spotify/liked',json={'track_uri':'spotify:track:Song2'},headers={'X-Midnight-Token':server.CSRF})
    assert response.status_code==503
    assert ('spotify-liked','spotify:track:Song2') not in server.CACHE


def test_like_status_reads_current_library_and_rejects_invalid_result(client, monkeypatch):
    monkeypatch.setattr(server,'read_json',lambda *args:{'scope':'user-library-read user-library-modify'})
    request=AsyncMock(return_value=[False])
    monkeypatch.setattr(server,'spotify_request',request)
    assert client.get('/api/spotify/liked?track_uri=spotify:track:Song2').json()=={'saved':False,'can_save':True,'needs_consent':False}
    request.assert_awaited_once_with('GET','/me/library/contains?uris=spotify%3Atrack%3ASong2',player=False)
    request.return_value=None
    assert client.get('/api/spotify/liked?track_uri=spotify:track:Song3').status_code==502


def test_like_accepts_spotifys_empty_200_response(client, monkeypatch):
    import httpx
    monkeypatch.setattr(server,'spotify_retry_at',0)
    server.save_json('spotify.json',{'access_token':'test','expires_at':9999999999,'scope':'user-library-modify'})
    real_client=httpx.AsyncClient
    calls=[]
    def handler(request):
        calls.append(request)
        return httpx.Response(200)
    monkeypatch.setattr(server.httpx,'AsyncClient',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    response=client.post('/api/spotify/liked',json={'track_uri':'spotify:track:Song2'},headers={'X-Midnight-Token':server.CSRF})
    assert response.json()['saved'] is True
    assert len(calls)==1
    assert calls[0].method=='PUT'
    assert str(calls[0].url)=='https://api.spotify.com/v1/me/library?uris=spotify%3Atrack%3ASong2'


def test_spotify_connect_requests_liked_songs_permissions(client):
    from urllib.parse import urlsplit,parse_qs
    server.save_json('settings.json',{'spotify_client_id':'a'*32})
    response=client.post('/api/spotify/connect',headers={'X-Midnight-Token':server.CSRF})
    scopes=set(parse_qs(urlsplit(response.json()['url']).query)['scope'][0].split())
    assert {'user-library-read','user-library-modify'} <= scopes


def test_albums_and_playlist_contexts_are_separate_distinct_and_keep_recent_order():
    history = [entry(1), entry(1), entry(2), entry(3)]
    for item in history:
        item['context'] = {'uri': 'spotify:playlist:Mix1'}
    history[-1]['context'] = {'uri': 'spotify:playlist:Mix2'}
    values = recent_collections(history)
    assert list(values) == ['spotify:album:Album1', 'spotify:playlist:Mix1',
                            'spotify:album:Album2', 'spotify:album:Album3', 'spotify:playlist:Mix2']
    assert values['spotify:album:Album1']['name'] == 'Album 1'
    assert values['spotify:playlist:Mix1']['image'] is None


def test_each_history_view_gets_its_own_twenty_item_limit():
    history = [entry(n) for n in range(30)]
    for index, item in enumerate(history):
        item['context'] = {'uri': f'spotify:playlist:Mix{index}'}
    values = recent_collections(history)
    assert len(values) == 40
    assert sum('/playlist/' in item['url'] for item in values.values()) == 20
    assert sum('/album/' in item['url'] for item in values.values()) == 20
