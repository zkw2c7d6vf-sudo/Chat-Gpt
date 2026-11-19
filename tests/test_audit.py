"""Audit regressions use temporary data and fake HTTP/device boundaries only."""
import json
from datetime import datetime,timedelta,timezone
import httpx
import pytest
import server
from test_dashboard import client,post


def ics(events):return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//test//EN\r\n'+''.join('BEGIN:VEVENT\r\n'+e+'\r\nEND:VEVENT\r\n' for e in events)+'END:VCALENDAR\r\n'


def test_scoped_settings_preserve_other_windows(client):
    assert post(client,'settings',{'feeds':['https://example.com/new']}).status_code==200
    result=post(client,'settings',{'units':'celsius'}).json()
    assert result['settings']['feeds']==['https://example.com/new']
    assert result['settings']['units']=='celsius'


def test_wrong_shape_and_invalid_settings_recover_previous(client):
    server.save_json('settings.json',{'units':'celsius'})
    server.save_json('settings.json',[])
    assert server.config()['units']=='celsius'
    assert 'settings.json' in client.get('/api/bootstrap').json()['configuration_warnings']
    server.save_json('settings.json',{'feeds':'wrong shape'})
    assert isinstance(server.config()['feeds'],list)


def test_received_chunked_bytes_are_limited(client):
    chunks=(b'x'*700000 for _ in range(3))
    result=client.post('/api/settings',content=chunks,headers={'X-Midnight-Token':server.CSRF,'Transfer-Encoding':'chunked'})
    assert result.status_code==413
    assert '2 MB' in result.json()['detail']


def test_calendar_identity_and_midnight_points(client):
    raw=ics(['UID:a\r\nDTSTART:20350101T000000Z\r\nDTEND:20350101T000000Z\r\nSUMMARY:Same',
             'UID:b\r\nDTSTART:20350101T000000Z\r\nDTEND:20350101T000000Z\r\nSUMMARY:Same'])
    events=server.calendar_events(raw,'UTC',datetime(2035,1,1).date(),datetime(2035,1,3).date())
    assert len(events)==2 and len({e['id'] for e in events})==2
    assert events[0]['start']==events[0]['end']


def test_calendar_exposes_large_result_limit(client):
    raw=ics([f'UID:e{i}\r\nDTSTART:20350101T090000Z\r\nDTEND:20350101T100000Z\r\nSUMMARY:Event {i}' for i in range(2001)])
    assert len(server.calendar_events(raw,'UTC',datetime(2035,1,1).date(),datetime(2035,1,2).date()))==2001
    (server.DATA/'calendar.ics').write_text(raw)
    result=client.get('/api/calendar?tz=UTC&start=2035-01-01&end=2035-01-02').json()
    assert len(result['events'])==2000 and result['truncated']


def test_dense_recurrence_rejected_before_expansion(client,monkeypatch):
    def forbidden(*args):raise AssertionError('Dense recurrence reached library expansion')
    monkeypatch.setattr(server.recurring_ical_events,'of',forbidden)
    result=post(client,'calendar/import',{'content':ics(['UID:dense\r\nDTSTART:20000101T000000Z\r\nRRULE:FREQ=SECONDLY\r\nSUMMARY:Dense'])})
    assert result.status_code==400
    assert not (server.DATA/'calendar.ics').exists()


def test_calendar_replacement_and_removal_recover(client):
    first=ics(['UID:a\r\nDTSTART:20350101T090000Z\r\nSUMMARY:Original'])
    second=first.replace('Original','Replacement')
    assert post(client,'calendar/import',{'content':first}).status_code==200
    assert post(client,'calendar/import',{'content':second}).status_code==200
    assert post(client,'calendar/restore').status_code==200
    assert 'Original' in (server.DATA/'calendar.ics').read_text()
    assert post(client,'calendar/clear').status_code==200
    assert post(client,'calendar/restore').status_code==200
    assert 'Original' in (server.DATA/'calendar.ics').read_text()


def test_forced_calendar_refresh_bypasses_cache_once(client,monkeypatch):
    calls=[]
    def fetch(url):calls.append(url);return ics(['UID:a\r\nDTSTART:20350101T090000Z\r\nSUMMARY:'+str(len(calls))]).encode()
    monkeypatch.setattr(server,'public_fetch',fetch)
    post(client,'settings',{'calendar_url':'https://example.com/calendar.ics'})
    client.get('/api/calendar');client.get('/api/calendar')
    assert len(calls)==1
    client.get('/api/calendar?refresh=true');assert len(calls)==2
    client.get('/api/calendar?refresh=true');assert len(calls)==2


def test_invalid_calendar_validation_keeps_snapshot(client):
    raw=ics(['UID:a\r\nDTSTART:20350101T090000Z\r\nSUMMARY:Original'])
    post(client,'calendar/import',{'content':raw})
    assert post(client,'calendar/validate',{'content':'not a calendar'}).status_code==400
    assert 'Original' in (server.DATA/'calendar.ics').read_text()
