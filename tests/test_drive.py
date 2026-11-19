"""Exercise the real Drive router with mock HTTP, never a real Google account."""
import json
import time
from urllib.parse import urlsplit,parse_qs
import httpx
import pytest
import server
from drive_recent import SCOPE,CONFIG,recent_files
from test_dashboard import client,post

CLIENT='test-client-12345.apps.googleusercontent.com';SECRET='test-secret-12345'


def network(monkeypatch,handler):
    real=httpx.AsyncClient
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kwargs:real(transport=httpx.MockTransport(handler),**kwargs))


def setup(client):
    result=post(client,'drive/connect',{'client_id':CLIENT,'client_secret':SECRET})
    assert result.status_code==200
    url=result.json()['url'];assert SECRET not in url
    values=parse_qs(urlsplit(url).query)
    assert values['scope']==[SCOPE] and values['code_challenge_method']==['S256']
    return values['state'][0]


def authorize(client,monkeypatch,token=None):
    state=setup(client)
    token=token or {'access_token':'access','refresh_token':'refresh','expires_in':3600,'scope':SCOPE}
    network(monkeypatch,lambda request:httpx.Response(200,json=token))
    return client.get('/api/drive/callback',params={'state':state,'code':'test'},follow_redirects=False)


def test_real_oauth_exchange_and_no_credential_reflection(client,monkeypatch):
    result=authorize(client,monkeypatch)
    assert result.status_code==303 and result.headers['location'].endswith('#drive-connected')
    stored=server.read_json(CONFIG,{})
    assert stored['client_secret']==SECRET and stored['token']['refresh_token']=='refresh'
    assert SECRET not in result.text and 'access' not in result.text


def test_scope_failure_does_not_commit_connection(client,monkeypatch):
    result=authorize(client,monkeypatch,{'access_token':'bad','refresh_token':'keep','scope':'wrong'})
    assert result.headers['location'].endswith('#drive-denied') and not server.read_json(CONFIG,{})


def test_oauth_state_is_one_time(client,monkeypatch):
    state=setup(client);network(monkeypatch,lambda request:httpx.Response(200,json={'access_token':'a','refresh_token':'r','scope':SCOPE}))
    assert client.get('/api/drive/callback',params={'state':state,'code':'test'},follow_redirects=False).status_code==303
    assert client.get('/api/drive/callback',params={'state':state,'code':'test'},follow_redirects=False).status_code==400


def test_refresh_and_recent_projection_shared_cache(client,monkeypatch):
    server.save_json(CONFIG,{'client_id':CLIENT,'client_secret':SECRET,'token':{'access_token':'old','refresh_token':'refresh','expires_at':0}})
    calls=[]
    def handler(request):
        calls.append(request)
        if request.method=='POST':return httpx.Response(200,json={'access_token':'new','expires_in':3600,'scope':SCOPE})
        assert request.headers['Authorization']=='Bearer new'
        return httpx.Response(200,json={'files':[{'id':'id123','name':'Plan','viewedByMeTime':'2035-01-01','webViewLink':'javascript:bad'}]})
    network(monkeypatch,handler)
    first=client.get('/api/drive/recent');second=client.get('/api/drive/recent')
    assert first.json()==second.json() and len(calls)==2
    assert first.json()['files'][0]['url']=='https://drive.google.com/open?id=id123'
    assert 'refresh' not in first.text and SECRET not in first.text
    assert server.read_json(CONFIG,{})['token']['refresh_token']=='refresh'


@pytest.mark.parametrize('status,expected',[(401,401),(403,403),(429,429),(500,502)])
def test_provider_errors_are_actionable_and_redacted(client,monkeypatch,status,expected):
    server.save_json(CONFIG,{'client_id':CLIENT,'client_secret':SECRET,'token':{'access_token':'a','refresh_token':'r','expires_at':time.time()+3600}})
    network(monkeypatch,lambda request:httpx.Response(status,json={'private':SECRET}))
    response=client.get('/api/drive/recent?refresh=true')
    assert response.status_code==expected and SECRET not in response.text and response.json()['detail']


def test_incomplete_connection_is_recoverable(client):
    server.save_json(CONFIG,{'client_id':CLIENT})
    result=client.get('/api/drive/recent?refresh=true')
    assert result.status_code==401 and 'incomplete' in result.json()['detail']


def test_reconnect_reuses_saved_setup_and_disconnect_clears_history(client):
    server.save_json(CONFIG,{'client_id':CLIENT,'client_secret':SECRET,'token':{'access_token':'a','refresh_token':'r'}})
    result=post(client,'drive/reconnect')
    assert result.status_code==200 and CLIENT in result.json()['url'] and SECRET not in result.text
    assert post(client,'drive/disconnect').status_code==200
    assert server.read_json(CONFIG,{})=={} and server.read_json(CONFIG+'.previous',{})=={}
    assert client.get('/api/drive/recent').json()=={'connected':False,'files':[]}


def test_recents_exclude_unviewed_and_unsafe_urls():
    values=[{'id':'bad space','viewedByMeTime':'now'},{'id':'unviewed'}]+[{'id':str(i),'name':'File','viewedByMeTime':'now','webViewLink':'https://docs.google.com.evil.example/x'} for i in range(5)]
    files=recent_files(values)
    assert len(files)==3 and all(f['url'].startswith('https://drive.google.com/open?') for f in files)
