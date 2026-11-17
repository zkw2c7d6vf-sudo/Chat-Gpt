"""Opt-in synthetic browser fixtures. Never used by the installed dashboard."""
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit, parse_qs
import httpx
from zoneinfo import ZoneInfo
from fastapi import HTTPException


def install(server, mode='active'):
    server.save_json('spotify.json', {'refresh_token': 'SYNTHETIC_BROWSER_FIXTURE_ONLY'})
    state={'is_playing':True,'progress_ms':90000,'shuffle_state':False,'repeat_state':'off',
           'item':{'name':'A quieter kind of afternoon','artists':[{'name':'Midnight Session'}],
                   'album':{'name':'Window Seat','release_date':'2024-03-01','images':[]},'duration_ms':240000,
                   'type':'track','external_urls':{'spotify':'https://open.spotify.com/'}},
           'device':{'name':'Studio speakers','volume_percent':37,'supports_volume':True},'actions':{'disallows':{}}}
    async def spotify(method,path,**kwargs):
        if mode=='auth':raise HTTPException(401,'Spotify sign-in expired. Reconnect in settings.')
        if mode=='idle':return None
        parsed=urlsplit(path);query=parse_qs(parsed.query)
        if method=='GET':return state
        if parsed.path=='/shuffle':state['shuffle_state']=query['state'][0]=='true'
        elif parsed.path=='/repeat':state['repeat_state']=query['state'][0]
        elif parsed.path=='/volume':state['device']['volume_percent']=int(query['volume_percent'][0])
        elif parsed.path=='/seek':state['progress_ms']=int(query['position_ms'][0])
        elif parsed.path in ('/play','/pause'):state['is_playing']=parsed.path=='/play'
        return None
    server.spotify_request=spotify
    now=datetime.now(timezone.utc).replace(second=0,microsecond=0)
    rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Midnight//Widget QA//EN']
    for i,(minutes,title,location,notes) in enumerate([(30,'Design review','Studio','Bring the draft.\nReview the next release together.'),(95,'A little time outside','Riverside path','A quiet break before the evening.'),(3*1440,'Project notes due','Workspace','Final notes for this week.')]):
        start=now+timedelta(minutes=minutes);end=start+timedelta(minutes=45)
        rows+=['BEGIN:VEVENT','UID:widget-qa-'+str(i),'DTSTAMP:'+now.strftime('%Y%m%dT%H%M%SZ'),'DTSTART:'+start.strftime('%Y%m%dT%H%M%SZ'),'DTEND:'+end.strftime('%Y%m%dT%H%M%SZ'),'SUMMARY:'+title,'LOCATION:'+location,'DESCRIPTION:'+notes.replace('\n','\\n'),'END:VEVENT']
    rows+=['END:VCALENDAR'];(server.DATA/'calendar.ics').write_text('\r\n'.join(rows))
    midnight=now.astimezone(ZoneInfo('America/New_York')).replace(hour=0,minute=0).astimezone(timezone.utc)
    hours=[int((midnight+timedelta(hours=i)).timestamp()) for i in range(168)]
    days=[int((midnight+timedelta(days=i)).timestamp()) for i in range(7)]
    current=int(now.timestamp())
    forecast={'timezone':'America/New_York','current':{'temperature_2m':54,'apparent_temperature':50,'weather_code':2,'is_day':1,'wind_speed_10m':8,'relative_humidity_2m':62},'current_units':{'wind_speed_10m':'mph'},
              'daily':{'time':days,'temperature_2m_max':[59,61,57,64,58,56,60],'temperature_2m_min':[41,44,40,46,42,39,43],'weather_code':[2,3,61,2,0,3,3],'sunrise':[d+7*3600 for d in days],'sunset':[d+17*3600 for d in days],'precipitation_probability_max':[65,20,80,10,0,25,30],'wind_speed_10m_max':[14]*7,'uv_index_max':[3]*7,'precipitation_sum':[2.1]*7},
              'daily_units':{'wind_speed_10m_max':'mph','precipitation_sum':'mm'},
              'hourly':{'time':hours,'temperature_2m':[54+(i%4) for i in range(168)],'weather_code':[2]*168,'precipitation_probability':[65 if current+2*3600<t<current+4*3600 else 10 for t in hours]}}
    original=httpx.AsyncClient
    def route(request):
        if request.url.host=='api.open-meteo.com':return httpx.Response(200,json=forecast)
        raise AssertionError('Widget fixtures must not access external services')
    transport=httpx.MockTransport(route)
    server.httpx.AsyncClient=lambda **kwargs:original(transport=transport,**kwargs)
