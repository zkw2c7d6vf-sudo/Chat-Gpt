/* App shell only: never cache API responses, credentials, article text or personal data.
   Bump the cache version whenever the shell or its local assets change. */
'use strict';
const CACHE = 'midnight-shell-r47-player-sounds';
const SHELL = '/static/index.html';
const ASSETS = [SHELL,"/static/activity.js?v=r47-player-sounds", "/static/style.css?v=r47-player-sounds", "/static/polish.css?v=r47-player-sounds", "/static/command.css?v=r47-player-sounds", "/static/icons.js?v=r47-player-sounds", "/static/command-core.js?v=r47-player-sounds", "/static/ui.js?v=r47-player-sounds", "/static/notifications.css?v=r47-player-sounds", "/static/notifications.js?v=r47-player-sounds", "/static/focus.js?v=r47-player-sounds", "/static/weather.js?v=r47-player-sounds", "/static/widget-core.js?v=r47-player-sounds", "/static/app.js?v=r47-player-sounds", "/static/today.css?v=r47-player-sounds", "/static/today-core.js?v=r47-player-sounds", "/static/capture-store.js?v=r47-player-sounds", "/static/capture.js?v=r47-player-sounds", "/static/calm.js?v=r47-player-sounds", "/static/command.js?v=r47-player-sounds", "/static/calendar.js?v=r47-player-sounds", "/static/today.js?v=r47-player-sounds", "/static/calm.css?v=r47-player-sounds", "/static/wallpaper.css?v=r47-player-sounds", "/static/wallpaper.js?v=r47-player-sounds", "/static/widgets.css?v=r47-player-sounds", "/static/widgets.js?v=r47-player-sounds", "/static/toolbar-core.js?v=r47-player-sounds", "/static/toolbar.js?v=r47-player-sounds", "/static/toolbar.css?v=r47-player-sounds", "/static/responsive.css?v=r47-player-sounds", "/static/liquid-glass.css?v=r47-player-sounds", "/static/home-controls.css?v=r47-player-sounds", "/static/home-controls.js?v=r47-player-sounds", "/static/drive.css?v=r47-player-sounds", "/static/drive.js?v=r47-player-sounds", "/static/create-menu.js?v=r47-player-sounds", "/static/focus-session.css?v=r47-player-sounds", "/static/utility-surfaces.css?v=r47-player-sounds", "/static/spotify-player.css?v=r47-player-sounds", "/static/spotify-player.js?v=r47-player-sounds", "/static/file-tools.css?v=r47-player-sounds", "/static/file-tools.js?v=r47-player-sounds", "/static/sounds.js?v=r47-player-sounds", "/static/christmas-tree.jpg", "/static/spotify-logo.png", "/static/wallpapers/scenes.json?v=r47-player-sounds", "/static/wallpapers/nature-long.jpg", "/static/wallpapers/rain-long.jpg", "/static/icons/wind.svg", "/static/icons/cloud-sun.svg", "/static/icons/cloud-snow.svg", "/static/icons/cloud-fog.svg", "/static/icons/mic.svg", "/static/icons/cloud-lightning.svg", "/static/icons/sun.svg", "/static/icons/cloud-moon.svg", "/static/icons/cloud-rain.svg", "/static/icons/map-pin.svg", "/static/icons/cloud.svg", "/static/icons/locate-fixed.svg", "/static/icons/moon.svg"];
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
