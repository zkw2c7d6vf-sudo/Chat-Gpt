/* Synthetic browser verification. Run against the updated server, never private data. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {mocks}=require('./ui-fixtures.cjs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await mocks(context);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.MIDNIGHT_TEST_URL||'http://127.0.0.1:8765');
  await page.evaluate(async()=>{await MidnightCapture.ready();const store=new MidnightCaptureStore(),now=new Date().toISOString();for(let i=0;i<5;i++)await store.save({id:'task-'+i,text:'Test task '+i,kind:'task',done:false,archived:false,createdAt:now,updatedAt:now,dueAt:i===4?new Date(Date.now()-86400000).toISOString():null});await MidnightToday.refresh();});
  await page.locator('[data-today-view=backlog]').click();
  for(let i=0;i<3;i++){await page.locator('#todayTasks [data-task-id="task-'+i+'"] .todayPin').click();await page.waitForFunction(n=>document.querySelectorAll('#todayPriorities .todayTask').length===n,i+1);}
  await page.locator('#todayTasks .todayPin').first().click();await page.getByText('Three priorities is enough for now. Remove one to make room.').waitFor();
  const row=page.locator('#todayPriorities [data-task-id="task-0"]');await row.getByRole('button',{name:'Focus',exact:true}).click();await page.locator('#todayFocus:not([hidden])').waitFor();assert.equal(await page.evaluate(()=>MidnightApp.snapshot().focus.running),true);
  await page.locator('#todayPauseFocus').click();assert.equal(await page.evaluate(()=>MidnightApp.snapshot().focus.running),false);
  await row.getByRole('button',{name:'Complete Test task 0',exact:true}).click();await page.waitForFunction(()=>document.getElementById('todayDoneCount').textContent==='1');
  await page.locator('[data-today-view=completed]').click();await page.getByRole('button',{name:'Reopen Test task 0',exact:true}).click();await page.waitForFunction(()=>document.getElementById('todayDoneCount').textContent==='0');
  await page.locator('[data-today-view=due]').click();await page.locator('#todayTasks').getByText('Test task 4',{exact:true}).waitFor();
  await page.locator('#todayAdd').click();await page.locator('#captureText').fill('Task with date');await page.locator('#captureDue').fill('2026-12-01T12:00');await page.locator('#captureSave').click();await page.waitForFunction(()=>!document.getElementById('captureDialog').open);
  assert.ok(await page.evaluate(async()=>(await MidnightCapture.all()).find(i=>i.text==='Task with date').dueAt));
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#todayPriorities .todayTask').length===3);
  // Backup import keeps same-ID captures and the current draft. Then repeat safely.
  await page.locator('#inboxOpen').click();await page.locator('#captureRestore').click();
  const backup=await page.evaluate(async()=>{const existing=(await MidnightCapture.all())[0],now=new Date().toISOString();return {format:'midnight-capture',version:1,items:[{...existing,text:'Must not overwrite'},{id:'restored',kind:'note',text:'A restored note',done:false,archived:false,createdAt:now,updatedAt:now,dueAt:null}],draft:null};});
  await page.locator('#restoreFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.locator('#restoreConfirm:not([disabled])').waitFor();await page.locator('#restoreConfirm').click();await page.getByText('Restored 1 captures; kept 1 existing captures.').waitFor();
  assert.equal(await page.evaluate(async()=>(await MidnightCapture.all()).some(i=>i.text==='Must not overwrite')),false);
  await page.locator('#restoreFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{invalid')});await page.getByText(/Could not read backup/).waitFor();assert.equal(await page.locator('#restoreConfirm').isDisabled(),true);
  await page.locator('#inboxClose').click();
  for(const [width,height] of [[1024,768],[1440,900],[1920,1080]]){
   await page.setViewportSize({width,height});
   for(const theme of ['midnight','light','graphite','sand']){await page.evaluate(t=>MidnightApp.theme(t),theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No page overflow: '+width+' '+theme);const clips=await page.evaluate(()=>[...document.querySelectorAll('#todayPanel button')].filter(b=>b.checkVisibility()).filter(b=>{const r=b.getBoundingClientRect(),p=b.closest('.todayTask,.todayHeading,.todayTaskHeader,.todayNext')?.getBoundingClientRect();return p&&(r.left<p.left-1||r.right>p.right+1);}).map(b=>b.textContent));assert.deepEqual(clips,[]);}
  }
  assert.deepEqual(errors,[]);console.log('PASS: Today priorities/cap, focus/pause, complete/undo, due dates, reload, safe backup restore, malformed backup and desktop/theme overflow.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
