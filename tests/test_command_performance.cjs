const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../static/command-core.js');
const settle=()=>new Promise(setImmediate);

function commandContext() {
  const nodes=new Map(),listeners=new Map();let reads=0,replacements=0,items=[],read=async()=>items;
  class Element {
    value='';children=[];dataset={};open=false;parentNode={insertBefore(){}};events=new Map();
    append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
    setAttribute(){}removeAttribute(){}focus(){}select(){}scrollIntoView(){}
    addEventListener(type,fn){this.events.set(type,fn);}
  }
  const byId=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  class Index extends core.SearchIndex {replace(items){replacements++;super.replace(items);}}
  const context=vm.createContext({window:{addEventListener:(type,fn)=>listeners.set(type,fn)},document:{getElementById:byId,createElement:()=>new Element(),addEventListener(){}},
    MidnightCommandCore:{...core,SearchIndex:Index},MidnightCapture:{isSaving:()=>false,ready:async()=>{},flush:async()=>{},applyKeyboard(){},stopVoice(){},all:()=>{reads++;return read();}},
    MidnightApp:{snapshot:()=>({events:[]})},MidnightUI:{open:el=>el.open=true,close:el=>{el.open=false;el.events.get('close')?.();}},
    MidnightIcons:{make:()=>new Element()},localStorage:{getItem:()=>null},setTimeout,clearTimeout,Date,Map,JSON});
  vm.runInContext(fs.readFileSync(require.resolve('../static/command.js'),'utf8'),context);
  return {byId,api:context.window.MidnightCommand,dispatch:type=>listeners.get(type)?.(),get reads(){return reads;},get replacements(){return replacements;},setItems(value){items=value;},setRead(fn){read=fn;}};
}
const item=text=>({id:text,text,kind:'note',createdAt:'2026-11-17T12:00:00Z'});

test('prepared search keeps exact, prefix, typo, accent and usage ranking identical',()=>{
  function originalScore(query,item){
    const q=core.normalize(query),title=core.normalize(item.title),words=core.normalize([item.title,item.subtitle,...(item.keywords||[])].join(' ')).split(' ');
    if(!q)return 1;let total=title===q?1000:title.startsWith(q)?450:title.includes(q)?300:0;
    for(const token of q.split(' ')){let best=0;for(const word of words){if(word===token)best=Math.max(best,80);else if(word.startsWith(token))best=Math.max(best,50);else if(token.length>=3&&core.distance(token,word)<=(token.length>5?2:1))best=Math.max(best,25);}if(!best)return 0;total+=best;}
    return total;
  }
  const titles=['Calendar','Calendar settings','Classroom observation','Reading lesson','Café planning','Reminder for tomorrow','Focus timer'];
  const items=Array.from({length:100},(_,i)=>({id:String(i),title:titles[i%titles.length],type:i%2?'note':'Module',keywords:['school task assignment calendar teaching school task'],subtitle:'Saved in this browser'}));
  const index=new core.SearchIndex();index.replace(items);const usage={0:100,1:'malformed',2:-4,3:5},context=['Module'];
  for(const query of ['', 'CALENDAR','calendr','cal','classrom teaching','cafe','reading lesson','task school','saved browser','zzzz no match']){
    const expected=items.map(item=>({...item,relevance:originalScore(query,item)})).filter(item=>item.relevance>0).map(item=>({...item,relevance:item.relevance+Math.min(20,(Number.isFinite(Number(usage[item.id]))?Math.max(0,Number(usage[item.id])):0)*2)+(context.includes(item.type)?5:0)})).sort((a,b)=>b.relevance-a.relevance||a.title.localeCompare(b.title)).slice(0,40).map(item=>[item.id,item.relevance]);
    assert.deepEqual(index.search(query,{usage,context}).map(item=>[item.id,item.relevance]),expected,query);
  }
  index.replace([{id:'fresh',title:'New content'}]);assert.equal(index.search('calendar').length,0);assert.equal(index.search('new')[0].id,'fresh');
});

test('closed Search defers indexing; opening and live edits expose the current captures',async()=>{
  const app=commandContext();await settle();app.setItems([item('Newest note')]);
  for(let i=0;i<120;i++)app.dispatch('midnight:captures');await settle();assert.equal(app.reads,0);assert.equal(app.replacements,0);
  await app.api.openSearch();await settle();assert.equal(app.reads,1);assert.ok(app.api.index.search('Newest').some(row=>row.title==='Newest note'));
  app.setItems([item('Edited note')]);app.dispatch('midnight:captures');await settle();assert.ok(app.api.index.search('Edited').some(row=>row.title==='Edited note'));
});

test('an obsolete index rebuild cannot replace newer results or publish after Search closes',async()=>{
  const app=commandContext();await app.api.openSearch();await settle();const pending=[];
  app.setRead(()=>new Promise(resolve=>pending.push(resolve)));app.dispatch('midnight:captures');app.dispatch('midnight:captures');
  pending[1]([item('Current')]);await settle();pending[0]([item('Obsolete')]);await settle();
  assert.ok(app.api.index.search('Current').some(row=>row.title==='Current'));assert.ok(!app.api.index.search('Obsolete').length);
  app.dispatch('midnight:captures');app.byId('captureDialog').open=false;app.dispatch('midnight:captures');
  const count=app.replacements;pending[2]([item('Closed')]);await settle();assert.equal(app.replacements,count);
});
