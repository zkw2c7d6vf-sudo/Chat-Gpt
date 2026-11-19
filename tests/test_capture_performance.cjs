const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const settle=()=>new Promise(setImmediate);

function captureContext({channel=true}={}) {
  const nodes=new Map(),events=new Map(),intervals=[],notices=[],channels=[];
  let reads=0,now=Date.parse('2026-11-17T12:00:00Z'),items=[],read=()=>Promise.resolve(items.map(item=>({...item})));
  class Element {
    contains(){return false;}
    constructor(){this.value='';this.children=[];this.dataset={};this.style={};this.open=false;this.classList={add(){},toggle(){}};}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;}
    setAttribute(){} querySelectorAll(){return [];} addEventListener(){} focus(){}
  }
  const byId=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  const listen=(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);};
  const dispatch=event=>{for(const fn of events.get(event.type)||[])fn(event);};
  class Store {
    ready=Promise.resolve();
    all(){reads++;return read();}
    async update(id,changes){items=items.map(item=>item.id===id?{...item,...changes}:item);}
  }
  class FakeDate extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const document={getElementById:byId,createElement:()=>new Element(),addEventListener:listen,hidden:false};
  const context=vm.createContext({document,window:{addEventListener:listen,dispatchEvent:dispatch},Date:FakeDate,Intl,JSON,Promise,Map,Event:class{constructor(type){this.type=type;}},
    MidnightCaptureStore:Store,MidnightNotifications:{reminders:items=>notices.push(items.map(item=>item.id))},localStorage:{getItem:()=>null},
    matchMedia:()=>({matches:false}),innerHeight:900,setInterval:(fn,ms)=>intervals.push({fn,ms}),
    ...(channel?{BroadcastChannel:class{constructor(){channels.push(this);}postMessage(){}}}:{})});
  vm.runInContext(fs.readFileSync(require.resolve('../static/capture.js'),'utf8'),context);
  return {context,document,byId,channels,notices,intervals,dispatch,get api(){return context.window.MidnightCapture;},get reads(){return reads;},
    setItems(value){items=value;},setRead(fn){read=fn;},advance(ms){now+=ms;}};
}
const item=(id,extra={})=>({id,text:id,kind:'note',createdAt:'2026-11-17T12:00:00Z',archived:false,done:false,...extra});

test('capture readers share one snapshot; idle reminder checks do not scan storage or emit change events',async()=>{
  const app=captureContext();app.setItems([item('saved')]);
  await settle();const initial=app.reads;let changes=0;app.context.window.addEventListener('midnight:captures',()=>changes++);
  const [a,b]=await Promise.all([app.api.all(),app.api.all()]);assert.equal(app.reads,initial);assert.equal(a[0].id,'saved');
  a[0].text='caller edit';a.pop();assert.equal(b[0].text,'saved');assert.equal((await app.api.all()).length,1);
  const interval=app.intervals.find(row=>row.ms===30000);
  for(let i=0;i<120;i++)interval.fn();
  assert.equal(app.reads,initial);assert.equal(changes,0);
});

test('reminders become due without database polling, and completed reminders clear',async()=>{
  const app=captureContext();app.setItems([item('due',{kind:'reminder',dueAt:'2026-11-17T12:01:00Z'})]);await settle();
  const initial=app.reads,interval=app.intervals[0];app.advance(61000);interval.fn();
  assert.deepEqual(app.notices.at(-1),['due']);assert.equal(app.reads,initial);
  const count=app.notices.length;interval.fn();assert.equal(app.notices.length,count);
  assert.equal(await app.api.update('due',{done:true}),true);assert.deepEqual(app.notices.at(-1),[]);
});

test('a cross-tab edit during a read cannot publish an obsolete snapshot',async()=>{
  const app=captureContext();await settle();const pending=[];app.setRead(()=>new Promise(resolve=>pending.push(resolve)));
  app.channels[0].onmessage();const reader=app.api.all();await settle();assert.equal(pending.length,1);
  app.channels[0].onmessage();pending.shift()([item('obsolete')]);await settle();assert.equal(pending.length,1);
  pending.shift()([item('latest')]);assert.equal((await reader)[0].id,'latest');await settle();
  assert.equal((await app.api.all())[0].id,'latest');
});

test('commits from another store in the same tab invalidate the shared snapshot',async()=>{
  const app=captureContext();await settle();app.setItems([item('seeded')]);app.dispatch({type:'midnight:captures-invalidated'});
  assert.equal((await app.api.all())[0].id,'seeded');
});

test('storage failures can retry; browsers without BroadcastChannel retain polling and visibility refresh',async()=>{
  const app=captureContext({channel:false});await settle();const interval=app.intervals[0];
  app.setRead(()=>Promise.reject(new Error('read failed')));interval.fn();await settle();
  app.setRead(()=>Promise.resolve([item('recovered')]));interval.fn();await settle();assert.equal((await app.api.all())[0].id,'recovered');
  const reads=app.reads;app.document.hidden=true;interval.fn();await settle();assert.equal(app.reads,reads);
  app.document.hidden=false;app.dispatch({type:'visibilitychange'});await settle();assert.ok(app.reads>reads);
});

test('only committed item writes invalidate snapshots; drafts and aborted writes do not',async()=>{
  const events=[],context=vm.createContext({window:{dispatchEvent:event=>events.push(event.type)},Event:class{constructor(type){this.type=type;}}});
  vm.runInContext(fs.readFileSync(require.resolve('../static/capture-store.js'),'utf8'),context);
  const transact=context.window.MidnightCaptureStore.prototype.transact;
  let tx;const store={ready:Promise.resolve(),db:{transaction:()=>tx={}}};
  const write=transact.call(store,['items'],'readwrite',()=>{});await settle();assert.equal(events.length,0);tx.oncomplete();await write;
  assert.deepEqual(events,['midnight:captures-invalidated']);
  const draft=transact.call(store,['drafts'],'readwrite',()=>{});await settle();tx.oncomplete();await draft;assert.equal(events.length,1);
  const failed=transact.call(store,['items'],'readwrite',()=>{});await settle();tx.onabort();await assert.rejects(failed,/Local storage/);assert.equal(events.length,1);
});
