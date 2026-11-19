/* Independent field recordings: one-tap dock playback with inline volume. */
'use strict';
(() => {
 const $ = id => document.getElementById(id), audio = $('ambientAudio'), panel = $('soundsPanel'), dock = $('soundsDock');
 let recordings = [], chosen = null, savedId = 'rain', loading = null, loaded = false, starting = false, used = false, volume = .45, playIntent = 0;
 try {
  const saved = JSON.parse(localStorage.getItem('midnight-sounds-v1') || 'null');
  if (saved) {savedId = String(saved.id || 'rain'); if (Number.isFinite(saved.volume)) volume = Math.max(0, Math.min(1, saved.volume));}
 } catch {}
 const quick = document.createElement('div'); quick.id = 'soundQuickControls'; quick.className = 'soundQuickControls'; quick.hidden = true;
 quick.setAttribute('role','group'); quick.setAttribute('aria-label','Ambient sound controls');
 quick.innerHTML = '<span id="soundQuickName">Rain</span><label class="srOnly" for="soundQuickVolume">Ambient sound volume</label><input id="soundQuickVolume" type="range" min="0" max="100" value="45" aria-describedby="soundQuickVolumeValue"><output id="soundQuickVolumeValue" for="soundQuickVolume">45%</output><button type="button" id="soundQuickSettings" aria-label="Choose ambient recording" title="Choose recording"><span aria-hidden="true">⌄</span></button>';
 document.querySelector('.bottomDock').append(quick);
 const ring = document.createElement('span'); ring.className = 'soundRainRing'; ring.setAttribute('aria-hidden','true'); dock.append(ring);
 dock.removeAttribute('aria-haspopup');
 function notice(text, error = false) {$('soundStatus').textContent = text; if (error) MidnightApp.toast(text,true);}
 function persist() {
  try {localStorage.setItem('midnight-sounds-v1',JSON.stringify({id:chosen?.id || savedId, volume:audio.volume}));}
  catch {notice('Sound preferences could not be saved. Playback is still available.');}
 }
 function clock(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const total = Math.floor(seconds), minutes = Math.floor(total / 60);
  return (minutes >= 60 ? Math.floor(minutes / 60) + ':' + String(minutes % 60).padStart(2,'0') : minutes) + ':' + String(total % 60).padStart(2,'0');
 }
 function sync() {
  const playing = !audio.paused && !audio.ended && !audio.error;
  dock.setAttribute('aria-pressed',String(playing)); dock.setAttribute('aria-busy',String(starting));
  dock.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + (chosen?.label.toLowerCase() || 'ambient sounds'));
  dock.title = starting ? 'Starting sounds…' : playing ? 'Pause sounds' : 'Play sounds';
  quick.hidden = !used || !document.querySelector('#toolbarItems')?.contains(dock);
  $('soundQuickName').textContent = chosen?.label || 'Rain';
  $('soundQuickSettings').title = 'Choose recording · ' + (chosen?.label || 'Rain');
  $('soundPower').disabled = !chosen?.available || starting;
  $('soundPower').textContent = starting ? 'Starting…' : playing ? 'Pause' : 'Play';
  for (const button of $('soundChoices').children) {button.setAttribute('aria-pressed',String(button.dataset.id === chosen?.id)); button.disabled = starting || !recordings.find(item => item.id === button.dataset.id)?.available;}
  $('soundProgress').textContent = chosen ? clock(audio.currentTime) + ' / ' + clock(audio.duration || chosen.seconds) : '';
 }
 function syncVolume() {
  const value = Math.round(audio.volume * 100);
  for (const id of ['soundVolume','soundQuickVolume']) $(id).value = String(value);
  for (const id of ['soundVolumeValue','soundQuickVolumeValue']) $(id).value = value + '%';
 }
 function credit() {
  const area = $('soundCredit'); area.replaceChildren(); if (!chosen) return;
  const link = document.createElement('a'); link.href = chosen.source; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = chosen.title + ' — ' + chosen.creator;
  const license = document.createElement('a'); license.href = chosen.license_url; license.target = '_blank'; license.rel = 'noopener noreferrer'; license.textContent = chosen.license;
  area.append(link,document.createTextNode(' · '),license,document.createTextNode(chosen.normalize_mp3 ? '. 82-minute excerpt of the original recording; no generated audio.' : '. Real recording supplied by Freesound; no generated audio.'));
 }
 function select(recording) {
  if (!recording) {sync(); return;}
  if (chosen?.id !== recording.id) {audio.pause(); chosen = recording; savedId = recording.id; audio.src = recording.path; audio.load(); persist();}
  credit(); sync();
 }
 async function play(recording = chosen) {
  if (starting || !recording?.available) return;
  select(recording); const intent = ++playIntent; starting = true; used = true; sync(); notice('Starting ' + recording.label.toLowerCase() + '…');
  try {await audio.play(); if (intent === playIntent) notice('Playing ' + recording.label.toLowerCase() + '. Use Sounds to pause.');}
  catch {if (intent === playIntent) notice('Playback could not start. Tap Sounds to retry, or choose an installed recording.',true);}
  finally {if (intent === playIntent) starting = false; sync();}
 }
 async function load() {
  if (loaded) return true;
  if (loading) return loading;
  loading = (async () => {
   try {
    const response = await fetch('/api/sounds'); if (!response.ok) throw new Error('Recordings could not load. Tap Sounds to retry.');
    recordings = (await response.json()).recordings; $('soundChoices').replaceChildren();
    for (const item of recordings) {
     const button = document.createElement('button'); button.type = 'button'; button.className = 'soundChoice'; button.dataset.id = item.id; button.disabled = !item.available;
     const copy = document.createElement('span'), title = document.createElement('strong'), description = document.createElement('small');
     title.textContent = item.label; description.textContent = item.description + ' · ' + clock(item.seconds) + (item.available ? '' : ' · recording not installed'); copy.append(title,description);
     button.append(MidnightIcons.make(item.id === 'rain' ? 'cloud' : 'sounds'),copy); button.onclick = () => play(item); $('soundChoices').append(button);
    }
    loaded = true; select(recordings.find(item => item.id === savedId && item.available) || recordings.find(item => item.available) || recordings[0]);
    if (recordings.some(item => !item.available)) notice('Some recordings are missing. Run scripts/fetch_ambient.py and reopen Midnight.');
    return true;
   } catch (error) {notice(error.message); return false;}
   finally {loading = null;}
  })();
  return loading;
 }
 let toggling = false;
 dock.onclick = async () => {
  if (starting) {++playIntent; audio.pause(); starting = false; toggling = false; notice('Paused. Tap Sounds to continue.'); sync(); return;}
  if (toggling) return;
  toggling = true; used = true;
  try {
   if (!audio.paused) {audio.pause(); notice('Paused. Tap Sounds to continue.');}
   else if (await load()) {
    if (chosen?.available) await play();
    else {sync(); notice('No sound recording is installed. Choose a recording for setup details.',true);}
   } else notice($('soundStatus').textContent,true);
  } finally {toggling = false; sync();}
 };
 $('soundQuickSettings').onclick = () => {MidnightUI.open(panel); load();};
 addEventListener('midnight:dialogchange',() => {if (panel.open) load();});
 addEventListener('midnight:toolbarchange',sync);
 $('soundPower').onclick = () => {if (!starting) {if (!audio.paused) {audio.pause(); notice('Paused. Tap Sounds to continue.');} else play();} sync();};
 for (const id of ['soundVolume','soundQuickVolume']) $(id).oninput = () => {audio.volume = Number($(id).value) / 100; syncVolume(); persist();};
 for (const event of ['timeupdate','play','pause','ended','loadedmetadata']) audio.addEventListener(event,sync);
 audio.addEventListener('volumechange',syncVolume);
 audio.addEventListener('waiting',() => notice('Loading recording…'));
 audio.addEventListener('playing',() => notice('Playing ' + chosen.label.toLowerCase() + '. Use Sounds to pause.'));
 audio.addEventListener('error',() => {audio.pause(); notice('This recording could not load. Choose another recording or restore the missing audio.',used); sync();});
 // Load only the catalog at startup. Audio remains paused, with preload=none.
 audio.volume = volume; syncVolume(); sync(); load();
})();
