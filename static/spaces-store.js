/* One local layout document. Widgets reference existing data; nothing is duplicated. */
(function(root){
 'use strict';
 const widgets=['music','weather','focusWidget','room','agenda','news','capturesWidget'];
 const make=(id,name,icon,accent,items)=>({id,name,icon,accent,wallpaper:'none',widgets:items.map(([id,width])=>({id,width})),layout:{density:'comfortable',calm:id==='focus'},shortcuts:[],createdAt:'2026-11-15T00:00:00.000Z',updatedAt:'2026-11-15T00:00:00.000Z'});
 const defaults=()=>[
  make('home','Home','⌂','#b7ebd7',[['music',4],['weather',4],['focusWidget',2],['room',2],['agenda',5],['news',7]]),
  make('school','School','▤','#b9ccff',[['agenda',6],['capturesWidget',6],['focusWidget',4],['weather',8]]),
  make('entertainment','Entertainment','♫','#ddc2ff',[['music',8],['room',4],['news',12]]),
  make('focus','Focus','◉','#c4dfb5',[['focusWidget',6],['capturesWidget',6]])
 ].map(space=>space.id==='entertainment'?{...space,shortcuts:[{title:'Spotify',url:'https://open.spotify.com/',favorite:true}]}:space);
 const clone=value=>JSON.parse(JSON.stringify(value));
 function safeURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
 function validate(space){if(!space||typeof space.id!=='string'||!space.id||space.id.length>80||typeof space.name!=='string'||!space.name.trim()||space.name.length>40)throw new Error('Give the Space a name (up to 40 characters).');if(!/^#[a-f0-9]{6}$/i.test(space.accent))throw new Error('Choose a valid accent.');if(!['none','aurora','dusk','linen'].includes(space.wallpaper))throw new Error('Choose an available background.');if(!Array.isArray(space.widgets)||space.widgets.length>widgets.length||new Set(space.widgets.map(w=>w.id)).size!==space.widgets.length||space.widgets.some(w=>!widgets.includes(w.id)||!Number.isInteger(w.width)||w.width<2||w.width>12))throw new Error('The widget layout is invalid.');if(!Array.isArray(space.shortcuts)||space.shortcuts.length>12||space.shortcuts.some(s=>!s.title?.trim()||s.title.length>50||!safeURL(s.url)))throw new Error('Shortcuts need a name and a public HTTPS address (up to 12).');return {...clone(space),name:space.name.trim(),icon:String(space.icon||'◈').slice(0,8),layout:{density:space.layout?.density==='compact'?'compact':'comfortable',calm:!!space.layout?.calm}};}
 class SpacesStore{
  constructor(storage){this.storage=storage;this.warning='';this.state={version:1,activeId:'home',spaces:defaults(),suggestionsEnabled:true};try{const raw=storage?.getItem('midnight-spaces-v1');if(raw){const saved=JSON.parse(raw);if(saved.version!==1||!Array.isArray(saved.spaces)||saved.spaces.length<1||saved.spaces.length>24)throw new Error('Invalid saved Spaces');const spaces=saved.spaces.map(validate);if(new Set(spaces.map(s=>s.id)).size!==spaces.length||defaults().some(d=>!spaces.some(s=>s.id===d.id)))throw new Error('Missing default Spaces');this.state={version:1,activeId:spaces.some(s=>s.id===saved.activeId)?saved.activeId:'home',spaces,suggestionsEnabled:saved.suggestionsEnabled!==false};}}catch{this.warning='Saved layouts could not be read. Default Spaces are available; the original saved value is left untouched until you save a change.';}}
  snapshot(){return clone(this.state);}
  commit(next){const clean={...next,spaces:next.spaces.map(validate)};if(clean.spaces.length>24)throw new Error('You can keep up to 24 Spaces.');this.storage.setItem('midnight-spaces-v1',JSON.stringify(clean));this.state=clean;return this.snapshot();}
  switch(id){if(!this.state.spaces.some(s=>s.id===id))throw new Error('Space not found.');return this.commit({...this.state,activeId:id});}
  save(space){const next=validate(space),state=this.snapshot(),index=state.spaces.findIndex(s=>s.id===next.id);next.updatedAt=new Date().toISOString();if(index<0){next.originalWidgets=clone(next.widgets);next.originalLayout=clone(next.layout);state.spaces.push(next);}else state.spaces[index]=next;return this.commit(state);}
  remove(id){if(defaults().some(s=>s.id===id))throw new Error('Default Spaces can be reset, but not deleted.');const state=this.snapshot();state.spaces=state.spaces.filter(s=>s.id!==id);if(state.activeId===id)state.activeId='home';return this.commit(state);}
  reset(id){const current=this.state.spaces.find(s=>s.id===id);if(!current)throw new Error('Space not found.');const original=defaults().find(s=>s.id===id)||{widgets:current.originalWidgets||current.widgets,layout:current.originalLayout||current.layout};return this.save({...current,widgets:clone(original.widgets),layout:clone(original.layout)});}
  suggestions(enabled){return this.commit({...this.state,suggestionsEnabled:!!enabled});}
 }
 const api={SpacesStore,defaults,validate,safeURL,widgets};root.MidnightSpacesCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
