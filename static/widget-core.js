/* Glanceable, read-only projections. No storage, network or account actions. */
(function(root){
 'use strict';
 const formatters=new Map();
 const formatter=(kind,tz)=>{const key=kind+':'+tz;if(!formatters.has(key)){if(formatters.size>=16)formatters.clear();formatters.set(key,new Intl.DateTimeFormat(kind==='day'?'en-CA':undefined,{timeZone:tz,...(kind==='day'?{year:'numeric',month:'2-digit',day:'2-digit'}:{hour:'numeric',minute:'2-digit'})}));}return formatters.get(key);};
 const dateKey=(value,tz)=>formatter('day',tz).format(new Date(value));
 const time=(value,tz)=>formatter('time',tz).format(new Date(value));
 function relative(event,now,tz){
  const start=Date.parse(event.start),end=Date.parse(event.end);
  if(event.all_day){const days=Math.round((Date.parse(dateKey(start,tz))-Date.parse(dateKey(now,tz)))/86400000);return days<=0?'All day today':days===1?'Tomorrow · All day':'In '+days+' days · All day';}
  const live=start<=now,remaining=(live?end:start)-now;
  const days=Math.round((Date.parse(dateKey(live?end:start,tz))-Date.parse(dateKey(now,tz)))/86400000);
  let text;if(remaining<60000)text='less than a minute';else if(remaining<3600000)text=Math.ceil(remaining/60000)+' min';else if(remaining<86400000)text=Math.floor(remaining/3600000)+' hr'+(Math.floor(remaining%3600000/60000)?' '+Math.floor(remaining%3600000/60000)+' min':'');else text=days+' day'+(days===1?'':'s');
  return (live?'Ends in ':'In ')+text;
 }
 function agenda(events,now=Date.now(),tz='UTC'){
  const unique=[...new Map(events.map(e=>[e.id||e.uid+'|'+e.start+'|'+e.end+'|'+e.title+'|'+(e.location||''),e])).values()].filter(e=>Number.isFinite(Date.parse(e.start))&&Number.isFinite(Date.parse(e.end))&&Date.parse(e.end)>now).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  const today=dateKey(now,tz),current=unique.find(e=>!e.all_day&&Date.parse(e.start)<=now)||unique.find(e=>!e.all_day&&dateKey(e.start,tz)===today)||unique.find(e=>e.all_day&&dateKey(e.start,tz)<=today)||unique[0];
  const upcoming=unique.filter(e=>e!==current&&Date.parse(e.start)>=Math.max(now,Date.parse(current?.start))).slice(0,2);
  const following=upcoming[0];
  return {current,following,upcoming,todayCount:unique.filter(e=>dateKey(e.start,tz)===today||Date.parse(e.start)<=now).length,label:current?relative(current,now,tz):'',live:!!current&&!current.all_day&&Date.parse(current.start)<=now};
 }
 function outlook(data,now=Date.now(),tz='UTC'){
  const hourly=data?.hourly||{},times=hourly.time||[],limit=now+12*3600000;
  const indexes=times.map((value,i)=>({i,ms:typeof value==='number'?value*1000:Date.parse(value)})).filter(row=>row.ms>=now-30*60000&&row.ms<=limit);
  const rain=indexes.find(row=>Number.isFinite(hourly.precipitation_probability?.[row.i])&&hourly.precipitation_probability[row.i]>=40);
  if(rain)return 'Rain chance '+Math.round(hourly.precipitation_probability[rain.i])+'% · '+time(rain.ms,tz);
  const covered=indexes.filter(row=>Number.isFinite(hourly.precipitation_probability?.[row.i]));
  if(covered.length>=12&&covered[0].ms<=now+3600000&&covered.at(-1).ms>=limit-3600000&&covered.every((row,i)=>!i||row.ms-covered[i-1].ms<=3600000))return 'Low rain chance for the next 12 hours';
  if(covered.length)return 'Low rain chance in available hours · 12-hour coverage incomplete';
  return '';
 }
 const api={agenda,relative,outlook,dateKey,time};root.MidnightWidgetCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
