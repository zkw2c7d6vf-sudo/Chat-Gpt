/* Focus and ChatGPT handoff checks: isolated storage, simulated clock, no live writes. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const seconds=value=>value.split(':').reduce((minutes,part)=>minutes*60+Number(part),0);
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1080},permissions:['clipboard-read','clipboard-write']});
  const mutations=[];
  await context.route('**/api/**',r=>{if(r.request().method()!=='GET')mutations.push(r.request().url());return r.fulfill({json:r.request().url().endsWith('/bootstrap')?{csrf:'test',settings:{feeds:[],plug_enabled:false,units:'fahrenheit'},spotify_connected:false}:{configured:false,events:[],articles:[],errors:[]}});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto(process.env.MIDNIGHT_TEST_URL||'http://127.0.0.1:8765');
  await page.locator('#focusCustom').click();await page.locator('#focusMinutes').fill('37');await page.locator('#focusCustomForm').getByRole('button',{name:'Start timer'}).click();
  await page.waitForFunction(()=>!document.getElementById('focusCustomDialog').open);
  assert.ok(seconds(await page.locator('#focusTime').textContent())>=37*60-5);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('midnight-focus-v3')).duration),37*60000);assert.match(await page.locator('#focusCustom').getAttribute('aria-label'),/37 minutes/);assert.equal(await page.locator('#focusStart').textContent(),'Pause');
  assert.ok(await page.locator('#focusWidget').evaluate(el=>el.classList.contains('running')));
  await page.clock.fastForward(60000);await page.locator('#focusStart').click();
  assert.equal(await page.locator('#focusStart').textContent(),'Resume');assert.equal(await page.locator('#focusWidget').evaluate(el=>el.classList.contains('running')),false);
  const pausedTime=await page.locator('#focusTime').textContent();assert.ok(seconds(pausedTime)>=36*60-5&&seconds(pausedTime)<=36*60);await page.reload();assert.equal(await page.locator('#focusTime').textContent(),pausedTime);
  await page.locator('#focusCustom').click();assert.equal(await page.locator('#focusMinutes').inputValue(),'37');
  await page.locator('#focusMinutes').fill('181');await page.locator('#focusCustomForm').getByRole('button',{name:'Start timer'}).click();assert.equal(await page.locator('#focusCustomDialog').evaluate(el=>el.open),true);assert.equal(await page.locator('#focusMinutes').evaluate(el=>el.validity.valid),false);
  await page.locator('#focusCustomClose').click();await page.waitForFunction(()=>!document.getElementById('focusCustomDialog').open);assert.equal(await page.locator('#focusTime').textContent(),pausedTime);
  await page.locator('#focusStart').click();await page.locator('#focusCustom').click();await page.locator('#focusMinutes').fill('1');await page.locator('#focusCustomForm').getByRole('button',{name:'Start timer'}).click();await page.waitForFunction(()=>!document.getElementById('focusCustomDialog').open);
  await page.locator('#captureOpen').click();await page.locator('#captureDialog[open]').waitFor();await page.locator('#captureText').fill('Do not interrupt my capture');
  await page.clock.fastForward(61000);await page.locator('#notificationTitle').getByText('Nicely done.',{exact:true}).waitFor({state:'visible'});assert.equal(await page.locator('#focusTime').textContent(),'0:00');assert.equal(await page.locator('#captureText').evaluate(el=>el===document.activeElement),true);
  await page.screenshot({animations:'disabled',path:'/tmp/midnight-focus-complete.png'});
  await page.locator('#notificationDismiss').click();assert.equal(await page.locator('#captureText').inputValue(),'Do not interrupt my capture');await page.locator('#captureSave').click();await page.waitForFunction(()=>!document.getElementById('captureDialog').open);
  await page.locator('#inboxOpen').click();const item=page.locator('.captureItem').filter({hasText:'Do not interrupt my capture'});await item.getByRole('button',{name:'Copy for ChatGPT'}).click();await page.getByText('Copied. Open Quick Capture, paste, and send. Nothing has been sent yet.').waitFor();assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/Do not interrupt my capture/);
  const link=page.getByRole('link',{name:'Open Quick Capture'});assert.equal(await link.getAttribute('href'),'https://chatgpt.com/');
  await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{value:async()=>{throw new Error('denied');},configurable:true}));await item.getByRole('button',{name:'Copy for ChatGPT'}).click();await page.getByText(/Clipboard unavailable/).waitFor();
  await page.locator('#inboxClose').click();await page.waitForFunction(()=>!document.getElementById('inboxDialog').open);
  for(const width of [1024,1280,1440,1920]) {
   await page.setViewportSize({width,height:844});
   const rect=await page.locator('#focusCustom').evaluate(el=>{const r=el.getBoundingClientRect(),b=el.closest('.card').getBoundingClientRect();return {width:r.width,height:r.height,inside:r.left>=b.left&&r.right<=b.right&&r.bottom<=b.bottom};});assert.ok(rect.width>=44&&rect.height>=44&&rect.inside,JSON.stringify(rect));
   await page.locator('#focusCustom').click();await page.locator('#focusCustomDialog[open]').waitFor();assert.ok(await page.locator('#focusCustomDialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
   if(width===1280)await page.screenshot({animations:'disabled',path:'/tmp/midnight-custom-desktop.png'});
   await page.locator('#focusCustomClose').click();await page.waitForFunction(()=>!document.getElementById('focusCustomDialog').open);
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#focusCustom').click();await page.locator('[data-minutes="25"]').click();await page.waitForFunction(()=>!document.getElementById('focusCustomDialog').open);assert.equal(await page.locator('#focusStart').textContent(),'Pause');assert.equal(await page.locator('.focusRain').evaluate(el=>getComputedStyle(el).display),'none');
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.locator('#focusCustom').click();await page.locator('#focusMinutes').fill('12');await page.locator('#focusCustomForm').getByRole('button',{name:'Start timer'}).click();await page.waitForFunction(()=>!document.getElementById('focusCustomDialog').open);assert.ok(seconds(await page.locator('#focusTime').textContent())>=12*60-5);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('midnight-focus-v3')).duration),12*60000);
  assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
  console.log('PASS: custom duration/start, bounds/cancel, pause/reload, rain state, completion with preserved capture focus, dismiss, clipboard handoff/failure, pinned destination, responsive custom form, reduced motion and offline custom start.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
