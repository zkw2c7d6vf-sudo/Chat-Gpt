/* Inline Spotify controls and distinct recent albums/playlists. No playback occurs without a click. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const music = $('music'), row = $('spotifyRecents'), preview = $('recordPreview');
  const status = $('homePlaybackStatus');
  let busy = false, albums = [], playlists = [], mode = 'albums', signature = '';
  let nextFetch = 0, fetching = false, historyMessage = '', historyConsent = false;
  let previousVolume = 50, lastSecond = '', loading = false;
  const svg = path => {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key, value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'})) icon.setAttribute(key,value);
    const shape = document.createElementNS(icon.namespaceURI, 'path'); shape.setAttribute('d',path); icon.append(shape); return icon;
  };
  $('homeShuffle').append(svg('m3 6 3 0c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 5-6m2-3c2-2 3-3 5-3h3m-4-4 4 4-4 4'));
  $('homeRepeat').firstElementChild.append(svg('m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3'));
  const volumeIcon = muted => svg('M4 9h4l5-4v14l-5-4H4z '+(muted?'m17 0 5 6m-5 0 5-6':'M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14'));
  let messageTimer;
  function message(text, error = false) {
    clearTimeout(messageTimer);
    if (text && !error && !/…$|waiting for playback\.$/.test(text)) messageTimer = setTimeout(() => {status.hidden = true;}, 3500);
    status.textContent = text; status.hidden = !text; status.dataset.error = String(error);
    status.title = text;
  }
  function sync() {
    const state = MidnightApp.snapshot(), p = state.player, active = !!p?.active, dis = p?.disallows || {};
    if (!busy && p?.playing && status.textContent === 'Sent to Spotify · waiting for playback.') message('');
    music.dataset.connected = String(!!state.spotify.connected);
    music.dataset.active = String(active);
    if (!active) {
      $('musicTitle').textContent = state.spotify.connected ? 'Nothing playing' : 'Your listening room';
      $('artist').textContent = state.spotify.connected ? 'Choose a record or open Spotify.' : 'A little room for your music.';
    }
    syncLike();
    const volume = active && p.supports_volume && typeof p.volume === 'number';
    $('homeShuffle').disabled = busy || !active || !!dis.toggling_shuffle;
    $('homeShuffle').setAttribute('aria-pressed',String(!!p?.shuffle));
    $('homeRepeat').disabled = busy || !active || !!dis.toggling_repeat_context || !!dis.toggling_repeat_track;
    const repeat = p?.repeat || 'off', repeatName = {off:'off',context:'all',track:'one track'}[repeat] || 'off';
    $('homeRepeat').setAttribute('aria-label','Repeat: '+repeatName); $('homeRepeat').title = 'Repeat: '+repeatName+' · click to change';
    $('homeRepeat').setAttribute('aria-pressed',String(repeat !== 'off')); $('homeRepeat').lastElementChild.hidden = repeat !== 'track';
    $('homeVolume').disabled = $('homeMute').disabled = busy || !volume;
    if (document.activeElement !== $('homeVolume')) {
      $('homeVolume').value = volume ? p.volume : 0;
      $('homeVolumeValue').textContent = volume ? p.volume+'%' : '—';
      $('homeVolume').style.setProperty('--range-fill',(volume?p.volume:0)+'%');
    }
    const muted = volume && p.volume === 0;
    $('homeMute').replaceChildren(volumeIcon(muted)); $('homeMute').setAttribute('aria-label',muted?'Unmute':'Mute');
    $('homeVolume').title = !active ? 'Start Spotify on a device to adjust volume' : !volume ? 'Volume is managed in Spotify on this device' : 'Volume';
    $('homeVolumeValue').title = $('homeVolume').title;
    $('homeSeek').disabled = busy || !active || !p.duration || !!dis.seeking;
    $('play').disabled = busy || !active || !!(p?.playing ? dis.pausing : dis.resuming);
    $('previous').disabled = busy || !active || !!dis.skipping_prev;
    $('next').disabled = busy || !active || !!dis.skipping_next;
    $('musicDeviceLabel').textContent = active ? p.device : 'Details';
    $('musicMore').title = active ? 'Listening on '+p.device+' · details' : 'Spotify details';
    for (const button of row.querySelectorAll('button')) {
      button.disabled = busy || !state.spotify.connected;
      if (p?.url && button.dataset.url === p.url) button.setAttribute('aria-current','true');
      else button.removeAttribute('aria-current');
    }
    progress();
  }
  function progress() {
    if (document.hidden || document.activeElement === $('homeSeek')) return;
    const p = MidnightApp.playerSnapshot(), elapsed = p?.active ? Math.min(p.duration,p.progress+(p.playing?Date.now()-p.fetched:0)) : 0;
    const key = [Math.floor(elapsed/1000),p?.duration].join(':'); if (key === lastSecond) return; lastSecond = key;
    $('homeSeek').value = p?.duration ? Math.round(elapsed/p.duration*1000) : 0;
    $('homeSeek').setAttribute('aria-valuetext',duration(elapsed)+' of '+duration(p?.duration||0));
  }
  async function run(path,body) {
    if (busy) return;
    busy = true; sync(); message('Updating Spotify…');
    try {
      await MidnightApp.request(path,{method:'POST',body:JSON.stringify(body)});
      await MidnightApp.refreshPlayer();
      message(MidnightApp.snapshot().spotify.message || '');
    } catch(error) { message(error.message,true); }
    finally { busy = false; sync(); }
  }
  let likeUri = '', liked = null, likeBusy = false, likeLoading = false, likeCheck = 0;
  let likeCanSave = true, likeNeedsConsent = false, likeNextCheck = 0;
  function currentSong() {
    const p = MidnightApp.playerSnapshot();
    if (!p?.active || p.type && p.type !== 'track') return '';
    if (/^spotify:track:[a-zA-Z0-9]{1,64}$/.test(p.uri || '')) return p.uri;
    const match = /^https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]{1,64})$/.exec(p.url || '');
    return match ? 'spotify:track:' + match[1] : '';
  }
  function paintLike() {
    const button = $('homeLike'), saved = liked === true;
    button.replaceChildren(MidnightIcons.make(saved ? 'check' : 'plus'));
    button.disabled = busy || likeBusy || !currentSong() || saved;
    button.setAttribute('aria-busy', String(likeBusy));
    button.dataset.saved = String(saved);
    const title = !currentSong() ? 'Play a Spotify song to add it to Liked Songs' : saved ? 'Saved to Liked Songs' : likeNeedsConsent && !likeCanSave ? 'Connect Spotify to enable Liked Songs' : 'Add to Liked Songs';
    button.title = title; button.setAttribute('aria-label', title);
  }
  function syncLike() {
    const uri = currentSong();
    if (uri !== likeUri) {likeUri = uri; liked = null; likeCanSave = true; likeNeedsConsent = false; likeNextCheck = 0; likeCheck++; likeLoading = false;}
    paintLike();
    if (!uri || document.hidden || likeLoading || likeBusy || Date.now() < likeNextCheck) return;
    likeLoading = true; likeNextCheck = Date.now() + 30000;
    const revision = ++likeCheck;
    MidnightApp.request('spotify/liked?track_uri=' + encodeURIComponent(uri)).then(data => {
      if (revision !== likeCheck || currentSong() !== uri) return;
      liked = data.saved; likeCanSave = data.can_save !== false; likeNeedsConsent = !!data.needs_consent; paintLike();
    }).catch(() => { /* A failed status read never prevents an explicit save attempt. */ })
      .finally(() => {if (revision === likeCheck) likeLoading = false;});
  }
  $('homeLike').onclick = async () => {
    const uri = currentSong();
    if (!uri || liked === true || likeBusy || busy) return;
    if (likeNeedsConsent && !likeCanSave) {
      message('Connect Spotify once to enable Liked Songs.');
      try {await MidnightApp.connectSpotify();} catch(error) {message(error.message, true);}
      return;
    }
    const title = MidnightApp.playerSnapshot()?.title || 'Song';
    likeBusy = true; likeCheck++; likeLoading = false; paintLike();
    message('Adding ' + title + ' to Liked Songs…');
    try {
      const result = await MidnightApp.request('spotify/liked', {method:'POST', body:JSON.stringify({track_uri:uri})});
      if (result.saved !== true) throw new Error('Spotify has not confirmed saving the song. Try again.');
      if (currentSong() === uri) {liked = true; likeNextCheck = Date.now() + 30000;}
      message('Added ' + title + ' to Liked Songs.');
    } catch(error) {
      if (currentSong() === uri && error.status === 403 && /Reconnect Spotify to allow/.test(error.message)) {likeCanSave = false; likeNeedsConsent = true;}
      message(error.message, true);
    } finally {likeBusy = false; syncLike();}
  };
  $('homeShuffle').onclick = () => run('spotify/options',{shuffle:!MidnightApp.playerSnapshot()?.shuffle});
  $('homeRepeat').onclick = () => run('spotify/options',{repeat:({off:'context',context:'track',track:'off'})[MidnightApp.playerSnapshot()?.repeat || 'off']});
  $('homeVolume').oninput = () => { $('homeVolumeValue').textContent = $('homeVolume').value+'%'; $('homeVolume').style.setProperty('--range-fill',$('homeVolume').value+'%'); };
  $('homeVolume').onchange = () => run('spotify/options',{volume:Number($('homeVolume').value)});
  $('homeMute').onclick = () => { const volume = MidnightApp.playerSnapshot()?.volume || 0; if (volume) previousVolume = volume; run('spotify/options',{volume:volume?0:previousVolume}); };
  $('homeSeek').oninput = () => {
    const p = MidnightApp.playerSnapshot(), position = (p?.duration || 0)*Number($('homeSeek').value)/1000;
    $('elapsed').textContent = duration(position); $('progressFill').style.width = Number($('homeSeek').value)/10+'%';
    $('homeSeek').setAttribute('aria-valuetext',duration(position)+' of '+duration(p?.duration || 0));
  };
  $('homeSeek').onchange = () => {
    const p = MidnightApp.playerSnapshot();
    if (p?.active && p.duration) run('spotify/options',{position_ms:Math.max(0,Math.min(p.duration-1,Math.round(p.duration*Number($('homeSeek').value)/1000)))});
  };
  function art(item,cls) {
    const node = document.createElement('span'); node.className = cls; node.append(MidnightIcons.make('music'));
    if (/^https:\/\//.test(item.image || '')) {
      const image = document.createElement('img'); image.alt = ''; image.decoding = 'async'; image.src = item.image;
      image.onerror = () => image.remove(); node.append(image);
    }
    return node;
  }
  function showPreview(item) {
    if (busy) return;
    preview.textContent = item.name; preview.hidden = false;
  }

  function renderShelf() {
    $('shelfView').value = mode;
    const seen = new Set();
    const items = (mode === 'playlists' ? playlists : albums).filter(item => {
      const match = /^https:\/\/open\.spotify\.com\/(album|playlist)\/[a-zA-Z0-9]{1,64}$/.exec(item.url || '');
      if (!match || match[1] !== (mode === 'playlists' ? 'playlist' : 'album') || seen.has(item.url)) return false;
      seen.add(item.url); return true;
    }), key = JSON.stringify([items,mode]);
    $('shelfEmpty').textContent = historyMessage || (loading?'Loading your records…':items.length?'':(mode === 'playlists' ? 'Play a playlist in Spotify to see it here.' : 'Your recently played albums will appear here.'));
    $('shelfEmpty').hidden = !!items.length && !historyMessage;
    $('shelfConnect').hidden = !historyConsent;
    if (signature === key) return;
    signature = key; preview.hidden = true; row.replaceChildren();
    row.setAttribute('aria-label',mode === 'playlists'?'Recently played playlists':'Recently played albums');
    for (const item of items.slice(0,20)) {
      const match = /^https:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]{1,64})$/.exec(item.url || '');
      if (!match) continue;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'shelfRecord'; button.dataset.url = item.url;
      button.setAttribute('aria-label','Play '+item.name+(item.artist?' by '+item.artist:''));
      const cover = art(item,'recordCover'); cover.setAttribute('aria-hidden','true'); button.append(cover);
      button.onpointerenter = () => showPreview(item); button.onpointerleave = () => {preview.hidden = true;};
      button.onfocus = () => {showPreview(item); button.scrollIntoView({block:'nearest',inline:'nearest'});}; button.onblur = () => {preview.hidden = true;};
      button.onclick = () => playRecord(item,button,match);
      row.append(button);
    }
    row.hidden = !row.childElementCount; sync();
  }
  try { if (localStorage.getItem('midnight-shelf-view') === 'playlists') mode = 'playlists'; } catch {}
  $('shelfView').onchange = () => {
    mode = $('shelfView').value;
    try { localStorage.setItem('midnight-shelf-view', mode); } catch {}
    renderShelf();
  };
  // The request starts immediately. Finite transform animations occupy its round trip.
  async function animateRecord(item,button) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) return;
    const source = button.querySelector('.recordCover').getBoundingClientRect(), target = $('disc').getBoundingClientRect();
    const vinyl = art(item,'recordFlightVinyl');
    const size = 88, left = source.left + source.width/2-size/2, top = source.top + source.height/2-size/2;
    vinyl.setAttribute('aria-hidden','true'); vinyl.style.left=left+'px';vinyl.style.top=top+'px';document.body.append(vinyl);
    const dx = target.left+target.width/2-(left+size/2), dy = target.top+target.height/2-(top+size/2);
    const b = vinyl.animate([{transform:'translate(0,0) scale(.65)',opacity:0},{transform:'translate(0,-85px) scale(1)',opacity:1,offset:.3},{transform:'translate(58px,-85px) scale(1) rotate(30deg)',opacity:1,offset:.55},{transform:`translate(${dx}px,${dy-16}px) scale(${target.width/size}) rotate(110deg)`,opacity:1,offset:.9},{transform:`translate(${dx}px,${dy}px) scale(${target.width/size}) rotate(135deg)`,opacity:0}],{duration:1500,easing:'cubic-bezier(.22,.7,.2,1)'});
    const stop = () => {b.cancel();};
    const visibility = () => {if(document.hidden)stop();}; document.addEventListener('visibilitychange',visibility);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)'); const preference = () => {if(reduced.matches)stop();};reduced.addEventListener('change',preference);
    addEventListener('resize',stop,{once:true});
    try {await Promise.allSettled([b.finished]);}
    finally {document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);removeEventListener('resize',stop);vinyl.remove();}
  }
  async function playRecord(item,button,match) {
    if (busy) return;
    busy = true; preview.hidden = true; button.setAttribute('aria-busy','true'); music.dataset.loadingRecord = 'true'; sync();
    message('Taking '+item.name+' off the shelf…');
    const animation = animateRecord(item,button);
    try {
      const track = match[1] === 'track';
      await MidnightApp.request('spotify/'+(track?'play-track':'play-collection'),{method:'POST',body:JSON.stringify(track?{track_uri:'spotify:track:'+match[2]}:{context_uri:'spotify:'+match[1]+':'+match[2]})});
      await animation; await MidnightApp.refreshPlayer();
      const state = MidnightApp.snapshot();
      message(state.spotify.message || (state.player?.playing?'':'Sent to Spotify · waiting for playback.'));
    } catch(error) {await animation; message(error.message,true);}
    finally {busy = false; delete music.dataset.loadingRecord;button.removeAttribute('aria-busy');sync();}
  }
  async function refreshShelf() {
    if (!MidnightApp.spotifyConnected()) {
      albums=[];playlists=[];nextFetch=0;historyConsent=false;historyMessage='Connect Spotify to fill your record shelf.';renderShelf();return;
    }
    if (document.hidden || fetching || Date.now() < nextFetch) return;
    fetching = loading = true; nextFetch = Date.now()+120000; historyMessage=''; renderShelf();
    try {
      const data = await MidnightApp.request('spotify/recent'); if (!MidnightApp.spotifyConnected()) return;
      albums = data.albums || (data.items || []).filter(item => item.url?.includes('/album/'));
      playlists = data.playlists || (data.items || []).filter(item => item.url?.includes('/playlist/')); historyConsent = !!data.needs_consent;
      historyMessage = historyConsent ? 'Allow listening history to fill your shelf.' : '';
      $('spotifyRecentsStatus').textContent = historyMessage; $('spotifyRecentsConnect').hidden = !historyConsent;
    } catch(error) {historyMessage = 'History unavailable · '+error.message;}
    finally {fetching = loading = false;renderShelf();}
  }
  const connect = () => MidnightApp.connectSpotify().catch(error => message(error.message,true));
  $('shelfConnect').onclick = $('spotifyRecentsConnect').onclick = connect;
  addEventListener('midnight:player',() => {sync(); refreshShelf();});
  addEventListener('midnight:tick',progress); document.addEventListener('visibilitychange',refreshShelf);
  MidnightActivity.every('spotify-record-shelf',refreshShelf,120000,{enabled:()=>MidnightApp.spotifyConnected()});
  $('albumArt').onerror = () => {$('albumArt').hidden = true;};
  sync(); refreshShelf();
})();
