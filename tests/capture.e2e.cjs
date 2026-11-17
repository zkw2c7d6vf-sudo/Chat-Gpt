/* Run against a local Midnight server. No integration/device/account requests are made. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})});
 const context=await browser.newContext({viewport:{width:1440,height:1080},hasTouch:true});
 await context.route('**/api/**',route=>{
  if(route.request().url().endsWith('/bootstrap')) return route.fulfill({json:{csrf:'test',settings:{feeds:[],plug_enabled:false,units:'fahrenheit'},spotify_connected:false}});
  if(route.request().url().includes('/calendar')) return route.fulfill({json:{configured:false,events:[]}});
  if(route.request().url().includes('/news')) return route.fulfill({json:{articles:[],errors:[]}});
  return route.fulfill({status:503,json:{detail:'Integration deliberately disabled in capture tests'}});
 });
 await context.addInitScript(()=>{
  class Speech {
   static async available(){return window.testVoiceAvailability || 'available';}
   static async install(){window.testVoiceAvailability='available';return true;}
   constructor(){this.processLocally=false;window.testSpeech=this;}
   start(){if(!this.processLocally) throw new Error('Cloud voice must never start');this.onstart?.();}
   abort(){this.onend?.();}
   stop(){this.onend?.();}
  }
  Speech.prototype.processLocally=false;window.SpeechRecognition=Speech;
 });
 const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.MIDNIGHT_TEST_URL || 'http://127.0.0.1:8765';
 await page.goto(base);
 await page.locator('#captureOpen').click();
 await page.locator('#captureKeyboard .touchKey').getByText('h',{exact:true}).click();
 await page.locator('#captureKeyboard .touchKey').getByText('i',{exact:true}).click();
 assert.equal(await page.locator('#captureText').inputValue(),'hi');
 await page.locator('#captureText').fill('Draft survives closing and reload');
 await page.locator('#captureClose').click();await page.reload();
 await page.locator('#captureOpen').click();await page.locator('#captureDialog[open] #captureText').waitFor({state:'visible'});assert.equal(await page.locator('#captureText').inputValue(),'Draft survives closing and reload');
 await page.locator('#captureSave').click();await page.waitForFunction(()=>!document.getElementById('captureDialog').open);
 await page.locator('#inboxOpen').click();await page.locator('#captureItems').getByText('Draft survives closing and reload',{exact:true}).waitFor();
 await page.locator('#inboxClose').click();
 // Typing and saving use no network after the interface loads.
 await context.setOffline(true);await page.locator('#captureOpen').click();
 await page.locator('[data-kind=task]').click();await page.locator('#captureText').fill('Offline task');await page.locator('#captureSave').click();
 await page.waitForFunction(()=>!document.getElementById('captureDialog').open);await context.setOffline(false);
 await page.reload();await page.locator('#inboxOpen').click();
 const task=page.locator('.captureItem').filter({hasText:'Offline task'});await task.waitFor();await task.getByRole('button',{name:'Mark done'}).click();
 await task.getByRole('button',{name:'Reopen'}).waitFor();await task.getByRole('button',{name:'Edit',exact:true}).click();
 await page.locator('#captureDialog[open] #captureText').waitFor({state:'visible'});assert.equal(await page.locator('#captureText').inputValue(),'Offline task');
 await page.locator('#captureText').fill('Edited offline task');await page.locator('#captureSave').click();await page.waitForFunction(()=>!document.getElementById('captureDialog').open);
 await page.locator('#inboxOpen').click();const edited=page.locator('.captureItem').filter({hasText:'Edited offline task'});await edited.getByRole('button',{name:'Edit',exact:true}).click();await page.locator('#captureDialog[open] #captureText').waitFor({state:'visible'});assert.equal(await page.locator('#captureText').inputValue(),'Edited offline task');await page.locator('#captureClose').click();await page.locator('#inboxOpen').click();await edited.getByRole('button',{name:'Archive',exact:true}).click();
 await page.locator('[data-filter=archive]').click();await page.locator('#captureItems').getByText('Edited offline task',{exact:true}).waitFor();
 await page.locator('.captureItem').filter({hasText:'Edited offline task'}).getByRole('button',{name:'Restore'}).click();
 await page.locator('#inboxClose').click();await page.locator('#captureOpen').click();
 await page.locator('[data-kind=reminder]').click();await page.locator('#captureText').fill('Overdue reminder');await page.locator('#captureDue').fill('2026-01-01T12:00');
 await page.locator('#captureSave').click();await page.getByRole('button',{name:'View reminders',exact:true}).waitFor({state:'visible'});await page.reload();await page.getByRole('button',{name:'View reminders',exact:true}).waitFor({state:'visible'});
 await page.getByRole('button',{name:'View reminders',exact:true}).click();await page.locator('#captureItems').getByText('Overdue reminder',{exact:true}).waitFor();await page.locator('.captureItem').filter({hasText:'Overdue reminder'}).getByRole('button',{name:'Mark done'}).click();await page.getByRole('button',{name:'View reminders',exact:true}).waitFor({state:'hidden'});
 await page.locator('#inboxClose').click();await page.locator('#captureOpen').click();await page.locator('[data-kind=idea]').click();
 await page.locator('#captureMic').click();await page.getByText('Listening on this device · tap Stop when finished.').waitFor();
 await page.evaluate(()=>window.testSpeech.onresult({resultIndex:0,results:[Object.assign([{transcript:'A voice idea'}],{isFinal:true})]}));
 assert.equal(await page.locator('#captureText').inputValue(),'A voice idea');
 await page.evaluate(()=>{window.testSpeech.onerror({error:'not-allowed'});window.testSpeech.onend();});await page.getByText(/Microphone permission denied/).waitFor();
 await page.locator('#captureMic').click();await page.evaluate(()=>{window.testSpeech.onerror({error:'audio-capture'});window.testSpeech.onend();});await page.getByText(/No microphone available/).waitFor();
 await page.evaluate(()=>window.testVoiceAvailability='downloadable');await page.locator('#captureMic').click();await page.locator('#captureVoiceInstall').waitFor({state:'visible'});await page.locator('#captureVoiceInstall').click();await page.getByText('Voice pack ready. Tap Dictate to allow microphone access.').waitFor();
 await page.locator('#captureSave').click();await page.waitForFunction(()=>!document.getElementById('captureDialog').open);
 // Force a transaction failure: saving must preserve input and keep the dialog open.
 await page.locator('#captureOpen').click();await page.locator('#captureText').fill('Do not lose this');
 await page.evaluate(()=>{window.originalCaptureSave=MidnightCaptureStore.prototype.save;MidnightCaptureStore.prototype.save=async()=>{throw new Error('Test disk full');};});
 await page.locator('#captureSave').click();await page.getByText(/Could not save locally.*Test disk full/).waitFor();assert.equal(await page.locator('#captureText').inputValue(),'Do not lose this');
 await page.evaluate(()=>MidnightCaptureStore.prototype.save=window.originalCaptureSave);
 await page.locator('#captureSave').click();await page.waitForFunction(()=>!document.getElementById('captureDialog').open);
 await page.locator('#inboxOpen').click();await page.locator('[data-filter=inbox]').click();
 await page.locator('#captureSearch').fill('voice idea');assert.equal(await page.locator('.captureItem').count(),1);await page.locator('#captureSearchClear').click();assert.equal(await page.locator('#captureSearch').inputValue(),'');assert.ok(await page.locator('.captureItem').count()>1);
 const download=page.waitForEvent('download');await page.locator('#captureExport').click();const result=await download;assert.match(result.suggestedFilename(),/^midnight-captures-.*\.json$/);
 await page.locator('#inboxClose').click();await page.screenshot({animations:'disabled',path:'/tmp/midnight-capture-home.png'});
 await page.locator('#captureOpen').click();await page.locator('#captureDialog[open] #captureText').waitFor({state:'visible'});await page.screenshot({animations:'disabled',path:'/tmp/midnight-capture-desktop.png'});
 await page.setViewportSize({width:1280,height:720});await page.reload();await page.locator('#captureOpen').click();await page.locator('#captureDialog[open] #captureText').waitFor({state:'visible'});await page.screenshot({animations:'disabled',path:'/tmp/midnight-capture-compact.png'});
 assert.equal(await page.evaluate(()=>document.getElementById('captureDialog').scrollWidth>document.getElementById('captureDialog').clientWidth),false,'Capture must not overflow horizontally');
 assert.deepEqual(errors,[]);
 // Unsupported voice is explicit and never initiates remote recognition.
 const unsupported=await context.newPage();await unsupported.addInitScript(()=>{delete window.SpeechRecognition;delete window.webkitSpeechRecognition;});await unsupported.goto(base);await unsupported.locator('#captureOpen').click();await unsupported.getByText(/On-device dictation is unavailable here/).waitFor();
 console.log('PASS: touch keys, drafts/reload, offline save, edit, complete, archive/restore, reminders/reload, local voice/results/errors/install, storage failure, search, backup, desktop layout and unsupported voice.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
