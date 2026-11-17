/* One floating surface for Search and the existing Capture composer. */
'use strict';
(() => {
 const $=id=>document.getElementById(id),registry=new MidnightCommandCore.Registry(),index=new MidnightCommandCore.SearchIndex();
 const dialog=$('captureDialog'),form=$('captureForm'),keyboard=$('captureKeyboard'),keyboardHome=keyboard.parentNode,keyboardNext=keyboard.nextSibling;
 let mode='capture',results=[],selected=0,generation=0,timer,busy=false,confirmation=null,usage={};
 try{usage=JSON.parse(localStorage.getItem('midnight-command-usage')||'{}');if(!usage||typeof usage!=='object'||Array.isArray(usage))usage={};}catch{}
 const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls||'';if(text!==undefined)el.textContent=text;return el;};
 const register=(id,title,type,icon,action,keywords=[],extra={})=>registry.register({id,title,type,icon,action,keywords,...extra});
 function setMode(next){
  if(MidnightCapture.isSaving())return;
  if(next==='search')MidnightCapture.stopVoice();mode=next;dialog.dataset.commandMode=next;
  $('commandSearchPane').hidden=next!=='search';form.hidden=next==='search';$('commandSearchMode').setAttribute('aria-pressed',String(next==='search'));$('commandCaptureMode').setAttribute('aria-pressed',String(next==='capture'));
  $('captureTitle').textContent=next==='search'?'Search':MidnightCapture.title();
  if(next==='search'){$('commandKeyboardSlot').append(keyboard);$('commandQuery').focus();search();}else{keyboardHome.insertBefore(keyboard,keyboardNext);$('captureText').focus();}
  MidnightCapture.applyKeyboard();
 }
 async function openSearch(){if(MidnightCapture.isSaving())return;try{await MidnightCapture.ready();await MidnightCapture.flush();}catch{}setMode('search');MidnightUI.open(dialog);$('commandQuery').focus();$('commandQuery').select();rebuild();}
 async function openCapture(){if(dialog.open&&mode==='search'){setMode('capture');return;}await MidnightCapture.open();}
 function confirm(text,action){confirmation=action;$('commandConfirmText').textContent=text;$('commandConfirmStatus').textContent='';$('commandConfirmRun').disabled=false;MidnightUI.open($('commandConfirmDialog'));}
 function closeConfirmation(){if($('commandConfirmRun').disabled)return;confirmation=null;MidnightUI.close($('commandConfirmDialog'));}
 $('commandConfirmClose').onclick=closeConfirmation;$('commandConfirmCancel').onclick=closeConfirmation;
 $('commandConfirmDialog').addEventListener('cancel',e=>{if($('commandConfirmRun').disabled)e.preventDefault();else confirmation=null;});
 $('commandConfirmRun').onclick=async()=>{if(!confirmation||$('commandConfirmRun').disabled)return;$('commandConfirmRun').disabled=true;try{await confirmation();confirmation=null;MidnightUI.close($('commandConfirmDialog'));}catch(e){$('commandConfirmStatus').textContent=e.message;}finally{$('commandConfirmRun').disabled=false;}};
 register('module:today','Open Tasks','Module','✓',()=>window.MidnightToday?.open(),['priorities','plan','due','next task']);
 register('module:calendar','Open Calendar','Module','▦',()=>window.MidnightCalendar?.open(),['events','schedule','classes']);
 register('module:inbox','Open Inbox','Module','▤',()=>MidnightCapture.openInbox(),['assignments','notes','tasks','reminders','ideas','show my assignments']);
 register('module:weather','Open Weather','Module','☁',()=>MidnightApp.openWeather(),['forecast','temperature']);
 register('module:news','Open Daily Read','Module','▧',()=>MidnightApp.reveal('news'),['news','rss']);
 register('module:capture','Create a note','Capture','＋',()=>MidnightCapture.open(null,{kind:'note'}),['capture','new note']);
 register('capture:task','Create a task','Capture','✓',()=>MidnightCapture.open(null,{kind:'task'}),['assignment','todo']);
 register('capture:idea','Capture an idea','Capture','✦',()=>MidnightCapture.open(null,{kind:'idea'}),['new idea']);
 register('capture:reminder','Create reminder','Capture','◷',()=>MidnightCapture.open(null,{kind:'reminder'}),['remind me','new reminder']);
 register('focus:start','Start focus timer','Action','◉',()=>MidnightApp.startFocus(),['concentrate','work','focus']);
 register('focus:custom','Set a custom timer','Action','◷',()=>MidnightApp.focus(),['duration','minutes','custom focus']);
 register('settings:all','Open Settings','Settings','⚙',()=>MidnightApp.openSettings(),['preferences','connections']);
 register('settings:theme','Change theme','Settings','◐',()=>MidnightApp.openSettings(),['appearance','color','font']);
 register('settings:calendar','Calendar settings','Settings','▦',()=>MidnightApp.openSettings('calendar'),['import','subscribe']);
 register('settings:room','Configure candle warmer','Settings','⌁',()=>MidnightApp.openSettings('room'),['device','smart home','kasa']);
 register('settings:news','News subscriptions','Settings','▧',()=>MidnightApp.openSettings('news'),['feeds','rss']);
 for(const on of [true,false])register('device:'+on,(on?'Turn on':'Turn off')+' candle warmer','Device','⏻',()=>confirm((on?'Turn on':'Turn off')+' the candle warmer?',async()=>{await MidnightApp.warmer(on);MidnightApp.toast('Candle warmer '+(on?'on':'off')+' · verified.');}),['smart home','power','lamp','kasa'],{subtitle:'Confirmation required · local device'});
 register('media:spotify','Open Spotify','Application','♫',()=>{const a=node('a');a.href='https://open.spotify.com/';a.target='_blank';a.rel='noopener noreferrer';a.click();},['music','media']);
 register('media:play','Play Spotify','Media','▶',()=>MidnightApp.media('play'),['resume music'],{available:()=>!!MidnightApp.snapshot().player});
 register('media:pause','Pause Spotify','Media','Ⅱ',()=>MidnightApp.media('pause'),['stop music'],{available:()=>!!MidnightApp.snapshot().player});
 async function rebuild(){
  const token=++generation;
  // Rebuild from current data when Search opens; closed panels need no index work.
  if(mode!=='search'||!dialog.open)return;
  const items=registry.list();const snapshot=MidnightApp.snapshot();
  if(snapshot.player?.title)items.push({id:'media:current',title:snapshot.player.title,type:'Media',icon:'♫',subtitle:snapshot.player.artist||'Current Spotify track',keywords:['spotify','music','now playing'],action:()=>MidnightApp.reveal('music')});
  for(const [i,event] of [...new Map([...snapshot.events,...(window.MidnightCalendar?.snapshot()||[])].map(event=>[event.title+'|'+event.start+'|'+event.end,event])).values()].entries())items.push({id:'event:'+i,title:event.title,type:'Calendar',icon:'▦',subtitle:new Date(event.start).toLocaleString()+(event.location?' · '+event.location:''),keywords:['event','class','schedule'],action:()=>MidnightApp.revealEvent(event)});
  try{for(const item of await MidnightCapture.all()){if(item.archived)continue;items.push({id:'capture:'+item.id,title:item.text.slice(0,140),type:item.kind,icon:item.done?'✓':item.kind==='reminder'?'◷':'▤',subtitle:item.done?'Completed':item.dueAt?new Date(item.dueAt).toLocaleString():'Saved in this browser',keywords:[item.text,item.kind,item.done?'done':''],action:()=>MidnightCapture.edit(item)});}}catch{}
  if(token!==generation)return;index.replace(items);if(mode==='search'&&dialog.open)search();
 }
 function search(){results=index.search($('commandQuery').value,{usage,context:[]});selected=0;render();}
 function render(){
  const target=$('commandResults');target.replaceChildren();$('commandStatus').textContent=results.length?results.length+' local result'+(results.length===1?'':'s'):'No matches. Try a different word, or switch to Capture to create something.';
  $('commandQuery').setAttribute('aria-expanded',String(!!results.length));
  results.forEach((result,i)=>{const row=node('div','commandResult');row.id='command-result-'+i;row.role='option';row.setAttribute('aria-selected',String(i===selected));const action=node('button','commandResultAction');action.type='button';action.tabIndex=-1;action.setAttribute('aria-label',result.title);const icon=node('span','commandResultIcon');const names={Module:result.id.includes('calendar')?'calendar':result.id.includes('weather')?'cloud':result.id.includes('news')?'news':'inbox',Settings:'settings',Capture:'note',Device:'device',Media:'music',Application:'music',Calendar:'calendar',note:'note',idea:'spark',task:'task',reminder:'reminder',Space:'space',Action:'focus'};icon.append(MidnightIcons.make(result.type==='Space'&&result.icon?MidnightIcons.spaceName(result.icon):names[result.type]||'search'));action.append(icon);const copy=node('span','commandResultCopy');copy.append(node('strong','',result.title),node('small','',result.type+(result.subtitle?' · '+result.subtitle:'')));const go=node('span','commandResultGo');go.append(MidnightIcons.make('enter'));action.append(copy,go);action.onclick=()=>execute(result);row.append(action);target.append(row);});syncSelection();
 }
 function syncSelection(){[...$('commandResults').children].forEach((row,i)=>row.setAttribute('aria-selected',String(i===selected)));if(results.length){$('commandQuery').setAttribute('aria-activedescendant','command-result-'+selected);$('commandResults').children[selected]?.scrollIntoView({block:'nearest'});}else $('commandQuery').removeAttribute('aria-activedescendant');}
 async function execute(result){if(busy)return;busy=true;$('commandStatus').textContent='Opening…';try{if(!result.id.startsWith('capture:')&&!['module:capture','module:inbox'].includes(result.id)){MidnightUI.close(dialog);}const registered=registry.entries.has(result.id);if(registered)await registry.execute(result.id);else await result.action();usage[result.id]=Math.min(100,(Number(usage[result.id])||0)+1);try{localStorage.setItem('midnight-command-usage',JSON.stringify(Object.fromEntries(Object.entries(usage).slice(-300))));}catch{}}catch(e){MidnightApp.toast(e.message,true);$('commandStatus').textContent=e.message;}finally{busy=false;}}
 $('commandOpen').onclick=openSearch;$('commandSearchMode').onclick=openSearch;$('commandCaptureMode').onclick=openCapture;
 $('commandQuery').oninput=()=>{clearTimeout(timer);timer=setTimeout(search,70);};$('commandQuery').onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();selected=Math.max(0,Math.min(results.length-1,selected+(e.key==='ArrowDown'?1:-1)));syncSelection();}if(e.key==='Enter'){e.preventDefault();if(results[selected])execute(results[selected]);}};
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&e.code==='KeyK'){e.preventDefault();openSearch();}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.code==='Space'){e.preventDefault();MidnightCapture.open();}});
 window.addEventListener('midnight:captureopen',()=>setMode('capture'));
 for(const event of ['midnight:data','midnight:captures','midnight:spaces','midnight:calendar-view'])window.addEventListener(event,rebuild);
 dialog.addEventListener('keydown',e=>{if(mode==='search'&&e.key==='Escape'){e.preventDefault();e.stopPropagation();MidnightUI.close(dialog);}});
 dialog.addEventListener('close',()=>{clearTimeout(timer);$('commandQuery').value='';});
 window.MidnightCommand={register(command){const remove=registry.register(command);rebuild();return()=>{remove();rebuild();};},get mode(){return mode;},openSearch,openCapture,confirm,registry,index,rebuild};rebuild();
})();
