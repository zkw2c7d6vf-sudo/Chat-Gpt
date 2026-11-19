/* Keep original tool nodes and their state; only their position in the dock changes. */
'use strict';
window.MidnightToolbar=(()=>{
 const core=MidnightToolbarCore,KEY='midnight-toolbar-v1',$=id=>document.getElementById(id);
 const dock=document.querySelector('.bottomDock'),dialog=$('toolbarDialog'),originals=new Map(),stash=$('toolbarToolStash');
 let state=core.withDrivePresets(),draft=null,editing=null,details=null,permission=null,loadNotice='';
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const tool=id=>core.TOOLS.find(item=>item.id===id);
 try{const saved=localStorage.getItem(KEY);if(saved)state=core.withDrivePresets(JSON.parse(saved));}catch{loadNotice='Saved toolbar settings could not be read. Your default tools are available.';}
 for(const button of dock.querySelectorAll('[data-panel],#inboxOpen'))originals.set(button.id==='inboxOpen'?'inbox':button.dataset.panel,button);
 const triggers={capture:'captureOpen',search:'commandOpen',music:'musicMore',weather:'weatherMore',settings:'settingsBtn',fullscreen:'fullscreen',notifications:'notificationToggle'};
 for(const info of core.TOOLS)if(!originals.has(info.id)){
  const button=make('button');button.type='button';button.setAttribute('aria-label',info.label);button.append(MidnightIcons.make(info.icon),make('span','dockLabel',info.label));button.onclick=()=>$(triggers[info.id])?.click();originals.set(info.id,button);
 }
 const items=make('div','toolbarItems');items.id='toolbarItems';dock.querySelector('.dockDivider')?.remove();
 const edit=$('toolbarEdit');edit.onclick=open;
 for(const button of originals.values())stash.append(button);
 dock.replaceChildren(items);
 function websiteIcon(address){
  const url = new URL(address);
  const domain = url.hostname.replace(/^www\./, '');
  const youtube = domain === 'youtube.com' || domain.endsWith('.youtube.com') || domain === 'youtu.be';
  const slot = make('span', 'toolbarSiteIcon');
  slot.setAttribute('aria-hidden', 'true');
  const fallback = MidnightIcons.make(youtube ? 'music' : 'home');
  slot.append(fallback);
  const source = youtube ? 'https://www.youtube.com/favicon.ico'
    : domain === 'open.spotify.com' ? '/static/spotify-logo.png'
    : url.protocol === 'https:' ? url.origin + '/favicon.ico' : '';
  if (!source) return slot;
  const image = make('img');
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('load', () => { fallback.hidden = true; }, {once:true});
  image.addEventListener('error', () => image.remove(), {once:true});
  image.src = source;
  slot.append(image);
  return slot;
 }
 function render(){
  // Moving, rather than rebuilding, retains Inbox counts and the running Focus dot.
  for(const button of originals.values())stash.append(button);items.replaceChildren();dock.hidden=state.items.length===0;
  for(const item of state.items){
   if(item.type==='tool'){items.append(originals.get(item.id));continue;}
   const domain=new URL(item.url).hostname.replace(/^www\./,'');
   const label=/^youtube$/i.test(item.label)&&(domain==='youtu.be'||domain==='youtube.com'||domain.endsWith('.youtube.com'))?'YouTube':item.label;
   const anchor=make('a','toolbarWebsite');anchor.href=item.url;anchor.target='_blank';anchor.rel='noopener noreferrer';anchor.title=label+' · '+new URL(item.url).hostname;anchor.setAttribute('aria-label','Open '+label);
   const preset=core.DRIVE_PRESETS.find(value=>value.url===item.url);
   anchor.append(preset?MidnightIcons.make(preset.icon):websiteIcon(item.url),make('span','dockLabel',label));
   anchor.addEventListener('click',event=>{
    if(preset||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!state.secondDisplay)return;
    // No asynchronous permission prompt here: ordinary links retain new-tab behavior.
    if(core.openOnDisplay(item.url,details,window.open.bind(window)))event.preventDefault();
   });items.append(anchor);
  }
  window.dispatchEvent(new Event('midnight:toolbarchange'));
 }
 function message(text){$('toolbarStatus').textContent=text;}
 function resetForm(){editing=null;$('toolbarLinkName').value='';$('toolbarLinkUrl').value='';$('toolbarLinkSubmit').textContent='Add website';$('toolbarLinkCancel').hidden=true;$('toolbarLinkStatus').textContent='';}
 function open(){draft=core.normalize(state);resetForm();message(loadNotice);loadNotice='';$('toolbarSecondDisplay').checked=draft.secondDisplay;renderEditor();displayStatus();MidnightUI.open(dialog);dialog.scrollTop=0;}
 function smallAction(label,icon,action,disabled=false){const button=make('button','quiet');button.type='button';button.title=label;button.setAttribute('aria-label',label);button.disabled=disabled;button.append(MidnightIcons.make(icon));button.onclick=action;return button;}
 function renderEditor(focusId,focusAction){
  const previousScroll=$('toolbarOrder').scrollTop;
  const selected=new Set(draft.items.filter(item=>item.type==='tool').map(item=>item.id));$('toolbarToolChoices').replaceChildren();
  for(const info of core.TOOLS){
   const label=make('label','toolbarToolChoice'),input=make('input');input.type='checkbox';input.checked=selected.has(info.id);input.dataset.tool=info.id;input.addEventListener('change',()=>{
    if(input.checked){if(draft.items.length>=100){input.checked=false;message('Your toolbar can hold up to 100 shortcuts.');return;}draft.items.push({type:'tool',id:info.id});}
    else draft.items=draft.items.filter(item=>item.type!=='tool'||item.id!==info.id);
    renderEditor(info.id,'choice');
   });label.append(input,MidnightIcons.make(info.icon),make('span','',info.label));$('toolbarToolChoices').append(label);
  }
  const list=$('toolbarOrder');list.replaceChildren();
  if(!draft.items.length)list.append(make('li','toolbarEmpty','Choose a tool or add a website below. You can reopen the editor in Settings.'));
  draft.items.forEach((item,index)=>{
   const info=item.type==='tool'?tool(item.id):item,row=make('li','toolbarOrderRow');row.dataset.item=item.id;
   const copy=make('div','toolbarOrderCopy');copy.append(make('strong','',info.label));if(item.type==='link')copy.append(make('span','',new URL(item.url).hostname));
   const controls=make('div','toolbarRowActions');
   const move=delta=>{[draft.items[index],draft.items[index+delta]]=[draft.items[index+delta],draft.items[index]];renderEditor(item.id,delta<0?'up':'down');};
   const up=smallAction('Move '+info.label+' earlier','up',()=>move(-1),index===0);up.dataset.action='up';
   const down=smallAction('Move '+info.label+' later','down',()=>move(1),index===draft.items.length-1);down.dataset.action='down';controls.append(up,down);
   if(item.type==='link')controls.append(smallAction('Edit '+info.label,'edit',()=>{editing=item.id;$('toolbarLinkName').value=item.label;$('toolbarLinkUrl').value=item.url;$('toolbarLinkSubmit').textContent='Update website';$('toolbarLinkCancel').hidden=false;$('toolbarLinkCancel').textContent='Cancel edit';$('toolbarLinkStatus').textContent='';$('toolbarLinkName').focus();}));
   controls.append(smallAction('Remove '+info.label,'close',()=>{draft.items.splice(index,1);if(editing===item.id)resetForm();renderEditor();const next=$('toolbarOrder').querySelector('button:not(:disabled)')||$('toolbarLinkName');next.focus();}));
   row.append(item.type==='tool'?MidnightIcons.make(info.icon):websiteIcon(item.url),copy,controls);list.append(row);
  });
  list.scrollTop=previousScroll;
  if(focusId){const target=focusAction==='choice'?[...$('toolbarToolChoices').querySelectorAll('input')].find(input=>input.dataset.tool===focusId):[...list.querySelectorAll('li')].find(row=>row.dataset.item===focusId)?.querySelector(`[data-action="${focusAction}"]:not(:disabled),[data-action]:not(:disabled)`);target?.focus({preventScroll:true});}
 }
 $('toolbarLinkForm').addEventListener('submit',event=>{
  event.preventDefault();if(!draft)return;
  try{
   if(!editing&&draft.items.length>=100)throw new Error('Your toolbar can hold up to 100 shortcuts.');
   const id=editing||'link:'+(crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
   const item=core.link(id,$('toolbarLinkName').value,$('toolbarLinkUrl').value);
   if(editing){const index=draft.items.findIndex(value=>value.id===editing);if(index>=0)draft.items[index]=item;}else draft.items.push(item);
   const updated=!!editing;resetForm();renderEditor();$('toolbarLinkStatus').textContent=updated?'Website updated in your selection. Save toolbar to keep it.':'Website added to your selection. Save toolbar to keep it.';$('toolbarLinkName').focus();
  }catch(error){$('toolbarLinkStatus').textContent=error.message;$('toolbarLinkCancel').hidden=false;$('toolbarLinkCancel').textContent=editing?'Cancel edit':'Clear';$('toolbarLinkUrl').focus();}
 });
 $('toolbarLinkCancel').onclick=resetForm;
 for(const id of ['toolbarLinkName','toolbarLinkUrl'])$(id).addEventListener('input',()=>{$('toolbarLinkCancel').hidden=!editing&&!$('toolbarLinkName').value&&!$('toolbarLinkUrl').value;$('toolbarLinkCancel').textContent=editing?'Cancel edit':'Clear';});
 $('toolbarClose').onclick=()=>MidnightUI.close(dialog);$('toolbarCancel').onclick=()=>MidnightUI.close(dialog);
 $('toolbarSave').onclick=()=>{
  if(!draft)return;
  if($('toolbarLinkName').value.trim()||$('toolbarLinkUrl').value.trim()){message('Add or update the website first, or cancel its edit, before saving.');$('toolbarLinkSubmit').focus();return;}
  const next=core.normalize({...draft,secondDisplay:$('toolbarSecondDisplay').checked});
  try{localStorage.setItem(KEY,JSON.stringify(next));}catch{message('Could not save on this browser. Your selection is still here; free browser storage and try again.');return;}
  state=next;render();MidnightUI.close(dialog);
 };
 $('toolbarReset').onclick=()=>{draft=core.withDrivePresets();resetForm();$('toolbarSecondDisplay').checked=draft.secondDisplay;renderEditor();message('Default tools selected. Save toolbar to keep this change.');};
 $('toolbarSecondDisplay').onchange=()=>{draft.secondDisplay=$('toolbarSecondDisplay').checked;displayStatus();};
 function displayStatus(text){
  const enabled=draft?.secondDisplay??state.secondDisplay,supported=typeof window.getScreenDetails==='function';
  $('toolbarDisplayEnable').hidden=!supported||!enabled||!!details;
  $('toolbarDisplayStatus').textContent=text||(!enabled?'Websites open in a new tab.':!supported?'This browser opens websites in a new tab. Display placement is available in supported Chrome and Edge browsers.':details?(core.otherScreen(details)?'Ready. Websites open in a separate window on the other display.':'One display connected. Websites open in a new tab; connect another display to use it.'):'Enable display access once to open websites on your other monitor. Until then, they open in a new tab.');
 }
 async function readDisplays(){
  const value=await window.getScreenDetails();if(permission&&permission.state==='denied'){details=null;displayStatus();return;}
  details=value;details.addEventListener?.('screenschange',()=>displayStatus());details.addEventListener?.('currentscreenchange',()=>displayStatus());displayStatus();
 }
 $('toolbarDisplayEnable').onclick=async()=>{try{await readDisplays();}catch{details=null;displayStatus('Display access was unavailable or declined. Websites will open in a new tab. You can change this permission in your browser’s site settings.');}};
 async function restoreDisplayAccess(){
  if(typeof window.getScreenDetails!=='function'||!navigator.permissions?.query)return;
  try{permission=await navigator.permissions.query({name:'window-management'});permission.addEventListener?.('change',()=>{details=null;if(permission.state==='granted')readDisplays().catch(()=>displayStatus());else displayStatus();});if(permission.state==='granted'&&state.secondDisplay)await readDisplays();}catch{details=null;}
 }
 window.addEventListener('storage',event=>{if(event.key!==KEY)return;try{state=core.withDrivePresets(event.newValue?JSON.parse(event.newValue):undefined);render();if(dialog.open)message('The saved toolbar changed in another tab. Save to keep your current selection, or Cancel to use that toolbar.');}catch{}});
 render();restoreDisplayAccess();
 return {open};
})();
