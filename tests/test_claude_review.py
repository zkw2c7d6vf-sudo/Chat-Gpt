"""Current-code checks for the applicable deep-dive recommendations."""
import json
from pathlib import Path
import server
from wallpaper import FALLBACKS
from test_dashboard import client,post


def test_new_install_has_no_personal_plug_address(client):
    boot=client.get('/api/bootstrap').json()
    assert boot['settings']['plug_ip']=='' and not boot['settings']['plug_enabled']
    assert post(client,'settings',{'units':'celsius','plug_ip':''}).status_code==200
    assert post(client,'settings',{'plug_enabled':True}).status_code==422
    assert post(client,'settings',{'plug_enabled':True,'plug_ip':'192.168.1.20'}).status_code==200
    assert server.config()['plug_ip']=='192.168.1.20'


def test_saved_calendar_secret_never_round_trips_in_routine_settings(client):
    secret='https://calendar.example.com/private/bearer-secret-123/basic.ics?token=calendar-key'
    result=post(client,'settings',{'calendar_url':secret})
    assert result.status_code==200 and secret not in result.text and 'bearer-secret' not in result.text
    public=result.json()['settings']
    assert public['calendar_url']=='' and public['calendar_configured']
    assert public['calendar_url_hint']=='calendar.example.com'
    boot=client.get('/api/bootstrap')
    assert 'bearer-secret' not in boot.text and 'calendar-key' not in boot.text
    post(client,'settings',{'units':'celsius'})
    assert server.config()['calendar_url']==secret
    assert post(client,'calendar/clear').status_code==200
    assert not client.get('/api/bootstrap').json()['settings']['calendar_configured']
    assert post(client,'calendar/restore').status_code==200
    assert server.config()['calendar_url']==secret
    assert 'bearer-secret' not in client.get('/api/bootstrap').text


def test_existing_saved_device_setup_is_preserved(client):
    server.save_json('settings.json',{'plug_ip':'192.168.1.44','plug_enabled':True})
    assert post(client,'settings',{'units':'celsius'}).status_code==200
    assert server.config()['plug_ip']=='192.168.1.44'
    assert server.config()['plug_enabled']


def test_scene_metadata_has_one_authoritative_source():
    root=Path(__file__).resolve().parents[1]
    catalog=json.loads((root/'static/wallpapers/scenes.json').read_text())
    assert catalog['format']==1 and catalog['scenes']==FALLBACKS
    frontend=(root/'static/wallpaper.js').read_text()
    assert 'scenes.json' in frontend and 'Tom Fisk' not in frontend and 'Engin Akyurt' not in frontend
    for scene in catalog['scenes'].values():
        assert (root/scene['poster'].lstrip('/')).is_file()
        assert scene['page'].startswith('https://www.pexels.com/')
