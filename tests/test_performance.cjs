const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {selectDay}=require('../static/weather.js');

test('weather indexes are isolated by timezone and forecast snapshot, including DST fallback',()=>{
  const second=s=>Date.parse(s)/1000;
  const data={daily:{time:[second('2026-11-01T04:00:00Z')]},hourly:{time:Array.from({length:25},(_,i)=>second('2026-11-01T04:00:00Z')+i*3600)}};
  assert.equal(selectDay(data,0,'America/New_York').hours.length,25);
  assert.equal(selectDay(data,0,'UTC').hours.length,20);
  assert.equal(selectDay(data,0,'America/New_York').hours.length,25);
  assert.equal(selectDay({...data,hourly:{time:[]}},0,'America/New_York').hours.length,0);
});

function appContext(overrides={}) {
  const source=fs.readFileSync(require.resolve('../static/app.js'),'utf8').replace(/\ninit\(\);\s*$/,'');
  const context=vm.createContext({Intl,Date,Map,URL,JSON,Math,Number,Promise,encodeURIComponent,
    localStorage:{getItem:()=>null},MidnightFocus:require('../static/focus.js'),...overrides});
  vm.runInContext(source,context);return context;
}
test('identical GETs share only in-flight work; mutations remain distinct and failures can retry',async()=>{
  let release,calls=0,fail=false;
  const context=appContext({fetch:()=>{calls++;return new Promise(resolve=>release=()=>resolve({ok:!fail,status:502,json:async()=>fail?{detail:'offline'}:{ok:true}}));}});
  const first=vm.runInContext("api('news')",context), second=vm.runInContext("api('news')",context);
  assert.equal(first,second);assert.equal(calls,1);release();await first;
  fail=true;const failed=vm.runInContext("api('news')",context);release();await assert.rejects(failed,/offline/);
  fail=false;const retry=vm.runInContext("api('news')",context);release();await retry;assert.equal(calls,3);
  const a=vm.runInContext("post('plug',{on:true})",context);release();
  const b=vm.runInContext("post('plug',{on:true})",context);release();await Promise.all([a,b]);assert.equal(calls,5);
});
test('idle focus rendering avoids repeated DOM work and completion still fires after sleep',()=>{
  let now=1000000,writes=0,notifications=0;
  class FakeDate extends Date {static now(){return now;}}
  const node={set textContent(v){writes++;},setAttribute(){writes++;},classList:{toggle(){writes++;}}};
  const context=appContext({Date:FakeDate,document:{getElementById:()=>node,querySelector:()=>node,querySelectorAll:()=>[]}});
  vm.runInContext('focusTimer.onComplete=()=>{}; renderFocus()',context);const initial=writes;
  vm.runInContext('renderFocus();renderFocus()',context);assert.equal(writes,initial);
  context.completed=()=>notifications++; context.now=()=>now;
  vm.runInContext('focusTimer.now=now; focusTimer.onComplete=completed; focusTimer.select(1);focusTimer.toggle()',context);
  now+=61000;vm.runInContext('renderFocus();renderFocus()',context);assert.equal(notifications,1);
});

test('a location change during a weather request cannot paint the old town forecast',async()=>{
 const nodes=new Map(),pending=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',setAttribute(){},classList:{toggle(){}},replaceChildren(){}});return nodes.get(id);};
 const context=appContext({document:{getElementById:node},window:{dispatchEvent(){}},Event:class{},queueMicrotask,
   fetch:url=>new Promise(resolve=>pending.push({url,resolve}))});
 vm.runInContext("coordinates={lat:1,lon:2,name:'Town A'};settings={units:'fahrenheit'};renderWeatherDetails=()=>{};tick=()=>{};calendarTimeZone='UTC';",context);
 const first=vm.runInContext('refreshWeather()',context);
 vm.runInContext("coordinates={lat:3,lon:4,name:'Town B'};refreshWeather();",context);
 const data=temperature=>({timezone:'UTC',current:{temperature_2m:temperature,apparent_temperature:temperature,weather_code:0,is_day:1},daily:{temperature_2m_max:[temperature],temperature_2m_min:[temperature]}});
 pending[0].resolve({ok:true,json:async()=>data(11)});await first;await Promise.resolve();
 assert.notEqual(node('temperature').textContent,'11°');assert.match(pending[1].url,/lat=3&lon=4/);
 pending[1].resolve({ok:true,json:async()=>data(22)});
 await new Promise(setImmediate);
 assert.equal(node('temperature').textContent,'22°');assert.equal(node('weatherTitle').textContent,'Town B');
});
