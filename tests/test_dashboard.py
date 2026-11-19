import asyncio
import hashlib
import ipaddress
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi.testclient import TestClient
import server


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(server, 'DATA', tmp_path)
    server.OAUTH.clear()
    server.CACHE.clear()
    monkeypatch.setattr(server, 'spotify_retry_at', 0)
    # Tests must fail before any unmocked physical-device connection.
    monkeypatch.setattr(server.Discover, 'discover_single', AsyncMock(side_effect=AssertionError('Unmocked LAN access')))
    with TestClient(server.app, base_url=server.BASE) as client:
        yield client


def post(client, path, data=None):
    return client.post('/api/' + path, json=data, headers={'X-Midnight-Token':server.CSRF})


def test_page_and_bootstrap(client):
    assert client.get('/').status_code == 200
    assert client.get('/static/app.js').status_code == 200
    boot=client.get('/api/bootstrap').json()
    assert boot['settings']['plug_ip']==''
    assert not boot['settings']['plug_enabled']
    assert not boot['spotify_connected']
    assert 'frame-ancestors' in client.get('/').headers['content-security-policy']


def test_offline_worker_is_served_at_root(client):
    response = client.get('/sw.js')
    assert response.status_code == 200
    assert 'javascript' in response.headers['content-type']
    assert response.headers['cache-control'] == 'no-store'
    assert 'midnight-shell-' in response.text


def test_static_assets_revalidate_while_html_and_private_responses_stay_uncached(client):
    asset = client.get('/static/app.js')
    assert asset.headers['cache-control'] == 'no-cache'
    reused = client.get('/static/app.js', headers={'If-None-Match': asset.headers['etag']})
    assert reused.status_code == 304
    assert reused.content == b''
    assert reused.headers['cache-control'] == 'no-cache'
    assert 'frame-ancestors' in reused.headers['content-security-policy']
    for path in ['/', '/app', '/static/index.html', '/sw.js', '/api/bootstrap', '/api/settings', '/static/missing.js']:
        assert client.get(path).headers['cache-control'] == 'no-store'


def test_mutations_need_csrf(client):
    assert client.post('/api/plug',json={'on':True}).status_code==403
    assert client.post('/api/spotify/connect').status_code==403


def test_foreign_origin_and_host(client):
    assert client.get('/api/bootstrap',headers={'Origin':'https://evil.example'}).status_code==403
    assert client.get('/api/bootstrap',headers={'Host':'evil.example:8765'}).status_code==403


def test_settings_validation(client):
    for ip in ['127.0.0.1','8.8.8.8','169.254.169.254','::1','not-ip']:
        assert post(client,'settings',{'plug_ip':ip}).status_code==422
    assert post(client,'settings',{'feeds':['http://example.com/rss']}).status_code==422
    assert post(client,'settings',{'calendar_url':'https://user:pass@example.com/a'}).status_code==422
    assert post(client,'settings',{'spotify_client_id':'bad'}).status_code==422
    assert post(client,'settings',{'units':'kelvin'}).status_code==422
    assert post(client,'settings',{'feeds':['https://example.com/a']*13}).status_code==422
    assert post(client,'settings',{'plug_ip':'192.168.1.20'}).status_code==200


def test_plug_disabled_never_discovers(client):
    assert client.get('/api/plug').status_code==409
    assert post(client,'plug',{'on':True}).status_code==409
    server.Discover.discover_single.assert_not_awaited()


def test_plug_explicit_state_and_cleanup(client,monkeypatch):
    device=SimpleNamespace(is_on=False,alias='Warmer',update=AsyncMock(),turn_on=AsyncMock(),turn_off=AsyncMock(),disconnect=AsyncMock())
    async def turn_on(): device.is_on=True
    device.turn_on.side_effect=turn_on
    discover=AsyncMock(return_value=device)
    monkeypatch.setattr(server.Discover,'discover_single',discover)
    post(client,'settings',{'plug_enabled':True,'plug_ip':'192.168.1.20'})
    assert client.get('/api/plug').json()['on'] is False
    device.turn_on.assert_not_awaited()
    device.turn_off.assert_not_awaited()
    assert post(client,'plug',{'on':True}).json()['on'] is True
    device.turn_on.assert_awaited_once()
    assert device.disconnect.await_count==2
    assert discover.await_args.args==('192.168.1.20',)


def test_plug_failure_unknown_and_no_retry(client,monkeypatch):
    device=SimpleNamespace(is_on=False,alias='Warmer',update=AsyncMock(),turn_on=AsyncMock(side_effect=OSError()),turn_off=AsyncMock(),disconnect=AsyncMock())
    monkeypatch.setattr(server.Discover,'discover_single',AsyncMock(return_value=device))
    post(client,'settings',{'plug_enabled':True,'plug_ip':'192.168.1.20'})
    r=post(client,'plug',{'on':True})
    assert r.status_code==503
    assert 'unknown' in r.json()['detail']
    device.turn_on.assert_awaited_once()
    device.disconnect.assert_awaited_once()


def test_oauth_pkce_and_state(client,monkeypatch):
    post(client,'settings',{'spotify_client_id':'a'*32})
    data=post(client,'spotify/connect').json()
    query=parse_qs(urlsplit(data['url']).query)
    assert query['code_challenge_method']==['S256']
    assert query['redirect_uri']==[server.CALLBACK]
    assert 'client_secret' not in query
    state=query['state'][0]
    verifier=server.OAUTH[state][0]
    assert len(verifier)>=43
    assert client.get('/api/spotify/callback?state=wrong&code=abc').status_code==400
    exchange=AsyncMock(return_value={'access_token':'TEST_ONLY','refresh_token':'TEST_REFRESH','expires_at':9999999999})
    monkeypatch.setattr(server,'token_exchange',exchange)
    r=client.get('/api/spotify/callback',params={'state':state,'code':'abc'},follow_redirects=False)
    assert r.status_code==303
    assert exchange.await_args.args[0]['code_verifier']==verifier
    assert client.get('/api/bootstrap').json()['spotify_connected']
    assert client.get('/api/spotify/callback',params={'state':state,'code':'abc'}).status_code==400
    assert 'TEST_ONLY' not in client.get('/api/bootstrap').text
    post(client,'spotify/disconnect')
    assert not (server.DATA/'spotify.json').exists()


def test_oauth_denial_and_expiry(client):
    server.OAUTH['denied']=('verifier',server.time.time()+60,'a'*32)
    assert client.get('/api/spotify/callback?state=denied&error=access_denied',follow_redirects=False).status_code==303
    server.OAUTH['expired']=('verifier',0,'a'*32)
    assert client.get('/api/spotify/callback?state=expired&code=abc').status_code==400


def test_spotify_disconnected(client):
    assert client.get('/api/spotify').status_code==401
    assert post(client,'spotify/control/arbitrary').status_code==400


def test_spotify_empty_and_track(client,monkeypatch):
    request=AsyncMock(return_value=None)
    monkeypatch.setattr(server,'spotify_request',request)
    assert client.get('/api/spotify').json()=={'active':False}
    request.return_value={'is_playing':True,'item':{'name':'Test song','artists':[{'name':'Test artist'}],'album':{'images':[{'url':'https://example.com/cover'}]},'duration_ms':1000},'progress_ms':10,'device':{'name':'PC'},'actions':{'disallows':{'skipping_next':True}}}
    data=client.get('/api/spotify').json()
    assert data['title']=='Test song' and data['playing']
    assert data['disallows']['skipping_next']
    assert post(client,'spotify/control/pause').status_code==200
    request.assert_awaited_with('PUT','/pause')


@pytest.mark.parametrize('status,detail',[(403,'denied'),(404,'active'),(429,'rate limit'),(401,'expired')])
def test_spotify_api_errors(client,monkeypatch,status,detail):
    server.save_json('spotify.json',{'access_token':'test','refresh_token':'refresh','expires_at':9999999999})
    real_client=httpx.AsyncClient
    transport=httpx.MockTransport(lambda req:httpx.Response(status,headers={'Retry-After':'45'},json={}))
    monkeypatch.setattr(server.httpx,'AsyncClient',lambda **kwargs:real_client(transport=transport,**kwargs))
    r=client.get('/api/spotify')
    assert r.status_code==status and detail in r.json()['detail']
    if status==429:
        assert server.spotify_retry_at>server.time.time()


def test_spotify_refresh_preserves_refresh_token(client,monkeypatch):
    server.save_json('spotify.json',{'access_token':'old','refresh_token':'keep','expires_at':0})
    exchange=AsyncMock(return_value={'access_token':'new','expires_at':9999999999})
    monkeypatch.setattr(server,'token_exchange',exchange)
    real_client=httpx.AsyncClient
    def handler(req):
        assert req.headers['authorization']=='Bearer new'
        return httpx.Response(204)
    monkeypatch.setattr(server.httpx,'AsyncClient',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    assert client.get('/api/spotify').json()=={'active':False}
    assert server.read_json('spotify.json',{})['refresh_token']=='keep'


def test_public_fetch_blocks_private_dns(client,monkeypatch):
    monkeypatch.setattr(server.socket,'getaddrinfo',lambda *args,**kwargs:[(2,1,6,'',('127.0.0.1',443))])
    with pytest.raises(ValueError,match='blocked'): server.public_fetch('https://example.com/feed')
    for url in ['http://example.com','file:///etc/passwd','https://example.com:444/a','https://u:p@example.com/a']:
        with pytest.raises(ValueError): server.validate_url(url)


def test_feed_parsing_safe_links_and_cache(client,monkeypatch):
    raw=b'<rss version="2.0"><channel><title>Source</title><item><title>&lt;script&gt;Test&lt;/script&gt;</title><link>javascript:alert(1)</link></item><item><title>Normal</title><link>https://example.com/story</link></item></channel></rss>'
    calls=[]
    def fetch(url): calls.append(url); return raw
    monkeypatch.setattr(server,'public_fetch',fetch)
    post(client,'settings',{'feeds':['https://example.com/feed']})
    data=client.get('/api/news').json()
    assert len(data['articles'])==2
    assert data['articles'][0]['url']==''
    assert data['articles'][1]['url']=='https://example.com/story'
    client.get('/api/news')
    assert len(calls)==1


def test_feed_failure_is_visible(client,monkeypatch):
    monkeypatch.setattr(server,'public_fetch',lambda url:(_ for _ in ()).throw(OSError()))
    post(client,'settings',{'feeds':['https://example.com/feed']})
    data=client.get('/api/news').json()
    assert data['errors'] and not data['articles']


def test_calendar_import_recurring_all_day_and_clear(client):
    tomorrow=datetime.now(timezone.utc)+timedelta(days=1)
    dt=tomorrow.strftime('%Y%m%dT120000Z')
    day=tomorrow.strftime('%Y%m%d')
    ics=f'''BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//Test//EN\r
BEGIN:VEVENT\r
UID:repeat\r
DTSTART:{dt}\r
DURATION:PT1H\r
RRULE:FREQ=DAILY;COUNT=3\r
SUMMARY:Recurring test\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:day\r
DTSTART;VALUE=DATE:{day}\r
SUMMARY:All day test\r
END:VEVENT\r
END:VCALENDAR\r
'''
    assert post(client,'calendar/import',{'content':ics}).status_code==200
    data=client.get('/api/calendar?tz=America/New_York').json()
    assert data['configured']
    assert len([e for e in data['events'] if e['title']=='Recurring test'])==3
    assert any(e['all_day'] for e in data['events'])
    assert post(client,'calendar/import',{'content':'not ics'}).status_code==400
    assert post(client,'calendar/clear').status_code==200
    assert not client.get('/api/calendar').json()['configured']


def test_weather_validation_and_cache(client,monkeypatch):
    assert client.get('/api/weather?lat=100&lon=0').status_code==400
    calls=[]
    real_client=httpx.AsyncClient
    def handler(req):
        calls.append(req)
        assert req.url.params['timezone']=='auto'
        return httpx.Response(200,json={'timezone':'America/New_York','current':{'temperature_2m':60}})
    monkeypatch.setattr(server.httpx,'AsyncClient',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    assert client.get('/api/weather?lat=40&lon=-74').status_code==200
    assert client.get('/api/weather?lat=40&lon=-74').status_code==200
    assert len(calls)==1


def test_spotify_album_metadata(client,monkeypatch):
    monkeypatch.setattr(server,'spotify_request',AsyncMock(return_value={'is_playing':True,'item':{'name':'Song','artists':[{'name':'Artist'}],'album':{'name':'Album','images':[]}}}))
    data=client.get('/api/spotify').json()
    assert data['artist']=='Artist' and data['album']=='Album'


def test_news_thumbnail_and_html_image_extraction(client,monkeypatch):
    raw=b'''<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Photos</title><item><title>Thumbnail</title><media:thumbnail url="https://example.com/photo.jpg"/></item><item><title>HTML</title><description>&lt;img src="/photo.png"&gt;</description></item></channel></rss>'''
    monkeypatch.setattr(server,'public_fetch',lambda url:raw)
    articles=server.news_fetch('https://example.com/feed')
    assert articles[0]['image']=='https://example.com/photo.jpg'
    assert articles[1]['image']=='https://example.com/photo.png'


def test_news_preview_only_configured_images_and_raster_formats(client,monkeypatch):
    fetch=__import__('unittest.mock',fromlist=['Mock']).Mock(return_value=b'\xff\xd8\xffTEST')
    monkeypatch.setattr(server,'public_fetch',fetch)
    image='https://example.com/image.jpg'
    assert client.get('/api/news/image',params={'url':image}).status_code==404
    fetch.assert_not_called()
    post(client,'settings',{'feeds':['https://example.com/rss']})
    server.CACHE[('rss','https://example.com/rss')]=(9999999999,[{'image':image}])
    r=client.get('/api/news/image',params={'url':image})
    assert r.status_code==200 and r.headers['content-type']=='image/jpeg'
    fetch.return_value=b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    assert client.get('/api/news/image',params={'url':image}).status_code==415
    post(client,'settings',{'feeds':[]})
    assert client.get('/api/news/image',params={'url':image}).status_code==404


def test_news_preview_private_servers_are_blocked(client,monkeypatch):
    post(client,'settings',{'feeds':['https://example.com/rss']})
    image='https://127.0.0.1/private.png'
    server.CACHE[('rss','https://example.com/rss')]=(9999999999,[{'image':image}])
    monkeypatch.setattr(server.socket,'getaddrinfo',lambda *args,**kwargs:[(2,1,6,'',('127.0.0.1',443))])
    assert client.get('/api/news/image',params={'url':image}).status_code==502


def test_spotify_release_year(client,monkeypatch):
    for value,expected in [('1979-04-23','1979'),('2009','2009'),('1981-12','1981'),('',None),('unknown',None)]:
        assert server.release_year({'album':{'release_date':value}})==expected
    monkeypatch.setattr(server,'spotify_request',AsyncMock(return_value={'item':{'name':'Track','album':{'release_date':'1979-01-01'}}}))
    assert client.get('/api/spotify').json()['release_year']=='1979'


def seed_reader(client):
    post(client,'settings',{'feeds':['https://example.com/feed']})
    article={'title':'Test article','url':'https://example.com/story','source':'Test source','summary':'A short feed summary.', 'published':''}
    server.CACHE[('rss','https://example.com/feed')]=(9999999999,[article])
    return article


def test_article_reader_restricted_to_current_feeds(client,monkeypatch):
    reader=__import__('unittest.mock',fromlist=['Mock']).Mock(return_value='Never called')
    monkeypatch.setattr(server,'article_text',reader)
    assert client.get('/api/news/article',params={'url':'https://example.com/arbitrary'}).status_code==404
    reader.assert_not_called()


def test_article_reader_text_and_cache(client,monkeypatch):
    article=seed_reader(client)
    text='A readable article paragraph with enough detail to extract as the main body. '*4
    reader=__import__('unittest.mock',fromlist=['Mock']).Mock(return_value=text)
    monkeypatch.setattr(server,'article_text',reader)
    data=client.get('/api/news/article',params={'url':article['url']}).json()
    assert data['mode']=='article' and data['content']==text and data['notice']==''
    client.get('/api/news/article',params={'url':article['url']})
    reader.assert_called_once()
    post(client,'settings',{'feeds':[]})
    assert client.get('/api/news/article',params={'url':article['url']}).status_code==404


def test_article_reader_falls_back_to_feed(client,monkeypatch):
    article=seed_reader(client)
    monkeypatch.setattr(server,'article_text',lambda url:(_ for _ in ()).throw(OSError()))
    data=client.get('/api/news/article',params={'url':article['url']}).json()
    assert data['mode']=='feed' and data['content']==article['summary'] and data['notice']


def test_article_extraction_and_subscription_marker(client,monkeypatch):
    paragraph='This is a detailed article paragraph about a local community project, describing the research, findings and public results in accessible language. '
    raw=('<!doctype html><html><body><nav>Do not include this menu</nav><article><h1>Headline</h1><p>'+paragraph*3+'</p><p>'+paragraph*3+'</p></article><script>alert(1)</script></body></html>').encode()
    def fetch(url,allow_html=False):
        assert allow_html
        return raw
    monkeypatch.setattr(server,'public_fetch',fetch)
    text=server.article_text('https://example.com/story')
    assert paragraph.strip() in text and 'alert(1)' not in text
    raw=b'<html><script type="application/ld+json">{"isAccessibleForFree":false,"articleBody":"restricted"}</script></html>'
    assert server.article_text('https://example.com/story') is None


def test_feed_summary_is_plain_text(client,monkeypatch):
    assert server.plain_text('<p>Hello <b>world</b>.</p><script>bad()</script><style>badcss</style><p>Next.</p>')=='Hello world.\n\nNext.'
    raw=b'<rss version="2.0"><channel><title>Feed</title><item><title>Title</title><description>&lt;p&gt;Reader summary&lt;/p&gt;</description></item></channel></rss>'
    monkeypatch.setattr(server,'public_fetch',lambda url:raw)
    assert server.news_fetch('https://example.com/feed')[0]['summary']=='Reader summary'


def test_weather_forecast_and_city_search(client,monkeypatch):
    real_client=httpx.AsyncClient
    def handler(req):
        if req.url.host=='geocoding-api.open-meteo.com':
            assert req.url.params['name']=='Paris'
            return httpx.Response(200,json={'results':[{'name':'Paris','admin1':'Ile-de-France','country':'France','latitude':48.85,'longitude':2.35}]})
        assert req.url.params['forecast_days']=='7'
        assert req.url.params['timeformat']=='unixtime'
        assert 'precipitation_probability' in req.url.params['hourly']
        assert 'sunrise' in req.url.params['daily']
        assert req.url.params['wind_speed_unit']=='mph'
        return httpx.Response(200,json={'timezone':'Europe/Paris'})
    monkeypatch.setattr(server.httpx,'AsyncClient',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    assert client.get('/api/weather/search?q=x').status_code==400
    result=client.get('/api/weather/search?q=Paris').json()['results'][0]
    assert result['country']=='France' and result['latitude']==48.85
    assert client.get('/api/weather?lat=48.85&lon=2.35').status_code==200


def test_calendar_full_range_and_invalid_ranges(client):
    raw = '''BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:past\r
DTSTART:20200103T140000Z\r
DTEND:20200103T150000Z\r
SUMMARY:Past event\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:future\r
DTSTART;VALUE=DATE:20350509\r
DTEND;VALUE=DATE:20350511\r
SUMMARY:Future all-day\r
END:VEVENT\r
END:VCALENDAR\r
'''
    assert post(client, 'calendar/import', {'content': raw}).status_code == 200
    past = client.get('/api/calendar?tz=America/New_York&start=2020-01-01&end=2020-02-01').json()
    assert [e['title'] for e in past['events']] == ['Past event']
    future = client.get('/api/calendar?tz=America/New_York&start=2035-05-01&end=2035-06-01').json()
    assert future['events'][0]['title'] == 'Future all-day'
    assert future['events'][0]['all_day']
    for query in ['start=2020-01-01', 'start=bad&end=2020-02-01', 'start=2020-02-01&end=2020-01-01', 'start=2020-01-01&end=2021-01-01']:
        assert client.get('/api/calendar?' + query).status_code == 400


def test_calendar_import_rejects_bad_events_and_keeps_previous_file(client, monkeypatch):
    valid = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:ok\r\nDTSTART:20300101T120000Z\r\nSUMMARY:Keep me\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    assert post(client, 'settings', {'calendar_url': 'https://example.com/calendar.ics'}).status_code == 200
    assert post(client, 'calendar/import', {'content': valid}).status_code == 200
    assert server.config()['calendar_url'] == ''
    assert server.DATA.joinpath('calendar.ics').read_text() == valid.replace('\r\n', '\n')
    invalid = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:bad\r\nSUMMARY:No start\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    assert post(client, 'calendar/import', {'content': invalid}).status_code == 400
    assert 'Keep me' in server.DATA.joinpath('calendar.ics').read_text()
    original = server.os.replace
    monkeypatch.setattr(server.os, 'replace', lambda *args: (_ for _ in ()).throw(OSError('disk full')))
    with pytest.raises(OSError):
        post(client, 'calendar/import', {'content': valid.replace('Keep me', 'Replacement')})
    assert 'Keep me' in server.DATA.joinpath('calendar.ics').read_text()
    monkeypatch.setattr(server.os, 'replace', original)


def test_calendar_duration_and_recurring_exclusions(client):
    raw = '''BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:duration\r
DTSTART;TZID=America/New_York:20350510T090000\r
DURATION:PT2H\r
RRULE:FREQ=DAILY;COUNT=3\r
EXDATE;TZID=America/New_York:20350511T090000\r
SUMMARY:Two-hour class\r
END:VEVENT\r
END:VCALENDAR\r
'''
    assert post(client, 'calendar/import', {'content': raw}).status_code == 200
    events = client.get('/api/calendar?tz=America/New_York&start=2035-05-01&end=2035-06-01').json()['events']
    assert len(events) == 2
    assert all(datetime.fromisoformat(event['end']) - datetime.fromisoformat(event['start']) == timedelta(hours=2) for event in events)
    assert all('2035-05-11' not in event['start'] for event in events)
