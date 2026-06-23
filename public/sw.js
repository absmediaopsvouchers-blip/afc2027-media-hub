/* =============================================================================
   Service worker — offline-friendly app shell for the Media Hub PWA.

   Strategy:
     • App shell (HTML/CSS/JS/icons): cache-first, refreshed in the background.
     • API calls (/api/*): always network — never cached (data must be live and
       the daily voucher limits must be enforced server-side).
   ========================================================================== */

const CACHE = 'media-hub-v4';

const SHELL = [
  '/',
  '/index.html',
  '/admin.html',
  '/css/styles.css',
  '/css/admin.css',
  '/js/common.js',
  '/js/app.js',
  '/js/admin.js',
  '/manifest.webmanifest',
  '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API responses — always go to the network.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req).catch(() => new Response(
      JSON.stringify({ error: 'You appear to be offline.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // App shell: serve from cache, then refresh the cached copy in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
