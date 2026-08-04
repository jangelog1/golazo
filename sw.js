const CACHE = 'golazo-v7';   // v7: never serve the page or its data from the HTTP cache
const ASSETS = ['./', 'index.html', 'icon-512.png', 'manifest.webmanifest'];

// GitHub Pages sends `cache-control: max-age=600` on everything, including this file and
// index.html. Two consequences we have to defend against, both of which stranded an installed
// PWA on an old build:
//   1. A plain fetch() here can be answered from the browser's HTTP cache, so the worker would
//      re-cache a stale page and keep serving it long after a deploy.
//   2. On install, addAll() would bake that same stale copy into a brand-new cache version.
// So: HTML and data always go to the network with cache:'no-store', and the precache reloads.

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Only cache same-origin GETs; cross-origin (YouTube feed proxy, GDELT, ESPN) passes through.
  if (new URL(req.url).origin !== self.location.origin) return;

  // The page shell and the summaries file are the two things that must never be a version
  // behind. Everything else (icon, manifest) is fine from cache.
  const mustBeFresh = req.mode === 'navigate' || req.url.indexOf('/data/') !== -1;
  const hit = mustBeFresh ? fetch(req.url, { cache: 'no-store' }) : fetch(req);

  e.respondWith(
    hit.then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req).then(m => m || caches.match('index.html')))
  );
});
