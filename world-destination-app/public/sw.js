// Service worker minimal : rend l'application installable et garde l'interface en cache.
// Seuls les fichiers de l'application (page, scripts, styles, icônes) sont mis en cache :
// jamais les données ni les documents des clients.
const CACHE = 'wd-v2';
const STATIQUE = /\.(?:js|css|png|svg|webmanifest|woff2?)$/;
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = e.request.mode === 'navigate';
  if (!navigation && !STATIQUE.test(url.pathname)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copie = res.clone(); caches.open(CACHE).then((c) => c.put(navigation ? './index.html' : e.request, copie)); }
        return res;
      })
      .catch(() => caches.match(navigation ? './index.html' : e.request).then((r) => r || caches.match('./index.html')))
  );
});
