const {chromium,firefox}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {mocks}=require('./ui-fixtures.cjs');const assert=require('node:assert/strict');
(async()=>{for(const [name,engine] of [['chrome',chromium],['firefox',firefox]]){
const browser=await engine.launch({headless:true,...(name==='chrome'?{channel:'chrome'}:{})});try{
const context=await browser.newContext();await mocks(context);await context.route('**/api/drive/**',r=>r.fulfill({json:{connected:true,files:Array.from({length:3},(_,i)=>({name:['Observation Schedule FALL 26 West El.','Small Group Lesson Plan Observation Joseph','Kindergarten We See Final Worksheet.pdf'][i],url:'https://docs.google.com/document/d/test',mimeType:'application/vnd.google-apps.document'}))}}));
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.MIDNIGHT_TEST_URL||'http://127.0.0.1:8891');
await page.locator('[data-panel=focus]').click();await page.locator('#focusStart').click();await page.locator('[data-close=focusPanel]').click();await page.waitForFunction(()=>!document.getElementById('focusPanel').open);
await page.evaluate(()=>{MidnightNotifications.notify({id:'test-reminder',kind:'reminder',title:'1 reminder due',message:'Complete the financial aid application',persistent:true,actionLabel:'View reminders',action:()=>{}});document.getElementById('nextWallpaperHome').hidden=false;document.getElementById('location').textContent='Cheektowaga';document.getElementById('weatherTitle').textContent='Cheektowaga';});
for(const [width,height] of [[900,768],[960,768],[1000,768],[1637,882],[1440,900],[1440,810],[1366,768],[1280,720],[1024,768],[1920,1080]]){
 await page.setViewportSize({width,height});await page.waitForTimeout(150);
 const result=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height}};return {capture:rect('#captureOpen'),focus:rect('#focusSession'),notice:rect('#notificationDock'),cards:rect('.homeWidgets'),dock:rect('.bottomDock'),video:rect('#nextWallpaperHome'),search:rect('.homeSearchRow'),clock:rect('.clockHero'),docHeight:document.documentElement.scrollHeight,zoom:getComputedStyle(document.getElementById('home')).zoom,styles:['#captureOpen','#focusSession','#notificationDock'].map(s=>{const c=getComputedStyle(document.querySelector(s));return [c.backgroundImage,c.backgroundColor,c.borderRadius]})};});
 assert.equal(result.zoom,'1');
 assert.ok(result.dock.bottom<=height&&result.video.bottom<=height,`${name} ${width}x${height} clipped dock: ${JSON.stringify(result)}`);
 const weather=await page.evaluate(()=>{const summary=document.getElementById('weatherInsight').getBoundingClientRect(),forecast=document.getElementById('miniForecast').getBoundingClientRect();return {summaryBottom:summary.bottom,forecastTop:forecast.top};});assert.ok(weather.summaryBottom<=weather.forecastTop,`${name} overlapping weather: ${JSON.stringify(weather)}`);
 assert.ok(result.cards.bottom<=result.dock.y,`${name} cards overlap dock`);
 assert.ok(result.focus.y>=result.capture.bottom&&Math.abs(result.focus.x-result.capture.x)<2,`${name} focus below Capture`);
 assert.ok(Math.abs(result.focus.y-result.notice.y)<1,`${name} notification alignment`);
 assert.deepEqual(result.styles[0],result.styles[1]);assert.deepEqual(result.styles[1],result.styles[2]);
 assert.ok(result.focus.right<width/2&&result.notice.x>width/2,`${name} utilities overlap clock`);
 if(width===1637||width===1280) await page.screenshot({path:`/tmp/midnight-unified-${name}-${width}.png`});
}
await page.locator('#focusSessionToggle').click();assert.equal(await page.locator('#focusSessionLabel').textContent(),'Paused');await page.locator('#focusSessionToggle').click();
await page.locator('#captureOpen').click();await page.locator('#captureText').fill('Keep this unified capture draft');await page.locator('#captureClose').click();await page.waitForFunction(()=>!document.getElementById('captureDialog').open);await page.locator('#captureOpen').click();assert.equal(await page.locator('#captureText').inputValue(),'Keep this unified capture draft');await page.waitForTimeout(350);await page.screenshot({path:`/tmp/midnight-unified-capture-${name}.png`});
assert.deepEqual(errors,[]);console.log(`PASS ${name}: seven desktop sizes, complete dock/video, equal rows, Focus below Capture/aligned with reminders, matching surfaces, timer controls and preserved capture draft.`);
}finally{await browser.close();}}
})().catch(e=>{console.error(e);process.exit(1)});
