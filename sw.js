/* App shell only: never cache API responses, credentials, article text or personal data.
   Bump the cache version whenever the shell or its local assets change. */
'use strict';
const CACHE = 'midnight-shell-r46-review';
const SHELL = '/static/index.html';
const ASSETS = [SHELL,"/static/activity.js?v=r46-review", "/static/style.css?v=r46-review", "/static/polish.css?v=r46-review", "/static/command.css?v=r46-review", "/static/icons.js?v=r46-review", "/static/command-core.js?v=r46-review", "/static/ui.js?v=r46-review", "/static/notifications.css?v=r46-review", "/static/notifications.js?v=r46-review", "/static/focus.js?v=r46-review", "/static/weather.js?v=r46-review", "/static/widget-core.js?v=r46-review", "/static/app.js?v=r46-review", "/static/today.css?v=r46-review", "/static/today-core.js?v=r46-review", "/static/capture-store.js?v=r46-review", "/static/capture.js?v=r46-review", "/static/calm.js?v=r46-review", "/static/command.js?v=r46-review", "/static/calendar.js?v=r46-review", "/static/today.js?v=r46-review", "/static/calm.css?v=r46-review", "/static/wallpaper.css?v=r46-review", "/static/wallpaper.js?v=r46-review", "/static/widgets.css?v=r46-review", "/static/widgets.js?v=r46-review", "/static/toolbar-core.js?v=r46-review", "/static/toolbar.js?v=r46-review", "/static/toolbar.css?v=r46-review", "/static/responsive.css?v=r46-review", "/static/liquid-glass.css?v=r46-review", "/static/home-controls.css?v=r46-review", "/static/home-controls.js?v=r46-review", "/static/drive.css?v=r46-review", "/static/drive.js?v=r46-review", "/static/create-menu.js?v=r46-review", "/static/focus-session.css?v=r46-review", "/static/utility-surfaces.css?v=r46-review", "/static/spotify-player.css?v=r46-review", "/static/spotify-player.js?v=r46-review", "/static/file-tools.css?v=r46-review", "/static/file-tools.js?v=r46-review", "/static/sounds.js?v=r46-review", "/static/christmas-tree.jpg", "/static/spotify-logo.png", "/static/wallpapers/scenes.json?v=r46-review", "/static/wallpapers/nature-long.jpg", "/static/wallpapers/rain-long.jpg", "/static/icons/wind.svg", "/static/icons/cloud-sun.svg", "/static/icons/cloud-snow.svg", "/static/icons/cloud-fog.svg", "/static/icons/mic.svg", "/static/icons/cloud-lightning.svg", "/static/icons/sun.svg", "/static/icons/cloud-moon.svg", "/static/icons/cloud-rain.svg", "/static/icons/map-pin.svg", "/static/icons/cloud.svg", "/static/icons/locate-fixed.svg", "/static/icons/moon.svg"];
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
