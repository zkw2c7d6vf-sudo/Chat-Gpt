/* Actual local MP3 playback in Chromium; integrations disabled and output muted. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');const path=require('node:path');
require('node:fs').mkdirSync(path.join(__dirname,'../verification/file-tools'),{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',args:['--mute-audio']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;if(p==='/api/sounds'||p==='/api/bootstrap')return route.continue();if(p.includes('calendar'))return route.fulfill({json:{configured:false,events:[]}});if(p.includes('news'))return route.fulfill({json:{articles:[],errors:[]}});return route.fulfill({status:503,json:{detail:'Integration disabled for audio tests'}});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const base=process.env.MIDNIGHT_TEST_URL||'http://127.0.0.1:8879';await page.goto(base+'/app');
 await page.locator('.soundChoice').nth(3).waitFor({state:'attached'});
 assert.equal(await page.locator('#ambientAudio').evaluate(a=>a.paused),true,'No autoplay');
 await page.locator('#soundsDock').click();await page.waitForFunction(()=>!document.getElementById('ambientAudio').paused && document.getElementById('soundsDock').getAttribute('aria-busy')==='false');
 assert.equal(await page.locator('#soundsPanel').evaluate(e=>e.open),false,'Dock tap must not open a popup');
 assert.equal(await page.locator('#soundQuickControls').isVisible(),true);
 assert.equal(await page.locator('.soundRainRing').evaluate(e=>getComputedStyle(e).opacity),'0.85');
 await page.locator('#soundQuickVolume').fill('28');await page.locator('#soundQuickVolume').dispatchEvent('input');
 assert.equal(await page.locator('#ambientAudio').evaluate(a=>a.volume),.28);
 await page.locator('#soundsDock').click();assert.equal(await page.locator('#ambientAudio').evaluate(a=>a.paused),true);
 assert.equal(await page.locator('#soundsDock').getAttribute('aria-pressed'),'false');
 await page.locator('#soundsDock').click();await page.waitForFunction(()=>!document.getElementById('ambientAudio').paused && document.getElementById('soundsDock').getAttribute('aria-busy')==='false');
 await page.locator('#soundQuickSettings').click();assert.equal(await page.locator('.soundChoice').count(),4);
 const installed=await page.locator('.soundChoice:not([disabled])').count();if(!process.env.MIDNIGHT_PARTIAL_AUDIO)assert.equal(installed,4,'All four complete recordings must be installed');
 await page.locator('.soundChoice[data-id="heavy-storm"]').click();await page.waitForFunction(()=>{const a=document.getElementById('ambientAudio');return !a.paused&&a.currentTime>0;});
 const duration=await page.locator('#ambientAudio').evaluate(a=>a.duration);assert(Math.abs(duration-1647.579)<1,'The storm is the actual 27-minute recording');
 await page.locator('#soundVolume').fill('28');await page.locator('#soundVolume').dispatchEvent('input');assert.equal(await page.locator('#ambientAudio').evaluate(a=>a.volume),.28);
 assert.equal(await page.locator('#soundsDock').getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Close sounds',exact:true}).click();const before=await page.locator('#ambientAudio').evaluate(a=>a.currentTime);
 // A real visibility transition and focus completion cannot stop the independent player.
 const other=await context.newPage();await other.bringToFront();await page.evaluate(()=>window.dispatchEvent(new CustomEvent('midnight:focus',{detail:{running:false}})));await page.waitForTimeout(1200);assert.equal(await page.locator('#ambientAudio').evaluate(a=>a.paused),false);assert(await page.locator('#ambientAudio').evaluate(a=>a.currentTime)>before);await other.close();await page.bringToFront();
 await page.locator('#soundsDock').click();assert.equal(await page.locator('#ambientAudio').evaluate(a=>a.paused),true);assert.equal(await page.locator('#soundsDock').getAttribute('aria-pressed'),'false');await page.locator('#soundsDock').click();await page.waitForFunction(()=>!document.getElementById('ambientAudio').paused && document.getElementById('soundsDock').getAttribute('aria-busy')==='false');
 await page.locator('#soundQuickSettings').click();
 if(installed===4){
  for(const id of ['rain','rain-thunder','heavy-storm','roof-storm']){
   await page.locator(`.soundChoice[data-id="${id}"]`).click();await page.waitForFunction(id=>{const a=document.getElementById('ambientAudio');return a.src.endsWith('/'+id+'.mp3')&&!a.paused&&a.readyState>=2;},id);
   const duration=await page.locator('#ambientAudio').evaluate(a=>a.duration);assert(duration>1500,'Each file contains at least 25 minutes of audio');
   // Decode the actual end of every recording; a truncated MP3 can retain a full-duration header.
   await page.locator('#ambientAudio').evaluate(a=>{a.currentTime=a.duration-1.5;});
   try { await page.waitForFunction(()=>{const a=document.getElementById('ambientAudio');return !a.paused&&a.currentTime<8&&a.readyState>=2;},null,{timeout:15000}); } catch(e) { console.error('EOF check',id,await page.locator('#ambientAudio').evaluate(a=>({time:a.currentTime,duration:a.duration,paused:a.paused,ready:a.readyState,seeking:a.seeking,error:a.error?.message,buffered:[...Array(a.buffered.length)].map((_,i)=>[a.buffered.start(i),a.buffered.end(i)])})));throw e; }
  }
 }
 for(const viewport of [{width:1440,height:1000},{width:1024,height:700},{width:800,height:600}]){
  await page.getByRole('button',{name:'Close sounds',exact:true}).click();
  await page.setViewportSize(viewport);await page.waitForTimeout(150);
  const dockBox=await page.locator('.bottomDock').boundingBox(), slider=await page.locator('#soundQuickVolume').boundingBox();
  assert(dockBox.x>=0&&dockBox.x+dockBox.width<=viewport.width&&dockBox.y+dockBox.height<=viewport.height,'Expanded dock fits window '+JSON.stringify({viewport,dockBox,slider}));
  assert(slider.height>=44&&slider.x>=dockBox.x&&slider.x+slider.width<=dockBox.x+dockBox.width,'Inline volume remains reachable');
  await page.locator('#home').evaluate(e=>{e.scrollTop=e.scrollHeight;});
  const musicBox=await page.locator('#music').boundingBox();assert(musicBox.y+musicBox.height<=dockBox.y,'Card controls can scroll clear of the dock');
  await page.screenshot({path:path.join(__dirname,`../verification/file-tools/sounds-inline-${viewport.width}.png`)});
  await page.locator('#soundQuickSettings').click();const box=await page.locator('#soundsPanel').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height);
  const hit=await page.locator('#soundPower').boundingBox();assert(hit.height>=44);await page.screenshot({path:path.join(__dirname,`../verification/file-tools/sounds-${viewport.width}.png`)});
 }
 await page.reload();await page.locator('.soundChoice').nth(3).waitFor({state:'attached'});
 assert.equal(await page.locator('#ambientAudio').evaluate(a=>a.paused),true,'Reload never autoplays');
 assert.equal(await page.locator('#soundVolume').inputValue(),'28');
 await page.locator('#soundsDock').click();await page.waitForFunction(()=>!document.getElementById('ambientAudio').paused && document.getElementById('soundsDock').getAttribute('aria-busy')==='false');
 assert.equal(await page.locator('#soundQuickName').innerText(),'Rain & thunder on a metal roof');
 assert.equal(await page.locator('#soundsPanel').evaluate(e=>e.open),false);
 assert.deepEqual(errors,[]);console.log(`Sounds: one-tap play/pause, active rain ring, inline remembered volume, optional recording choices, no popup, ${installed} real recordings installed; 27-minute MP3 decode, playback, end-of-file decode/loop, stop/resume, hidden-tab continuation, Focus independence, remembered volume, no autoplay and 3 desktop sizes passed.`);await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
