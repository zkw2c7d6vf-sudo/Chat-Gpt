/* Isolated UI states: no account, file or device changes. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const {mocks}=require('./ui-fixtures.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await mocks(context);
 let drive={connected:false,files:[]},driveStatus=200;
 await context.route('**/api/drive/**',r=>r.fulfill({status:driveStatus,json:drive}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();
 await page.goto(process.env.MIDNIGHT_TEST_URL||'http://127.0.0.1:8891');
 // Drive setup, auth recovery, transient failure and a successful retry.
 await page.locator('#driveTilesConnect').click();await page.locator('#driveDialog[open]').waitFor();
 await page.locator('#driveSetup summary').click();await page.locator('#driveClientId').fill('keep-this-client');
 await page.locator('#driveClientSecret').fill('keep-this-secret');
 driveStatus=401;drive={detail:'Expired token'};await page.locator('#driveRefresh').click();
 await page.getByText('Drive needs your attention',{exact:true}).waitFor();
 assert.equal(await page.locator('#driveClientId').inputValue(),'keep-this-client');
 assert.equal(await page.locator('#driveClientSecret').inputValue(),'keep-this-secret');
 await page.screenshot({path:'/tmp/midnight-drive-auth.png'});
 driveStatus=503;drive={detail:'A very long upstream failure '.repeat(30)};await page.locator('#driveRefresh').click();
 await page.getByText('Drive is unavailable',{exact:true}).waitFor();
 for(const width of [1024,1440]){
 await page.setViewportSize({width,height:768});
 assert.ok(await page.locator('#driveDialog').evaluate(e=>e.scrollWidth<=e.clientWidth));
 assert.ok(await page.locator('#driveTitle').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)<=21));
 await page.screenshot({path:`/tmp/midnight-drive-error-${width}.png`});
 }
 driveStatus=200;drive={connected:true,files:[{name:'A long document name '.repeat(20),url:'https://docs.google.com/document/d/test',mimeType:'application/vnd.google-apps.document'}]};
 await page.locator('#driveRefresh').click();await page.locator('#driveRecent a').waitFor();
 assert.equal(await page.locator('#driveRecovery').isVisible(),false);
 assert.ok(await page.locator('#driveDialog').evaluate(e=>e.scrollWidth<=e.clientWidth));
 await page.locator('#driveClose').click();await page.waitForFunction(()=>!document.getElementById('driveDialog').open);
 // Smooth New toggle retains keyboard navigation and closes cleanly on interruption.
 for(const width of [1024,1440]){
 await page.setViewportSize({width,height:900});await page.locator('#createToggle').click();
 await page.locator('#createToggle').press('ArrowDown');assert.equal(await page.locator('#createActions a').first().evaluate(e=>document.activeElement===e),true);
 const box=await page.locator('#createActions').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
 await page.screenshot({path:`/tmp/midnight-new-${width}.png`});
 await page.keyboard.press('Escape');assert.equal(await page.locator('#createActions').evaluate(e=>e.inert),true);
 await page.locator('#createToggle').click();await page.locator('#createToggle').click();await page.locator('#createToggle').click();
 assert.equal(await page.locator('#createToggle').getAttribute('aria-expanded'),'true');
 await page.locator('#googleQuery').click();assert.equal(await page.locator('#createToggle').getAttribute('aria-expanded'),'false');
 }
 // Focus works locally and preserves the deadline/paused state through reloads.
 await page.locator('[data-panel=focus]').click();await page.locator('#focusCustom').click();
 await page.locator('#focusMinutes').fill('2');await page.locator('#focusCustomForm').getByRole('button',{name:'Start timer'}).click();
 await page.waitForFunction(()=>!document.getElementById('focusCustomDialog').open);
 await page.locator('[data-close=focusPanel]').click();await page.locator('#focusSession').waitFor({state:'visible'});
 await page.clock.fastForward(30000);await page.locator('#focusSessionToggle').click();
 assert.equal(await page.locator('#focusSessionLabel').textContent(),'Paused');
 const paused=await page.locator('#focusSessionTime').textContent();
 await page.clock.fastForward(30000);assert.equal(await page.locator('#focusSessionTime').textContent(),paused);
 await page.reload();assert.equal(await page.locator('#focusSessionTime').textContent(),paused);
 await page.locator('#focusSessionOpen').click();await page.locator('#focusPanel[open]').waitFor();
 assert.equal(await page.locator('#focusTime').textContent(),paused);
 await page.locator('[data-close=focusPanel]').click();await page.waitForFunction(()=>!document.getElementById('focusPanel').open);
 await page.locator('#focusSessionToggle').click();await page.reload();await page.locator('#focusSession').waitFor({state:'visible'});
 for(const width of [1024,1440,1920]){
 await page.setViewportSize({width,height:900});
 const box=await page.locator('#focusSession').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
 await page.screenshot({path:`/tmp/midnight-focus-session-${width}.png`});
 }
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await context.setOffline(true);await page.reload();await page.locator('#focusSession').waitFor({state:'visible'});
 await page.clock.fastForward(125000);await page.locator('#focusSession').waitFor({state:'hidden'});
 await context.setOffline(false);await page.locator('[data-panel=focus]').click();await page.locator('#focusReset').click();
 assert.equal(await page.locator('#focusTime').textContent(),'2:00');
 await page.locator('[data-close=focusPanel]').click();await page.waitForFunction(()=>!document.getElementById('focusPanel').open);
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#createToggle').click();
 assert.equal(await page.locator('#createActions').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
 assert.deepEqual(errors,[]);
 console.log('PASS: Drive setup/auth/failure/retry, preserved credentials, long filenames, compact layouts; New keyboard/outside/rapid toggles/reduced motion; Focus pause/resume/reload/offline/completion/reset and desktop layouts.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
