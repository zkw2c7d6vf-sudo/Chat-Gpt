/* Decorative local video never controls media playback or account integrations. */
'use strict';
window.MidnightWallpaper=(()=>{
 const $=id=>document.getElementById(id),root=document.documentElement;
 const videos=[$('wallpaperVideoA'),$('wallpaperVideoB')],reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const included={nature:{src:'/static/wallpapers/nature-long.mp4',poster:'/static/wallpapers/nature-long.jpg',author:'Tom Fisk',page:'https://www.pexels.com/video/32329775/',width:3840,duration:60.43},rain:{src:'/static/wallpapers/rain-long.mp4',poster:'/static/wallpapers/rain-long.jpg',author:'Engin Akyurt',page:'https://www.pexels.com/video/11887609/',width:4096,duration:59.26}};
 let active=null,loading=null,generation=0,request=0,busy=false,motion=true,prefs={configured:false,interval:30,quality:'hd'},lastScene=null,lastNotice='';
 try{motion=localStorage.getItem('midnight-wallpaper-motion')!=='off';}catch{}
 const theme=()=>root.dataset.appearance==='nature'?'nature':root.dataset.appearance==='rainy'?'rain':null;
 const api=(path,options)=>MidnightApp.request(path,options);
 const post=(path,body)=>api(path,{method:'POST',body:JSON.stringify(body)});
 function status(message){$('wallpaperStatus').textContent=message;}
 function release(video){video.pause();video.onloadeddata=null;video.onerror=null;video.dataset.active='false';video.removeAttribute('src');video.load();}
 function syncMotion(){
  const play=motion&&!reduced.matches&&!document.hidden&&!!theme();
  if(loading&&(!play||loading.getAttribute('src')!==lastScene?.src)){generation++;release(loading);loading=null;}
  if(active)active.dataset.active=String(!!theme()&&active.getAttribute('src')===lastScene?.src);
  if(play&&lastScene&&root.dataset.scene===theme()&&active?.getAttribute('src')!==lastScene.src&&loading?.getAttribute('src')!==lastScene.src)loadScene(lastScene,theme());
  videos.forEach(video=>{if(video===active&&play)video.play().catch(()=>status('Motion is paused by your browser. Turn live backgrounds off and on to play.'));else video.pause();});
  $('wallpaperMotion').checked=motion;
 }
 function describe(scene){const quality=scene.width>=3840?'4K':scene.width>=1920?'1080p':'Landscape';const seconds=Math.round(scene.duration||0),length=seconds?' · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'';return (scene.source==='pixabay'?quality+length+' · Saved from Pixabay':quality+length+' · Included scene')+(reduced.matches?' · Reduced Motion is on':'')+(lastNotice?' · '+lastNotice:'');}
 function present(scene,name){
  if(theme()!==name)return;
  if(!/^\/(static\/wallpapers\/|api\/wallpaper\/media\/)/.test(scene.src))return;
  lastScene=scene;lastNotice=scene.notice||'';root.dataset.scene=name;
  $('wallpaperCredit').hidden=false;$('wallpaperAuthor').textContent=scene.author;
  const provider=scene.source==='pixabay'?'Pixabay':'Pexels';$('wallpaperProvider').textContent=provider;$('wallpaperProvider').href=provider==='Pixabay'?'https://pixabay.com':'https://www.pexels.com';$('wallpaperAuthor').href=/^https:\/\/(www\.)?(pixabay|pexels)\.com\//.test(scene.page)?scene.page:$('wallpaperProvider').href;
  $('liveBackdrop').style.backgroundImage='url("'+included[name].poster+'")';
  status(describe(scene));
  if(active&&active.getAttribute('src')!==scene.src)active.dataset.active='false';
  syncMotion();
 }
 function loadScene(scene,name){
  const token=++generation,incoming=videos.find(video=>video!==active);loading=incoming;incoming.pause();incoming.dataset.active='false';incoming.poster=included[name].poster;
  incoming.onloadeddata=()=>{
   if(token!==generation||theme()!==name)return;
   const previous=active;active=incoming;loading=null;incoming.dataset.active='true';
   if(previous&&previous!==incoming)release(previous);
   syncMotion();
  };
  incoming.onerror=()=>{if(token===generation){generation++;loading=null;release(incoming);status('This scene could not play. The saved still background is available.');if(scene.src!==included[name].src)present({...included[name],notice:'Using the included scene.'},name);}};
  incoming.src=scene.src;
  incoming.load();
 }
 async function preferences(){try{prefs=await api('wallpaper/settings');$('wallpaperInterval').value=String(prefs.interval);$('wallpaperQuality').value=prefs.quality;$('pixabayKey').placeholder=prefs.configured?'Key saved · leave blank to keep it':'Paste a key to enable rotation';$('removePixabay').hidden=!prefs.configured;$('nextWallpaper').disabled=!prefs.configured||busy;}catch{status('The local server is unavailable. Included scenes still work.');}}
 async function refresh(){
  const name=theme(),token=++request;
  if(!name){delete root.dataset.scene;$('wallpaperCredit').hidden=true;generation++;lastScene=null;active=null;loading=null;videos.forEach(release);syncMotion();return;}
  if(!lastScene||root.dataset.scene!==name)present({...included[name],source:'included'},name);
  busy=true;$('nextWallpaper').disabled=true;
  try{const scene=await api('wallpaper?theme='+name);if(token===request&&theme()===name)present(scene,name);}
  catch{if(token===request)status('Offline · using the included scene.');}
  finally{if(token===request){busy=false;$('nextWallpaper').disabled=!prefs.configured;}}
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
 $('nextWallpaper').onclick=async()=>{const name=theme();if(!name){status('Choose Nature or Rain to change the scene.');return;}if(busy)return;busy=true;$('nextWallpaper').disabled=true;const token=++request;try{const scene=await post('wallpaper/next?theme='+name,{});if(token===request)present(scene,name);}catch(error){status(error.message);}finally{busy=false;$('nextWallpaper').disabled=!prefs.configured;}};
 $('wallpaperMotion').onchange=()=>{motion=$('wallpaperMotion').checked;try{localStorage.setItem('midnight-wallpaper-motion',motion?'on':'off');}catch{}syncMotion();};
 addEventListener('midnight:appearance',refresh);document.addEventListener('visibilitychange',()=>{syncMotion();if(!document.hidden&&!busy)refresh();});reduced.addEventListener('change',()=>{syncMotion();if(lastScene)status(describe(lastScene));});
 let settingsOpen=false;addEventListener('midnight:dialogchange',()=>{const open=$('settingsDialog').open;if(open&&!settingsOpen)preferences();settingsOpen=open;});
 setInterval(()=>{if(!document.hidden&&!busy&&theme())refresh();},60000);
 preferences();refresh();return {refresh};
})();
