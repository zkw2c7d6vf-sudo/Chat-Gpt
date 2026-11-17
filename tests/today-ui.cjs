/* In-process UI integration checks; this is a DOM model, not a browser/layout test. */
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.hidden=false;this.textContent='';this.className='';}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=[...children];this.textContent='';}
 setAttribute(k,v){this.attributes[k]=v;}
 scrollIntoView(){}
 click(){return this.onclick?.();}
}
const text=n=>n.textContent+n.children.map(text).join(' '),find=(n,cls)=>n.children.flatMap(c=>[...(c.className.split(' ').includes(cls)?[c]:[]),...find(c,cls)]);
function setup(){
 const ids=new Map(),tabs=['due','backlog','completed'].map(view=>{const n=new Element('button');n.dataset.todayView=view;return n;});
 const get=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);},storage=new Map(),listeners=new Map();
 let records=[],timer={running:false,remaining:1500000},saveOK=true;
 const capture={all:async()=>structuredClone(records),update:async(id,changes)=>{if(!saveOK)return false;records=records.map(i=>i.id===id?{...i,...changes,completedAt:changes.done?new Date().toISOString():i.completedAt}:i);return true;},open:async()=>{},edit:()=>{},openInbox:()=>{}};
 const app={snapshot:()=>({events:[],focus:{...timer},calendarLoaded:true,calendarConfigured:false}),startFocus:()=>{timer.running=true;},openSettings:()=>{}};
 get('focusStart').onclick=()=>timer.running=!timer.running;
 const context={window:null,document:{getElementById:get,createElement:t=>new Element(t),querySelectorAll:()=>tabs},MidnightTodayCore:require('../static/today-core.js'),MidnightCapture:capture,MidnightApp:app,MidnightSpaces:{active:()=>({id:'home'}),switchTo:()=>{}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setInterval:()=>{},matchMedia:()=>({matches:true}),Date,Set,Map,Promise,addEventListener:(name,fn)=>listeners.set(name,fn)};context.window=context;
 vm.runInNewContext(fs.readFileSync(require.resolve('../static/today.js'),'utf8'),context);
 const now=new Date().toISOString();return {get,tabs,timer,context,records:()=>records,seed:async()=>{records=Array.from({length:5},(_,i)=>({id:'t'+i,text:'Task '+i,kind:'task',archived:false,done:false,createdAt:now,updatedAt:now,dueAt:i===4?new Date(Date.now()-86400000).toISOString():null}));await context.MidnightToday.refresh();},fail:()=>saveOK=false};
}
test('Today selects three priorities, refuses a fourth, links focus, completes and reopens a task',async()=>{
 const ui=setup();await ui.seed();ui.tabs[1].click();
 for(let i=0;i<3;i++)await find(ui.get('todayTasks'),'todayPin')[0].click();
 assert.equal(find(ui.get('todayPriorities'),'todayTask').length,3);
 await find(ui.get('todayTasks'),'todayPin')[0].click();assert.match(text(ui.get('todayStatus')),/Three priorities/);
 const first=find(ui.get('todayPriorities'),'todayTask')[0],selected=ui.records().find(item=>item.id===first.dataset.taskId);await find(first,'smallButton')[0].click();assert.equal(ui.timer.running,true);assert.equal(ui.get('todayFocus').hidden,false);assert.equal(ui.get('todayFocusText').textContent,selected.text);
 ui.get('todayPauseFocus').click();assert.equal(ui.timer.running,false);
 await find(first,'captureTaskToggle')[0].click();assert.equal(ui.get('todayDoneCount').textContent,1);assert.equal(ui.get('todayFocus').hidden,true);
 ui.tabs[2].click();await find(ui.get('todayTasks'),'captureTaskToggle')[0].click();assert.equal(ui.records().find(item=>item.id===selected.id).done,false);
});
test('due tasks stay visible, tomorrow preserves deadlines, and failed updates show no false success',async()=>{
 const ui=setup();await ui.seed();assert.match(text(ui.get('todayTasks')),/Task 4/);
 const row=find(ui.get('todayTasks'),'todayTask')[0],due=ui.records()[4].dueAt;
 await find(row,'textButton')[0].click();assert.equal(ui.records()[4].dueAt,due);assert.ok(ui.records()[4].plannedFor);assert.match(text(ui.get('todayTasks')),/Task 4/);
 ui.fail();await find(ui.get('todayTasks'),'captureTaskToggle')[0].click();assert.equal(ui.records()[4].done,false);assert.match(text(ui.get('todayStatus')),/could not be saved/);
});
