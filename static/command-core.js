/* Dependency-free local search, command registry and conservative capture interpretation. */
(function(root){
 'use strict';
 const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 function distance(a,b){if(Math.abs(a.length-b.length)>2)return 3;let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1)));row=next;}return row[b.length];}
 const prepare=item=>({title:normalize(item.title),words:[...new Set(normalize([item.title,item.subtitle,...(item.keywords||[])].join(' ')).split(' '))]});
 function preparedScore(q,{title,words}){if(!q)return 1;let total=title===q?1000:title.startsWith(q)?450:title.includes(q)?300:0;for(const token of q.split(' ')){let best=0;for(const word of words){if(word===token){best=80;break;}else if(word.startsWith(token))best=Math.max(best,50);else if(best<25&&token.length>=3&&distance(token,word)<=(token.length>5?2:1))best=25;}if(!best)return 0;total+=best;}return total;}
 function score(query,item){return preparedScore(normalize(query),prepare(item));}
 class Registry {
  constructor(){this.entries=new Map();this.busy=new Set();}
  register(command){if(!command.id||typeof command.action!=='function')throw new Error('Commands need an id and action.');this.entries.set(command.id,command);return()=>this.entries.delete(command.id);}
  list(){return [...this.entries.values()].filter(item=>!item.available||item.available());}
  async execute(id){const command=this.entries.get(id);if(!command)throw new Error('This command is no longer available.');if(this.busy.has(id))return false;this.busy.add(id);try{await command.action();return true;}finally{this.busy.delete(id);}}
 }
 class SearchIndex {
  constructor(){this.items=[];this.prepared=[];}
  replace(items){this.items=items.map(item=>({...item,keywords:[...(item.keywords||[])]}));this.prepared=this.items.map(prepare);}
  search(query,{usage={},context=[]}={}){const q=normalize(query);return this.items.map((item,i)=>({item,relevance:preparedScore(q,this.prepared[i])})).filter(r=>r.relevance>0).map(({item,relevance})=>({...item,relevance:relevance+Math.min(20,(Number.isFinite(Number(usage[item.id]))?Math.max(0,Number(usage[item.id])):0)*2)+(context.includes(item.type)?5:0)})).sort((a,b)=>b.relevance-a.relevance||a.title.localeCompare(b.title)).slice(0,40);}
 }
 function parseCapture(text,now=new Date()){
  const value=text.trim();let kind=null,due=null;
  if(/^idea\s*:/i.test(value))kind='idea';else if(/^note\s*:/i.test(value))kind='note';else if(/^remind\s+me\b/i.test(value))kind='reminder';else if(/^(task\s*:|need to\b|todo\s*:)/i.test(value))kind='task';
  if(kind==='reminder'){
   const date=new Date(now),dateMatch=value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);let found=false;
   if(dateMatch){date.setFullYear(+dateMatch[1],+dateMatch[2]-1,+dateMatch[3]);found=date.getFullYear()===+dateMatch[1]&&date.getMonth()===+dateMatch[2]-1&&date.getDate()===+dateMatch[3];}
   else if(/\btomorrow\b/i.test(value)){date.setDate(date.getDate()+1);found=true;}
   else if(/\btoday\b/i.test(value))found=true;
   else{const day=value.match(/\b(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);if(day){let delta=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(day[1].toLowerCase())-date.getDay();if(delta<=0)delta+=7;date.setDate(date.getDate()+delta);found=true;}}
   if(found){let h=9,m=0;const clock=value.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);if(clock){h=+clock[1];m=+(clock[2]||0);if(clock[3]){if(h<1||h>12)return {kind,due:null,needsDate:true};h=h%12+(clock[3].toLowerCase()==='pm'?12:0);}if(h>23||m>59)return {kind,due:null,needsDate:true};}date.setHours(h,m,0,0);due=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;}
  }
  return kind?{kind,due,needsDate:kind==='reminder'&&!due}:null;
 }
 const api={normalize,distance,score,Registry,SearchIndex,parseCapture};root.MidnightCommandCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
