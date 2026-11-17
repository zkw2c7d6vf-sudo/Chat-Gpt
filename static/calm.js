/* The home stays quiet. Tools retain their own local state in floating panels. */
'use strict';
window.MidnightPanels=(()=>{
 const routes={tasks:'tasksPanel',focus:'focusPanel',room:'roomPanel',news:'newsPanel'};
 function open(name){if(name==='calendar'){window.MidnightCalendar?.open();return;}const panel=document.getElementById(routes[name]);if(panel)MidnightUI.open(panel);}
 function reveal(id){const name={todayPanel:'tasks',focusWidget:'focus',room:'room',news:'news',agenda:'calendar'}[id];if(!name)return false;open(name);return true;}
 document.querySelectorAll('[data-panel]').forEach(button=>button.onclick=()=>open(button.dataset.panel));
 document.querySelectorAll('.panelClose').forEach(button=>{button.replaceChildren(MidnightIcons.make('close'));button.onclick=()=>MidnightUI.close(document.getElementById(button.dataset.close));});
 document.querySelectorAll('[data-dock-icon]').forEach(el=>el.replaceChildren(MidnightIcons.make(el.dataset.dockIcon)));
 document.getElementById('nextCalendar').onclick=()=>open('calendar');
 addEventListener('midnight:dialogchange',()=>document.querySelectorAll('[data-panel]').forEach(button=>{const id=button.dataset.panel==='calendar'?'calendarBrowserDialog':routes[button.dataset.panel];button.setAttribute('aria-pressed',String(!!document.getElementById(id)?.open));}));
 addEventListener('midnight:focus',event=>{document.getElementById('dockFocusDot').hidden=!event.detail.running;});
 return {open,reveal};
})();
