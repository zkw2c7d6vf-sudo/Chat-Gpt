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
 for(const bad of [{},{format:'midnight-capture',version:2,items:[]},{format:'midnight-capture',version:1,items:[task('a'),task('a')]},{format:'midnight-capture',version:1,items:[task('a',{dueAt:'bad'})]},{format:'midnight-capture',version:1,items:[task('a',{text:'a'.repeat(20001)})]},{format:'midnight-capture',version:1,items:[],draft:{text:'bad',kind:'bogus',due:''}}])assert.throws(()=>validateBackup(bad));
});
