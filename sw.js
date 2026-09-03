const VERSION = '2026.09.03-boxfix1';
const CACHE = `daybook-${VERSION}`;
const SHELL = [
  './', './index.html', './assets/app.css',
  './assets/fonts/lexend-400.woff2', './assets/fonts/lexend-700.woff2',
  './src/app.js', './src/sources.js', './src/merge.js', './src/day-model.js',
  './src/markdown.js', './src/store.js', './src/deployment.js', './src/sync.js', './src/version.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];
const SHARED = ['../shared/v1/sync.js', '../shared/v2/journal.js'];
// cache: 'reload' bypasses the browser's own HTTP cache — without it, a
// recently-visited asset can still be HTTP-cache-fresh and get copied
// straight into the new versioned CACHE unchanged, silently defeating a
// VERSION bump.
self.addEventListener('install', (event) => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await Promise.all(SHELL.map(async (url) => {
    const response = await fetch(new Request(url, { cache: 'reload' }));
    if (!response.ok) throw new Error(`Could not cache ${url}: ${response.status}`);
    await cache.put(url, response);
  }));
  await Promise.all(SHARED.map((url) => fetch(new Request(url, { cache: 'reload' }))
    .then((response) => (response.ok ? cache.put(url, response) : null))
    .catch(() => null)));
  await self.skipWaiting();
})()));
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith('daybook-') && key !== CACHE).map((key) => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put('./index.html', response.clone()));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
