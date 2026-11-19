/* The home stays quiet. Tools retain their own local state in floating panels. */
'use strict';
window.MidnightPanels=(()=>{
 const routes={tasks:'tasksPanel',focus:'focusPanel',room:'roomPanel',news:'newsPanel',files:'fileToolsPanel',sounds:'soundsPanel'};
 function open(name){if(name==='calendar'){window.MidnightCalendar?.open();return;}const panel=document.getElementById(routes[name]);if(panel)MidnightUI.open(panel);}
 function reveal(id){const name={todayPanel:'tasks',focusWidget:'focus',room:'room',news:'news',agenda:'calendar'}[id];if(!name)return false;open(name);return true;}
 const warmer=document.querySelector('.bottomDock [data-panel="room"]');
 function syncWarmer() {
  const on=window.MidnightApp?.warmerState();
  warmer.dataset.state=on==null?'unknown':on?'on':'off';
  if (on==null) warmer.removeAttribute('aria-pressed');
  else warmer.setAttribute('aria-pressed', String(on));
  warmer.setAttribute('aria-label', on==null?'Candle warmer state unknown · check and toggle':on?'Turn off candle warmer':'Turn on candle warmer');
 }
 addEventListener('midnight:warmer',syncWarmer);
 document.querySelectorAll('[data-panel]').forEach(button=>{
  if (button!==warmer) button.onclick=()=>open(button.dataset.panel);
 });
 warmer.onclick=async()=>{
  if (warmer.disabled) return;
  warmer.disabled=true;
  warmer.setAttribute('aria-busy','true');
  try {
   const on=await MidnightApp.toggleWarmer();
   MidnightApp.toast(on?'Warmer on.':'Warmer off.');
  } catch(error) {
   MidnightApp.toast(error.message,true);
  } finally {
   warmer.disabled=false;
   warmer.removeAttribute('aria-busy');
   syncWarmer();
  }
 };
 document.querySelectorAll('.panelClose').forEach(button=>{button.replaceChildren(MidnightIcons.make('close'));button.onclick=()=>MidnightUI.close(document.getElementById(button.dataset.close));});
 document.querySelectorAll('[data-dock-icon]').forEach(el=>el.replaceChildren(MidnightIcons.make(el.dataset.dockIcon)));
 document.getElementById('todayCalendar').replaceChildren(MidnightIcons.make('calendar'));
 document.getElementById('nextCalendar').onclick=()=>open('calendar');
 document.querySelectorAll('[data-panel]:not([data-panel=room]), #inboxOpen, #musicMore, #weatherMore, #todayCalendar, #nextCalendar').forEach(button=>button.setAttribute('aria-haspopup','dialog'));
 addEventListener('midnight:focus',event=>{document.getElementById('dockFocusDot').hidden=!event.detail.running;});
 return {open,reveal};
})();
