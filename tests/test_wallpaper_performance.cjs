const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const settle=()=>new Promise(setImmediate);

function wallpaperContext({motion=true,reduced=false,hidden=false,configured=false,focused=true,focusOnly=true,request}={}) {
  const nodes=new Map(),listeners=new Map(),mediaListeners=new Map(),sources=[];
  class Element {
    dataset={};style={};attrs=new Map();paused=true;
    set src(value){this.attrs.set('src',value);sources.push(value);}getAttribute(name){return this.attrs.get(name)||null;}
    setAttribute(name,value){this.attrs.set(name,value);}removeAttribute(name){this.attrs.delete(name);}load(){}pause(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}
  }
  const byId=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  const root={dataset:{appearance:'nature'}},media={matches:reduced,addEventListener:(type,fn)=>mediaListeners.set(type,fn)};
  const listen=(type,fn)=>listeners.set(type,fn),document={hasFocus:()=>focused,documentElement:root,hidden,getElementById:byId,addEventListener:listen};
  let scene={src:'/static/wallpapers/nature-long.mp4',source:'included',author:'Creator',page:'https://www.pexels.com/video/1/',width:3840,duration:60};
  const context=vm.createContext({window:{},document,AbortController,setTimeout,clearTimeout,fetch:async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(require.resolve('../static/wallpapers/scenes.json'),'utf8'))}),localStorage:{getItem:key=>key==='midnight-wallpaper-playback'?(focusOnly?'focused':'visible'):motion?'on':'off',setItem(){}},matchMedia:()=>media,
    MidnightApp:{toast(){},request:async path=>path==='wallpaper/settings'?{configured,interval:30,quality:'4k'}:request?request(path):scene},
    addEventListener:listen,setInterval(){},MidnightActivity:{every(){},wake(){}}});
  vm.runInContext(fs.readFileSync(require.resolve('../static/wallpaper.js'),'utf8'),context);
  return {byId,root,media,document,sources,api:context.window.MidnightWallpaper,videos:[byId('wallpaperVideoA'),byId('wallpaperVideoB')],
    setFocused(value){focused=value;listeners.get(value?'focus':'blur')?.();},dispatch(type){listeners.get(type)?.();},setScene(value){scene=value;},setReduced(value){media.matches=value;mediaListeners.get('change')();}};
}

for(const settings of [{motion:false},{reduced:true},{hidden:true}])test('video loading is deferred while '+JSON.stringify(settings),async()=>{
  const app=wallpaperContext(settings);await settle();assert.equal(app.sources.length,0);
  assert.match(app.byId('liveBackdrop').style.backgroundImage,/nature-long.jpg/);assert.equal(app.byId('wallpaperCredit').hidden,false);
  app.document.hidden=false;app.setReduced(false);app.byId('wallpaperMotion').checked=true;app.byId('wallpaperMotion').onchange();
  await settle();assert.equal(app.sources.length,1);app.videos[0].onloadeddata();assert.equal(app.videos[0].paused,false);
});

test('unchanged pending scenes load once; hidden loads cancel, resume, and obsolete decoders are released',async()=>{
  const app=wallpaperContext();await settle();await app.api.refresh();assert.equal(app.sources.length,1);
  const obsolete=app.videos[0].onloadeddata;app.document.hidden=true;app.dispatch('visibilitychange');assert.equal(app.videos[0].getAttribute('src'),null);
  obsolete();assert.equal(app.videos[0].dataset.active,'false');
  app.document.hidden=false;app.dispatch('visibilitychange');await settle();assert.equal(app.sources.length,2);app.videos[0].onloadeddata();
  app.root.dataset.appearance='rainy';app.setScene({src:'/static/wallpapers/rain-long.mp4',width:4096,duration:60});await app.api.refresh();
  assert.equal(app.sources.length,3);const incoming=app.videos.find(v=>v.getAttribute('src'));incoming.onloadeddata();assert.equal(incoming.paused,false);assert.equal(app.videos.filter(v=>v.getAttribute('src')).length,1);
  app.root.dataset.appearance='dark';await app.api.refresh();assert.ok(app.videos.every(video=>video.paused&&!video.getAttribute('src')));
});

test('turning motion back on restores the selected scene without losing credits',async()=>{
  const app=wallpaperContext();await settle();app.videos[0].onloadeddata();
  app.byId('wallpaperMotion').checked=false;app.byId('wallpaperMotion').onchange();assert.ok(app.videos[0].paused);assert.ok(app.videos.every(video=>!video.getAttribute('src')),'Motion off releases every decoder source');
  await app.api.refresh();app.byId('wallpaperMotion').checked=true;app.byId('wallpaperMotion').onchange();
  assert.equal(app.sources.length,2);app.videos[0].onloadeddata();assert.equal(app.videos[0].dataset.active,'true');assert.equal(app.videos[0].paused,false);
  assert.equal(app.byId('wallpaperCredit').hidden,false);
});

test('failed rotation releases decoders and restores the saved still background',async()=>{
  const app=wallpaperContext();await settle();app.videos[0].onloadeddata();
  app.setScene({src:'/api/wallpaper/media/nature-4k-test',width:3840,duration:90});await app.api.refresh();
  const obsolete=app.videos[1].onloadeddata;app.videos[1].onerror();
  assert.equal(app.videos[1].getAttribute('src'),null);assert.ok(app.videos.every(v=>v.paused&&!v.getAttribute('src')));
  obsolete();assert.ok(app.videos.every(v=>v.dataset.active==='false'));
});

test('credits follow actual video pixels and switch to the included still when motion stops',async()=>{
 const app=wallpaperContext();await settle();app.videos[0].onloadeddata();assert.equal(app.byId('wallpaperProvider').textContent,'Pexels');
 app.setScene({src:'/api/wallpaper/media/pixabay-nature-hd-test',source:'pixabay',author:'Test filmmaker',page:'https://pixabay.com/videos/id-123/',width:1920,duration:90});await app.api.refresh();
 assert.equal(app.byId('wallpaperProvider').textContent,'Pexels','Keep the previous frame credit until the new frame loads');app.videos[1].onloadeddata();assert.equal(app.byId('wallpaperProvider').textContent,'Pixabay');assert.equal(app.byId('wallpaperAuthor').textContent,'Test filmmaker');
 app.byId('wallpaperMotion').checked=false;app.byId('wallpaperMotion').onchange();assert.equal(app.byId('wallpaperProvider').textContent,'Pexels');assert.equal(app.byId('wallpaperAuthor').textContent,'Tom Fisk');
});

test('rapid Next photo clicks are serialized, not disabled or discarded, and keep the previous frame visible',async()=>{
 const pending=[];let calls=0;
 const app=wallpaperContext({configured:true,request:path=>path.startsWith('wallpaper/next')?new Promise(resolve=>{calls++;pending.push(resolve);}):Promise.resolve({src:'/static/wallpapers/nature-long.mp4'})});
 await settle();app.videos[0].onloadeddata();const button=app.byId('nextWallpaperHome');
 const drain=button.onclick();button.onclick();app.byId('nextWallpaper').onclick();
 assert.equal(calls,1);assert.equal(button.disabled,false);assert.match(button.title,/2 queued/);
 // Periodic refresh must not invalidate an in-flight user action.
 await app.api.refresh();assert.equal(calls,1);
 for(let i=1;i<=3;i++){
  pending.shift()({src:'/api/wallpaper/media/test-'+i});await settle();
  assert.equal(calls,Math.min(i+1,3));
 }
 await drain;assert.equal(button.attrs.get('aria-busy'),'false');
 assert.equal(app.videos[0].dataset.active,'true','Keep old frame while the next decoder loads');
 app.videos[1].onloadeddata();assert.match(app.videos[1].getAttribute('src'),/test-3$/);
 assert.equal(app.videos[1].dataset.active,'true');assert.equal(app.videos[0].getAttribute('src'),null);
});

test('failed requests clear queued clicks and leave Next photo usable for retry',async()=>{
 let reject,calls=0;
 const app=wallpaperContext({configured:true,request:path=>path.startsWith('wallpaper/next')?new Promise((resolve,no)=>{calls++;reject=no;}):Promise.resolve({src:'/static/wallpapers/nature-long.mp4'})});
 await settle();const button=app.byId('nextWallpaperHome'),drain=button.onclick();button.onclick();
 reject(new Error('Offline'));await drain;
 assert.equal(calls,1);assert.equal(button.disabled,false);assert.match(app.byId('wallpaperStatus').textContent,/Offline/);
 const retry=button.onclick();assert.equal(calls,2);reject(new Error('Still offline'));await retry;
});

test('changing appearance cancels queued clicks and ignores stale results',async()=>{
 let resolve,calls=0;
 const app=wallpaperContext({configured:true,request:path=>path.startsWith('wallpaper/next')?new Promise(done=>{calls++;resolve=done;}):Promise.resolve({src:'/static/wallpapers/nature-long.mp4'})});
 await settle();const button=app.byId('nextWallpaperHome'),drain=button.onclick();button.onclick();
 app.root.dataset.appearance='graphite';await app.api.refresh();
 resolve({src:'/api/wallpaper/media/stale'});await drain;
 assert.equal(calls,1);assert.equal(button.hidden,true);assert.ok(app.videos.every(video=>!video.getAttribute('src')));
});

test('focused-only motion pauses on blur without releasing the visible frame, then resumes once',async()=>{
 const app=wallpaperContext();await settle();app.videos[0].onloadeddata();const video=app.videos[0];assert.equal(video.paused,false);const source=video.getAttribute('src'),loads=app.sources.length;
 app.setFocused(false);assert.equal(video.paused,true);assert.equal(video.getAttribute('src'),source);assert.equal(app.root.dataset.wallpaperPlayback,'paused');
 app.setFocused(true);await settle();assert.equal(video.paused,false);assert.equal(app.sources.length,loads);assert.equal(app.root.dataset.wallpaperPlayback,'playing');
});
test('remembered visible-window choice keeps motion while another window is focused',async()=>{
 const app=wallpaperContext({focusOnly:false});await settle();app.videos[0].onloadeddata();app.setFocused(false);assert.equal(app.videos[0].paused,false);
});
test('unfocused startup defers decoder work, and offline catalog attribution still appears',async()=>{
 const app=wallpaperContext({focused:false});await settle();assert.equal(app.sources.length,0);assert.match(app.byId('liveBackdrop').style.backgroundImage,/nature-long.jpg/);assert.equal(app.byId('wallpaperProvider').textContent,'Pexels');app.setFocused(true);await settle();assert.equal(app.sources.length,1);
});
