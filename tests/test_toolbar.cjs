'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),core=require('../static/toolbar-core.js');
test('website shortcuts accept ordinary and local websites and reject executable URLs or credentials',()=>{
 assert.equal(core.website(' example.com/path?q=1#part '),'https://example.com/path?q=1#part');
 assert.equal(core.website('http://127.0.0.1:7001/configure'),'http://127.0.0.1:7001/configure');
 for(const url of ['javascript:alert(1)','data:text/html,test','file:///etc/passwd','https://joe:password@example.com','about:blank','', 'https://'])assert.throws(()=>core.website(url));
 assert.deepEqual(core.link('link:a','','https://www.example.com'),{type:'link',id:'link:a',label:'example.com',url:'https://www.example.com/'});
});
test('saved configuration preserves order, an empty dock, link names and display preferences',()=>{
 const saved={version:1,secondDisplay:false,items:[core.link('link:one','My website','example.com'),{type:'tool',id:'capture'},{type:'tool',id:'inbox'}]};
 assert.deepEqual(core.normalize(JSON.parse(JSON.stringify(saved))),saved);
 assert.deepEqual(core.normalize({version:1,items:[]}).items,[]);
 assert.deepEqual(core.normalize({version:900,items:[]}),core.defaults());
});
test('invalid, duplicate and unknown stored entries cannot become toolbar controls',()=>{
 const data={version:1,items:[null,{type:'tool',id:'not-a-tool'},{type:'tool',id:'calendar'},{type:'tool',id:'calendar'},{type:'link',id:'link:bad',url:'javascript:alert(1)'},{type:'link',id:'calendar',url:'https://example.com'},{type:'link',id:'link:<script>',url:'https://example.com'},core.link('link:ok','<img onerror=alert(1)>','example.com')]};
 assert.deepEqual(core.normalize(data).items,[{type:'tool',id:'calendar'},core.link('link:ok','<img onerror=alert(1)>','example.com')]);
});
const builtin={left:0,top:0,availLeft:0,availTop:25,availWidth:1440,availHeight:875,isInternal:true},external={left:-1920,top:0,availLeft:-1920,availTop:0,availWidth:1920,availHeight:1080,isInternal:false};
test('only a second connected screen is selected, including negative coordinates and changed current screens',()=>{
 assert.equal(core.otherScreen(null),null);assert.equal(core.otherScreen({screens:[builtin],currentScreen:builtin}),null);
 assert.equal(core.otherScreen({screens:[builtin,external],currentScreen:{...builtin}}),external);
 assert.equal(core.otherScreen({screens:[builtin,external],currentScreen:external}),builtin);
 assert.equal(core.features(external),'popup=yes,left=-1920,top=0,width=1920,height=1080');
 assert.equal(core.features({...external,availWidth:NaN}),null);
});
test('second-screen opening severs the opener before navigation and never opens duplicate fallbacks',()=>{
 const events=[],child={set opener(value){events.push(['opener',value]);},location:{replace(url){events.push(['url',url]);}},focus(){events.push(['focus']);}};
 const details={screens:[builtin,external],currentScreen:builtin};
 assert.equal(core.openOnDisplay('example.com',details,(...args)=>{events.push(['open',...args]);return child;}),true);
 assert.deepEqual(events,[['open','about:blank','_blank','popup=yes,left=-1920,top=0,width=1920,height=1080'],['opener',null],['url','https://example.com/'],['focus']]);
 let calls=0;assert.equal(core.openOnDisplay('example.com',{screens:[builtin],currentScreen:builtin},()=>calls++),false);assert.equal(calls,0);
 assert.equal(core.openOnDisplay('example.com',details,()=>{calls++;return null;}),false);assert.equal(calls,1);
 assert.equal(core.openOnDisplay('example.com',details,()=>{throw new Error('Blocked');}),false);
 assert.throws(()=>core.openOnDisplay('javascript:alert(1)',details,()=>calls++));assert.equal(calls,1);
});
test('a failed navigation closes its blank window and leaves the regular link available',()=>{
 let closed=0;assert.equal(core.openOnDisplay('example.com',{screens:[builtin,external],currentScreen:builtin},()=>({location:{replace(){throw new Error('Unavailable');}},close(){closed++;}})),false);assert.equal(closed,1);
});
