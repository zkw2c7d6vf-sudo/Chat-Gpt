from unittest.mock import AsyncMock
from fastapi.testclient import TestClient
import pytest
import server

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(server,'DATA',tmp_path)
    with TestClient(server.app,base_url=server.BASE) as client:yield client

def post(client,value):return client.post('/api/spotify/options',json=value,headers={'X-Midnight-Token':server.CSRF})

@pytest.mark.parametrize('value,path',[({'volume':42},'/volume?volume_percent=42'),({'shuffle':False},'/shuffle?state=false'),({'repeat':'track'},'/repeat?state=track')])
def test_one_explicit_playback_change(client,monkeypatch,value,path):
    request=AsyncMock(return_value=None);monkeypatch.setattr(server,'spotify_request',request)
    assert post(client,value).status_code==200;request.assert_awaited_once_with('PUT',path)

def test_seek_is_clamped_within_the_current_track(client,monkeypatch):
    request=AsyncMock(side_effect=[{'item':{'duration_ms':1000}},None]);monkeypatch.setattr(server,'spotify_request',request)
    assert post(client,{'position_ms':5000}).status_code==200
    assert request.await_args.args==('PUT','/seek?position_ms=999')

def test_unavailable_or_disallowed_seek_never_changes_playback(client,monkeypatch):
    request=AsyncMock(return_value={'item':{'duration_ms':1000},'actions':{'disallows':{'seeking':True}}});monkeypatch.setattr(server,'spotify_request',request)
    assert post(client,{'position_ms':500}).status_code==409;assert request.await_count==1
    request.reset_mock();request.return_value=None
    assert post(client,{'position_ms':500}).status_code==409;assert request.await_count==1

def test_invalid_options_and_foreign_requests_are_rejected_before_spotify(client,monkeypatch):
    request=AsyncMock();monkeypatch.setattr(server,'spotify_request',request)
    for body in [{},{'volume':101},{'volume':True},{'shuffle':'false'},{'repeat':'random'},{'volume':10,'shuffle':True},{'device_id':'unexpected'}]:assert post(client,body).status_code==422
    assert client.post('/api/spotify/options',json={'volume':10}).status_code==403
    request.assert_not_awaited()

def test_calendar_notes_are_plain_data():
    data=b'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:notes\r\nDTSTART:20990101T100000Z\r\nDTEND:20990101T110000Z\r\nSUMMARY:Review\r\nDESCRIPTION:Bring the draft.\\nReview together.\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    from datetime import date
    events=server.calendar_events(data,'UTC',date(2099,1,1),date(2099,1,2));assert events[0]['description']=='Bring the draft.\nReview together.'
