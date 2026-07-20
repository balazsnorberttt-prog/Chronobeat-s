/* ChronoBeats service worker — app shell + futasideju cache.
   FONTOS: a Deezer API es a preview-hangok SOHA nem kerulnek cache-be. */
const CACHE = 'chronobeats-v16';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const cacheFirst = async (req) => {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) {
    const c = await caches.open(CACHE);
    c.put(req, res.clone());
  }
  return res;
};

const staleWhileRevalidate = async (req) => {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  const net = fetch(req)
    .then((res) => {
      if (res && res.ok) c.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || net.then((r) => r || Response.error());
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Kulso cimek: Deezer/dzcdn SOHA nem cache-elodik; Google Fonts igen
  if (url.origin !== self.location.origin) {
    if (url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic')) {
      e.respondWith(cacheFirst(req));
    }
    return; // minden mas kulso keres erintetlen (deezer, dzcdn, github modellek)
  }

  // 3D modellek: cache-first (nagy, ritkan valtozo fajlok)
  if (url.pathname.startsWith('/models/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(cacheFirst(req));
    return;
  }

  // Navigacio: halozat elonyben, offline eseten a cache-elt apphej
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('/index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Minden mas sajat asset (JS/CSS): cache + hatterfrissites
  e.respondWith(staleWhileRevalidate(req));
});
