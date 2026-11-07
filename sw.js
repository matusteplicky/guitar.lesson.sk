// Release number comes from the registration URL (sw.js?v=N), which app.js takes from index.html.
const VER = new URL(self.location).searchParams.get('v') || '0', V = 'fretwork-' + VER;
const FILES = ['./', 'index.html', 'style.css?v=' + VER, 'theme.css?v=' + VER, 'look.json', 'engine.js?v=' + VER, 'sk.js?v=' + VER, 'config.js?v=' + VER, 'app.js?v=' + VER, 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x))))); self.clients.claim(); });
// network first, bypassing the browser's HTTP cache; saved copy only when offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
