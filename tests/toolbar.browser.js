/* Browser integration checks; inject only into an isolated page with mocked integrations. */
'use strict';
window.toolbarChecks=(async()=>{
 const $=id=>document.getElementById(id),checks=[];
 function check(value,message){if(!value)throw new Error(message);checks.push(message);}
 async function until(fn){const end=Date.now()+3000;while(!fn()){if(Date.now()>end)throw new Error('Timed out waiting for UI');await new Promise(resolve=>setTimeout(resolve,25));}}
 const close=async id=>{MidnightUI.close($(id));await until(()=>!$(id).open);};
 const add=(label,url)=>{$('toolbarLinkName').value=label;$('toolbarLinkUrl').value=url;$('toolbarLinkForm').requestSubmit();};
 const saved=()=>JSON.parse(localStorage.getItem('midnight-toolbar-v1'));
 const current=()=>[...$('toolbarItems').children];
 try{
  localStorage.removeItem('midnight-toolbar-v1');window.dispatchEvent(new StorageEvent('storage',{key:'midnight-toolbar-v1',newValue:null}));
  const openEditor=()=>{if(!$('settingsDialog').open)$('settingsBtn').click();$('toolbarEdit').closest('details').open=true;$('toolbarEdit').click();};
  check(!$('toolbarEdit').closest('.bottomDock'),'Edit lives in Settings');
  openEditor();check($('toolbarDialog').open,'Edit opens a popup');check($('notificationDock').hidden,'Notifications stay hidden in toolbar editor');
  check($('toolbarDialog').scrollTop===0,'Editor opens at its tool selection');
  const inbox=$('inboxOpen'),dot=$('dockFocusDot');
  document.querySelector('[data-tool="room"]').click();document.querySelector('[data-tool="inbox"]').click();
  add('Example','example.com/path');check($('toolbarLinkUrl').value==='','Valid website is accepted');
  const websiteRow=[...$('toolbarOrder').children].find(row=>row.textContent.includes('Example'));
  websiteRow.querySelector('[data-action="up"]').click();
  $('toolbarSave').click();await until(()=>!$('toolbarDialog').open);
  check(!current().includes(inbox)&&inbox.isConnected,'Hidden Inbox keeps its original state and integration node');
  check($('dockFocusDot')===dot,'Reordering retains the running-focus indicator');
  check(saved().items.at(-2).type==='link','Saved shortcuts retain the selected order');
  const website=document.querySelector('.toolbarWebsite[href="https://example.com/path"]');check(website.href==='https://example.com/path'&&website.target==='_blank'&&website.rel.includes('noopener'),'Website fallback is a safe new-tab link');
  openEditor();document.querySelector('[data-tool="capture"]').click();$('toolbarCancel').click();await until(()=>!$('toolbarDialog').open);
  check(!saved().items.some(item=>item.id==='capture'),'Cancel leaves the saved toolbar unchanged');
  openEditor();add('Unsafe','javascript:alert(1)');check($('toolbarLinkUrl').value==='javascript:alert(1)'&&$('toolbarLinkStatus').textContent.includes('http'),'Invalid URLs retain the input and explain the problem');check(!$('toolbarLinkCancel').hidden,'Invalid website input exposes a clear action without discarding the toolbar selection');$('toolbarLinkCancel').click();
  // A second opening after rejection starts from the unchanged saved state.
  await close('toolbarDialog');openEditor();
  const editButton=[...$('toolbarOrder').querySelectorAll('button')].find(button=>button.getAttribute('aria-label')==='Edit Example');editButton.click();
  check($('toolbarLinkName').value==='Example'&&$('toolbarLinkUrl').value==='https://example.com/path','Existing website shortcuts can be edited');
  $('toolbarLinkName').value='Updated website';$('toolbarLinkUrl').value='https://example.org';$('toolbarLinkForm').requestSubmit();
  const originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='midnight-toolbar-v1')throw new Error('Quota exceeded');return originalSet.call(this,key,value);};
  try{$('toolbarSave').click();check($('toolbarDialog').open&&$('toolbarStatus').textContent.includes('Could not save'),'Storage failure leaves the editor and selection intact');check(saved().items.some(item=>item.label==='Example'),'Failed saves do not change the saved toolbar');}finally{Storage.prototype.setItem=originalSet;}
  $('toolbarSave').click();await until(()=>!$('toolbarDialog').open);check(saved().items.some(item=>item.label==='Updated website'&&item.url==='https://example.org/'),'Edited websites persist after a successful save');
  // Permission and screen details are synthetic, never the user's real display permission.
  await until(()=>window.toolbarMockDetails!==undefined);openEditor();if(!$('toolbarDisplayEnable').hidden){$('toolbarDisplayEnable').click();await until(()=>$('toolbarDisplayEnable').hidden);}await close('toolbarDialog');
  const clickWebsite=()=>{const link=document.querySelector('.toolbarWebsite[href="https://example.org/"]');let intercepted;link.addEventListener('click',event=>{intercepted=event.defaultPrevented;event.preventDefault();},{once:true});link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));return intercepted;};
  window.testOpenCalls.length=0;window.toolbarMockDetails.screens=[window.toolbarMockInternal];check(!clickWebsite()&&window.testOpenCalls.length===0,'One display leaves the regular new-tab navigation intact');
  window.toolbarMockDetails.screens=[window.toolbarMockInternal,window.toolbarMockExternal];check(clickWebsite()&&window.testOpenCalls.length===1,'Two synthetic displays open exactly one placed website window');check(window.testOpenCalls[0][2].includes('left=-1920'),'Monitor coordinates support a screen left of Midnight');check(window.testLastWebsite==='https://example.org/','The placed window navigates to the selected website');
  window.toolbarMockDetails.screens=[window.toolbarMockInternal];check(!clickWebsite(),'Disconnecting a display restores new-tab behavior immediately');
  inbox.click();await until(()=>$('inboxDialog').open);check($('notificationDock').hidden,'Original Inbox still opens when removed from the toolbar');await close('inboxDialog');
  $('captureOpen').click();await until(()=>$('captureDialog').open);$('captureText').value='Toolbar regression draft';$('captureText').dispatchEvent(new Event('input',{bubbles:true}));await close('captureDialog');$('captureOpen').click();await until(()=>$('captureDialog').open);check($('captureText').value==='Toolbar regression draft','Opening tools preserves Capture drafts');await close('captureDialog');
  openEditor();$('toolbarReset').click();$('toolbarSave').click();await until(()=>!$('toolbarDialog').open);check(current().includes(inbox)&&saved().items.length===MidnightToolbarCore.withDrivePresets().items.length,'Restore defaults brings back the original tool nodes');
  check(new Set([...document.querySelectorAll('[id]')].map(el=>el.id)).size===document.querySelectorAll('[id]').length,'Toolbar editing creates no duplicate element IDs');
  window.toolbarTestResult={ok:true,checks};
 }catch(error){window.toolbarTestResult={ok:false,checks,error:error.stack||error.message};}
 document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
 const result=document.createElement('aside');result.id='toolbarTestResult';result.setAttribute('role','status');result.textContent=window.toolbarTestResult.ok?'PASS: '+checks.length+' toolbar browser checks.':'FAIL: '+window.toolbarTestResult.error;
 document.body.append(result);return window.toolbarTestResult;
})();
