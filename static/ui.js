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
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(() => {
      // Never claim offline readiness if the shell could not be installed.
      offlineReady=false;updateOffline();
    });
  });
  return {open, close,top:()=>stack.filter(panel=>panel.open).at(-1)};
})();
