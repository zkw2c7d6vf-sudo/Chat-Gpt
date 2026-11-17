const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const settle=()=>new Promise(setImmediate);

function wallpaperContext({motion=true,reduced=false,hidden=false}={}) {
  const nodes=new Map(),listeners=new Map(),mediaListeners=new Map(),sources=[];
  class Element {
    dataset={};style={};attrs=new Map();paused=true;
    set src(value){this.attrs.set('src',value);sources.push(value);}getAttribute(name){return this.attrs.get(name)||null;}
    removeAttribute(name){this.attrs.delete(name);}load(){}pause(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}
  }
  const byId=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  const root={dataset:{appearance:'nature'}},media={matches:reduced,addEventListener:(type,fn)=>mediaListeners.set(type,fn)};
  const listen=(type,fn)=>listeners.set(type,fn),document={documentElement:root,hidden,getElementById:byId,addEventListener:listen};
  let scene={src:'/static/wallpapers/nature-long.mp4',source:'included',author:'Creator',page:'https://www.pexels.com/video/1/',width:3840,duration:60};
  const context=vm.createContext({window:{},document,localStorage:{getItem:()=>motion?'on':'off',setItem(){}},matchMedia:()=>media,
    MidnightApp:{request:async path=>path==='wallpaper/settings'?{configured:false,interval:30,quality:'4k'}:scene},
    addEventListener:listen,setInterval(){}});
  vm.runInContext(fs.readFileSync(require.resolve('../static/wallpaper.js'),'utf8'),context);
  return {byId,root,media,document,sources,api:context.window.MidnightWallpaper,videos:[byId('wallpaperVideoA'),byId('wallpaperVideoB')],
    dispatch(type){listeners.get(type)?.();},setScene(value){scene=value;},setReduced(value){media.matches=value;mediaListeners.get('change')();}};
}

for(const settings of [{motion:false},{reduced:true},{hidden:true}])test('video loading is deferred while '+JSON.stringify(settings),async()=>{
  const app=wallpaperContext(settings);await settle();assert.equal(app.sources.length,0);
  assert.match(app.byId('liveBackdrop').style.backgroundImage,/nature-long.jpg/);assert.equal(app.byId('wallpaperCredit').hidden,false);
  app.document.hidden=false;app.setReduced(false);app.byId('wallpaperMotion').checked=true;app.byId('wallpaperMotion').onchange();
  assert.equal(app.sources.length,1);app.videos[0].onloadeddata();assert.equal(app.videos[0].paused,false);
});

test('unchanged pending scenes load once; hidden loads cancel, resume, and obsolete decoders are released',async()=>{
  const app=wallpaperContext();await settle();await app.api.refresh();assert.equal(app.sources.length,1);
  const obsolete=app.videos[0].onloadeddata;app.document.hidden=true;app.dispatch('visibilitychange');assert.equal(app.videos[0].getAttribute('src'),null);
  obsolete();assert.equal(app.videos[0].dataset.active,'false');
  app.document.hidden=false;app.dispatch('visibilitychange');await settle();assert.equal(app.sources.length,2);app.videos[0].onloadeddata();
  app.root.dataset.appearance='rainy';app.setScene({src:'/static/wallpapers/rain-long.mp4',width:4096,duration:60});await app.api.refresh();
  assert.equal(app.sources.length,3);app.videos[1].onloadeddata();assert.equal(app.videos[0].getAttribute('src'),null);assert.equal(app.videos[1].paused,false);
  app.root.dataset.appearance='dark';await app.api.refresh();assert.ok(app.videos.every(video=>video.paused&&!video.getAttribute('src')));
});

test('turning motion back on restores the selected scene without losing credits',async()=>{
  const app=wallpaperContext();await settle();app.videos[0].onloadeddata();
  app.byId('wallpaperMotion').checked=false;app.byId('wallpaperMotion').onchange();assert.ok(app.videos[0].paused);
  await app.api.refresh();app.byId('wallpaperMotion').checked=true;app.byId('wallpaperMotion').onchange();
  assert.equal(app.sources.length,1);assert.equal(app.videos[0].dataset.active,'true');assert.equal(app.videos[0].paused,false);
  assert.equal(app.byId('wallpaperCredit').hidden,false);
});

test('failed rotation releases its source and restores the included scene',async()=>{
  const app=wallpaperContext();await settle();app.videos[0].onloadeddata();
  app.setScene({src:'/api/wallpaper/media/nature-4k-test',width:3840,duration:90});await app.api.refresh();
  const obsolete=app.videos[1].onloadeddata;app.videos[1].onerror();
  assert.equal(app.videos[1].getAttribute('src'),null);assert.equal(app.videos[0].dataset.active,'true');assert.equal(app.videos[0].paused,false);
  obsolete();assert.equal(app.videos[0].dataset.active,'true');
});

test('Pixabay scenes show their creator and provider; fallback credits stay accurate',async()=>{
  const app=wallpaperContext({motion:false});await settle();
  assert.equal(app.byId('wallpaperProvider').textContent,'Pexels');
  app.setScene({src:'/api/wallpaper/media/pixabay-nature-hd-test',source:'pixabay',author:'Test filmmaker',page:'https://pixabay.com/videos/id-123/',width:1920,duration:90});
  await app.api.refresh();assert.equal(app.byId('wallpaperProvider').textContent,'Pixabay');
  assert.equal(app.byId('wallpaperProvider').href,'https://pixabay.com');assert.equal(app.byId('wallpaperAuthor').textContent,'Test filmmaker');
  assert.match(app.byId('wallpaperStatus').textContent,/1080p.*Saved from Pixabay/);assert.equal(app.sources.length,0);
});
