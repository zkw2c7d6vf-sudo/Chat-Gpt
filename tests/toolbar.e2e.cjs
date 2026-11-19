/* Isolated browser checks: integrations and display access are synthetic. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const path=require('node:path');const {mocks}=require('./ui-fixtures.cjs');
(async()=>{const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});try{
 const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true});await mocks(context);
 await context.addInitScript(()=>{
  window.toolbarMockInternal={left:0,top:0,availLeft:0,availTop:25,availWidth:1440,availHeight:875,isInternal:true};
  window.toolbarMockExternal={left:-1920,top:0,availLeft:-1920,availTop:0,availWidth:1920,availHeight:1080,isInternal:false};
  window.toolbarMockDetails={screens:[window.toolbarMockInternal],currentScreen:window.toolbarMockInternal,addEventListener(){}};
  window.getScreenDetails=async()=>window.toolbarMockDetails;Object.defineProperty(navigator,'permissions',{value:{query:async()=>({state:'granted',addEventListener(){}})}});
  window.testOpenCalls=[];window.open=(...args)=>{window.testOpenCalls.push(args);return {opener:null,location:{replace(url){window.testLastWebsite=url;}},focus(){},close(){}};};
 });
 await context.route('**/static/test-toolbar.js',route=>route.fulfill({contentType:'application/javascript',body:require('node:fs').readFileSync(path.join(__dirname,'toolbar.browser.js'),'utf8')}));
 const page=await context.newPage();await page.goto(process.env.MIDNIGHT_TEST_URL||'http://127.0.0.1:8879');await page.locator('#toolbarEdit').waitFor({state:'attached'});await page.addScriptTag({url:'/static/test-toolbar.js'});const result=await page.evaluate(()=>window.toolbarChecks);assert.equal(result.ok,true,result.error);console.log('PASS: '+result.checks.length+' toolbar browser checks.');
 const openEditor=async()=>{if(!await page.locator('#settingsDialog').evaluate(el=>el.open))await page.locator('#settingsBtn').click();if(!await page.locator('#toolbarEdit').isVisible())await page.locator('#settingsDialog summary').getByText('Toolbar',{exact:true}).click();await page.locator('#toolbarEdit').click();};
 // Check persisted selection across an actual navigation.
 await openEditor();await page.locator('[data-tool="weather"]').check();await page.locator('#toolbarSave').click();await page.waitForFunction(()=>!document.getElementById('toolbarDialog').open);await page.reload();await page.locator('#toolbarItems button[aria-label="Weather"]').waitFor();
 for(const [width,height] of [[1024,768],[1440,900]]){await page.setViewportSize({width,height});await openEditor();assert.ok(await page.locator('#toolbarSave').evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight&&r.right<=innerWidth;}),'Save remains reachable');await page.screenshot({path:`/tmp/midnight-toolbar-${width}.png`,animations:'disabled'});await page.locator('#toolbarCancel').click();await page.waitForFunction(()=>!document.getElementById('toolbarDialog').open);}
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
