const test=require('node:test');
const assert=require('node:assert/strict');
const FocusTimer=require('../static/focus.js');
function fixture() { let now=1000000; const values=new Map(); const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}; let completed=0; const options={storage,now:()=>now,onComplete:()=>completed++}; return {options,advance:ms=>now+=ms,completed:()=>completed,values}; }
test('start, pause, resume and reset preserve elapsed time',()=>{
 const f=fixture(),timer=new FocusTimer(f.options);timer.toggle();f.advance(60000);assert.equal(timer.snapshot().remaining,24*60000);timer.toggle();f.advance(60000);assert.equal(timer.snapshot().remaining,24*60000);timer.toggle();f.advance(60000);assert.equal(timer.snapshot().remaining,23*60000);timer.reset();assert.equal(timer.snapshot().remaining,25*60000);assert.equal(timer.snapshot().running,false);
});
test('running timer survives a reload and completion fires once',()=>{
 const f=fixture(),timer=new FocusTimer(f.options);timer.select(5);timer.toggle();f.advance(2*60000);const restored=new FocusTimer(f.options);assert.equal(restored.snapshot().remaining,3*60000);f.advance(4*60000);assert.equal(restored.snapshot().remaining,0);restored.snapshot();assert.equal(f.completed(),1);assert.equal(new FocusTimer(f.options).snapshot().running,false);
});
test('invalid stored values and invalid durations are ignored',()=>{
 const f=fixture();f.values.set('midnight-focus-v3','{"duration":-1,"remaining":-1,"running":true,"endsAt":0}');const timer=new FocusTimer(f.options);timer.select(-10);assert.equal(timer.snapshot().duration,25*60000);f.values.set('midnight-focus-v3','not json');assert.equal(new FocusTimer(f.options).snapshot().remaining,25*60000);
});
test('existing absolute focus deadline migrates into the widget',()=>{
 const f=fixture();f.values.set('midnight-focus',String(f.options.now()+60000));const timer=new FocusTimer(f.options);assert.equal(timer.snapshot().remaining,60000);assert.equal(timer.snapshot().running,true);
});
test('custom duration survives pause, reload and reset without reverting to a preset',()=>{
 const f=fixture(),timer=new FocusTimer(f.options);timer.select(37);timer.toggle();f.advance(90000);timer.toggle();
 const restored=new FocusTimer(f.options);assert.equal(restored.snapshot().duration,37*60000);assert.equal(restored.snapshot().remaining,37*60000-90000);assert.equal(restored.snapshot().running,false);
 restored.toggle();f.advance(30000);assert.equal(restored.snapshot().remaining,35*60000);restored.reset();assert.equal(restored.snapshot().remaining,37*60000);
 restored.select(181);assert.equal(restored.snapshot().duration,37*60000);
});
