/* App shell only: never cache API responses, credentials, article text or personal data.
   Bump the cache version whenever the shell or its local assets change. */
'use strict';
const CACHE = 'midnight-shell-v18-performance';
const SHELL = '/static/index.html';
const ASSETS = ['/static/widget-core.js','/static/widgets.js','/static/widgets.css','/static/wallpaper.js','/static/wallpaper.css','/static/wallpapers/nature-long.jpg','/static/wallpapers/rain-long.jpg','/static/calm.js','/static/calm.css','/static/today-core.js','/static/today.js','/static/today.css','/static/notifications.js','/static/notifications.css','/static/icons.js','/static/calendar.js','/static/icons/mic.svg','/static/command-core.js','/static/command.js','/static/command-spaces.css',SHELL, '/static/style.css', '/static/polish.css', '/static/ui.js',
  '/static/app.js', '/static/focus.js', '/static/weather.js',
  '/static/capture-store.js', '/static/capture.js', '/static/spotify-logo.png',
  '/static/christmas-tree.jpg', ...['cloud-fog','cloud-lightning','cloud-moon',
    'cloud-rain','cloud-snow','cloud-sun','cloud','locate-fixed','map-pin','moon',
    'sun','wind'].map(name => '/static/icons/' + name + '.svg')].map(path=>/\.(js|css)$/.test(path)?path+'?v=performance1':path);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
  // Loaded pages retain their DOM and drafts. The complete new shell is used on their next navigation.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('midnight-shell-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/app' || url.pathname === SHELL);
  if (navigation) {
    // Keep HTML and cached assets on the same release until the new worker activates.
    event.respondWith((async () => { const cache=await caches.open(CACHE); return await cache.match(SHELL) || fetch(request); })());
  } else if (ASSETS.includes(url.pathname+url.search)) {
    event.respondWith((async () => { const cache=await caches.open(CACHE); return await cache.match(request) || fetch(request); })());
  }
});
