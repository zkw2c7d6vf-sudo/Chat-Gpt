/* Real browser checks with isolated browser storage and mocked integrations only. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const base=process.env.MIDNIGHT_TEST_URL || 'http://127.0.0.1:8765';
const artifactDir=process.env.MIDNIGHT_SCREENSHOTS || '/tmp';
const {mocks}=require('./ui-fixtures.cjs');
async function contained(page,selector) {
 await page.locator(selector).first().evaluate(async el=>{const panel=el.closest('dialog'); if(panel) await Promise.all(panel.getAnimations().map(a=>a.finished.catch(()=>{})));});
 const result=await page.locator(selector).first().evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('dialog')||el.closest('.card');const b=p.getBoundingClientRect();return {width:r.width,height:r.height,inside:r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1};});
 assert.ok(result.inside,selector+' must remain inside its panel '+JSON.stringify(result));
 assert.ok(result.width>=44&&result.height>=44,selector+' needs a 44px touch target '+JSON.stringify(result));
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true});await mocks(context);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  await page.locator('.miniDay').first().waitFor();
  await page.screenshot({animations:'disabled',path:artifactDir+'/midnight-ui-desktop.png',fullPage:true});
  for(const width of [1024,1152,1280,1366,1440,1920,2560]) {
   await page.setViewportSize({width,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow at '+width);
   const overlap=await page.evaluate(()=>{const a=document.querySelector('.captureNav').getBoundingClientRect(),b=document.querySelector('.clock').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});
   assert.equal(overlap,false,'Header actions must clear the clock at '+width);
   for(const selector of ['#focusStart','#focusReset','#locate','#plugToggle','#focusCustom']) await contained(page,selector);
   if(width===1280||width===1920) await page.screenshot({animations:'disabled',path:artifactDir+`/midnight-ui-${width}.png`,fullPage:true});
   await page.locator('#settingsBtn').click();await page.locator('#settingsDialog[open]').waitFor();
   assert.ok(await page.locator('#settingsDialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'Settings width at '+width);
   await page.locator('#closeSettings').click();await page.waitForFunction(()=>!document.getElementById('settingsDialog').open);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#settingsBtn').click();
  assert.equal(await page.locator('[data-theme-choice]').count(),10);
  for(const theme of ['midnight','ocean','forest','plum','ember','light','christmas','rainy','graphite','sand']) {
   await page.locator(`[data-theme-choice=${theme}]`).click();
   assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
   assert.equal(await page.locator(`[data-theme-choice=${theme}]`).getAttribute('aria-pressed'),'true');
   if(['sand','graphite'].includes(theme)) {await page.locator('#closeSettings').click();await page.waitForFunction(()=>!document.getElementById('settingsDialog').open);await page.screenshot({animations:'disabled',path:artifactDir+`/midnight-ui-${theme}.png`,fullPage:true});await page.locator('#settingsBtn').click();}
  }
  // A shortcut may temporarily layer Capture over an unfinished settings form.
  await page.locator('#feedUrls').fill('https://example.com/unsaved');
  await page.keyboard.press('Control+Shift+K');await page.locator('#captureDialog[open]').waitFor();
  assert.equal(await page.locator('#settingsDialog').evaluate(el=>el.open),true);
  await page.locator('#captureText').fill('Keep the draft safe while switching panels');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.getElementById('captureDialog').open);
  assert.equal(await page.locator('#feedUrls').inputValue(),'https://example.com/unsaved');
  assert.equal(await page.locator('#settingsDialog').evaluate(el=>el.contains(document.activeElement)),true);
  await page.locator('#closeSettings').click();await page.waitForFunction(()=>!document.getElementById('settingsDialog').open);await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'sand');
  await page.locator('#captureOpen').click();await page.locator('#captureDialog[open]').waitFor();
  await page.locator('#captureKeyboardToggle').click();await page.locator('#captureClose').click();await page.reload();
  await page.locator('#captureOpen').click();await page.locator('#captureDialog[open]').waitFor();
  assert.equal(await page.locator('#captureKeyboard').isVisible(),false);
  await page.locator('#captureSave').click();await page.waitForFunction(()=>!document.getElementById('captureDialog').open);
  await page.locator('#inboxOpen').click();await page.locator('.captureItem').first().getByRole('button',{name:'Edit',exact:true}).click();
  await page.locator('#captureDialog[open]').waitFor();assert.equal(await page.locator('#inboxDialog').evaluate(el=>el.open),false);
  assert.equal(await page.locator('#captureDialog').getAttribute('data-arrival'),'handoff');
  await page.locator('#captureClose').click();
  await page.locator('#calendarSettings').click();assert.equal(await page.locator('#calendarUrl').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Escape');
  await page.locator('.miniDay').nth(1).click();await page.locator('#weatherDialog[open]').waitFor();await page.setViewportSize({width:1024,height:768});
  assert.ok(await page.locator('#weatherDialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await contained(page,'#closeWeather');await contained(page,'#nextWeatherDay');await page.locator('#closeWeather').click();
  await page.setViewportSize({width:1280,height:800});await page.locator('.article').first().click();await page.locator('#readerDialog[open]').waitFor();await page.getByText('Test feed text.',{exact:true}).waitFor();await page.locator('#readerDone').click();
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#captureOpen').click();await page.locator('#captureDialog[open]').waitFor();
  assert.equal(await page.locator('#captureDialog').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');await page.locator('#captureClose').click();
  // Service worker caches the UI only. API mocks do not write to that cache.
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const cached=await page.evaluate(async()=>{const keys=await caches.keys();return (await Promise.all(keys.map(async key=>(await (await caches.open(key)).keys()).map(r=>new URL(r.url).pathname)))).flat();});
  assert.ok(cached.includes('/static/capture.js'));assert.ok(cached.every(path=>path.startsWith('/static/')));
  await context.setOffline(true);await page.reload();await page.locator('#notificationConnection').waitFor({state:'visible'});
  await page.locator('#captureOpen').click();await page.locator('#captureDialog[open]').waitFor();await page.locator('#captureText').fill('Saved after an offline reload');await page.locator('#captureSave').click();await page.waitForFunction(()=>!document.getElementById('captureDialog').open);
  await page.locator('#inboxOpen').click();await page.locator('#captureItems').getByText('Saved after an offline reload',{exact:true}).waitFor();await page.locator('#inboxClose').click();await page.locator('#focusStart').click();assert.equal(await page.locator('#focusStart').textContent(),'Pause');
  assert.deepEqual(errors,[]);console.log('PASS: desktop 1024–2560px, touch containment, ten themes/persistence, modal handoffs, stacked form/focus recovery, keyboard preference, direct settings, weather/reader, reduced motion, cached shell and offline reload/save/focus.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
