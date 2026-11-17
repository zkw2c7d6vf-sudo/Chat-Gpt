/* Extra capability lives one tap away; the home keeps its three glanceable cards. */
'use strict';
window.MidnightWidgets=(()=>{
 const $=id=>document.getElementById(id),core=MidnightWidgetCore,api=(path,body)=>MidnightApp.request(path,body===undefined?{}:{method:'POST',body:JSON.stringify(body)});
 let commandBusy=false,event=null,lastAgenda='',lastMinute=-1;
 const make=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
 const icon=(id,name)=>$(id).replaceChildren(MidnightIcons.make(name));
 for(const [id,name] of Object.entries({closePlayback:'close',closeEventDetails:'close',detailPrevious:'previous',detailNext:'next'}))icon(id,name);
 $('closePlayback').onclick=()=>MidnightUI.close($('playbackDialog'));$('closeEventDetails').onclick=()=>MidnightUI.close($('eventDetailsDialog'));
 function renderPlayer(){
  const state=MidnightApp.snapshot(),p=state.player,auth=state.spotify||{},active=!!p?.active,dis=p?.disallows||{};
  $('connectSpotify').hidden=!!auth.connected&&!auth.authRequired;$('connectSpotify').textContent=auth.authRequired?'Reconnect Spotify ↗':'Connect Spotify ↗';
  $('musicMore').hidden=!auth.connected&&!active;$('musicDeviceLabel').textContent=active?p.device:'Controls';$('musicMore').title=active?'Listening on '+p.device:'Spotify details and controls';
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
  const p=MidnightApp.snapshot().player,elapsed=p?.active?Math.min(p.duration,p.progress+(p.playing?Date.now()-p.fetched:0)):0;
  $('detailSeek').value=p?.duration?Math.round(elapsed/p.duration*1000):0;$('detailElapsed').textContent=duration(elapsed);$('detailDuration').textContent=duration(p?.duration||0);$('detailSeek').setAttribute('aria-valuetext',duration(elapsed)+' of '+duration(p?.duration||0));
 }
 async function run(path,body){
  if(commandBusy)return;commandBusy=true;renderPlayer();$('playbackStatus').textContent='Updating Spotify…';
  try{await api(path,body);await new Promise(resolve=>setTimeout(resolve,350));await MidnightApp.refreshPlayer();commandBusy=false;renderPlayer();}
  catch(error){commandBusy=false;renderPlayer();$('playbackStatus').textContent=error.message;}
 }
 function openPlayer(){MidnightUI.open($('playbackDialog'));renderPlayer();}
 $('musicMore').onclick=openPlayer;const record=document.querySelector('.turntable');record.setAttribute('role','button');record.tabIndex=0;record.setAttribute('aria-label','Open now playing');record.onclick=openPlayer;record.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPlayer();}};
 $('detailPlay').onclick=()=>run('spotify/control/'+(MidnightApp.snapshot().player?.playing?'pause':'play'),{});$('detailPrevious').onclick=()=>run('spotify/control/previous',{});$('detailNext').onclick=()=>run('spotify/control/next',{});
 $('detailShuffle').onclick=()=>run('spotify/options',{shuffle:!MidnightApp.snapshot().player?.shuffle});$('detailRepeat').onchange=()=>run('spotify/options',{repeat:$('detailRepeat').value});
 $('detailVolume').oninput=()=>{$('detailVolumeValue').textContent=$('detailVolume').value+'%';};$('detailVolume').onchange=()=>run('spotify/options',{volume:Number($('detailVolume').value)});
 $('detailSeek').oninput=()=>{const p=MidnightApp.snapshot().player;const value=(p?.duration||0)*Number($('detailSeek').value)/1000;$('detailElapsed').textContent=duration(value);$('detailSeek').setAttribute('aria-valuetext',duration(value)+' of '+duration(p?.duration||0));};$('detailSeek').onchange=()=>{const p=MidnightApp.snapshot().player;if(p?.active)run('spotify/options',{position_ms:Math.min(p.duration-1,Math.round(p.duration*Number($('detailSeek').value)/1000))});};
 $('playbackConnect').onclick=()=>MidnightApp.connectSpotify().catch(error=>$('playbackStatus').textContent=error.message);
 $('detailAlbumArt').onerror=()=>{$('detailAlbumArt').hidden=true;$('playbackArtEmpty').hidden=false;};
 function renderWeather(){const weather=MidnightApp.weatherSnapshot(),data=weather.data;$('weatherCurrent').hidden=!data;if(!data){$('weatherInsight').textContent='';return;}$('weatherCurrentIcon').replaceChildren(weatherIcon(data.current.weather_code,!!data.current.is_day));$('weatherInsight').textContent=weather.loading?'Updating forecast…':weather.message?'Saved forecast · refresh unavailable':core.outlook(data,Date.now(),weather.timezone);$('weatherInsight').title=$('weatherInsight').textContent;}
 $('weatherCurrent').onclick=()=>MidnightApp.openWeather();
 const when=e=>{const tz=MidnightApp.timezone(),date=new Intl.DateTimeFormat(undefined,{timeZone:tz,weekday:'short',month:'short',day:'numeric'}).format(new Date(e.start));return date+' · '+(e.all_day?'All day':core.time(e.start,tz)+' – '+core.time(e.end,tz));};
 function openEvent(value){event={...value};$('eventDetailCountdown').textContent=core.relative(event,Date.now(),MidnightApp.timezone());$('eventDetailTitle').textContent=event.title;$('eventDetailWhen').textContent=when(event);$('eventDetailLocation').textContent=event.location||'';$('eventDetailLocation').hidden=!event.location;$('eventDetailNotes').textContent=event.description||'';$('eventDetailNotes').hidden=!event.description;$('eventDetailMap').hidden=!event.location;if(event.location)$('eventDetailMap').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(event.location);$('eventDetailStatus').textContent='';MidnightUI.open($('eventDetailsDialog'));}
 $('eventDetailCalendar').onclick=()=>{if(!event)return;MidnightUI.close($('eventDetailsDialog'));MidnightCalendar.openEvent(event);};$('eventDetailCopy').onclick=async()=>{if(!event)return;try{await navigator.clipboard.writeText([event.title,when(event),event.location,event.description].filter(Boolean).join('\n'));$('eventDetailStatus').textContent='Event details copied.';}catch{$('eventDetailStatus').textContent='Clipboard unavailable in this browser.';}};
 function renderAgenda(){
  const snapshot=MidnightApp.snapshot(),events=[...snapshot.events,...(window.MidnightCalendar?.snapshot()||[])],plan=core.agenda(events,Date.now(),MidnightApp.timezone());
  const signature=JSON.stringify([plan,snapshot.calendarLoaded,snapshot.calendarConfigured,snapshot.calendarFailed]);if(signature===lastAgenda)return;lastAgenda=signature;
  const target=$('todayNextEvent');target.replaceChildren();$('nextTitle').textContent=plan.live?'Happening now':'Up next';$('agendaSummary').textContent=snapshot.calendarFailed?'Saved calendar':plan.todayCount?plan.todayCount+' remaining today':'';
  if(plan.current){const next=plan.current,row=make('button','todayEvent');row.type='button';row.setAttribute('aria-label','View event: '+next.title);row.onclick=()=>openEvent(next);const date=make('small','',when(next)),title=make('strong','',next.title),countdown=make('span','eventCountdown',plan.label);row.append(date,title,countdown);if(next.location)row.append(make('span','eventLocation',next.location));target.append(row);if(plan.following){const after=plan.following,button=make('button','followingEvent');button.type='button';button.setAttribute('aria-label','View following event: '+after.title);button.onclick=()=>openEvent(after);const tz=MidnightApp.timezone(),sameDay=core.dateKey(after.start,tz)===core.dateKey(Date.now(),tz),weekday=new Intl.DateTimeFormat(undefined,{timeZone:tz,weekday:'short'}).format(new Date(after.start)),label=after.all_day?(sameDay?'All day':weekday+' · All day'):(sameDay?'':weekday+' ')+core.time(after.start,tz);button.append(make('span','',label),make('strong','',after.title));target.append(button);}}
  else{target.append(make('p','todayEmpty',snapshot.calendarFailed?'Calendar unavailable.':!snapshot.calendarLoaded?'Loading calendar…':snapshot.calendarConfigured?'No upcoming events.':'Connect your calendar.'));if(snapshot.calendarLoaded&&!snapshot.calendarConfigured){const button=make('button','textButton','Add calendar');button.onclick=()=>MidnightApp.openSettings('calendar');target.append(button);}}
 }
 addEventListener('midnight:player',renderPlayer);addEventListener('midnight:weather',renderWeather);addEventListener('midnight:data',renderAgenda);addEventListener('midnight:calendar-view',renderAgenda);
 setInterval(()=>{if(document.hidden)return;renderProgress();const minute=Math.floor(Date.now()/60000);if(lastMinute!==minute){lastMinute=minute;renderAgenda();renderWeather();if(event&&$('eventDetailsDialog').open)$('eventDetailCountdown').textContent=core.relative(event,Date.now(),MidnightApp.timezone());}},1000);
 renderPlayer();renderWeather();renderAgenda();return {renderAgenda,openEvent};
})();
