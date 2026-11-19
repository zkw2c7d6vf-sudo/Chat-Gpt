'use strict';
const $ = id => document.getElementById(id);
let settingsBaseline={};
let csrf = '', settings = {}, connected = false, player = null, plug = null, spotifyBusy = false;
let spotifyAuthRequired=false,spotifyMessage='',weatherFetched=0,weatherMessage='';
let tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
let locationRevision = 0;
let calendarTruncated=false;
let calendarItems = [], calendarDayStamp = '', calendarLoaded=false, calendarConfigured=false, calendarFailed=false;
let coordinates = null, spotifyNextPoll = 0;
let weatherData=null,weatherDataKey='',weatherBusy=false,weatherQueued=false,readerRequest=0;
let selectedWeatherDay=0, selectedWeatherDate=null;const browsedHours=new Set();
let safeStorage;try{safeStorage=window.localStorage;}catch{}
const focusTimer=new MidnightFocus({storage:safeStorage,onComplete:()=>showFocusComplete()});
try { coordinates = JSON.parse(localStorage.getItem('midnight-location') || 'null'); } catch {}
let clockFormat='12';try{clockFormat=safeStorage?.getItem('midnight-clock-format')||'12';}catch{}
let spotifyCommandBusy=false,spotifyReadRevision=0,spotifyRefreshQueued=false;
async function spotifyCommand(path,options){if(spotifyCommandBusy)throw new Error('Spotify is updating. Wait for the current action to finish.');spotifyCommandBusy=true;spotifyReadRevision++;try{return await requestApi(path,options);}finally{spotifyCommandBusy=false;spotifyRefreshQueued=true;queueMicrotask(()=>refreshSpotify());}}
const pendingReads=new Map();
function api(path, options = {}) {
  if(options.method&&options.method!=='GET'&&path.startsWith('spotify/')&&!path.includes('disconnect'))return spotifyCommand(path,options);
  if ((options.method && options.method!=='GET') || options.signal) return requestApi(path,options);
  if (!pendingReads.has(path)) {
    const pending=requestApi(path,options).finally(()=>pendingReads.delete(path));
    pendingReads.set(path,pending);
  }
  return pendingReads.get(path);
}
async function requestApi(path, options = {}) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
  try {
    const res=await fetch('/api/'+path,{...options,signal:controller.signal,headers:{'Content-Type':'application/json','X-Midnight-Token':csrf,...options.headers}});
    let body;try{body=await res.json();}catch{throw new Error('The local server returned an unreadable response.');}
    if(!res.ok){
      if(res.status===403&&body.detail==='Reload the dashboard before making changes.'){
        const boot=await requestApi('bootstrap');csrf=boot.csrf;
        throw new Error('Midnight restarted. Connection restored; review the current state, then try the action again.');
      }
      const error=new Error(typeof body.detail==='string'?body.detail:Array.isArray(body.detail)?body.detail.map(e=>e.msg).join(' · '):'Request failed.');error.status=res.status;throw error;
    }
    return body;
  }catch(error){if(controller.signal.aborted)throw new Error('The local server took too long. The result may be unknown; check the current state before trying again.');throw error;}
  finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}

const post = (path, data) => api(path, {method:'POST', body: data === undefined ? undefined : JSON.stringify(data)});
function toast(message, error=false) { MidnightNotifications.notify({message,kind:error?'error':'success'}); }

function handle(fn) { return async (...args) => { try { await fn(...args); } catch(e) { const panel=MidnightUI.top();if(panel){let status=panel.querySelector('.requestError');if(!status){status=document.createElement('p');status.className='requestError captureHint';status.setAttribute('role','alert');panel.append(status);}status.textContent=e.message;}else toast(e.message,true); } }; }
const dateFormatters=new Map();
function dateFormatter(options) {
  const key=JSON.stringify([tz,options]);
  if (!dateFormatters.has(key)) {
    if (dateFormatters.size>=32) dateFormatters.delete(dateFormatters.keys().next().value);
    dateFormatters.set(key,new Intl.DateTimeFormat(undefined,{timeZone:tz,...options}));
  }
  return dateFormatters.get(key);
}
function formatDate(value, options) { return dateFormatter(options).format(value); }
let lastClockMinute='', currentHour=0,lastProgressFetch=0;
function tick() {
  const now = new Date();
  const minute=tz+':'+Math.floor(now.getTime()/60000);
  if (minute!==lastClockMinute) {
    lastClockMinute=minute;
    const parts = dateFormatter({hour:'numeric', minute:'2-digit', hour12:clockFormat!=='24'}).formatToParts(now);
    $('clock').textContent = parts.filter(p => ['hour','minute','literal'].includes(p.type)).map(p=>p.value).join('').trim();
    $('meridiem').textContent = parts.find(p=>p.type==='dayPeriod')?.value || '';
    $('today').textContent = formatDate(now, {weekday:'long', month:'long', day:'numeric'});
    $('timezone').textContent = tz.replaceAll('_',' ');$('timezone').hidden=tz===Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hour = currentHour = Number(formatDate(now, {hour:'numeric', hourCycle:'h23'}));
    $('greeting').textContent = hour < 12 ? 'A softer start to your day.' : hour < 18 ? 'A little space for your afternoon.' : 'Settle into your evening.';
  }
  if (player?.active && (player.playing || player.fetched!==lastProgressFetch)) {
    lastProgressFetch=player.fetched;
    const elapsed = Math.min(player.duration, player.progress + (player.playing ? Date.now()-player.fetched : 0));
    const progress = player.duration ? Math.min(100, elapsed/player.duration*100) : 0;
    $('progressFill').style.width = progress + '%';
    $('music').style.setProperty('--tonearm-angle', (player.playing || elapsed > 0 ? -4 + progress * 0.21 : -8) + 'deg');
    document.querySelector('.progress').setAttribute('aria-valuenow', Math.round(progress));
    $('elapsed').textContent = duration(elapsed); $('duration').textContent = duration(player.duration);
  }
  renderFocus();
  if(typeof window!=='undefined')window.dispatchEvent(new Event('midnight:tick'));
  const sky=(weatherData ? !!weatherData.current.is_day : currentHour>=7 && currentHour<18) ? 'day' : 'night';
  if (document.documentElement.dataset.sky!==sky) document.documentElement.dataset.sky=sky;
}
const temperature=value=>Number.isFinite(value)?Math.round(value)+'°':'—';
function duration(ms) { const seconds = Math.max(0,Math.floor(ms/1000)); return Math.floor(seconds/60) + ':' + String(seconds%60).padStart(2,'0'); }
function setPlayerControls(active, playing=false, disallows={}) {
  $('play').disabled = !active || (playing ? disallows.pausing : disallows.resuming);
  $('previous').disabled = !active || !!disallows.skipping_prev;
  $('next').disabled = !active || !!disallows.skipping_next;
  setPlaybackIcon($('play'),playing); $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  $('disc').classList.toggle('playing', active && playing);
}
async function refreshSpotify() {
  if (!connected || spotifyCommandBusy || Date.now() < spotifyNextPoll) return;
  if(spotifyBusy){spotifyRefreshQueued=true;return;}
  const revision=spotifyReadRevision;spotifyBusy=true;spotifyRefreshQueued=false;
  try {
    const data = await api('spotify');if(revision!==spotifyReadRevision)return; player = {...data, fetched:Date.now()};spotifyAuthRequired=false;spotifyMessage='';
    $('musicStatus').hidden=false; $('spotifyHint').hidden=true;
    $('musicStatus').textContent = data.active ? (data.playing ? 'Playing' : 'Paused') : 'NO ACTIVE PLAYER';
    $('connectSpotify').hidden=true;
    if (data.active) {
      $('musicTitle').textContent = data.title; $('artist').textContent = data.artist || ''; $('albumTitle').textContent = data.album || ''; $('albumTitle').title = data.album || ''; $('artist').title=$('artist').textContent; $('releaseYear').textContent=data.release_year || ''; $('releaseYear').hidden=!data.release_year; $('device').textContent = data.device;
      const image = data.image;
      if (image && new URL(image).protocol === 'https:') { $('albumArt').src=image; $('albumArt').hidden=false; } else $('albumArt').hidden=true;
      $('spotifyHint').textContent = 'Listening on ' + data.device;
    } else {
      $('musicTitle').textContent = 'No active player'; $('artist').textContent = ''; $('albumTitle').textContent = ''; $('spotifyHint').textContent='Start a song in Spotify.'; $('spotifyHint').hidden=false;
      $('device').textContent = 'WAITING FOR SPOTIFY'; $('albumArt').hidden=true; resetProgress();
    }
    setPlayerControls(data.active, data.playing, data.disallows || {});
    tick();
  } catch(e) {
    player=null; setPlayerControls(false); resetProgress(); $('musicStatus').textContent = (e.status === 401 ? 'SIGN-IN NEEDED' : 'UNAVAILABLE')+' · last known track';
    $('spotifyHint').textContent=e.message; $('spotifyHint').hidden=false; $('artist').textContent = ''; $('albumTitle').textContent = '';
    spotifyMessage=e.message;if (e.status===401){connected=false;spotifyAuthRequired=true;$('connectSpotify').hidden=false;$('connectSpotify').textContent='Reconnect Spotify';}
    if (e.status===429) {
      const seconds = Number(e.message.match(/(\d+) seconds/)?.[1] || 30); spotifyNextPoll=Date.now()+seconds*1000;
    }
  } finally { spotifyBusy=false;if(spotifyRefreshQueued&&!spotifyCommandBusy){spotifyRefreshQueued=false;queueMicrotask(()=>refreshSpotify());}if(typeof window!=='undefined')window.dispatchEvent(new Event('midnight:player')); }
}
function resetProgress() { $('music').style.removeProperty('--tonearm-angle'); $('releaseYear').hidden=true; $('progressFill').style.width='0%'; $('elapsed').textContent='0:00'; $('duration').textContent='0:00'; document.querySelector('.progress').setAttribute('aria-valuenow','0'); }
async function connectSpotify() {
  if (!settings.spotify_client_id) { showSettings(); $('spotifyPreferences').querySelector('details').open=true; $('clientId').focus(); return; }
  const data=await post('spotify/connect'); window.location.assign(data.url);
}
async function control(action) {
  const p=player,restriction={play:'resuming',pause:'pausing',previous:'skipping_prev',next:'skipping_next'}[action];if(!p?.active||p.disallows?.[restriction])throw new Error('This Spotify action is unavailable on the current player.');
  setPlayerControls(false);
  try { await post('spotify/control/'+action); await new Promise(r=>setTimeout(r,500)); }
  finally { await refreshSpotify(); }
}
const descriptions = {0:'Clear skies',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Freezing fog',51:'Light drizzle',53:'Drizzle',55:'Steady drizzle',56:'Freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Passing showers',81:'Rain showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorms',96:'Thunderstorms & hail',99:'Thunderstorms & hail'};
let placeLookupKey=null;
function updateWeatherTown(){
  const name=coordinates?.name||'';
  $('weatherTitle').textContent=name||'Weather';$('weatherTitle').title=name;
  $('location').textContent=name;
}
async function resolveWeatherTown(){
  updateWeatherTown();
  if(!coordinates||coordinates.name)return;
  const key=String(Number(coordinates.lat))+','+String(Number(coordinates.lon));
  if(placeLookupKey===key)return;placeLookupKey=key;
  try{
    const place=await api('weather/place?lat='+encodeURIComponent(coordinates.lat)+'&lon='+encodeURIComponent(coordinates.lon));
    if(!coordinates||String(Number(coordinates.lat))+','+String(Number(coordinates.lon))!==key||coordinates.name)return;
    if(place.name){coordinates={...coordinates,name:place.name,nameSource:'nearest'};try{localStorage.setItem('midnight-location',JSON.stringify(coordinates));}catch{}updateWeatherTown();if($('weatherDialog').open)$('forecastPlace').textContent=place.name;}
  }catch{/* Forecast stays usable; the pin offers an explicit city choice. */}
}
async function refreshWeather(force=false) {
  if(!coordinates)return;if(weatherBusy){weatherQueued=true;return;}
  weatherBusy=true;const requested={lat:coordinates.lat,lon:coordinates.lon,units:settings.units},dataKey=Number(coordinates.lat)+','+Number(coordinates.lon)+','+settings.units;if(weatherData&&weatherDataKey!==dataKey){weatherData=null;$('temperature').textContent='—°';$('condition').textContent='Updating forecast…';$('weatherDetail').textContent='';renderWeatherDetails();}$('weather').setAttribute('aria-busy','true');window.dispatchEvent(new Event('midnight:weather'));
  resolveWeatherTown();
  try {
    const data=await api(`weather?lat=${encodeURIComponent(requested.lat)}&lon=${encodeURIComponent(requested.lon)}${force ? "&refresh=true" : ""}`);
    if(!coordinates||Number(coordinates.lat)!==Number(requested.lat)||Number(coordinates.lon)!==Number(requested.lon)||settings.units!==requested.units)return;
    weatherData={...data,current:data.current||{},daily:{...data.daily,time:data.daily?.time||[]},hourly:data.hourly||{}};weatherDataKey=dataKey;weatherFetched=Date.now();weatherMessage=''; tz=data.timezone || tz; const current=weatherData.current,daily=weatherData.daily;
    $('temperature').textContent=temperature(current.temperature_2m);
    $('condition').textContent=descriptions[current.weather_code] || 'Current conditions';
    updateWeatherTown();
    $('weatherDetail').textContent=`Feels ${temperature(current.apparent_temperature)} · H ${temperature(daily.temperature_2m_max?.[0])} / L ${temperature(daily.temperature_2m_min?.[0])}`;
    $('weatherUpdated').textContent='Observed '+(current.time?formatDate(typeof current.time==='number'?new Date(current.time*1000):new Date(current.time),{hour:'numeric',minute:'2-digit'}):'time unavailable');
    $('weather').classList.toggle('night', !current.is_day);
    $('weather').classList.toggle('cloudy',current.weather_code>=2);
    $('weather').classList.toggle('raining',current.weather_code>=51 && current.weather_code<=67 || current.weather_code>=80 && current.weather_code<=82 || current.weather_code>=95);
    renderWeatherDetails(); tick(); if (calendarTimeZone!==tz) await refreshCalendar();
  } catch(e) { weatherMessage=weatherData?'Could not refresh. Showing the last forecast.':e.message;window.dispatchEvent(new Event('midnight:weather'));$('weatherUpdated').textContent='Weather unavailable · last reading may be stale'; $('weatherDetail').textContent=e.message; $('forecastNotice').textContent=e.message+' Previous readings may be stale.'; }
  finally{weatherBusy=false;$('weather').setAttribute('aria-busy','false');window.dispatchEvent(new Event('midnight:weather'));if(weatherQueued||coordinates&&(Number(coordinates.lat)!==Number(requested.lat)||Number(coordinates.lon)!==Number(requested.lon)||settings.units!==requested.units)){weatherQueued=false;queueMicrotask(()=>refreshWeather(force));}}
}
function locate(quiet=false) {
  if (!navigator.geolocation) { $('weatherDetail').textContent='Location is unavailable. Set coordinates in preferences.'; return; }
  const revision=++locationRevision;
  $('forecastLocate').disabled=true;
  navigator.geolocation.getCurrentPosition(pos=>{
    $('forecastLocate').disabled=false; if (revision!==locationRevision) return; coordinates={lat:pos.coords.latitude,lon:pos.coords.longitude};
    localStorage.setItem('midnight-location',JSON.stringify(coordinates)); refreshWeather();
  },()=>{
    $('forecastLocate').disabled=false; if (revision!==locationRevision || coordinates) return; $('weatherDetail').textContent='Location not available. Choose a city or allow location access.';
    if (!quiet) toast('Location is unavailable. You can enter coordinates in preferences.',true);
  },{timeout:15000,maximumAge:900000,enableHighAccuracy:false});
}
function reportWarmerState() { window.dispatchEvent(new Event('midnight:warmer')); }
async function refreshPlug() {
  $('plugSettings').hidden=!settings.plug_enabled;
  if (!settings.plug_enabled) {
    plug=null; $('plugToggle').disabled=false; $('plugToggle').setAttribute('aria-label','Set up candle warmer'); $('plugInfo').textContent='Local access is off'; $('plugLabel').textContent='Set up';
    $('plugMessage').textContent='Enable access in preferences'; $('room').classList.remove('on'); reportWarmerState(); return;
  }
  try {
    plug=await api('plug'); renderPlug();
  } catch(e) {
    plug=null; $('plugToggle').disabled=true; $('plugMessage').hidden=false; $('room').classList.remove('on'); $('plugInfo').textContent='State unknown · '+settings.plug_ip;
    $('plugLabel').textContent='Unavailable'; $('plugMessage').textContent=e.message; reportWarmerState();
  }
}
function renderPlug() {
  $('plugMessage').hidden=true;
  $('plugToggle').disabled=false; $('room').classList.toggle('on',plug.on);
  $('plugInfo').textContent=(plug.on ? 'On · warming your space' : 'Off · ready when you are');
  $('plugLabel').textContent=plug.on ? 'Turn off' : 'Turn on';
  $('plugMessage').textContent=plug.ip+' · verified just now';
  $('plugToggle').setAttribute('aria-label', (plug.on ? 'Turn off' : 'Turn on')+' candle warmer');
  reportWarmerState();
}
async function togglePlug() {
  if (!settings.plug_enabled) { showSettings({currentTarget:{id:'plugSettings'}}); return; }
  if (!plug) return;
  $('plugToggle').disabled=true;
  try { plug=await post('plug',{on:!plug.on}); renderPlug(); }
  catch(e) { plug=null; $('room').classList.remove('on'); $('plugLabel').textContent='State unknown'; $('plugInfo').textContent='Command could not be verified'; $('plugMessage').textContent='Check the warmer before assuming it is off.'; reportWarmerState(); throw e; }
}
function element(tag, className, text) { const node=document.createElement(tag); if (className) node.className=className; if (text!==undefined) node.textContent=text; return node; }
function empty(target, title, description='') { $(target).replaceChildren(); const box=element('div','empty'); box.append(element('h3','',title)); if (description) box.append(element('p','captureHint',description)); $(target).append(box); }
function dayKey(value) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
  return ['year','month','day'].map(key=>parts.find(p=>p.type===key).value).join('-');
}
function renderCalendarDays(events=calendarItems) {
  const today=dayKey(new Date()); calendarDayStamp=today;
  const [year,month,day]=today.split('-').map(Number); $('calendarDays').replaceChildren();
  const counts=new Map();
  for (const event of events) { const key=dayKey(new Date(event.start)); counts.set(key,(counts.get(key) || 0)+1); }
  for (let i=0;i<14;i++) {
    const date=new Date(Date.UTC(year,month-1,day+i,12)), key=date.toISOString().slice(0,10);
    const count=counts.get(key) || 0;
    const chip=element('button','dayChip'+(i===0 ? ' today' : ''));
    chip.type='button'; chip.dataset.day=key; chip.setAttribute('aria-pressed',String(i===0)); chip.setAttribute('aria-label',date.toLocaleDateString(undefined,{timeZone:'UTC',month:'long',day:'numeric'})+`, ${count} events`);
    chip.append(element('span','',date.toLocaleDateString(undefined,{timeZone:'UTC',weekday:'short'})),element('strong','',String(date.getUTCDate())),element('i',count ? 'hasEvents' : ''));
    chip.onclick=()=>{ $('calendarDays').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button===chip))); const row=[...$('events').querySelectorAll('.event')].find(e=>e.dataset.day===key); if (row) row.scrollIntoView({block:'nearest',behavior:'smooth'}); else toast('No events on '+date.toLocaleDateString(undefined,{timeZone:'UTC',month:'short',day:'numeric'})+'.'); };
    $('calendarDays').append(chip);
  }
}
let calendarTimeZone='';
let calendarSource='';
let calendarImportedAt=null;
async function refreshCalendar() {
  const requestedTimeZone=tz;
  try {
    const data=await api('calendar?tz='+encodeURIComponent(requestedTimeZone));
    if (requestedTimeZone!==tz) return;
    calendarTimeZone=requestedTimeZone;
    calendarTruncated=!!data.truncated;calendarSource=data.source || ''; calendarImportedAt=data.imported_at || null;
    calendarLoaded=true;calendarConfigured=!!data.configured;calendarFailed=false;calendarItems=data.events || []; renderCalendarDays(); window.dispatchEvent(new Event('midnight:data')); 
    if (!data.configured) { $('calendarStatus').hidden=true; return; }
    $('calendarStatus').hidden=true;
    $('events').replaceChildren();
    if (!data.events.length) empty('events','No upcoming events');
    for (const event of data.events) {
      const start=new Date(event.start), row=element('div','event'), day=element('div','eventDate'); row.dataset.day=dayKey(start);
      day.append(element('span','',formatDate(start,{weekday:'short'})),element('strong','',formatDate(start,{day:'numeric'})));
      const details=element('div','eventInfo'); details.append(element('h3','',event.title));
      const when=event.all_day ? 'All day' : formatDate(start,{hour:'numeric',minute:'2-digit'})+(Date.parse(event.start)===Date.parse(event.end)?'':' – '+formatDate(new Date(event.end),{hour:'numeric',minute:'2-digit'}));
      details.append(element('p','',formatDate(start,{month:'short',day:'numeric'})+' · '+when+(event.location ? ' · '+event.location : '')));
      row.append(day,details); $('events').append(row);
    }
    $('calendarStatus').textContent=data.source+' · checked '+formatDate(new Date(),{hour:'numeric',minute:'2-digit'});
  } catch(e) { calendarFailed=true;window.dispatchEvent(new Event('midnight:data'));empty('events','Calendar unavailable',e.message); $('calendarStatus').textContent='Could not refresh'; $('calendarStatus').hidden=false; }
}
async function refreshNews() {
  try {
    const data=await api('news');
    if (!settings.feeds.length) return;
    $('articles').replaceChildren();
    if (!data.articles.length) empty('articles','No headlines yet.','Check your subscriptions in preferences, or try refreshing later.');
    // Interleave sources for a balanced view without ranking headlines.
    const sources=new Map(); for (const a of data.articles) { if (!sources.has(a.source)) sources.set(a.source,[]); sources.get(a.source).push(a); }
    for (let i=0;i<10;i++) for (const articles of sources.values()) {
      const article=articles[i]; if (!article) continue;
      const row=element('button','article'); row.type='button'; row.setAttribute('aria-label',article.title);
      row.onclick=handle(()=>openReader(article));
      const media=element('div','articleMedia');
      if (article.image) {
        const img=element('img'); img.alt=''; img.loading='lazy'; img.decoding='async';
        img.src='/api/news/image?url='+encodeURIComponent(article.image);
        img.onerror=()=>{ img.remove(); media.classList.add('noImage'); };
        media.append(img);
      } else media.classList.add('noImage');
      const copy=element('div','articleCopy'); copy.append(element('span','source',article.source),element('h3','',article.title));
      const date=new Date(article.published); if (!Number.isNaN(date.getTime())) copy.append(element('time','',formatDate(date,{month:'short',day:'numeric'})));
      row.append(media,copy);
      $('articles').append(row);
    }
    $('newsStatus').textContent=data.errors.length ? data.errors.map(e=>e.source+': '+e.message).join(' · ') : settings.feeds.length+' sources · checked '+formatDate(new Date(),{hour:'numeric',minute:'2-digit'});
    $('newsStatus').hidden=!data.errors.length;
    $('newsStatus').title=data.errors.map(e=>e.message).join(' ');
  } catch(e) { $('newsStatus').textContent=e.message; $('newsStatus').hidden=false; }
}
function renderCalendarSetting(){const input=$('calendarUrl');input.placeholder=settings.calendar_configured?'Saved subscription on '+(settings.calendar_url_hint||'your provider')+' · leave blank to keep':'https://…/calendar.ics';$('calendarPrivateStatus').textContent=settings.calendar_configured?'A subscription is saved. Its private address stays on this computer. Paste a new URL to replace it, or use Remove calendar data below.':'Paste a subscription URL or import a snapshot.';}
function showSettings(event) {
  if ($('settingsDialog').open) { MidnightUI.open($('settingsDialog')); return; }
  settingsBaseline=structuredClone(settings);
  $('clientId').value=settings.spotify_client_id || ''; $('plugIp').value=settings.plug_ip || '';
  $('plugEnabled').checked=!!settings.plug_enabled; $('calendarUrl').value='';renderCalendarSetting();
  $('feedUrls').value=(settings.feeds || []).join('\n'); $('units').value=settings.units || 'fahrenheit';
  $('latitude').value=coordinates?.lat ?? ''; $('longitude').value=coordinates?.lon ?? '';
  $('settingsForm').addEventListener('invalid', revealInvalidSetting, true);
  $('settingsMessage').textContent=''; MidnightUI.open($('settingsDialog'));
  const section={calendarSettings:'calendarPreferences',connectCalendar:'calendarPreferences',plugSettings:'roomPreferences',newsSettings:'newsPreferences',addFeeds:'newsPreferences'}[event?.currentTarget?.id];
  if (section) { $(section).querySelector('details').open=true; $(section).scrollIntoView({block:'start',behavior:'instant'}); $(section).querySelector('input,textarea')?.focus({preventScroll:true}); }
  else $('settingsDialog').scrollTop=0;
}
function revealInvalidSetting(event) {
  const section = event.target.closest('details');
  if (section) section.open = true;
}
async function saveSettings(event) {
  event.preventDefault(); $('saveSettings').disabled=true;const savedParts=[];
  try {
    const lat=$('latitude').value, lon=$('longitude').value;
    if ((lat==='') !== (lon==='')) throw new Error('Enter both latitude and longitude, or leave both blank.');
    const fileToValidate=$('icsFile').files[0];if(fileToValidate){if(fileToValidate.size>1500000)throw new Error('Calendar files must be smaller than 1.5 MB.');await post('calendar/validate',{content:await fileToValidate.text()});}
    if(lat!==''&&(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))||Math.abs(Number(lat))>90||Math.abs(Number(lon))>180))throw new Error('Enter valid coordinates.');
    if($('plugEnabled').checked&&!$('plugIp').value.trim())throw new Error('Enter the warmer’s private LAN IP before enabling it.');
    const next={spotify_client_id:$('clientId').value.trim(),plug_ip:$('plugIp').value.trim(),plug_enabled:$('plugEnabled').checked,
      calendar_url:$('calendarUrl').value.trim(),feeds:$('feedUrls').value.split('\n').map(s=>s.trim()).filter(Boolean),units:$('units').value};
    const patch=Object.fromEntries(Object.entries(next).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(settingsBaseline[key])));
    const result=await post('settings',patch);
    savedParts.push('Connection, calendar and feed settings');Object.assign(next,result.settings||next);
    window.dispatchEvent(new Event('midnight:settings-saved'));
    const changedClient=settings.spotify_client_id!==next.spotify_client_id, changedCalendar='calendar_url' in patch; settings=next;settingsBaseline=structuredClone(settings);$('calendarUrl').value='';renderCalendarSetting();if(changedCalendar)window.dispatchEvent(new Event('midnight:calendar-changed'));
    if (changedClient) { connected=false;spotifyAuthRequired=false;$('connectSpotify').hidden=false; player=null; setPlayerControls(false); resetProgress(); $('albumArt').hidden=true; $('musicTitle').textContent='Spotify'; $('artist').textContent = ''; $('albumTitle').textContent = ''; $('connectSpotify').textContent='Connect Spotify'; $('musicStatus').textContent='NOT CONNECTED'; $('spotifyHint').textContent='Client ID saved · tap Connect Spotify'; }
    locationRevision++;
    if (lat!=='' && lon!=='') { coordinates=coordinates&&Number(coordinates.lat)===Number(lat)&&Number(coordinates.lon)===Number(lon)?coordinates:{lat:Number(lat),lon:Number(lon)}; localStorage.setItem('midnight-location',JSON.stringify(coordinates)); }
    else { coordinates=null;updateWeatherTown();placeLookupKey=null; localStorage.removeItem('midnight-location'); tz=Intl.DateTimeFormat().resolvedOptions().timeZone; $('temperature').textContent='—°'; $('condition').textContent='Let’s find your forecast.'; $('location').textContent='Your corner of the world'; $('weatherDetail').textContent='Allow location, or set coordinates in preferences.'; $('weatherUpdated').textContent='Location needed'; weatherData=null; $('weatherStats').replaceChildren(); renderWeatherDetails(); tick(); }
    const file=$('icsFile').files[0];
    if (file) await importCalendarSnapshot(file);
    $('settingsMessage').textContent='Saved locally.'; MidnightUI.close($('settingsDialog')); toast('Preferences saved on this PC.');
    await Promise.allSettled([refreshPlug(),refreshCalendar(),refreshNews(),refreshWeather()]);
    if (!settings.feeds.length) empty('articles','Add feeds in Settings');
    if (!settings.calendar_configured && !file) { const b=await api('bootstrap'); if (!b.calendar_imported) empty('events','Add a calendar in Settings'); }
  } catch(e) { $('settingsMessage').textContent=(savedParts.length?savedParts.join(', ')+' saved. Remaining changes were not completed: ':'Nothing saved. ')+e.message; }
  finally { $('saveSettings').disabled=false; }
}
async function importCalendarSnapshot(file) {
  if (!file) throw new Error('Choose an .ics file first.');
  if (file.size>1500000) throw new Error('Calendar files must be smaller than 1.5 MB.');
  const result=await post('calendar/import',{content:await file.text()});
  settings.calendar_url='';settings.calendar_configured=false;settings.calendar_url_hint=''; $('calendarUrl').value='';renderCalendarSetting(); $('icsFile').value='';
  $('importStatus').textContent='Imported '+file.name+' · snapshot saved on this PC';
  window.dispatchEvent(new Event('midnight:calendar-changed')); return result;
}
function addFeed(url) { const lines=$('feedUrls').value.split('\n').map(s=>s.trim()).filter(Boolean); if (!lines.includes(url)) lines.push(url); $('feedUrls').value=lines.join('\n'); }
async function init() {
  initV3();initReliability();
  for (const id of ['settingsBtn','allSettings','calendarSettings','connectCalendar','plugSettings','newsSettings','addFeeds']) $(id).addEventListener('click',showSettings);
  $('importCalendarFile').onclick=async()=>{const button=$('importCalendarFile');button.disabled=true;$('importStatus').textContent='Importing…';try{const file=$('icsFile').files[0];await importCalendarSnapshot(file);await refreshCalendar();}catch(e){$('importStatus').textContent='Import failed: '+e.message;}finally{button.disabled=false;}};
  $('icsFile').onchange=()=>{$('importStatus').textContent=$('icsFile').files[0]?$('icsFile').files[0].name+' · ready to import':'No file selected';};
  $('closeSettings').onclick=()=>MidnightUI.close($('settingsDialog')); $('settingsForm').onsubmit=saveSettings;
  $('connectSpotify').onclick=handle(connectSpotify);
  $('play').onclick=handle(()=>control(player?.playing ? 'pause' : 'play'));
  $('previous').onclick=handle(()=>control('previous')); $('next').onclick=handle(()=>control('next'));
  $('plugToggle').onclick=handle(togglePlug); $('locate').onclick=()=>MidnightUI.open($('locationDialog'));
  $('refreshCalendar').onclick=refreshCalendar; $('refreshNews').onclick=refreshNews;
  $('fullscreen').onclick=handle(async()=>{ if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); });

  $('bbcPreset').onclick=()=>addFeed('https://feeds.bbci.co.uk/news/rss.xml'); $('nasaPreset').onclick=()=>addFeed('https://www.nasa.gov/feed/');
  $('disconnectSpotify').onclick=handle(async()=>{
    await post('spotify/disconnect'); connected=false;spotifyAuthRequired=false;spotifyMessage='';player=null;setPlayerControls(false);resetProgress();$('albumArt').hidden=true;$('connectSpotify').hidden=false;window.dispatchEvent(new Event('midnight:player'));
    $('musicStatus').textContent='NOT CONNECTED'; $('musicTitle').textContent='Spotify'; $('artist').textContent = ''; $('albumTitle').textContent = '';
    $('spotifyHint').textContent='Disconnected · tokens removed from this PC'; $('connectSpotify').textContent='Connect Spotify'; toast('Spotify tokens removed locally.');
  });
  $('clearCalendar').onclick=handle(async()=>{ await post('calendar/clear'); window.dispatchEvent(new Event('midnight:calendar-changed')); settings.calendar_url='';settings.calendar_configured=false;settings.calendar_url_hint=''; $('calendarUrl').value='';renderCalendarSetting(); $('importStatus').textContent='Calendar data removed'; empty('events','Add a calendar in Settings'); $('calendarStatus').textContent='Read-only · private on this PC';calendarItems=[];calendarConfigured=false;calendarLoaded=true;calendarFailed=false;window.dispatchEvent(new Event('midnight:data'));toast('Calendar data removed from this PC.'); });

  $('albumArt').onerror=()=>{ $('albumArt').hidden=true; };
  renderCalendarDays();
  tick();
  MidnightActivity.every('display',()=>{tick();if(dayKey(new Date())!==calendarDayStamp)renderCalendarDays();},()=>player?.active&&player.playing||focusTimer.state.running?1000:60000,{align:true});
  window.addEventListener('midnight:player',()=>MidnightActivity.wake());window.addEventListener('midnight:focus',()=>MidnightActivity.wake());
  try {
    const boot=await api('bootstrap');$('configurationWarning').textContent=boot.configuration_warnings?.length?'A damaged configuration was detected: '+boot.configuration_warnings.join(', ')+'. A previous valid copy is used where available; review settings before saving.':'';if(boot.chatgpt_destination){try{if(!safeStorage.getItem('midnight-chatgpt-destination')){const value=validChatDestination(boot.chatgpt_destination);safeStorage.setItem('midnight-chatgpt-destination',value);chatLink.href=value;$('chatgptDestination').value=value;}}catch{}} csrf=boot.csrf; settings=boot.settings; connected=boot.spotify_connected;
    if (connected) { $('musicStatus').textContent='CONNECTING'; $('connectSpotify').hidden=true; }
    $('importStatus').textContent=boot.calendar_imported ? 'An imported snapshot is saved on this PC' : 'No imported file';
    const status=new URLSearchParams(location.search).get('spotify');
    if (status) { toast(status==='connected' ? 'Spotify connected.' : 'Spotify sign-in was declined.',status!=='connected'); history.replaceState({},'',location.pathname); }
    await Promise.allSettled([refreshSpotify(),refreshPlug(),refreshCalendar(),refreshNews(),refreshWeather()]);
    // Location permission is requested only from the user's location controls.
    MidnightActivity.every('spotify',refreshSpotify,10000,{enabled:()=>connected});
    MidnightActivity.every('plug',refreshPlug,30000,{enabled:()=>!!settings.plug_enabled});
    MidnightActivity.every('data',()=>Promise.allSettled([refreshWeather(),refreshCalendar(),refreshNews()]),900000);
    document.addEventListener('visibilitychange',()=>{ if (!document.hidden) { tick(); if (dayKey(new Date())!==calendarDayStamp) renderCalendarDays(); MidnightActivity.wake(); } });
  } catch(e) { $('connectionStatus').textContent='LOCAL SERVER UNAVAILABLE'; toast(navigator.onLine ? 'Could not connect to the local server. Start Midnight, then reload. Capture and Focus still work.' : 'Offline. Capture, drafts and Focus are available.',navigator.onLine); }
}

function setPlaybackIcon(target,playing) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',playing ? 'M6.5 5h4v14h-4zM13.5 5h4v14h-4z' : 'M8 5v14l11-7z');
  path.setAttribute('fill','currentColor'); svg.append(path); target.replaceChildren(svg);
}
let lastFocusRender='';
let lastCustomMinutes=35;
try { const saved=Number(localStorage.getItem('midnight-custom-minutes')); if (Number.isInteger(saved)&&saved>=1&&saved<=180) lastCustomMinutes=saved; } catch {}
function dismissFocusComplete() { MidnightNotifications.dismissFocus(); }
function showFocusComplete() { MidnightNotifications.focusComplete(); }
function openCustomTimer() {
  $('focusMinutes').value=lastCustomMinutes;
  MidnightUI.open($('focusCustomDialog'));
  $('focusMinutes').focus(); $('focusMinutes').select();
}
function startCustomTimer(event) {
  event.preventDefault();
  const minutes=Number($('focusMinutes').value);
  if (!Number.isInteger(minutes)||minutes<1||minutes>180) return;
  lastCustomMinutes=minutes;
  try { localStorage.setItem('midnight-custom-minutes',String(minutes)); } catch {}
  dismissFocusComplete(); focusTimer.select(minutes); focusTimer.toggle(); renderFocus();
  MidnightUI.close($('focusCustomDialog'));
}
function renderFocus() {
  const state=focusTimer.snapshot();
  const signature=[Math.ceil(state.remaining/1000),state.duration,state.running,state.persistent,state.lastCompletedAt,tz].join(':');
  if (signature===lastFocusRender) return;
  lastFocusRender=signature;
  $('focusTime').textContent=duration(Math.ceil(state.remaining/1000)*1000);
  const active=state.running || (state.remaining>0 && state.remaining<state.duration);
  $('focusSession').hidden=!active;
  $('focusSessionTime').textContent=duration(Math.ceil(state.remaining/1000)*1000);
  $('focusSessionLabel').textContent=state.running ? 'Focusing' : 'Paused';
  $('focusSessionToggle').textContent=state.running ? 'Pause' : 'Resume';
  $('focusSessionToggle').setAttribute('aria-label',state.running ? 'Pause focus timer' : 'Resume focus timer');
  $('focusSessionOpen').setAttribute('aria-label','Open focus timer, '+$('focusSessionTime').textContent+' remaining'+(state.running?'':', paused'));
  $('focusSession').classList.toggle('isPaused',!state.running);
  $('focusSessionHint').textContent=state.running ? 'Ends at '+formatDate(new Date(state.endsAt),{hour:'numeric',minute:'2-digit'})+' · '+tz.replaceAll('_',' ') : active ? 'Paused · resume whenever you’re ready' : state.remaining===0 ? 'Session complete. Take a moment to recharge.' : 'Your timer stays visible on the home screen.';

  $('focusPersistence').textContent=state.persistent?'':'Temporary session: browser storage is unavailable. Keep this tab open; reload recovery and window sync are unavailable.';
  $('focusReceipt').hidden=!state.lastCompletedAt;$('focusReceiptText').textContent=state.lastCompletedAt?'Last session completed '+formatDate(new Date(state.lastCompletedAt),{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
  $('focusStart').textContent=state.running ? 'Pause' : state.remaining<state.duration && state.remaining>0 ? 'Resume' : 'Start';
  $('focusStart').setAttribute('aria-label',state.running ? 'Pause focus timer' : 'Start focus timer');
  $('focusRing').setAttribute('stroke-dashoffset',String(100-100*state.remaining/state.duration));
  $('focusTime').setAttribute('aria-label',Math.ceil(state.remaining/60000)+' minutes remaining');
  document.querySelectorAll('[data-minutes]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.minutes)*60000===state.duration)));
  $('focusCustom').setAttribute('aria-label','Set focus duration, currently '+state.duration/60000+' minutes');
  document.querySelector('.focusWidget').classList.toggle('running',state.running);
  if (typeof window!=='undefined') window.dispatchEvent(new CustomEvent('midnight:focus',{detail:{running:state.running,endsAt:state.endsAt}}));
}
function applyTheme(value) {
  const allowed=['nature','system','graphite','light','christmas','rainy'];
  const choice=allowed.includes(value)?value:'nature';
  const resolved=choice==='nature'?'graphite':choice==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'graphite':'light'):choice;
  document.documentElement.dataset.theme=resolved; document.documentElement.dataset.appearance=choice;
  const tree=document.querySelector('.seasonTree');
  if(resolved==='christmas' && tree?.dataset.src && !tree.hasAttribute('src'))tree.src=tree.dataset.src;
  $('themeSelect').value=choice;
  window.dispatchEvent(new CustomEvent('midnight:appearance',{detail:{choice}}));
  document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===choice)));
  try{localStorage.setItem('midnight-appearance-v2',choice);}catch{}
  document.querySelector('meta[name="theme-color"]').content=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
}
function applyNumberFont(value) {
  const fonts=['modern','rounded','mono','serif','humanist','geometric','book']; const chosen=fonts.includes(value) ? value : 'modern';
  document.documentElement.dataset.numberFont=chosen; $('numberFont').value=chosen;
  document.querySelectorAll('[data-font-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fontChoice===chosen)));
  try { localStorage.setItem('midnight-number-font',chosen); } catch {}
}
function uiIcon(name,className='') {
  const node=element('span','uiIcon'+(className ? ' '+className : '')); node.dataset.icon=name; node.setAttribute('aria-hidden','true'); return node;
}
function weatherIcon(code,day=true,className='weatherSymbol') {
  let name='cloud';
  if (code===0) name=day ? 'sun' : 'moon';
  else if (code===1 || code===2) name=day ? 'cloud-sun' : 'cloud-moon';
  else if (code===3) name='cloud';
  else if (code<50) name='cloud-fog';
  else if (code>=95) name='cloud-lightning';
  else if (code>=71 && code<=77 || code>=85 && code<=86) name='cloud-snow';
  else name='cloud-rain';
  return uiIcon(name,className);
}
function fromWeatherTime(value) { return typeof value==='number' ? new Date(value*1000) : new Date(value); }
function shortTime(value) { return value==null ? '—' : formatDate(fromWeatherTime(value),{hour:'numeric',minute:'2-digit'}); }
function metric(label,value) { const node=element('div','weatherMetric'); node.append(element('span','',label),element('strong','',value)); return node; }
function renderWeatherDetails() {
  if (!weatherData) {
    $('miniForecast').replaceChildren(); $('weatherMetrics').replaceChildren(); $('hourlyForecast').replaceChildren();
    $('forecastNotice').textContent='Set a weather location first.'; return;
  }
  const c=weatherData.current,d=weatherData.daily,units=weatherData.current_units || {};
  const wind=c.wind_speed_10m==null ? '—' : Math.round(c.wind_speed_10m)+' '+(units.wind_speed_10m || '').replace('mp/h','mph');
  const windStat=element('span'); windStat.append(uiIcon('wind'),document.createTextNode(wind));
  const rainStat=element('span'); rainStat.append(uiIcon('cloud-rain'),document.createTextNode((d.precipitation_probability_max?.[0] ?? '—')+'%'));
  $('weatherStats').replaceChildren(windStat,rainStat); $('miniForecast').replaceChildren();
  d.time.slice(0,7).forEach((value,i)=>{
    const day=MidnightWeather.selectDay(weatherData,i,tz),mini=element('button','miniDay'); mini.type='button';
    if (i===0) mini.setAttribute('aria-current','date');
    const label=(i===0 ? 'Today' : formatDate(day.date,{weekday:'long'}))+': '+(descriptions[day.code] || '')+', high '+temperature(day.high)+', low '+temperature(day.low);
    mini.title=label; mini.setAttribute('aria-label',label);
    mini.append(element('span','forecastWeekday',i===0 ? 'Today' : formatDate(day.date,{weekday:'short'})),weatherIcon(day.code),element('strong','',temperature(day.high)),element('small','',temperature(day.low)));
    mini.onclick=()=>openWeatherDay(i); $('miniForecast').append(mini);
  });
  if ($('weatherDialog').open) renderSelectedDay();
  window.dispatchEvent(new Event('midnight:weather'));
}
function openWeatherDay(index) {
  if (!weatherData) { MidnightUI.open($('locationDialog')); return; }
  if(!weatherData.daily.time.length){$('forecastTitle').textContent='Weather';$('forecastNotice').textContent='Daily forecast unavailable. Try Refresh.';$('selectedDayHero').replaceChildren();$('hourlyForecast').replaceChildren();$('weatherMetrics').replaceChildren();MidnightUI.open($('weatherDialog'));return;}
  selectedWeatherDay=Math.max(0,Math.min(weatherData.daily.time.length-1,index));
  selectedWeatherDate=MidnightWeather.selectDay(weatherData,selectedWeatherDay,tz).dayKey;
  renderSelectedDay(); if (!$('weatherDialog').open) MidnightUI.open($('weatherDialog')); $('weatherDialog').scrollTop=0;
}
function renderSelectedDay() {
  if (!weatherData) return;
  const match=weatherData.daily.time.findIndex(value=>MidnightWeather.key(value,tz)===selectedWeatherDate);
  if (match>=0) selectedWeatherDay=match;
  const day=MidnightWeather.selectDay(weatherData,selectedWeatherDay,tz); if (!day) return;
  selectedWeatherDate=day.dayKey;
  $('forecastTitle').textContent=formatDate(day.date,{weekday:'long',month:'short',day:'numeric'});
  $('forecastPlace').textContent=$('location').textContent; $('forecastNotice').textContent=weatherMessage;
  $('unitToggle').textContent=settings.units==='celsius' ? '°C → °F' : '°F → °C';
  $('previousWeatherDay').disabled=selectedWeatherDay===0; $('nextWeatherDay').disabled=selectedWeatherDay>=weatherData.daily.time.length-1;
  const temperatures=element('div','dayTemperatures'); temperatures.append(element('strong','',temperature(day.high)),element('span','',temperature(day.low)));
  const outlook=element('div','dayOutlook'); outlook.append(temperatures,element('p','',descriptions[day.code] || 'Forecast'));
  $('selectedDayHero').replaceChildren(weatherIcon(day.code),outlook);
  $('weatherMetrics').replaceChildren(metric('Rain chance',day.rain==null ? '—' : day.rain+'%'),metric('Sunrise',shortTime(day.sunrise)),metric('Sunset',shortTime(day.sunset)));
  const dayIndex=day.index,daily=weatherData.daily,du=weatherData.daily_units||{};const value=(number,unit)=>number==null?'—':Math.round(number*10)/10+(unit?' '+unit:'');$('weatherMetrics').append(metric('Max wind',value(daily.wind_speed_10m_max?.[dayIndex],du.wind_speed_10m_max)),metric('UV index',value(daily.uv_index_max?.[dayIndex],'')),metric('Precipitation',value(daily.precipitation_sum?.[dayIndex],du.precipitation_sum)));
  $('hourlyTitle').textContent='Hourly forecast'; $('hourlyForecast').replaceChildren();
  for (const hour of day.hours) {
    const cell=element('div','hourCell');
    cell.append(element('time','',formatDate(hour.time,{hour:'numeric'})),weatherIcon(hour.code,hour.isDay),element('strong','',hour.temperature==null ? '—' : Math.round(hour.temperature)+'°'),element('span','rainChance',hour.rain==null ? '—' : hour.rain+'%'));
    cell.dataset.time=hour.time.getTime();$('hourlyForecast').append(cell);
  }
  if(!browsedHours.has(day.dayKey)){browsedHours.add(day.dayKey);const current=[...$('hourlyForecast').children].find(cell=>Number(cell.dataset.time)>=Date.now()-3600000);requestAnimationFrame(()=>{if(current)$('hourlyForecast').scrollLeft=current.offsetLeft-$('hourlyForecast').offsetLeft;});}
  $('forecastChecked').textContent='Fetched '+formatDate(new Date(weatherFetched||Date.now()),{hour:'numeric',minute:'2-digit'});
}
async function searchCity(event) {
  event.preventDefault(); const query=$('citySearch').value.trim(); $('searchCity').disabled=true; $('cityResults').replaceChildren();
  try {
    const data=await api('weather/search?q='+encodeURIComponent(query));
    if (!data.results.length) $('cityResults').append(element('p','','No cities found. Try a nearby city.'));
    for (const place of data.results) {
      const label=[place.name,place.region,place.country].filter(Boolean).join(', '),button=element('button','cityResult',label);
      button.type='button'; button.onclick=handle(async()=>{
        if (weatherBusy) { toast('Weather is refreshing. Try again in a moment.'); return; }
        locationRevision++; coordinates={lat:place.latitude,lon:place.longitude,name:place.name};
        localStorage.setItem('midnight-location',JSON.stringify(coordinates)); $('cityResults').replaceChildren(); $('citySearch').value='';
        await refreshWeather(); MidnightUI.close($('locationDialog'));
      }); $('cityResults').append(button);
    }
  } catch(e) { $('cityResults').append(element('p','',e.message)); }
  finally { $('searchCity').disabled=false; }
}
async function openReader(article) {
  const request=++readerRequest;
  $('readerSource').textContent=article.source || ''; $('readerTitle').textContent=article.title;
  $('readerNotice').hidden=false; $('readerNotice').textContent='Loading article…'; $('readerContent').replaceChildren();
  $('readerOriginal').hidden=!article.url; if (article.url) $('readerOriginal').href=article.url;
  MidnightUI.open($('readerDialog')); $('readerDialog').scrollTop=0;
  try {
    const data=article.url ? await api('news/article?url='+encodeURIComponent(article.url)) : {content:article.summary || '',notice:'Text supplied by the RSS feed.'};
    if (request!==readerRequest || !$('readerDialog').open) return;
    $('readerNotice').textContent=data.notice || ''; $('readerNotice').hidden=!data.notice;
    for (const paragraph of data.content.split(/\n+/).filter(p=>p.trim())) $('readerContent').append(element('p','',paragraph));
  } catch(e) { if (request===readerRequest) { $('readerNotice').hidden=false; $('readerNotice').textContent=e.message; } }
}
function initV3() {
  const previews=$('themePreviews');
  for (const option of $('themeSelect').options) {
    const button=element('button','themePreview'); button.type='button'; button.dataset.themeChoice=option.value;
    button.setAttribute('aria-label',option.text+' theme'); button.title=option.text;
    const swatch=element('span','themeSwatch'); swatch.setAttribute('aria-hidden','true');
    button.append(swatch,element('span','',option.text)); button.onclick=()=>applyTheme(option.value); previews.append(button);
  }
  let theme='nature'; try { theme=localStorage.getItem('midnight-appearance-v2') || theme;if(!localStorage.getItem('midnight-live-intro-v1')){if(theme==='system')theme='nature';localStorage.setItem('midnight-live-intro-v1','1');} } catch {}
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(document.documentElement.dataset.appearance==='system')applyTheme('system');});
  applyTheme(theme); $('themeSelect').onchange=e=>applyTheme(e.target.value);
  let numberFont='modern'; try { numberFont=localStorage.getItem('midnight-number-font') || numberFont; } catch {}
  for(const option of $('numberFont').options){const button=element('button','fontPreview');button.type='button';button.dataset.fontChoice=option.value;button.setAttribute('aria-label',option.text+' number font');button.append(element('span','fontDigits','12:48'),element('span','fontName',option.text));button.onclick=()=>applyNumberFont(option.value);$('fontPreviews').append(button);}
  applyNumberFont(numberFont); $('numberFont').onchange=e=>applyNumberFont(e.target.value);
  setPlaybackIcon($('play'),false);
  $('focusCustom').onclick=openCustomTimer;
  $('focusCustomClose').onclick=()=>MidnightUI.close($('focusCustomDialog'));
  $('focusCustomForm').onsubmit=startCustomTimer;
  $('focusStart').onclick=()=>{ dismissFocusComplete(); focusTimer.toggle(); renderFocus(); };
  $('focusSessionOpen').onclick=()=>MidnightPanels.open('focus');
  $('focusSessionToggle').onclick=()=>{ dismissFocusComplete(); focusTimer.toggle(); renderFocus(); };
  $('focusReset').onclick=()=>{ dismissFocusComplete(); focusTimer.reset(); renderFocus(); };
  document.querySelectorAll('[data-minutes]').forEach(b=>b.onclick=()=>{ dismissFocusComplete(); focusTimer.select(Number(b.dataset.minutes)); focusTimer.toggle(); renderFocus(); MidnightUI.close($('focusCustomDialog')); });
  $('weatherMore').onclick=()=>openWeatherDay(0);
  $('previousWeatherDay').onclick=()=>openWeatherDay(selectedWeatherDay-1);
  $('nextWeatherDay').onclick=()=>openWeatherDay(selectedWeatherDay+1);
  $('closeLocation').onclick=()=>MidnightUI.close($('locationDialog'));
  $('closeWeather').onclick=()=>MidnightUI.close($('weatherDialog')); $('citySearchForm').onsubmit=searchCity;
  $('forecastLocate').onclick=()=>{ locate(); MidnightUI.close($('locationDialog')); };
  $('weatherRefresh').onclick=handle(async()=>{ $('weatherRefresh').disabled=true; try { await refreshWeather(true); } finally { $('weatherRefresh').disabled=false; } });
  $('unitToggle').onclick=handle(async()=>{ if (weatherBusy) return; const result=await post('settings',{units:settings.units==='celsius' ? 'fahrenheit' : 'celsius'}); settings=result.settings||{...settings,units:settings.units==='celsius'?'fahrenheit':'celsius'};window.dispatchEvent(new Event('midnight:settings-saved')); await Promise.allSettled([refreshWeather(),refreshNews()]); });
  const closeReader=()=>{ readerRequest++; MidnightUI.close($('readerDialog')); };
  $('closeReader').onclick=closeReader; $('readerDone').onclick=closeReader;
  $('readerDialog').addEventListener('close',()=>readerRequest++);
}
if (typeof window!=='undefined') window.MidnightApp={
 spotifyConnected:()=>connected,
 playerSnapshot:()=>player?{...player}:null,request:api,timezone:()=>tz,calendarRead:query=>api('calendar?'+query),
 snapshot:()=>({calendarTruncated,calendarSource,calendarImportedAt,calendarLoaded,calendarConfigured,calendarFailed,events:calendarItems.map(item=>({...item})),player:player?{...player}:null,spotify:{connected,authRequired:spotifyAuthRequired,message:spotifyMessage},plugEnabled:!!settings.plug_enabled,focus:focusTimer.snapshot()}),
 openSettings:section=>{showSettings({currentTarget:{id:section==='calendar'?'calendarSettings':section==='room'?'plugSettings':section==='news'?'newsSettings':'settingsBtn'}});},
 focus:()=>openCustomTimer(),startFocus:()=>{if(!focusTimer.snapshot().running){focusTimer.toggle();renderFocus();}},
 openWeather:()=>openWeatherDay(0),media:action=>control(action),
 warmerState:()=>plug?.on ?? null,
 async toggleWarmer(){
  if(!settings.plug_enabled)throw new Error('Enable the candle warmer in Settings first.');
  await refreshPlug();
  if(!plug)throw new Error('The candle warmer is unavailable.');
  const requested=!plug.on;
  await togglePlug();
  if(plug?.on!==requested)throw new Error('The requested power state could not be verified.');
  return plug.on;
 },
 async warmer(on){if(!settings.plug_enabled)throw new Error('Set up the candle warmer in Settings first.');await refreshPlug();if(!plug)throw new Error('The candle warmer is unavailable.');if(plug.on!==on)await togglePlug();if(!plug||plug.on!==on)throw new Error('The requested power state could not be verified.');return plug;},
 reveal(id){const node=$(id);if(window.MidnightPanels?.reveal(id))return;node?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},
 revealEvent(event){window.MidnightWidgets?.openEvent(event);},
 weatherSnapshot:()=>({data:weatherData,timezone:tz,place:coordinates?.name||'',checked:weatherFetched,message:weatherMessage,loading:weatherBusy}),refreshPlayer:refreshSpotify,connectSpotify,theme:applyTheme,toast
};

let chatLink;
function validChatDestination(value){const url=new URL(value);if(url.protocol!=='https:'||!['chatgpt.com','www.chatgpt.com'].includes(url.hostname)||url.username||url.password)throw new Error('Use an HTTPS address on chatgpt.com.');return url.href;}

function initReliability(){
chatLink=document.querySelector('[aria-label="Open Quick Capture in ChatGPT"]');
window.addEventListener('storage',event=>{if(event.key==='midnight-focus-v3'){focusTimer.sync();lastFocusRender='';renderFocus();MidnightActivity.wake();}});
$('focusReceiptDismiss').onclick=()=>{focusTimer.dismissReceipt();lastFocusRender='';renderFocus();};
$('clockFormat').value=clockFormat;$('clockFormat').onchange=()=>{try{safeStorage.setItem('midnight-clock-format',$('clockFormat').value);clockFormat=$('clockFormat').value;lastClockMinute='';tick();$('instantPreferenceStatus').textContent='Clock format saved in this browser.';}catch{$('instantPreferenceStatus').textContent='Clock format could not be saved.';}};
$('storageOrigin').textContent=location.origin;
$('restoreCalendar').onclick=handle(async()=>{await post('calendar/restore');const boot=await api('bootstrap');settings=boot.settings;$('calendarUrl').value='';renderCalendarSetting();$('importStatus').textContent='Previous calendar restored.';window.dispatchEvent(new Event('midnight:calendar-changed'));await refreshCalendar();});
try{chatLink.href=validChatDestination(safeStorage?.getItem('midnight-chatgpt-destination')||'https://chatgpt.com/');}catch{}
$('chatgptDestination').value=chatLink.href;$('chatgptDestination').onchange=()=>{try{const value=validChatDestination($('chatgptDestination').value||'https://chatgpt.com/');safeStorage.setItem('midnight-chatgpt-destination',value);chatLink.href=value;$('instantPreferenceStatus').textContent='ChatGPT destination saved in this browser.';}catch(error){$('instantPreferenceStatus').textContent=error.message;}};
const settingsChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('midnight-settings'):null;
window.addEventListener('midnight:settings-saved',()=>settingsChannel?.postMessage('changed'));
if(settingsChannel)settingsChannel.onmessage=async()=>{try{const boot=await api('bootstrap');settings=boot.settings;window.dispatchEvent(new Event('midnight:calendar-changed'));}catch{}};
if($('sceneryInfo'))$('sceneryInfo').onclick=()=>{MidnightApp.openSettings();$('wallpaperPreferences details').open=true;$('wallpaperPreferences').scrollIntoView({block:'start'});};

}
init();
