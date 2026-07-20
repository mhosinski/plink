// plink service worker: offline play + eviction-resistant install.
// Strategy: stale-while-revalidate — serve from cache instantly, refresh
// the cache from the network in the background, so an installed app
// works offline and picks up each deploy on its next launch.
// index.html, game.js, styles.css, and rules.js are a matched set (the
// markup ids, class names, and import surface must agree). Bump CACHE
// whenever any of those surfaces change, not just when the asset list
// does: install-time addAll re-caches the set atomically, closing the
// skew window a runtime refresh could leave.
const CACHE = 'plink-v3';
const ASSETS = ['./', './index.html', './game.js', './styles.css', './rules.js',
                './manifest.webmanifest',
                './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(cached => {
    const fresh = fetch(e.request).then(res => {
      if (res.ok){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
