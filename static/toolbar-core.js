/* Local toolbar data and display selection; no network or account dependency. */
'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MidnightToolbarCore=api;})(typeof window==='undefined'?globalThis:window,()=>{
 const TOOLS=Object.freeze([
  {id:'calendar',label:'Calendar',icon:'calendar'}, {id:'tasks',label:'Tasks',icon:'task'},
  {id:'focus',label:'Focus',icon:'focus'}, {id:'room',label:'Warmer',icon:'lamp'},
  {id:'news',label:'Read',icon:'book'}, {id:'inbox',label:'Inbox',icon:'inbox'},
  {id:'sounds',label:'Sounds',icon:'sounds'}, {id:'files',label:'Files',icon:'files'},
  {id:'capture',label:'Capture',icon:'plus'}, {id:'search',label:'Search',icon:'search'},
  {id:'music',label:'Spotify',icon:'music'}, {id:'weather',label:'Weather',icon:'cloud'},
  {id:'settings',label:'Settings',icon:'settings'}, {id:'fullscreen',label:'Fullscreen',icon:'fullscreen'},
  {id:'notifications',label:'Notifications',icon:'reminder'}
 ]);
 const defaults=()=>({version:1,secondDisplay:true,items:['calendar','tasks','focus','room','sounds','files','news','inbox'].map(id=>({type:'tool',id}))});
 function website(value){
  const raw=String(value||'').trim();if(!raw||raw.length>2048)throw new Error('Enter a website address, such as example.com.');
  // Scheme-less hostnames are convenient; executable and custom schemes are never accepted.
  const text=/^[a-z][a-z\d+.-]*:/i.test(raw)?raw:'https://'+raw;
  let url;try{url=new URL(text);}catch{throw new Error('Enter a valid website address.');}
  if(!['https:','http:'].includes(url.protocol)||!url.hostname||url.username||url.password)throw new Error('Use an http or https website address without login credentials.');
  return url.href;
 }
 function link(id,label,address){const url=website(address);return {type:'link',id:String(id),label:String(label||'').trim().slice(0,40)||new URL(url).hostname.replace(/^www\./,''),url};}
 function normalize(value){
  if(!value||value.version!==1||!Array.isArray(value.items))return defaults();
  const seen=new Set(),items=[];
  for(const item of value.items.slice(0,100)){
   if(!item||typeof item.id!=='string'||seen.has(item.id))continue;
   if(item.type==='tool'&&TOOLS.some(tool=>tool.id===item.id)){items.push({type:'tool',id:item.id});seen.add(item.id);}
   else if(item.type==='link'&&/^link:[\w-]{1,100}$/.test(item.id)){try{items.push(link(item.id,item.label,item.url));seen.add(item.id);}catch{}}
  }
  return {version:1,secondDisplay:value.secondDisplay!==false,items,...(value.drivePresetsAdded===true?{drivePresetsAdded:true}:{}),...(value.fileToolsAdded===true?{fileToolsAdded:true}:{}),...(value.driveCreateMoved===true?{driveCreateMoved:true}:{})};
 }
 const DRIVE_PRESETS = Object.freeze([
  {id:'link:midnight-drive-home', label:'My Drive', url:'https://drive.google.com/drive/my-drive', icon:'drive'},
 ]);
 function withDrivePresets(value) {
  const state=normalize(value);
  if(!state.driveCreateMoved) {
   state.items=state.items.filter(item=>item.type!=='link' || !['https://docs.new/','https://slides.new/'].includes(item.url));
   state.driveCreateMoved=true;
  }
  if(!state.fileToolsAdded){
   for(const id of ['sounds','files'])if(!state.items.some(item=>item.type==='tool'&&item.id===id))state.items.push({type:'tool',id});
   state.fileToolsAdded=true;
  }
  if(state.drivePresetsAdded)return state;
  const urls=new Set(state.items.filter(item=>item.type==='link').map(item=>item.url));
  const ids=new Set(state.items.map(item=>item.id));
  for(const preset of DRIVE_PRESETS){
   if(state.items.length>=100)break;
   if(!urls.has(preset.url)&&!ids.has(preset.id))state.items.push(link(preset.id,preset.label,preset.url));
  }
  return {...state,drivePresetsAdded:true};
 }
 function otherScreen(details){
  if(!details||!Array.isArray(details.screens)||details.screens.length<2)return null;
  const current=details.currentScreen;
  const others=details.screens.filter(screen=>screen!==current&&(!current||screen.left!==current.left||screen.top!==current.top));
  return others.find(screen=>screen.isInternal===false)||others[0]||null;
 }
 function features(screen){
  if(!screen)return null;
  const values=[screen.availLeft,screen.availTop,screen.availWidth,screen.availHeight];
  if(!values.every(Number.isFinite)||values[2]<200||values[3]<200)return null;
  return `popup=yes,left=${Math.round(values[0])},top=${Math.round(values[1])},width=${Math.round(values[2])},height=${Math.round(values[3])}`;
 }
 function openOnDisplay(address,details,openWindow){
  const url=website(address),placement=features(otherScreen(details));if(!placement)return false;
  let child;try{
   child=openWindow('about:blank','_blank',placement);if(!child)return false;
   // Sever the opener before any external page starts loading.
   child.opener=null;child.location.replace(url);try{child.focus();}catch{}return true;
  }catch{try{child?.close();}catch{}return false;}
 }
 return {TOOLS,DRIVE_PRESETS,withDrivePresets,defaults,website,link,normalize,otherScreen,features,openOnDisplay};
});
