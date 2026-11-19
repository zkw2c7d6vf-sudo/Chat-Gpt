/* Real local conversion API + IndexedDB. Integrations are disabled with synthetic data. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
require('node:fs').mkdirSync(path.join(__dirname,'../verification/file-tools'),{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',args:['--mute-audio']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',timezoneId:'America/New_York'});
 await context.route('**/api/**',route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/api/files/')||url.pathname==='/api/sounds'||url.pathname==='/api/bootstrap')return route.continue();
 if(url.pathname.includes('calendar'))return route.fulfill({json:{configured:false,events:[]}});
 if(url.pathname.includes('news'))return route.fulfill({json:{articles:[],errors:[]}});
 return route.fulfill({status:503,json:{detail:'Integration disabled during file-tools tests'}});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.MIDNIGHT_TEST_URL||'http://127.0.0.1:8879';await page.goto(base+'/app');
 await page.locator('.bottomDock [data-panel=files]').click();
 await page.waitForFunction(()=>document.querySelector('#fileConversion').options.length===20);
 assert.equal(await page.locator('#fileToolsPanel').isVisible(),true);
 // A real image conversion returns a decodable PNG, not a renamed source.
 await page.locator('#fileConversion').selectOption('jpeg-png');
 await page.locator('#convertFiles').setInputFiles(path.join(__dirname,'../static/wallpapers/nature-long.jpg'));
 await page.locator('#convertRun').click();await page.getByText('1 of 1 files converted.',{exact:false}).waitFor();
 const downloadPromise=page.waitForEvent('download');await page.locator('#convertResults a').click();const download=await downloadPromise;
 const result=await fs.promises.readFile(await download.path());assert.equal(result.subarray(1,4).toString(),'PNG');
 // Deadline review changes are the values actually committed.
 await page.locator('#importTab').click();await page.locator('#deadlineText').fill('November 24 — Lesson plan due at 6 PM\n12/2/2027 Final reflection due 11:59 pm\nDecember 3 Observation paper');
 await page.locator('#deadlineYear').fill('2027');await page.locator('#deadlineCourse').fill('EDU 313');await page.locator('#deadlineScan').click();
 await page.locator('.deadlineRow').nth(2).waitFor();assert.equal(await page.locator('.deadlineRow').count(),3);
 await page.getByRole('textbox',{name:'Deadline 1 task',exact:true}).fill('Edited lesson plan');
 await page.getByRole('checkbox',{name:'Import deadline 2',exact:true}).uncheck();
 // Simulated disk failure retains every reviewed value and writes nothing.
 await page.evaluate(()=>{window.originalImport=MidnightCaptureStore.prototype.importTasks;MidnightCaptureStore.prototype.importTasks=async function(items){return this.transact(['items'],'readwrite',tx=>{tx.objectStore('items').add(items[0]);tx.abort();});};});
 await page.locator('#deadlineSave').click();await page.getByText(/Could not save locally/).waitFor();
 assert.equal((await page.evaluate(()=>MidnightCapture.all())).length,0);
 assert.equal(await page.getByRole('textbox',{name:'Deadline 1 task',exact:true}).inputValue(),'Edited lesson plan');
 await page.evaluate(()=>{MidnightCaptureStore.prototype.importTasks=window.originalImport;});
 await page.locator('#deadlineSave').click();await page.getByText(/Added 2 tasks/).waitFor();
 let tasks=await page.evaluate(()=>MidnightCapture.all());assert.equal(tasks.length,2);assert(tasks.some(t=>t.text==='EDU 313 · Edited lesson plan'));assert(tasks.every(t=>t.kind==='task'));
 // Re-importing the same reviewed task retains the existing copy.
 await page.locator('#deadlineText').fill('November 24 — Edited lesson plan due at 6 PM');await page.locator('#deadlineScan').click();await page.waitForFunction(()=>document.querySelectorAll('.deadlineRow').length===1&&!document.getElementById('deadlineScan').disabled);
 await page.locator('#deadlineSave').click();await page.getByText(/Kept 1 existing matching tasks/).waitFor();assert.equal((await page.evaluate(()=>MidnightCapture.all())).length,2);
 // Closing and re-opening preserves the reviewed input.
 await page.getByRole('button',{name:'Close file tools',exact:true}).click();await page.locator('.bottomDock [data-panel=files]').click();assert.equal(await page.locator('#deadlineText').inputValue(),'November 24 — Edited lesson plan due at 6 PM');
 await page.screenshot({path:path.join(__dirname,'../verification/file-tools/import-desktop.png')});
 await page.getByRole('button',{name:'Close file tools',exact:true}).click();await page.reload();await page.locator('.bottomDock [data-panel=tasks]').click();await page.locator('#tasksPanel').getByRole('button',{name:'EDU 313 · Edited lesson plan',exact:true}).waitFor();
 await page.getByRole('button',{name:'Close tasks',exact:true}).click();
 // Existing custom toolbar layouts get both new controls once, preserving their links.
 const migrated=await page.evaluate(()=>MidnightToolbarCore.withDrivePresets({version:1,items:[{type:'link',id:'link:test',label:'School',url:'https://example.com'}]}));
 assert(migrated.items.some(i=>i.id==='files'));assert(migrated.items.some(i=>i.id==='sounds'));assert(migrated.items.some(i=>i.id==='link:test'));
 assert.equal(MidnightCount(migrated.items,'sounds'),1);
 for(const viewport of [{width:1920,height:1080},{width:1024,height:700},{width:800,height:600}]){
  await page.setViewportSize(viewport);await page.locator('.bottomDock [data-panel=files]').click();await page.locator('#convertTab').click();
  const geometry=await page.locator('#fileToolsPanel').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:el.scrollWidth,client:el.clientWidth};});
  assert(geometry.left>=0&&geometry.right<=viewport.width&&geometry.top>=0&&geometry.bottom<=viewport.height);assert(geometry.width<=geometry.client+2);
  await page.screenshot({path:path.join(__dirname,`../verification/file-tools/convert-${viewport.width}.png`)});
  await page.getByRole('button',{name:'Close file tools',exact:true}).click();
 }
 assert.deepEqual(errors,[]);console.log('File tools: real conversion, edited imports, failure recovery, deduplication, persistence, toolbar migration and 3 desktop sizes passed.');
 await browser.close();
 function MidnightCount(items,id){return items.filter(i=>i.id===id).length;}
})().catch(e=>{console.error(e);process.exit(1);});
