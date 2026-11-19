/* Shared native-dialog behavior. Capture storage and network integrations stay independent. */
'use strict';
window.MidnightUI = (() => {
  const closing = new WeakMap();
  let stack=[];
  const dialogs = () => [...document.querySelectorAll('dialog')];
  function sync() {
    const opened=dialogs().filter(dialog=>dialog.open);
    stack=stack.filter(dialog=>dialog.open);
    for(const dialog of opened)if(!stack.includes(dialog))stack.push(dialog);
    const open=stack;
    dialogs().forEach(dialog => dialog.classList.toggle('panelUnderlay', open.length > 1 && dialog !== open.at(-1) && dialog.open));
    window.dispatchEvent(new Event('midnight:dialogchange'));
  }
  function open(dialog) {
    const pending=closing.get(dialog);if(pending){closing.delete(dialog);pending.cancel();dialog.inert=false;}
    if (dialog.open) {if(stack.at(-1)===dialog)return;dialog.close();dialog.showModal();stack=stack.filter(panel=>panel!==dialog);stack.push(dialog);sync();return;}
    const previous = stack.filter(panel=>panel.open).at(-1);
    // Inbox → editor is a direct handoff. A capture shortcut over Settings keeps its form intact.
    const replace = previous?.id === 'inboxDialog' && dialog.id === 'captureDialog';
    dialog.dataset.arrival = replace ? 'handoff' : 'open';
    if (replace) previous.close();
    dialog.showModal();
    stack=stack.filter(panel=>panel!==dialog);stack.push(dialog);
    sync();
  }
  function close(dialog) {
    if (!dialog.open || closing.has(dialog)) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !dialog.animate) { dialog.close(); sync(); return; }
    dialog.inert = true;
    const animation = dialog.animate([{opacity:1,transform:getComputedStyle(dialog).transform},{opacity:0,transform:'translateY(10px) scale(.985)'}],{duration:160,easing:'ease-out'});
    closing.set(dialog,animation);
    animation.finished.catch(()=>{}).then(()=>{
      if(closing.get(dialog)!==animation)return;
      closing.delete(dialog); dialog.close(); dialog.inert=false; animation.cancel(); sync();
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    dialogs().forEach(dialog => {
      dialog.addEventListener('close', sync);
      dialog.addEventListener('cancel', event => { if (!event.defaultPrevented) { event.preventDefault(); close(dialog); } });
    });
    let offlineReady=true;
    const updateOffline = () => MidnightNotifications.offline(!navigator.onLine,offlineReady);
    addEventListener('online', updateOffline); addEventListener('offline', updateOffline); updateOffline();
    document.addEventListener('fullscreenchange', () => {
      const control = document.getElementById('fullscreen');
      control.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
      control.setAttribute('aria-pressed', String(!!document.fullscreenElement));
    });
    if ('serviceWorker' in navigator) {
      let hadController=!!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadController){hadController=true;return;}const button=document.getElementById('applyRelease');if(!button)return;button.hidden=false;MidnightNotifications.notify({id:'release-ready',message:'A Midnight update is ready.',actionLabel:'Reload safely',action:()=>button.click()});});
      document.getElementById('applyRelease').onclick=async()=>{try{if(window.MidnightCapture?.isSaving())return;await window.MidnightCapture?.flush();location.reload();}catch{document.getElementById('settingsMessage').textContent='The draft could not be committed. Keep this tab open and export a backup before reloading.';}};
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(() => {
      // Never claim offline readiness if the shell could not be installed.
      offlineReady=false;updateOffline();
    });
  });
  function rememberListFocus(list){
    const active=document.activeElement,row=active?.closest('[data-item-id]');
    if(!row||!list.contains(row))return ()=>{};
    const id=row.dataset.itemId,index=[...list.querySelectorAll('[data-item-id]')].indexOf(row),action=[...row.querySelectorAll('button')].indexOf(active);
    return ()=>{list.tabIndex=-1;const rows=[...list.querySelectorAll('[data-item-id]')],next=rows.find(r=>r.dataset.itemId===id)||rows[Math.min(index,rows.length-1)];(next?.querySelectorAll('button')[Math.max(0,action)]||next?.querySelector('button')||list).focus({preventScroll:true});};
  }
  return {open, close,rememberListFocus,top:()=>stack.filter(panel=>panel.open).at(-1)};
})();
