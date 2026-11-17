/* Pure local planning rules shared by the UI and deterministic tests. */
(function(root){
 'use strict';
 const dayKey=value=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const actionable=item=>!item.archived&&!item.done&&['task','reminder'].includes(item.kind);
 function plan(items,now=new Date()){
  const today=dayKey(now),tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);tomorrow.setHours(0,0,0,0);
  const open=items.filter(actionable),priorities=open.filter(i=>i.plannedFor===today).sort((a,b)=>(a.priorityOrder||0)-(b.priorityOrder||0));
  const priorityIds=new Set(priorities.map(i=>i.id));
  const due=open.filter(i=>i.dueAt&&Date.parse(i.dueAt)<tomorrow.getTime()&&!priorityIds.has(i.id)).sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
  const used=new Set([...priorities,...due].map(i=>i.id));
  const backlog=open.filter(i=>!used.has(i.id)).sort((a,b)=>{
   const ap=a.plannedFor&&a.plannedFor<=today?0:1,bp=b.plannedFor&&b.plannedFor<=today?0:1;
   return ap-bp||(Date.parse(a.dueAt)||Infinity)-(Date.parse(b.dueAt)||Infinity)||a.createdAt.localeCompare(b.createdAt);
  });
  const completed=items.filter(i=>!i.archived&&i.done&&i.completedAt&&dayKey(i.completedAt)===today);
  return {today,priorities,due,backlog,completed,total:open.length};
 }
 function validateBackup(value){
  if(!value||value.format!=='midnight-capture'||value.version!==1||!Array.isArray(value.items)||value.items.length>10000)throw new Error('Choose a Midnight capture backup (version 1, up to 10,000 captures).');
  const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
  const ids=new Set();
  const items=value.items.map(item=>{
   if(!item||typeof item.id!=='string'||!item.id||item.id.length>100||ids.has(item.id)||!['note','task','idea','reminder'].includes(item.kind)||typeof item.text!=='string'||!item.text.trim()||item.text.length>20000||!date(item.createdAt)||!date(item.updatedAt)||(item.dueAt!=null&&!date(item.dueAt))||typeof item.done!=='boolean'||typeof item.archived!=='boolean')throw new Error('This backup contains an invalid or duplicate capture. Nothing was imported.');
   ids.add(item.id);
   const clean={id:item.id,text:item.text,kind:item.kind,createdAt:item.createdAt,updatedAt:item.updatedAt,dueAt:item.dueAt||null,done:item.done,archived:item.archived};
   if(typeof item.plannedFor==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(item.plannedFor))clean.plannedFor=item.plannedFor;
   if(Number.isFinite(item.priorityOrder))clean.priorityOrder=item.priorityOrder;
   if(date(item.completedAt))clean.completedAt=item.completedAt;
   return clean;
  });
  const d=value.draft;let draft=null;
  if(d!=null){if(typeof d.text!=='string'||d.text.length>20000||!['note','task','idea','reminder'].includes(d.kind)||typeof d.due!=='string'||d.due.length>40)throw new Error('The saved draft is invalid. Nothing was imported.');draft={id:'new',text:d.text,kind:d.kind,due:d.due,updatedAt:date(d.updatedAt)?d.updatedAt:new Date().toISOString()};}
  return {items,draft};
 }
 const api={dayKey,actionable,plan,validateBackup};root.MidnightTodayCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
