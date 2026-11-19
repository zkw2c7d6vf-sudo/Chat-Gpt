const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const {mocks}=require('./ui-fixtures.cjs');
(async()=>{
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',hasTouch:process.env.MIDNIGHT_TEST_TOUCH==='1'});await mocks(context);
const colors=['#b0624d','#789cac','#a190b0','#a59d60','#cfb89c','#4f688f','#bc6a80','#628c7d','#835c52','#c6b449'];
await context.route('https://shelf.test/**',r=>{const n=Number(new URL(r.request().url()).pathname.slice(1))||0;return r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="shade" x2=".8" y2="1"><stop stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#101421" stop-opacity=".6"/></linearGradient></defs><rect width="200" height="200" fill="${colors[n%10]}"/><rect width="200" height="200" fill="url(#shade)"/><path d="M-30 ${70+n*3} Q70 ${-50+n*8} 230 ${90+n*4} L230 240 H-30Z" fill="#fff" fill-opacity=".14"/><path d="M-25 ${145-n*4} Q90 ${25+n*7} 225 ${155-n*3}" fill="none" stroke="#f5eee7" stroke-opacity=".45" stroke-width="2"/><path d="M-25 ${153-n*4} Q90 ${33+n*7} 225 ${163-n*3}" fill="none" stroke="#f5eee7" stroke-opacity=".2" stroke-width="1"/><text x="14" y="177" font-family="serif" font-size="14" letter-spacing="1" fill="#fff">${['AFTER HOURS','BLUE ROOM','MOONLIGHT','SLOW DAYS','GOLDEN','NIGHT DRIVE','SOFT FOCUS','EVERGREEN','FAR FROM HOME','DAYBREAK'][n%10]}</text></svg>`});});
let state={active:true,playing:false,title:'Evening in the city',artist:'Midnight Sessions',album:'After hours',release_year:'2026',image:'https://shelf.test/0',duration:240000,progress:67000,device:'Living room',volume:48,supports_volume:true,shuffle:false,repeat:'off',url:'https://open.spotify.com/track/Song0'};
const tracks=colors.map((c,i)=>({uri:'spotify:track:Song'+i,name:['Evening in the city','The blue room','Moonlight','Slow days','Golden','Night drive','Soft focus','Evergreen','Far from home','Daybreak'][i],artist:'Midnight Sessions',album:'Record '+i,image:'https://shelf.test/'+i,url:'https://open.spotify.com/track/Song'+i}));
const items=tracks.map((x,i)=>({...x,url:'https://open.spotify.com/album/Album'+i}));
const commands=[];let fail=false,delay=250;const liked=new Set();let consent=false;
await context.route('**/api/spotify**',async r=>{
const path=new URL(r.request().url()).pathname;
if(path.endsWith('/liked') && r.request().method()==='GET')return r.fulfill({json:{saved:consent?null:liked.has(new URL(r.request().url()).searchParams.get('track_uri')),can_save:!consent,needs_consent:consent}});
if(path.endsWith('/recent'))return r.fulfill({json:{items,tracks}});
if(r.request().method()==='GET')return r.fulfill({json:state});
commands.push({path,body:r.request().postDataJSON()});await new Promise(resolve=>setTimeout(resolve,delay));
if(fail)return r.fulfill({status:404,json:{detail:'No active Spotify player. Open Spotify and start a song first.'}});
const body=r.request().postDataJSON();if(path.endsWith('/liked')){liked.add(body.track_uri);return r.fulfill({json:{saved:true,track_uri:body.track_uri}});}
if(path.endsWith('/options'))Object.assign(state,body);
if(path.endsWith('/play-track')){const t=tracks.find(x=>x.uri===body.track_uri);state={...state,title:t.name,image:t.image,url:t.url,playing:true};}
return r.fulfill({json:{ok:true}});
});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto((process.env.MIDNIGHT_TEST_URL || 'http://127.0.0.1:8897')+'/app');await page.locator('.shelfRecord').nth(9).waitFor();
await page.waitForFunction(()=>document.querySelector('#sleeveArt').getAttribute('src')===document.querySelector('#albumArt').getAttribute('src') && !document.querySelector('#sleeveArt').hidden);
assert.equal(await page.locator('#sleeveArt').getAttribute('src'),state.image);
assert.equal(await page.locator('.recordShelfHeader select').count(),1);
assert.equal(await page.locator('#shelfView option').count(),2);
assert.equal(await page.locator('#shelfView option[value=albums]').innerText(),'Collections');
assert.equal(await page.locator('.recordShelfHeader button').count(),0);
assert.equal(await page.locator('.homePlaybackOptions').isVisible(),false);
assert.equal(await page.locator('.music > .cardFoot').isVisible(),false);
for(const [width,height]of [[1920,1080],[1440,900],[1280,720],[1024,768]]){
await page.setViewportSize({width,height});await page.waitForTimeout(200);
const result=await page.evaluate(()=>{const bounds=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,right:r.right,left:r.left}};return {cards:[...document.querySelectorAll('.homeWidgets>.card')].map(bounds),music:bounds(document.querySelector('#music')),controls:bounds(document.querySelector('.listeningControls')),seek:bounds(document.querySelector('.seekWrap')),library:bounds(document.querySelector('.recordLibrary')),shelf:bounds(document.querySelector('#spotifyRecents')),overflow:document.documentElement.scrollWidth>innerWidth};});
console.log(width,JSON.stringify(result));assert.equal(new Set(result.cards.map(x=>x.height)).size,1);assert.equal(result.overflow,false);if(process.env.MIDNIGHT_TEST_TOUCH==='1')assert.ok(result.seek.height>=44,`${width} touchscreen seek target is at least 44px high`);
for(const [label,bounds] of [['controls',result.controls],['timeline',result.seek],['library',result.library],['shelf',result.shelf]]){assert.ok(bounds.top>=result.music.top && bounds.bottom<=result.music.bottom,`${width} ${label} stays inside the music card`);assert.ok(bounds.left>=result.music.left && bounds.right<=result.music.right,`${width} ${label} stays within music width`);}
assert.ok(result.controls.bottom<=result.seek.top+1,`${width} transport precedes timeline`);assert.ok(result.seek.bottom<=result.library.top+1,`${width} timeline precedes shelf`);
await page.screenshot({path:'/tmp/midnight-spotify-'+width+(process.env.MIDNIGHT_TEST_TOUCH==='1'?'-touch':'')+'.png'});
}
await page.setViewportSize({width:1440,height:900});await page.mouse.move(0,0);await page.waitForTimeout(200);
assert.equal(await page.locator('.music .timecodes').evaluate(e=>getComputedStyle(e).opacity),'0');
await page.locator('#homeSeek').focus();await page.waitForTimeout(200);assert.equal(await page.locator('.music .timecodes').evaluate(e=>getComputedStyle(e).opacity),'1');
await page.locator('#homeLike').click();await page.waitForFunction(()=>document.querySelector('#homeLike').dataset.saved==='true');
assert.equal(commands.filter(x=>x.path.endsWith('/liked')).length,1);assert.equal(commands.at(-1).body.track_uri,'spotify:track:Song0');
assert.equal(await page.locator('#homeLike').getAttribute('aria-label'),'Saved to Liked Songs');assert.equal(await page.locator('#homeLike').isDisabled(),true);assert.equal(await page.locator('#playbackDialog').evaluate(dialog=>dialog.open),false,'Save must not open the player');
await page.locator('.shelfRecord').nth(2).hover();await page.locator('#recordPreview:not([hidden])').waitFor();
const preview=await page.locator('#recordPreview').evaluate(e=>{const c=getComputedStyle(e);return{children:e.childElementCount,images:e.querySelectorAll('img').length,height:e.getBoundingClientRect().height,background:c.backgroundColor,backgroundImage:c.backgroundImage,boxShadow:c.boxShadow,text:e.textContent};});
assert.equal(preview.children,0);assert.equal(preview.images,0);assert.ok(preview.height<=20);assert.equal(preview.background,'rgba(0, 0, 0, 0)');assert.equal(preview.backgroundImage,'none');assert.equal(preview.boxShadow,'none');assert.match(preview.text,/Moonlight/);
await page.screenshot({path:'/tmp/midnight-spotify-hover.png'});
await page.locator('.shelfRecord').nth(2).click();await page.waitForTimeout(450);assert.equal(await page.locator('.recordFlightVinyl').count(),1);await page.screenshot({path:'/tmp/midnight-spotify-flight.png'});await page.waitForFunction(()=>!document.querySelector('#music').dataset.loadingRecord);assert.equal(commands.filter(x=>x.path.endsWith('play-track')).length,1);assert.equal(commands.at(-1).body.track_uri,'spotify:track:Song2');
assert.equal(await page.locator('#sleeveArt').getAttribute('src'),tracks[2].image);
await page.waitForFunction(()=>document.querySelector('#homeLike').dataset.saved==='false');
fail=true;await page.locator('#homeLike').click();await page.waitForFunction(()=>document.querySelector('#homeLike').getAttribute('aria-busy')==='false');assert.equal(await page.locator('#homeLike').getAttribute('data-saved'),'false');assert.equal(await page.locator('#homeLike').isDisabled(),false);fail=false;
await page.locator('#musicMore').click();await page.locator('#playbackDialog[open]').waitFor();
await page.locator('#detailShuffle').click();await page.waitForFunction(()=>document.querySelector('#detailShuffle').getAttribute('aria-pressed')==='true' && !document.querySelector('#detailShuffle').disabled);
await page.locator('#detailRepeat').selectOption('context');await page.waitForFunction(()=>document.querySelector('#detailRepeat').value==='context' && !document.querySelector('#detailRepeat').disabled);
assert.equal(commands.at(-1).body.repeat,'context');await page.locator('#closePlayback').click();await page.waitForFunction(()=>!document.querySelector('#playbackDialog').open);
await page.locator('#homeVolume').fill('65');await page.locator('#homeVolume').dispatchEvent('change');await page.waitForTimeout(450);assert.equal(commands.at(-1).body.volume,65);
await page.locator('#homeSeek').fill('500');await page.locator('#homeSeek').dispatchEvent('change');await page.waitForTimeout(450);assert.equal(commands.at(-1).body.position_ms,120000);
await page.locator('#shelfView').selectOption('albums');assert.equal(await page.locator('.shelfRecord').count(),10);await page.locator('.shelfRecord').first().click();await page.waitForFunction(()=>!document.querySelector('#music').dataset.loadingRecord);assert.equal(commands.at(-1).body.context_uri,'spotify:album:Album0');
fail=true;await page.locator('.shelfRecord').nth(1).click();await page.waitForFunction(()=>!document.querySelector('#music').dataset.loadingRecord);assert.match(await page.locator('#homePlaybackStatus').innerText(),/No active Spotify/);assert.equal(await page.locator('.recordFlightVinyl').count(),0);
await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.shelfRecord').nth(1).click();assert.equal(await page.locator('.recordFlightVinyl').count(),0);await page.waitForFunction(()=>!document.querySelector('#music').dataset.loadingRecord);
consent=true;state={...state,url:'https://open.spotify.com/track/NeedsPermission'};await page.evaluate(()=>{window.likeConnects=0;MidnightApp.connectSpotify=async()=>{window.likeConnects++;};return MidnightApp.refreshPlayer();});await page.waitForFunction(()=>document.querySelector('#homeLike').getAttribute('aria-label')==='Connect Spotify to enable Liked Songs');const saves=commands.filter(x=>x.path.endsWith('/liked')).length;await page.locator('#homeLike').click();assert.equal(await page.evaluate(()=>window.likeConnects),1);assert.equal(commands.filter(x=>x.path.endsWith('/liked')).length,saves);assert.equal(await page.locator('#playbackDialog').evaluate(e=>e.open),false);
assert.deepEqual(errors,[]);console.log('PASS: shelf selector, text-only preview, mirrored sleeve, contained listening controls, animation, direct song/album play, one-tap Liked Songs/checkmark/error retry, volume, shuffle, repeat, seek, errors, reduced motion and equal card geometry');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
