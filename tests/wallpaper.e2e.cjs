/* Real browser video decoding and rapid input; APIs and media are synthetic. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {mocks}=require('./ui-fixtures.cjs');
(async()=>{
 const fixtures=fs.mkdtempSync(path.join(os.tmpdir(),'midnight-wallpaper-ui-'));
 let browser;
 try{
 for(const [name,color] of [['a','0x14253b'],['b','0x352b28']]){
  const result=spawnSync(process.env.FFMPEG_BIN||'ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i',`color=c=${color}:s=160x90:r=5`,'-t','2','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(fixtures,name+'.mp4')]);
  assert.equal(result.status,0,result.error?.message||String(result.stderr));
 }
 browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:1920,height:1080},hasTouch:true,serviceWorkers:'block'});await mocks(context);
 let current=0,calls=0,inFlight=0,maxInFlight=0,fail=false;
 const scene=()=>({src:'/api/wallpaper/media/test-'+current,source:'pixabay',author:'Test creator',page:'https://pixabay.com/videos/id-123/',width:1920,duration:90,notice:''});
 await context.route('**/api/wallpaper**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/media/'))return route.fulfill({path:path.join(fixtures,(Number(url.pathname.split('-').pop())%2?'b':'a')+'.mp4'),contentType:'video/mp4'});
  if(url.pathname.endsWith('/settings'))return route.fulfill({json:{configured:true,interval:30,quality:'hd'}});
  if(url.pathname.endsWith('/next')){
   calls++;inFlight++;maxInFlight=Math.max(inFlight,maxInFlight);
   await new Promise(resolve=>setTimeout(resolve,180));inFlight--;
   if(fail)return route.fulfill({status:503,json:{detail:'Offline test: try again'}});
   current++;return route.fulfill({json:scene()});
  }
  return route.fulfill({json:scene()});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.MIDNIGHT_TEST_URL||'http://127.0.0.1:8891');
 const button=page.getByRole('button',{name:'Next photo',exact:true});
 const waitScene=n=>page.waitForFunction(n=>[...document.querySelectorAll('.liveBackdrop video')].some(v=>v.dataset.active==='true'&&v.getAttribute('src')==='/api/wallpaper/media/test-'+n&&v.readyState>=2&&Number(getComputedStyle(v).opacity)>.99),n);
 const pixel=()=>page.evaluate(()=>{const v=document.querySelector('.liveBackdrop video[data-active=true]'),c=document.createElement('canvas');c.width=c.height=1;c.getContext('2d').drawImage(v,0,0,1,1);return [...c.getContext('2d').getImageData(0,0,1,1).data];});
 await waitScene(0);const firstPixel=await pixel();await button.click();await waitScene(1);
 assert.notDeepEqual(await pixel(),firstPixel,'The displayed video pixels must change');
 await button.click({clickCount:3,delay:20});await waitScene(4);
 assert.equal(calls,4,'Every rapid click advances once');assert.equal(maxInFlight,1,'Requests are serialized');
 await button.click();await waitScene(5);assert.equal(calls,5);
 for(const [width,height] of [[1920,1080],[1024,768]]){
  await page.setViewportSize({width,height});
  const box=await button.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height&&box.height>=44);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`/tmp/midnight-next-photo-${width}.png`});
 }
 fail=true;const failedCall=calls+1;await button.click({clickCount:3,delay:20});
 await page.waitForFunction(()=>document.getElementById('wallpaperStatus').textContent.includes('Offline test'));
 assert.equal(calls,failedCall,'Failure clears the remaining queue');assert.equal(await button.isEnabled(),true);
 fail=false;await button.click();await waitScene(6);
 await page.emulateMedia({reducedMotion:'reduce'});await button.waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);
 console.log('PASS: changed decoded pixels, consecutive and rapid clicks, serialized requests, failure/retry, reduced motion, and 1920/1024 desktop/touch bounds.');
 }finally{await browser?.close();fs.rmSync(fixtures,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1);});
