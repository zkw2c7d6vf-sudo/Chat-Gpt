/* Synthetic integration data. Never contacts accounts or devices. */
const time=Date.parse('2026-11-15T05:00:00Z')/1000;
const weather={timezone:'America/New_York',current:{temperature_2m:46,apparent_temperature:42,weather_code:2,is_day:1,wind_speed_10m:8},current_units:{wind_speed_10m:'mph'},
 daily:{time:Array.from({length:7},(_,i)=>time+i*86400),temperature_2m_max:[48,51,49,44,46,50,52],temperature_2m_min:[35,37,33,31,34,36,38],weather_code:[2,0,3,61,2,0,1],precipitation_probability_max:[10,5,20,70,15,5,10],sunrise:Array.from({length:7},(_,i)=>time+i*86400+7*3600),sunset:Array.from({length:7},(_,i)=>time+i*86400+17*3600)},
 hourly:{time:Array.from({length:168},(_,i)=>time+i*3600),temperature_2m:Array(168).fill(44),weather_code:Array(168).fill(2),precipitation_probability:Array(168).fill(10)}};
async function mocks(context) {
 await context.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname;
  if(r.request().method()!=='GET') throw new Error('Unexpected mutation: '+path);
  const data=path.endsWith('bootstrap') ? {csrf:'test',settings:{feeds:['https://example.com/feed'],units:'fahrenheit',plug_enabled:false},spotify_connected:true}
   : path.endsWith('spotify') ? {active:true,playing:false,title:'Evening in the city',artist:'Midnight Sessions',album:'After hours',release_year:'2026',duration:240000,progress:67000,device:'Test player'}
   : path.endsWith('weather') ? weather
   : path.endsWith('calendar') ? {configured:true,source:'Test calendar',events:[{title:'Classroom observation',start:'2026-11-16T14:00:00Z',end:'2026-11-16T16:00:00Z',location:'Campus'},{title:'Make time for a quiet evening',start:'2026-11-17T22:00:00Z',end:'2026-11-17T23:00:00Z'}]}
   : path.endsWith('news/article') ? {content:'A little more space for the things that matter.\nThis is a test article rendered as safe text.',notice:'Test feed text.'}
   : path.endsWith('news') ? {articles:[{title:'A slower rhythm for the end of the day',source:'Daily journal',published:'2026-11-15',url:'https://example.com/story'},{title:'Small discoveries, closer to home',source:'Science notes',published:'2026-11-15',url:'https://example.com/second'}],errors:[]}
   : {results:[]};
  return r.fulfill({json:data});
 });
 await context.addInitScript(()=>localStorage.setItem('midnight-location',JSON.stringify({lat:42.89,lon:-78.87,name:'Buffalo'})));
}

module.exports={mocks};
