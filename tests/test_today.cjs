const test=require('node:test'),assert=require('node:assert/strict');
const {plan,dayKey,validateBackup}=require('../static/today-core.js');
const now=new Date(2026,10,17,12),stamp=now.toISOString();
const task=(id,extra={})=>({id,text:id,kind:'task',done:false,archived:false,createdAt:stamp,updatedAt:stamp,dueAt:null,...extra});
test('daily planning separates priorities, due work, carry-over and completed tasks',()=>{
 const p=plan([task('pin',{plannedFor:'2026-11-17'}),task('late',{dueAt:new Date(2026,10,16,9).toISOString()}),task('evening',{dueAt:new Date(2026,10,17,23).toISOString()}),task('carry',{plannedFor:'2026-11-16'}),task('future',{dueAt:new Date(2026,10,18,0).toISOString()}),task('done',{done:true,completedAt:stamp}),task('old-done',{done:true}),task('archive',{archived:true}),task('note',{kind:'note'})],now);
 assert.deepEqual(p.priorities.map(i=>i.id),['pin']);assert.deepEqual(p.due.map(i=>i.id),['late','evening']);assert.deepEqual(p.backlog.map(i=>i.id),['carry','future']);assert.deepEqual(p.completed.map(i=>i.id),['done']);assert.equal(p.total,5);
 assert.equal(plan([task('pin',{plannedFor:'2026-11-17'})],new Date(2026,10,18,0,1)).priorities.length,0);
});
test('local dates and DST boundaries keep tomorrow out of today',()=>{
 assert.equal(dayKey(new Date(2026,0,1,0,1)),'2026-01-01');
 assert.equal(plan([task('tomorrow',{dueAt:new Date(2026,10,2,0).toISOString()})],new Date(2026,10,1,1)).due.length,0);
});
test('existing backups preserve planning fields and ignore unknown properties',()=>{
 const b=validateBackup({format:'midnight-capture',version:1,items:[task('a',{plannedFor:'2026-11-17',completedAt:stamp,secret:'ignore'})],draft:{id:'new',text:'Draft',kind:'note',due:'',updatedAt:stamp}});
 assert.equal(b.items[0].plannedFor,'2026-11-17');assert.equal(b.items[0].secret,undefined);assert.equal(b.draft.text,'Draft');
});
test('invalid backups and duplicate IDs are rejected before any write',()=>{
 for(const bad of [{},{format:'midnight-capture',version:3,items:[]},{format:'midnight-capture',version:1,items:[task('a'),task('a')]},{format:'midnight-capture',version:1,items:[task('a',{dueAt:'bad'})]},{format:'midnight-capture',version:1,items:[task('a',{text:'a'.repeat(20001)})]},{format:'midnight-capture',version:1,items:[],draft:{text:'bad',kind:'bogus',due:''}}])assert.throws(()=>validateBackup(bad));
});
test('version 2 restores edited drafts and collections beyond the old 10,000 record limit',()=>{
 const items=Array.from({length:10001},(_,i)=>task('t'+i));const result=validateBackup({format:'midnight-capture',version:2,items,drafts:[{id:'t0',text:'Unfinished edit',kind:'task',due:'',updatedAt:stamp},{id:'new',text:'New draft',kind:'note',due:'',updatedAt:stamp}]});assert.equal(result.items.length,10001);assert.equal(result.drafts.length,2);assert.equal(result.drafts[0].id,'t0');
});
test('pinning a due task preserves the total due count',()=>{const item=task('due',{dueAt:new Date(2026,10,16).toISOString()});assert.equal(plan([item],now).dueTotal,1);const p=plan([{...item,plannedFor:'2026-11-17'}],now);assert.equal(p.due.length,0);assert.equal(p.dueTotal,1);});
