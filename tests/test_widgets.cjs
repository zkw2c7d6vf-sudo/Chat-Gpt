const test=require('node:test'),assert=require('node:assert/strict');
const {agenda,relative,outlook}=require('../static/widget-core.js');
const now=Date.parse('2026-11-17T17:00:00Z');
const event=(title,start,end,all_day=false)=>({title,start,end,all_day});
test('live events take precedence, following event and remaining count are projected without duplicates',()=>{
 const current=event('Review','2026-11-17T16:30Z','2026-11-17T17:30Z'),next=event('Walk','2026-11-17T18:00Z','2026-11-17T19:00Z');
 const result=agenda([current,next,current],now,'America/New_York');assert.equal(result.current.title,'Review');assert.equal(result.following.title,'Walk');assert.equal(result.todayCount,2);assert.equal(result.label,'Ends in 30 min');assert.equal(result.live,true);
});
test('three-day countdown uses the selected timezone and all-day events retain date context',()=>{
 assert.equal(relative(event('Due','2026-11-20T23:00Z','2026-11-21T00:00Z'),now,'America/New_York'),'In 3 days');
 assert.equal(relative(event('Due','2026-11-18T05:00Z','2026-11-19T05:00Z',true),now,'America/New_York'),'Tomorrow · All day');
});
test('upcoming timed work today stays visible above an all-day event',()=>{
 const result=agenda([event('All day','2026-11-17T00:00Z','2026-11-18T00:00Z',true),event('Meeting','2026-11-17T18:00Z','2026-11-17T19:00Z')],now,'UTC');assert.equal(result.current.title,'Meeting');
});
test('expired and invalid events are excluded',()=>{
 assert.equal(agenda([event('Old','2026-11-16T18:00Z','2026-11-16T19:00Z'),event('Bad','wrong','wrong')],now).current,undefined);
});
test('rain outlook uses future hours, probability and local time',()=>{
 const data={hourly:{time:[(now-3600000)/1000,(now+3600000)/1000,(now+7200000)/1000],precipitation_probability:[90,10,65]}};
 assert.match(outlook(data,now,'America/New_York'),/65%.*2:00 PM/);
});
test('missing precipitation is unknown rather than clear, and low probability stays qualified',()=>{
 assert.equal(outlook({hourly:{time:[now/1000]}},now),'');assert.match(outlook({hourly:{time:[now/1000],precipitation_probability:[10]}},now),/Low rain chance/);
});
