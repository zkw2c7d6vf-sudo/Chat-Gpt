const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {mocks}=require('./ui-fixtures.cjs');const assert=require('node:assert/strict');
async function layout(page,label){
 const result=await page.evaluate(()=>{
  const cards=[...document.querySelectorAll('.homeWidgets>.card')],overlaps=[],clipped=[];if(cards.length!==3)throw new Error('Expected three home cards');
  for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){const a=cards[i].getBoundingClientRect(),b=cards[j].getBoundingClientRect();if(a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5)overlaps.push([cards[i].id,cards[j].id]);}
  for(const card of cards){const box=card.getBoundingClientRect();for(const el of card.querySelectorAll('.cardHead button,.cardFoot button,.cardFoot a,#focusCustom,#focusStart,#plugToggle,#plugSettings')){if(!el.checkVisibility())continue;const r=el.getBoundingClientRect();if(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1)clipped.push(el.id||el.textContent);}}
  return {overlaps,clipped,overflow:document.documentElement.scrollWidth>innerWidth};
 });assert.deepEqual(result,{overlaps:[],clipped:[],overflow:false},label+' '+JSON.stringify(result));
}
(async()=>{const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});try{
 for(const hasTouch of [false,true])for(const [width,height] of [[900,768],[960,768],[1000,768],[1024,768],[1152,864],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1440]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch});await mocks(context);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.MIDNIGHT_TEST_URL||'http://127.0.0.1:8765');await page.locator('.miniDay').first().waitFor();
  await layout(page,`${width}x${height} touch=${hasTouch}`);
  await page.evaluate(()=>{MidnightNotifications.notify({id:'layout-reminder',kind:'reminder',message:'A long reminder to follow up on placement. '.repeat(12),persistent:true});document.getElementById('musicTitle').textContent='An intentionally long title that must wrap cleanly without displacing the transport controls';});
  await layout(page,'with long reminder and track');
  if(width===1280&&hasTouch){
   await page.locator('#plugToggle').click();await page.locator('#settingsDialog[open]').waitFor();assert.equal(await page.locator('#plugIp').evaluate(el=>el===document.activeElement),true);await page.locator('#closeSettings').click();await page.waitForFunction(()=>!document.getElementById('settingsDialog').open);
   await page.locator('#captureOpen').click();await page.locator('#captureText').fill('A visible draft status must follow a completed write.');await page.getByText('Draft saved in this browser',{exact:true}).waitFor();
   await page.locator('[data-kind=reminder]').click();await page.locator('#captureDue').fill('2026-12-01T12:00');
   await page.locator('#captureDialog').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
   const controls=await page.evaluate(()=>['captureSave','captureClose'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,rect:r.toJSON(),visible:r.top>=0&&r.bottom<=innerHeight&&r.width>=44&&r.height>=44};}));assert.ok(controls.every(c=>c.visible),JSON.stringify(controls));
   await page.locator('#captureClose').click();await page.waitForFunction(()=>!document.getElementById('captureDialog').open);
   await page.evaluate(async()=>{const store=new MidnightCaptureStore();await store.ready;const now=new Date().toISOString();for(let i=0;i<24;i++)await store.save({id:crypto.randomUUID(),kind:'note',text:'Searchable note '+i,createdAt:now,updatedAt:now,done:false,archived:false},'unused');});
   await page.locator('#inboxOpen').click();await page.locator('.captureItem').first().waitFor();await page.locator('#inboxDialog').evaluate(el=>el.scrollTop=el.scrollHeight);
   const search=await page.locator('#captureSearch').boundingBox();assert.ok(search.y>20&&search.y+search.height<height,'Search stays reachable in long inbox');
   await page.locator('#captureSearch').fill('Searchable note 23');assert.equal(await page.locator('.captureItem').count(),1);await page.locator('#captureSearchClear').click();assert.equal(await page.locator('.captureItem').count(),24);
  }
  if(width===2560&&hasTouch){
   await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   await page.evaluate(async()=>{for(const name of await caches.keys()){const cache=await caches.open(name);await cache.delete('/static/index.html');await cache.delete('/static/polish.css');}});
   await page.reload();await page.locator('.miniDay').first().waitFor();await layout(page,'cache misses fall back to the local server');assert.equal(await page.locator('#music').evaluate(el=>getComputedStyle(el).borderRadius),'20px');
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: no card intersections or clipped primary controls across 14 desktop/touch layouts, long reminder/title stress, direct warmer setup, confirmed draft status, reachable reminder save/close, sticky inbox search and clear.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
