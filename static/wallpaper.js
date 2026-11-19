/* Decorative local video never controls media playback or account integrations. */
'use strict';
window.MidnightWallpaper=(()=>{
 const $=id=>document.getElementById(id),root=document.documentElement;
 const nextHome=$('nextWallpaperHome'), nextSettings=$('nextWallpaper');
 const videos=[$('wallpaperVideoA'),$('wallpaperVideoB')],reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const included={};

 let active=null,activeScene=null,loading=null,generation=0,request=0,busy=false,motion=true,prefs={configured:false,interval:30,quality:'hd'},lastScene=null,lastNotice='',pendingNext=0;
 let focusOnly=true;
 try{motion=localStorage.getItem('midnight-wallpaper-motion')!=='off';focusOnly=localStorage.getItem('midnight-wallpaper-playback')!=='visible';}catch{}
 const foreground=()=>!focusOnly||typeof document.hasFocus!=='function'||document.hasFocus();
 const theme=()=>root.dataset.appearance==='nature'?'nature':root.dataset.appearance==='rainy'?'rain':null;
 const api=(path,options)=>MidnightApp.request(path,options);
 const post=(path,body)=>api(path,{method:'POST',body:JSON.stringify(body)});
 function syncNextButtons(){
  const canRotate=!!theme()&&prefs.configured;
  nextHome.hidden=!canRotate||!motion||reduced.matches;
  nextHome.disabled=nextSettings.disabled=!canRotate;
  for(const button of [nextHome,nextSettings]){
   button.setAttribute('aria-busy',String(busy));
   button.title=busy?'Loading photo'+(pendingNext?' · '+pendingNext+' queued':'')+' · Click again to queue the next photo':'Next photo';
  }
 }
 function status(message){$('wallpaperStatus').textContent=message;}
 function release(video){video.pause();video.onloadeddata=null;video.onerror=null;video.dataset.active='false';video.removeAttribute('src');video.load();}
 function syncCredit(){
  const fallback=included[theme()];if(!fallback)return;
  const scene=active&&active.dataset.active==='true'&&active.getAttribute('src')&&activeScene?activeScene:fallback;
  $('wallpaperCredit').hidden=false;$('wallpaperAuthor').textContent=scene.author;
  const provider=scene.source==='pixabay'?'Pixabay':'Pexels';$('wallpaperProvider').textContent=provider;$('wallpaperProvider').href=provider==='Pixabay'?'https://pixabay.com':'https://www.pexels.com';$('wallpaperAuthor').href=/^https:\/\/(www\.)?(pixabay|pexels)\.com\//.test(scene.page)?scene.page:$('wallpaperProvider').href;
 }
 function syncMotion(){
  syncNextButtons();
  root.dataset.wallpaperMotion=motion?'on':'off';
  const play=motion&&!reduced.matches&&!document.hidden&&!!theme();
  root.dataset.wallpaperPlayback=play&&foreground()?'playing':'paused';
  $('wallpaperFocusOnly').checked=focusOnly;
  if(!play){generation++;loading=null;active=null;activeScene=null;videos.forEach(video=>{if(video.getAttribute('src'))release(video);else video.pause();video.dataset.active='false';});$('wallpaperMotion').checked=motion;syncCredit();return;}
  if(!foreground()){videos.forEach(video=>video.pause());$('wallpaperMotion').checked=motion;syncCredit();return;}
  if(loading&&(!play||loading.getAttribute('src')!==lastScene?.src)){generation++;release(loading);loading=null;}
  if(!lastScene?.src){generation++;loading=null;active=null;activeScene=null;videos.forEach(video=>{if(video.getAttribute('src'))release(video);});}
  if(active)active.dataset.active=String(!!theme());
  if(play&&lastScene?.src&&root.dataset.scene===theme()&&active?.getAttribute('src')!==lastScene.src&&loading?.getAttribute('src')!==lastScene.src)loadScene(lastScene,theme());
  videos.forEach(video=>{if(video===active&&play)video.play().catch(()=>status('Motion is paused by your browser. Turn live backgrounds off and on to play.'));else video.pause();});
  $('wallpaperMotion').checked=motion;syncCredit();
 }
 function describe(scene){if(!scene.src||!motion||reduced.matches)return 'Still background'+(lastNotice?' · '+lastNotice:'');const quality=scene.width>=3840?'4K':scene.width>=1920?'1080p':'Landscape';const seconds=Math.round(scene.duration||0),length=seconds?' · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'';return (scene.source==='pixabay'?quality+length+' · Saved from Pixabay':quality+length+' · Included scene')+(reduced.matches?' · Reduced Motion is on':'')+(lastNotice?' · '+lastNotice:'');}
 function present(scene,name){
  if(theme()!==name)return;
  if(scene.src&&!/^\/(static\/wallpapers\/|api\/wallpaper\/media\/)/.test(scene.src))return;
  lastScene=scene;lastNotice=scene.notice||'';root.dataset.scene=name;
  $('liveBackdrop').style.backgroundImage='url("'+included[name].poster+'")';
  status(describe(scene));
  syncMotion();
 }
 function loadScene(scene,name){
  const token=++generation,incoming=videos.find(video=>video!==active);loading=incoming;incoming.pause();incoming.dataset.active='false';incoming.poster=included[name].poster;
  incoming.onloadeddata=()=>{
   if(token!==generation||theme()!==name)return;
   const previous=active;active=incoming;activeScene=scene;loading=null;incoming.dataset.active='true';
   if(previous&&previous!==incoming)release(previous);
   syncMotion();
  };
  incoming.onerror=()=>{if(token===generation){generation++;loading=null;release(incoming);status('This scene could not play. The saved still background is available.');present({...included[name],src:'',source:'still',notice:'Using the saved still background.'},name);}};
  incoming.src=scene.src;
  incoming.load();
 }
 async function preferences(){try{prefs=await api('wallpaper/settings');$('wallpaperInterval').value=String(prefs.interval);$('wallpaperQuality').value=prefs.quality;$('pixabayKey').placeholder=prefs.configured?'Key saved · leave blank to keep it':'Paste a key to enable rotation';$('removePixabay').hidden=!prefs.configured;syncNextButtons();}catch{status('The local server is unavailable. Included scenes still work.');}}
 async function refresh({force=false}={}){
  const name=theme();
  if(name&&!included[name])return;
  if(root.dataset.scene!==name){pendingNext=0;request++;busy=false;}
  if(busy&&root.dataset.scene===name)return;
  if(!name){request++;busy=false;delete root.dataset.scene;$('wallpaperCredit').hidden=true;generation++;lastScene=null;active=null;loading=null;videos.forEach(release);syncMotion();return;}
  if(!lastScene||root.dataset.scene!==name)present({...included[name],src:'',source:'still'},name);
  if(!force&&(!motion||reduced.matches||document.hidden||!foreground()))return;
  const token=++request;
  busy=true;syncNextButtons();
  try{const scene=await api('wallpaper?theme='+name);if(token===request&&theme()===name)present(scene,name);}
  catch{if(token===request)status('Offline · using the included scene.');}
  finally{if(token===request){busy=false;syncNextButtons();drainNext();}}
 }
 async function save(clear=false){
  $('saveWallpaper').disabled=true;$('removePixabay').disabled=true;
  try{
   const key=$('pixabayKey').value.trim();
   prefs=await post('wallpaper/settings',{key:clear?'':key||null,interval:Number($('wallpaperInterval').value),quality:$('wallpaperQuality').value});
   $('pixabayKey').value='';await preferences();status(clear?'Pixabay key removed. Included scenes remain available.':'Background preferences saved locally.');await refresh();
  }catch(error){status(error.message);}
  finally{$('saveWallpaper').disabled=false;$('removePixabay').disabled=false;}
 }
 $('saveWallpaper').onclick=()=>save();$('removePixabay').onclick=()=>save(true);
 async function drainNext(){
  const name=theme();
  if(!pendingNext||!name||!prefs.configured||busy)return;
  const token=++request;
  busy=true;syncNextButtons();
  try{
   while(pendingNext&&token===request&&theme()===name){
    pendingNext--;syncNextButtons();
    const scene=await post('wallpaper/next?theme='+name,{});
    if(token!==request||theme()!==name)return;
    present(scene,name);
    if(scene.notice){pendingNext=0;MidnightApp.toast(scene.notice,true);}
   }
  }catch(error){
   if(token!==request)return;
   pendingNext=0;status(error.message);MidnightApp.toast(error.message,true);
  }finally{
   if(token===request){busy=false;syncNextButtons();}
  }
 }
 function nextScene(){
  if(!theme()||!prefs.configured)return;
  pendingNext++;syncNextButtons();
  return drainNext();
 }
 nextHome.onclick=nextSettings.onclick=nextScene;
 $('wallpaperFocusOnly').onchange=()=>{const chosen=$('wallpaperFocusOnly').checked;try{localStorage.setItem('midnight-wallpaper-playback',chosen?'focused':'visible');focusOnly=chosen;syncMotion();if(foreground()&&!busy)refresh();status('Background playback preference saved on this browser.');MidnightActivity.wake();}catch{$('wallpaperFocusOnly').checked=focusOnly;status('Could not save the background playback preference.');}};
 addEventListener('blur',()=>{syncMotion();MidnightActivity.wake();});addEventListener('focus',()=>{syncMotion();if(!busy)refresh();MidnightActivity.wake();});
 $('wallpaperMotion').onchange=()=>{motion=$('wallpaperMotion').checked;try{localStorage.setItem('midnight-wallpaper-motion',motion?'on':'off');}catch{}syncMotion();if(motion&&!busy)refresh();MidnightActivity.wake();};
 addEventListener('midnight:appearance',refresh);document.addEventListener('visibilitychange',()=>{syncMotion();if(!document.hidden&&!busy)refresh();});reduced.addEventListener('change',()=>{syncMotion();if(lastScene)status(describe(lastScene));});
 let settingsOpen=false;addEventListener('midnight:dialogchange',()=>{const open=$('settingsDialog').open;if(open&&!settingsOpen)preferences();settingsOpen=open;});
 MidnightActivity.every('wallpaper',refresh,60000,{enabled:()=>motion&&!reduced.matches&&!busy&&foreground()&&!!theme()});
 async function loadCatalog(){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{const response=await fetch('/static/wallpapers/scenes.json?v=r47-player-sounds',{signal:controller.signal});if(!response.ok)throw new Error('Catalog unavailable');const catalog=await response.json();if(catalog.format!==1||!['nature','rain'].every(name=>/^\/static\/wallpapers\/[a-z-]+\.jpg$/.test(catalog.scenes?.[name]?.poster)))throw new Error('Invalid catalog');Object.assign(included,catalog.scenes);const name=theme();if(name)present({...included[name],src:'',source:'still'},name);await preferences();await refresh();}
  catch{status('Background information could not load. Reload when the local app is available.');}
  finally{clearTimeout(timer);}
 }
 loadCatalog();return {refresh:()=>refresh({force:true})};
})();
