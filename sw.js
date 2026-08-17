const VERSION = '2026.08.17-1';
const CACHE = `daybook-${VERSION}`;
const SHELL = ['./','./index.html','./assets/app.css','./src/app.js','./manifest.webmanifest','./icons/icon.svg'];
const OPTIONAL = ['../shared/v1/sync.js'];
self.addEventListener('install', event => event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(SHELL);await Promise.all(OPTIONAL.map(url=>cache.add(url).catch(()=>null)));await self.skipWaiting();})()));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('daybook-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => { if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return; if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(response=>{caches.open(CACHE).then(cache=>cache.put('./index.html',response.clone()));return response;}).catch(()=>caches.match('./index.html')));return;} event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));});
self.addEventListener('message', event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
