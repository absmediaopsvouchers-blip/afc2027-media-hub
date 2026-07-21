/* =============================================================================
   Service worker — offline-friendly app shell for the Media Hub PWA.

   Strategy:
     • App shell (HTML/CSS/JS/icons): cache-first, refreshed in the background.
     • API calls (/api/*): always network — never cached (data must be live and
       the daily voucher limits must be enforced server-side).
   ========================================================================== */

const CACHE = 'media-hub-v17';

const SHELL = [
  '/',
  '/index.html',
  '/admin.html',
  '/css/styles.css',
  '/css/admin.css',
  '/js/common.js',
  '/js/push.js',
  '/js/app.js',
  '/js/admin.js',
  '/vendor/jsqr.js',
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

  // Manifest reflects admin-configured branding (name + logo) — always fetch
  // fresh so the install prompt and home-screen icon stay current; fall back to
  // the last cached copy when offline.
  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

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

/* ---- Web Push: News notifications ------------------------------------------
   Payload shape (set by src/push.js on the server):
     { title, body, icon, badge, data: { article_id, category, deep_link_url } }
   ========================================================================== */

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { /* non-JSON push — ignore */ }

  const title = payload.title || 'Media Hub update';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/notification-icon-256.png',
    badge: payload.badge || '/icons/notification-badge-96.png',
    data: payload.data || {},
    tag: (payload.data && payload.data.article_id) || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.deep_link_url) || '/#news';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
