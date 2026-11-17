/* Notifications own a fixed viewport region, never the dashboard layout or widget state. */
'use strict';
window.MidnightNotifications=(()=>{
 const $=id=>document.getElementById(id),dock=$('notificationDock'),panel=$('notificationPanel');
 const entries=[],dismissed=new Map();let selected=null,sequence=0,expiry=null,host=null,focusId=null;
 const priority={error:5,reminder:4,focus:3,suggestion:2,status:1,success:0};
 const icon={error:'reminder',reminder:'reminder',focus:'check',suggestion:'space',status:'cloud',success:'check'};
 const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls||'';if(text!==undefined)el.textContent=text;return el;};
 function panelOpen(){return typeof panel.showPopover==='function'?panel.matches(':popover-open'):!panel.hidden;}
 function closePanel(restoreFocus=false){if(typeof panel.hidePopover==='function'&&panelOpen())panel.hidePopover();panel.hidden=true;$('notificationToggle').setAttribute('aria-expanded','false');if(restoreFocus)$('notificationToggle').focus({preventScroll:true});}
 function attach(){
  const next=window.MidnightUI?.top()||document.body;if(next===host)return;
  const focused=document.activeElement,restore=focused&&focused!==document.body&&!dock.contains(focused);
  closePanel();if(typeof dock.hidePopover==='function'&&dock.matches(':popover-open'))dock.hidePopover();
  next.append(dock);host=next;if(typeof dock.showPopover==='function')dock.showPopover();
  if(restore&&focused.isConnected)focused.focus({preventScroll:true});
 }
 function current(){const value=entries.find(e=>e.id===selected&&!e.dismissed&&!e.expired);if(value)return value;return entries.filter(e=>e.persistent&&!e.dismissed).sort((a,b)=>(priority[b.kind]||0)-(priority[a.kind]||0)||b.time-a.time)[0]||null;}
 function render(){
  const entry=current();dock.dataset.active=String(!!entry);const count=entries.filter(e=>!e.read&&!e.dismissed).length;
  $('notificationToggle').title='Unread updates from this visit';$('notificationCount').textContent=count>99?'99+':String(count);$('notificationCount').hidden=!count;
  $('notificationToggle').setAttribute('aria-label','Notifications'+(count?', '+count+' unread updates':''));
  $('notificationLatest').dataset.notificationKind=entry?.kind||'idle';$('notificationLatestIcon').replaceChildren(MidnightIcons.make(entry?icon[entry.kind]||'reminder':'check'));
  $('notificationTitle').textContent=entry?.title||'';$('notificationTitle').hidden=!entry?.title;
  $('toast').textContent=entry?.message||'Nothing new';$('toast').title=entry?.message||'';
  $('notificationAction').hidden=!entry?.action;$('notificationAction').textContent=entry?.actionLabel||'Open';
  $('notificationDismiss').hidden=!entry;$('notificationDismiss').setAttribute('aria-label',entry?.title?'Dismiss '+entry.title:'Dismiss current notification');
  if(panelOpen())renderHistory();
 }
 function renderHistory(){
  const list=$('notificationList');list.replaceChildren();
  if(!entries.length)list.append(node('p','notificationEmpty','No notifications.'));
  for(const entry of [...entries].reverse()){
   const row=node('article','notificationRow'+(entry.dismissed?' notificationDismissed':''));
   const glyph=node('span','notificationRowIcon');glyph.append(MidnightIcons.make(icon[entry.kind]||'reminder'));
   const content=node('div','notificationRowContent'),heading=node('div','notificationRowHeading');
   heading.append(node('strong','',entry.title||(entry.kind==='error'?'Attention':'Update')),node('time','',new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(entry.time))));
   content.append(heading,node('p','',entry.message));
   if(entry.action&&!entry.dismissed){const action=node('button','textButton',entry.actionLabel||'Open');action.type='button';action.onclick=()=>run(entry);content.append(action);}
   if(entry.dismissed)content.append(node('span','notificationMeta','Dismissed'));
   row.append(glyph,content);list.append(row);
  }
 }
 function togglePanel(){
  if(panelOpen()){closePanel(true);return;}
  entries.forEach(e=>e.read=true);render();panel.hidden=false;renderHistory();
  if(typeof panel.showPopover==='function')panel.showPopover();$('notificationToggle').setAttribute('aria-expanded','true');
 }
 function dismiss(id){const entry=entries.find(e=>e.id===id);if(!entry)return;entry.dismissed=true;entry.read=true;dismissed.set(id,JSON.stringify([entry.kind,entry.title,entry.message]));if(dismissed.size>80)dismissed.delete(dismissed.keys().next().value);entry.onDismiss?.();if(selected===id)selected=null;render();}
 function run(entry){closePanel();entry.read=true;render();Promise.resolve().then(()=>entry.action?.()).catch(error=>notify({kind:'error',message:error.message||String(error)}));}
 function notify(options){
  const id=options.id||'notice-'+(++sequence),kind=options.kind||'success',message=String(options.message||'');
  if(dismissed.get(id)===JSON.stringify([kind,options.title||'',message]))return id;
  let entry=entries.find(e=>e.id===id);
  if(entry&&entry.message===message&&entry.kind===kind&&entry.title===(options.title||'')&&!entry.dismissed){entry.action=options.action;entry.actionLabel=options.actionLabel;return id;}
  if(entry)entries.splice(entries.indexOf(entry),1);
  entry={...options,id,kind,message,title:options.title||'',time:Date.now(),read:false,dismissed:false,expired:false};entries.push(entry);
  while(entries.length>40){const i=entries.findIndex(e=>!e.persistent);entries.splice(i<0?0:i,1);}
  selected=id;clearTimeout(expiry);render();
  $('notificationAnnouncer').textContent=kind==='error'?'':(entry.title?entry.title+'. ':'')+message;
  $('notificationErrorAnnouncer').textContent=kind==='error'?message:'';
  if(!entry.persistent)expiry=setTimeout(()=>{entry.expired=true;if(selected===id)selected=null;render();},kind==='error'?11000:6000);
  return id;
 }
 function resolve(id){const i=entries.findIndex(e=>e.id===id);if(i>=0)entries.splice(i,1);dismissed.delete(id);if(selected===id)selected=null;render();}
 function reminders(records,action){if(!records.length){resolve('reminders');return;}notify({id:'reminders',kind:'reminder',title:records.length+' reminder'+(records.length===1?'':'s')+' due',message:records[0].text.slice(0,180),persistent:true,actionLabel:'View reminders',action});}
 function suggestion(message,action,onDismiss){notify({id:'space-suggestion',kind:'suggestion',title:'Suggested Space',message,persistent:true,actionLabel:'Switch Space',action,onDismiss});}
 function offline(value,ready=true){$('notificationConnection').hidden=!value;if(value)notify({id:'offline',kind:'status',title:'Offline',message:ready?'Capture and Focus are available.':'Keep this tab open to use Capture and Focus.',persistent:true});else resolve('offline');}
 function focusComplete(){focusId=notify({kind:'focus',title:'Focus complete',message:'Your focus session is complete.',persistent:true});}
 function dismissFocus(){if(focusId)resolve(focusId);focusId=null;}
 $('notificationToggle').replaceChildren(MidnightIcons.make('reminder'),node('span','','Notifications'),$('notificationCount'));
 $('notificationDismiss').replaceChildren(MidnightIcons.make('close'));$('notificationPanelClose').replaceChildren(MidnightIcons.make('close'));
 $('notificationToggle').onclick=togglePanel;$('notificationPanelClose').onclick=()=>closePanel(true);
 $('notificationDismiss').onclick=()=>{const entry=current();if(entry)dismiss(entry.id);};$('notificationAction').onclick=()=>{const entry=current();if(entry)run(entry);};
 $('notificationClear').onclick=()=>{for(let i=entries.length-1;i>=0;i--)if(!entries[i].persistent||entries[i].dismissed)entries.splice(i,1);entries.forEach(e=>e.read=true);render();};
 document.addEventListener('pointerdown',e=>{if(panelOpen()&&!panel.contains(e.target)&&!$('notificationToggle').contains(e.target))closePanel();},true);
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePanel(true);}});
 dock.append($('notificationAnnouncer'),$('notificationErrorAnnouncer'));window.addEventListener('midnight:dialogchange',attach);attach();render();
 return {notify,resolve,reminders,suggestion,offline,focusComplete,dismissFocus,closePanel,dismiss,entries:()=>entries.map(({action,onDismiss,...entry})=>({...entry})),attach};
})();
