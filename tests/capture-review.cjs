const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const {mocks}=require('./ui-fixtures.cjs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const [width,height] of [[1920,1080],[1440,900],[1280,720]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true});await mocks(context);const page=await context.newPage();await page.goto('http://127.0.0.1:8877/static/index.html');await page.waitForLoadState('networkidle');
  await page.evaluate(async()=>{const store=new MidnightCaptureStore();await store.ready;const now=new Date().toISOString();for(const [kind,text] of [['note','Ask Julie about my remaining course requirements.'],['task','Bring observation notes to placement on Monday.'],['idea','Make a reading corner with books students can recommend to each other.']])await store.save({id:crypto.randomUUID(),kind,text,createdAt:now,updatedAt:now,done:false,archived:false,dueAt:null},'new');});
  await page.locator('#captureOpen').click();await page.locator('#captureText').fill('A little space to catch a thought before it disappears.\nMake tomorrow’s first step a small one.');await page.getByText('Draft saved in this browser',{exact:true}).waitFor();
  await page.screenshot({animations:'disabled',path:`verification/design/${process.env.MIDNIGHT_PASS||'pass3'}-capture-${width}.png`});
  console.log(JSON.stringify(await page.locator('#captureSave').evaluate(el=>({width:innerWidth,save:el.getBoundingClientRect().toJSON(),height:innerHeight}))));
  await page.locator('#captureClose').click();await page.waitForFunction(()=>!document.getElementById('captureDialog').open);await page.locator('#inboxOpen').click();await page.locator('.captureItem').first().waitFor();await page.screenshot({animations:'disabled',path:`verification/design/${process.env.MIDNIGHT_PASS||'pass3'}-inbox-${width}.png`});await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
