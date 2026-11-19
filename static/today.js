/* Daily direction from existing local captures. No account, API or duplicate task store. */
'use strict';
(() => {
 const $=id=>document.getElementById(id),core=MidnightTodayCore;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 const button=(text,action,cls='smallButton')=>{const n=el('button',cls,text);n.type='button';n.onclick=action;return n;};
 let records=[],view='backlog',focusId=null,collapsed=false,request=0,busy=false,limit=8,lastDay=core.dayKey(new Date());
 try{focusId=localStorage.getItem('midnight-focus-task')||null;collapsed=false;}catch{}
 function status(text){$('todayStatus').textContent=text;}
 function setCollapsed(value){try{localStorage.setItem('midnight-today-collapsed',String(value));collapsed=value;drawCollapse();}catch{status('This display preference could not be saved.');}}
 function drawCollapse(){$('todayBody').hidden=collapsed;$('todayToggle').textContent=collapsed?'+':'−';$('todayToggle').setAttribute('aria-expanded',String(!collapsed));$('todayToggle').setAttribute('aria-label',collapsed?'Expand Today':'Collapse Today');}
 function open(){window.MidnightPanels?.open('tasks');setCollapsed(false);}

 async function refresh(){const token=++request;try{const next=await MidnightCapture.all();if(token!==request)return;records=next;render();}catch(e){status('Local tasks unavailable. '+e.message);}}
 async function update(item,changes,message){if(busy)return;busy=true;try{const ok=await MidnightCapture.update(item.id,changes);if(ok){status(message);await refresh();}else status('This change could not be saved. Try again.');}catch(e){status('This change could not be saved. '+e.message);}finally{busy=false;}}
 function selectView(value){view=value;limit=8;render();}
 function prioritize(item){const plan=core.plan(records);if(plan.priorities.some(i=>i.id===item.id))return update(item,{plannedFor:null,priorityOrder:null},'Removed from today’s priorities.');if(plan.priorities.length>=3){status('Three priorities is enough for now. Remove one to make room.');return;}return update(item,{plannedFor:plan.today,priorityOrder:Date.now()},'Added to today’s priorities.');}
 function rememberFocus(id){try{if(id)localStorage.setItem('midnight-focus-task',id);else localStorage.removeItem('midnight-focus-task');focusId=id;renderFocus();return true;}catch{status('Could not save the focused task. Your timer has not changed.');return false;}}
 function focus(item){if(!rememberFocus(item.id))return;MidnightApp.startFocus();status('Focus linked to this task. Complete it when you’re ready.');renderFocus();}
 function tomorrow(item){const next=new Date();next.setDate(next.getDate()+1);return update(item,{plannedFor:core.dayKey(next),priorityOrder:null},'Planned for tomorrow. Its original due date is kept.');}
 function taskRow(item,priority=false,completed=false){
  const row=el('article','todayTask'+(completed?' isDone':''));row.dataset.taskId=item.id;row.dataset.itemId=item.id;
  const done=button(completed?'✓':'',()=>update(item,{done:!item.done},completed?'Task reopened.':'Task completed. Open Done today to undo.'),'captureTaskToggle');done.setAttribute('aria-label',(completed?'Reopen ':'Complete ')+item.text.slice(0,80));done.setAttribute('aria-pressed',String(!!item.done));
  const copy=el('div','todayTaskCopy'),text=button(item.text,()=>MidnightCapture.edit(item),'todayTaskText');copy.append(text);
  const labels=[];if(item.dueAt){const due=new Date(item.dueAt);labels.push((due<Date.now()&&!completed?'Overdue · ':'Due · ')+due.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}));}
  if(!completed&&item.plannedFor&&item.plannedFor<core.dayKey(new Date()))labels.push('Carry over');
  if(!completed&&item.plannedFor>core.dayKey(new Date()))labels.push('Planned · '+new Date(item.plannedFor+'T12:00').toLocaleDateString([],{month:'short',day:'numeric'}));
  if(labels.length)copy.append(el('small',item.dueAt&&Date.parse(item.dueAt)<Date.now()&&!completed?'todayOverdue':'',labels.join(' · ')));
  const actions=el('div','todayTaskActions');
  if(!completed){
   const pin=button(priority?'★':'☆',()=>prioritize(item),'todayPin');pin.setAttribute('aria-label',(priority?'Remove priority ':'Prioritize ')+item.text.slice(0,80));pin.setAttribute('aria-pressed',String(priority));pin.title=priority?'Remove priority':'Make a priority';
   actions.append(pin,button('Focus',()=>focus(item)));
   if(!priority){const defer=button('Tomorrow',()=>tomorrow(item),'textButton');defer.setAttribute('aria-label','Plan for tomorrow: '+item.text.slice(0,80));actions.append(defer);}
  }
  row.append(done,copy,actions);return row;
 }
 function render(){
  const restorePriorities=MidnightUI.rememberListFocus($('todayPriorities')),restoreTasks=MidnightUI.rememberListFocus($('todayTasks'));
  const p=core.plan(records),priorities=$('todayPriorities');priorities.replaceChildren();
  $('todayTitle').textContent='Tasks';
  $('todaySummary').textContent=`${p.total} open${p.dueTotal?' · '+p.dueTotal+' due':''}`;
  $('priorityCount').textContent=p.priorities.length+' / 3';
  for(const item of p.priorities)priorities.append(taskRow(item,true));
  $('todayDueCount').textContent=p.dueTotal;$('todayBacklogCount').textContent=p.backlog.length+p.due.length;$('todayDoneCount').textContent=p.completed.length;
  document.querySelectorAll('[data-today-view]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.todayView===view)));
  const list=$('todayTasks'),items=view==='due'?p.due:view==='completed'?p.completed:[...p.due,...p.backlog];list.replaceChildren();
  if(!items.length)list.append(el('p','todayEmpty',view==='due'?'Nothing due.':view==='completed'?'No completed tasks today.':'No tasks yet.'));
  for(const item of items.slice(0,limit))list.append(taskRow(item,false,view==='completed'));
  if(items.length>limit)list.append(button(`Show more (${items.length-limit} remaining)`,()=>{limit+=20;render();},'smallButton todayShowMore'));
  restorePriorities();restoreTasks();renderEvent();renderFocus();drawCollapse();
 }
 function renderEvent(){
  if(window.MidnightWidgets?.renderAgenda)return;
  const snapshot=MidnightApp.snapshot(),now=Date.now(),target=$('todayNextEvent');target.replaceChildren();
  const events=[...new Map([...snapshot.events,...(window.MidnightCalendar?.snapshot()||[])].map(e=>[e.id||e.uid+'|'+e.title+'|'+e.start+'|'+e.end+'|'+(e.location||''),e])).values()];
  const next=events.filter(e=>Date.parse(e.end)>now||(!e.end&&Date.parse(e.start)>now)).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))[0];
  if(next){if(snapshot.calendarFailed)target.append(el('p','captureHint','Last saved calendar · refresh unavailable'));const date=new Date(next.start),ongoing=date<=now,when=core.dayKey(date)===core.dayKey(now)?'Today':date.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});const row=button('',()=>window.MidnightCalendar?.openEvent(next),'todayEvent');row.append(el('small','',ongoing?'Happening now':when+' · '+(next.all_day?'All day':date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))),el('strong','',next.title));if(next.location)row.append(el('span','',next.location));target.append(row);}
  else {target.append(el('p','todayEmpty',snapshot.calendarFailed?'Calendar unavailable.':snapshot.calendarLoaded?(snapshot.calendarConfigured?'No upcoming events.':'Your calendar, here.'):'Loading calendar…'));if(snapshot.calendarLoaded&&!snapshot.calendarConfigured)target.append(button('Connect calendar',()=>MidnightApp.openSettings('calendar'),'textButton'));}
 }
 function renderFocus(){
  if(!$('tasksPanel').open)return;
  const item=records.find(i=>i.id===focusId&&core.actionable(i));$('todayFocus').hidden=!item;if(!item)return;
  $('todayFocusText').textContent=item.text;
  const timer=MidnightApp.snapshot().focus,seconds=Math.ceil(timer.remaining/1000),time=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  $('todayPauseFocus').textContent=(timer.running?'Pause · ':timer.remaining===0?'Start again · ':'Resume · ')+time;
  $('todayPauseFocus').setAttribute('aria-label',timer.running?'Pause focus timer':'Start focus timer');
 }
 $('todayAdd').onclick=()=>MidnightCapture.open(null,{kind:'task'});$('todayToggle').onclick=()=>setCollapsed(!collapsed);
 $('todayInbox').onclick=()=>MidnightCapture.openInbox();$('todayCalendar').onclick=()=>window.MidnightCalendar?.open();
 $('todayPauseFocus').onclick=()=>$('focusStart').click();$('todayClearFocus').onclick=()=>rememberFocus(null);
 $('todayFinishFocus').onclick=()=>{const item=records.find(i=>i.id===focusId);if(item)update(item,{done:true},'Task completed. Your focus timer is still available.');};
 document.querySelectorAll('[data-today-view]').forEach(n=>n.onclick=()=>selectView(n.dataset.todayView));
 window.addEventListener('midnight:calendar-view',renderEvent);window.addEventListener('midnight:captures',refresh);window.addEventListener('midnight:data',renderEvent);window.addEventListener('midnight:focus',renderFocus);
 window.addEventListener('storage',e=>{if(e.key==='midnight-focus-task'){focusId=e.newValue;renderFocus();}if(e.key==='midnight-today-collapsed'){collapsed=e.newValue==='true';drawCollapse();}});
 MidnightActivity.every('task-day',()=>{const day=core.dayKey(new Date());if(lastDay!==day){lastDay=day;refresh();}},60000,{align:true});
 window.addEventListener('midnight:dialogchange',()=>{if($('tasksPanel').open)renderFocus();});
 window.MidnightToday={open,refresh};refresh();
})();
