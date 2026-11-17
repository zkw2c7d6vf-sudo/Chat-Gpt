/* Saved review checkpoints for the real Midnight UI, with synthetic integrations. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const {mocks}=require('./ui-fixtures.cjs');
(async()=>{const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});try{
 for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1280,720],[1024,768]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true});await mocks(context);const page=await context.newPage();await page.goto(process.env.MIDNIGHT_TEST_URL||'http://127.0.0.1:8877/static/index.html');await page.locator('.miniDay').first().waitFor();await page.waitForLoadState('networkidle');
  await page.screenshot({animations:'disabled',path:`verification/design/${process.env.MIDNIGHT_PASS||'final'}-${width}.png`});
  if(width===1440){for(const theme of ['sand','graphite','christmas']){await page.locator('#settingsBtn').click();await page.locator(`[data-theme-choice=${theme}]`).click();await page.locator('#closeSettings').click();await page.waitForFunction(()=>!document.getElementById('settingsDialog').open);await page.screenshot({animations:'disabled',path:`verification/design/${process.env.MIDNIGHT_PASS||'final'}-${theme}.png`});}}
  await context.close();
 }
 console.log('Saved desktop and theme review screenshots.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
