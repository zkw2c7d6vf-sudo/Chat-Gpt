/* One visibility-aware scheduler; sleeping tabs do not keep polling loops alive. */
'use strict';
(function(root,factory){
 const create=factory();if(typeof module==='object'&&module.exports){module.exports=create;return;}
 const doc=document,html=doc.documentElement;
 try{html.dataset.effects=localStorage.getItem('midnight-effects')==='glass'?'glass':'efficient';}catch{html.dataset.effects='efficient';}
 const activity=create({visible:()=>!doc.hidden});root.MidnightActivity=activity;
 const visibility=()=>{html.dataset.pageVisibility=doc.hidden?'hidden':'visible';activity.wake();};
 doc.addEventListener('visibilitychange',visibility);visibility();
 doc.addEventListener('DOMContentLoaded',()=>{
  const control=doc.getElementById('visualEffects'),status=doc.getElementById('effectsStatus');if(!control)return;control.value=html.dataset.effects;
  control.onchange=()=>{try{localStorage.setItem('midnight-effects',control.value);html.dataset.effects=control.value;status.textContent='Saved on this browser.';}catch{control.value=html.dataset.effects;status.textContent='Could not save this preference. Try again after freeing browser storage.';}};
  const form=doc.getElementById('googleSearch');form?.addEventListener('submit',event=>{const input=doc.getElementById('googleQuery');input.value=input.value.trim();if(!input.value){event.preventDefault();input.focus();}});
 });
})(typeof window==='undefined'?globalThis:window,()=>function createActivity({now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout,visible=()=>true,onError=error=>console.error(error)}={}){
 const jobs=new Map();let timer=null;
 const rate=job=>Math.max(100,Number(typeof job.interval==='function'?job.interval():job.interval)||60000);
 const next=(job,time,period)=>job.align?(Math.floor(time/period)+1)*period:time+period;
 function wake(){
  if(timer!==null){clearTimer(timer);timer=null;}if(!visible())return;
  const time=now();let due=Infinity;
  for(const job of jobs.values()){
   if(job.running||!job.enabled())continue;
   const period=rate(job);if(period!==job.period){job.period=period;job.due=next(job,time,period);}
   due=Math.min(due,job.due);
  }
  if(Number.isFinite(due))timer=setTimer(run,Math.max(0,due-time));
 }
 function run(){
  timer=null;if(!visible())return;const time=now();
  for(const job of jobs.values())if(!job.running&&job.enabled()&&job.due<=time){
   job.running=true;job.due=next(job,time,rate(job));
   try{const value=job.fn();if(value&&typeof value.then==='function')Promise.resolve(value).catch(onError).finally(()=>{job.running=false;wake();});else job.running=false;}catch(error){job.running=false;onError(error);}
  }
  wake();
 }
 function every(name,fn,interval,{enabled=()=>true,align=false}={}){
  const job={fn,interval,enabled,align,running:false,period:0,due:0};job.period=rate(job);job.due=next(job,now(),job.period);jobs.set(name,job);wake();return ()=>{jobs.delete(name);wake();};
 }
 return {every,wake};
});
