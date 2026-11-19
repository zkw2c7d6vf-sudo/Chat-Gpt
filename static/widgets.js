/* Extra capability lives one tap away; the home keeps its three glanceable cards. */
'use strict';
window.MidnightWidgets=(()=>{
 const $=id=>document.getElementById(id),core=MidnightWidgetCore,api=(path,body)=>MidnightApp.request(path,body===undefined?{}:{method:'POST',body:JSON.stringify(body)});
 let commandBusy=false,event=null,lastAgenda='',lastMinute=-1,lastProgress='',lastWeather='';
 const make=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
 const icon=(id,name)=>$(id).replaceChildren(MidnightIcons.make(name));
 for(const [id,name] of Object.entries({closePlayback:'close',closeEventDetails:'close',detailPrevious:'previous',detailNext:'next'}))icon(id,name);
 $('closePlayback').onclick=()=>MidnightUI.close($('playbackDialog'));$('closeEventDetails').onclick=()=>MidnightUI.close($('eventDetailsDialog'));
 function renderPlayer(){
  const state=MidnightApp.snapshot(),p=state.player,auth=state.spotify||{},active=!!p?.active,dis=p?.disallows||{};
  $('connectSpotify').hidden=!!auth.connected&&!auth.authRequired;$('connectSpotify').textContent=auth.authRequired?'Reconnect Spotify':'Connect Spotify';
  $('music').querySelector('.cardFoot > a').hidden=!$('connectSpotify').hidden;
  $('musicMore').hidden=!auth.connected&&!active;$('musicMore').title=active?'Spotify controls · '+p.device:'Spotify controls';
  if(!$('playbackDialog').open)return;
  $('detailTrack').textContent=active?p.title:auth.authRequired?'Sign in to Spotify':auth.connected?'No active player':'Connect Spotify';
  $('detailArtist').textContent=active?p.artist:'';$('detailAlbum').textContent=active?p.album:'';$('detailYear').textContent=active&&p.release_year?p.release_year:'';
  const image=active&&/^https:\/\//.test(p.image||'')?p.image:null;$('detailAlbumArt').hidden=!image;$('playbackArtEmpty').hidden=!!image;if(image&&$('detailAlbumArt').getAttribute('src')!==image)$('detailAlbumArt').src=image;
  $('detailPrevious').disabled=commandBusy||!active||!!dis.skipping_prev;$('detailNext').disabled=commandBusy||!active||!!dis.skipping_next;
  $('detailPlay').disabled=commandBusy||!active||!!(p?.playing?dis.pausing:dis.resuming);setPlaybackIcon($('detailPlay'),!!p?.playing);$('detailPlay').setAttribute('aria-label',p?.playing?'Pause':'Play');
  $('detailSeek').disabled=commandBusy||!active||!!dis.seeking;
  $('detailShuffle').disabled=commandBusy||!active||!!dis.toggling_shuffle;$('detailShuffle').setAttribute('aria-pressed',String(!!p?.shuffle));
  $('detailRepeat').disabled=commandBusy||!active||!!dis.toggling_repeat_context||!!dis.toggling_repeat_track;if(document.activeElement!==$('detailRepeat'))$('detailRepeat').value=p?.repeat||'off';
  const volume=active&&p.supports_volume&&typeof p.volume==='number';$('detailVolume').disabled=commandBusy||!volume;
  if(document.activeElement!==$('detailVolume')){$('detailVolume').value=volume?p.volume:0;$('detailVolumeValue').textContent=volume?p.volume+'%':'';}
  $('detailDevice').textContent=active?'Listening on '+p.device:'Open Spotify on a device';$('volumeNotice').textContent=active&&!volume?'Volume is managed in Spotify on this player.':'';
  $('playbackConnect').hidden=!!auth.connected&&!auth.authRequired;$('playbackConnect').textContent=auth.authRequired?'Reconnect Spotify':'Connect Spotify';
  $('detailSpotifyLink').href=active&&/^https:\/\/open\.spotify\.com\//.test(p.url||'')?p.url:'https://open.spotify.com/';
  if(!commandBusy)$('playbackStatus').textContent=auth.message||(!active?'Start a song in Spotify to use playback controls.':'');
  renderProgress();
 }
 function renderProgress(){
  if(!$('playbackDialog').open||document.activeElement===$('detailSeek'))return;
  const p=MidnightApp.playerSnapshot(),elapsed=p?.active?Math.min(p.duration,p.progress+(p.playing?Date.now()-p.fetched:0)):0;
  const signature=[Math.floor(elapsed/1000),p?.duration].join(':');if(signature===lastProgress)return;lastProgress=signature;
  $('detailSeek').value=p?.duration?Math.round(elapsed/p.duration*1000):0;$('detailElapsed').textContent=duration(elapsed);$('detailDuration').textContent=duration(p?.duration||0);$('detailSeek').setAttribute('aria-valuetext',duration(elapsed)+' of '+duration(p?.duration||0));
 }
 async function run(path,body){
  if(commandBusy)return;commandBusy=true;renderPlayer();$('playbackStatus').textContent='Updating Spotify…';
  try{await api(path,body);await new Promise(resolve=>setTimeout(resolve,350));await MidnightApp.refreshPlayer();commandBusy=false;renderPlayer();}
  catch(error){commandBusy=false;renderPlayer();$('playbackStatus').textContent=error.message;}
 }
 function openPlayer(){MidnightUI.open($('playbackDialog'));renderPlayer();}
 $('musicMore').onclick=openPlayer;const record=document.querySelector('.turntable');record.setAttribute('role','button');record.tabIndex=0;record.setAttribute('aria-label','Open now playing');record.onclick=e=>{if(e.target.closest('button,a,input,select,textarea'))return;openPlayer();};record.onkeydown=e=>{if(e.target!==record)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();openPlayer();}};
 $('detailPlay').onclick=()=>run('spotify/control/'+(MidnightApp.snapshot().player?.playing?'pause':'play'),{});$('detailPrevious').onclick=()=>run('spotify/control/previous',{});$('detailNext').onclick=()=>run('spotify/control/next',{});
 $('detailShuffle').onclick=()=>run('spotify/options',{shuffle:!MidnightApp.snapshot().player?.shuffle});$('detailRepeat').onchange=()=>run('spotify/options',{repeat:$('detailRepeat').value});
 $('detailVolume').oninput=()=>{$('detailVolumeValue').textContent=$('detailVolume').value+'%';};$('detailVolume').onchange=()=>run('spotify/options',{volume:Number($('detailVolume').value)});
 $('detailSeek').oninput=()=>{const p=MidnightApp.snapshot().player;const value=(p?.duration||0)*Number($('detailSeek').value)/1000;$('detailElapsed').textContent=duration(value);$('detailSeek').setAttribute('aria-valuetext',duration(value)+' of '+duration(p?.duration||0));};$('detailSeek').onchange=()=>{const p=MidnightApp.snapshot().player;if(p?.active)run('spotify/options',{position_ms:Math.min(p.duration-1,Math.round(p.duration*Number($('detailSeek').value)/1000))});};
 $('playbackConnect').onclick=()=>MidnightApp.connectSpotify().catch(error=>$('playbackStatus').textContent=error.message);
 $('detailAlbumArt').onerror=()=>{$('detailAlbumArt').hidden=true;$('playbackArtEmpty').hidden=false;};
 function renderWeather(){const weather=MidnightApp.weatherSnapshot(),data=weather.data;const signature=JSON.stringify([data?.current,weather.loading,weather.message,data?core.outlook(data,Date.now(),weather.timezone):'']);if(signature===lastWeather)return;lastWeather=signature;$('weatherCurrent').hidden=!data;if(!data){$('weatherInsight').textContent='';return;}$('weatherCurrentIcon').replaceChildren(weatherIcon(data.current.weather_code,!!data.current.is_day));$('weatherInsight').textContent=weather.loading?'Updating forecast…':weather.message?'Saved forecast · refresh unavailable':core.outlook(data,Date.now(),weather.timezone);$('weatherInsight').title=$('weatherInsight').textContent;}
 $('weatherCurrent').onclick=()=>MidnightApp.openWeather();
 const when=e=>{const tz=MidnightApp.timezone(),date=new Intl.DateTimeFormat(undefined,{timeZone:tz,weekday:'short',month:'short',day:'numeric'}).format(new Date(e.start));return date+' · '+(e.all_day?'All day':core.time(e.start,tz)+(Date.parse(e.start)===Date.parse(e.end)?'':' – '+core.time(e.end,tz)));};
 function renderEventNotes(description){
  const target=$('eventDetailNotes');target.replaceChildren();
  for(const line of (description||'').split(/\r?\n/)){
   if(!line.trim())continue;
   const row=make('p','eventNoteLine'),matches=[...line.matchAll(/https?:\/\/[^\s<>"']+/gi)];let position=0;
   for(const match of matches){
    let url=match[0].replace(/[.,;!]+$/,'');
    // Keep balanced parentheses in URLs, but leave surrounding punctuation in the note.
    while(url.endsWith(')')&&(url.match(/\)/g)||[]).length>(url.match(/\(/g)||[]).length)url=url.slice(0,-1);
    let address;try{address=new URL(url);}catch{continue;}
    const before=line.slice(position,match.index),after=line.slice(match.index+url.length);
    const label=matches.length===1&&!after.trim()?before.match(/^\s*(.+?)\s+(?:-|–|—)\s*$/)?.[1]:null;
    if(!label)row.append(document.createTextNode(before));
    const name=label||'Open '+address.hostname.replace(/^www\./,''),link=make('a','eventNoteLink');
    link.href=address.href;link.target='_blank';link.rel='noopener noreferrer';link.title=address.href;link.setAttribute('aria-label',name+' (opens in a new tab)');
    const arrow=make('span','eventNoteArrow','↗');arrow.setAttribute('aria-hidden','true');link.append(make('span','',name),arrow);row.append(link);position=match.index+url.length;
   }
   row.append(document.createTextNode(line.slice(position)));target.append(row);
  }
  target.hidden=!target.childElementCount;
 }
 function openEvent(value){event={...value};$('eventDetailCountdown').textContent=core.relative(event,Date.now(),MidnightApp.timezone());$('eventDetailTitle').textContent=event.title;$('eventDetailWhen').textContent=when(event);$('eventDetailLocation').textContent=event.location||'';$('eventDetailLocation').hidden=!event.location;renderEventNotes(event.description);$('eventDetailMap').hidden=!event.location;if(event.location)$('eventDetailMap').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(event.location);$('eventDetailStatus').textContent='';MidnightUI.open($('eventDetailsDialog'));}
 $('eventDetailCalendar').onclick=()=>{if(!event)return;MidnightUI.close($('eventDetailsDialog'));MidnightCalendar.openEvent(event);};$('eventDetailCopy').onclick=async()=>{if(!event)return;try{await navigator.clipboard.writeText([event.title,when(event),event.location,event.description].filter(Boolean).join('\n'));$('eventDetailStatus').textContent='Event details copied.';}catch{$('eventDetailStatus').textContent='Clipboard unavailable in this browser.';}};
 function agendaRow(value, timezone, now, detail=''){
  const row=make('button','agendaPreviewRow'+(detail?' todayEvent':' followingEvent'));
  row.type='button';
  row.onclick=()=>openEvent(value);
  const date=new Date(value.start),today=core.dateKey(date,timezone)===core.dateKey(now,timezone);
  const day=today?'Today':new Intl.DateTimeFormat(undefined,{timeZone:timezone,weekday:'short'}).format(date);
  const time=make('span','agendaWhen');
  time.append(make('span','',day),make('small','',value.all_day?'All day':core.time(value.start,timezone)));
  const content=make('span','agendaText');
  content.append(make('strong','',value.title));
  if(detail)content.append(make('small','eventCountdown',detail));
  row.append(time,content);
  row.title=value.title;
  return row;
 }
 function renderAgenda(){
  const snapshot=MidnightApp.snapshot(),now=Date.now(),timezone=MidnightApp.timezone();
  const events=[...snapshot.events,...(window.MidnightCalendar?.snapshot()||[])];
  const plan=core.agenda(events,now,timezone);
  const signature=JSON.stringify([plan,timezone,snapshot.calendarSource,snapshot.calendarImportedAt,snapshot.calendarLoaded,snapshot.calendarConfigured,snapshot.calendarFailed,snapshot.calendarTruncated]);
  if(signature===lastAgenda)return;
  lastAgenda=signature;
  const target=$('todayNextEvent');
  target.replaceChildren();
  $('nextEvent').dataset.live=String(plan.live);
  $('nextTitle').textContent=plan.live?'Happening now':'Up next';
  let status='';
  if(snapshot.calendarFailed)status='Refresh unavailable';
  else if(snapshot.calendarSource==='Imported file'){
   const imported=Date.parse(snapshot.calendarImportedAt);
   status=Number.isFinite(imported)?'Imported '+new Intl.DateTimeFormat(undefined,{timeZone:timezone,month:'short',day:'numeric',year:'numeric'}).format(imported):'Imported calendar';
  }else if(plan.todayCount)status=plan.todayCount+' remaining today';
  $('agendaSummary').textContent=(snapshot.calendarTruncated?'Limited to 2,000 events · ':'')+status;
  if(plan.current){
   target.append(agendaRow(plan.current,timezone,now,plan.label));
   for(const upcoming of plan.upcoming)target.append(agendaRow(upcoming,timezone,now));
  }else{
   target.append(make('p','todayEmpty',snapshot.calendarFailed?'Calendar unavailable.':!snapshot.calendarLoaded?'Loading calendar…':snapshot.calendarConfigured?'No upcoming events.':'Connect your calendar.'));
   if(snapshot.calendarLoaded&&!snapshot.calendarConfigured){
    const button=make('button','textButton','Add calendar');
    button.onclick=()=>MidnightApp.openSettings('calendar');
    target.append(button);
   }
  }
 }
 addEventListener('midnight:player',renderPlayer);addEventListener('midnight:weather',renderWeather);addEventListener('midnight:data',renderAgenda);addEventListener('midnight:calendar-view',renderAgenda);
 addEventListener('midnight:tick',()=>{if(document.hidden)return;renderProgress();const minute=Math.floor(Date.now()/60000);if(lastMinute!==minute){lastMinute=minute;renderAgenda();renderWeather();if(event&&$('eventDetailsDialog').open)$('eventDetailCountdown').textContent=core.relative(event,Date.now(),MidnightApp.timezone());}});
 renderPlayer();renderWeather();renderAgenda();return {renderAgenda,openEvent};
})();
