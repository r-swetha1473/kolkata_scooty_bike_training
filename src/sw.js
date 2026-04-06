/**
 * Service worker — cache only long-lived static assets.
 * Never cache index.html, *.js, or *.css (hashed Angular chunks). Serving stale
 * bundles causes "Failed to fetch dynamically imported module" after deploy.
 */
const VERSION = 'v5-chunk-safe';
const STATIC_CACHE = `kolkata-scotty-static-${VERSION}`;
const PRECACHE_URLS = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {})
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== STATIC_CACHE) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

function isAppShellOrChunk(url, request) {
  const path = url.pathname;
  if (request.mode === 'navigate' || request.destination === 'document') {
    return true;
  }
  if (path === '/' || path.endsWith('.html')) {
    return true;
  }
  if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.css') || path.endsWith('.map')) {
    return true;
  }
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== location.origin) {
    return;
  }

  if (isAppShellOrChunk(url, request)) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => {
        if (request.mode === 'navigate' || request.destination === 'document') {
          return fetch(new Request('/index.html', { cache: 'no-store' }));
        }
        return new Response('', { status: 504, statusText: 'Network Error' });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-bookings') {
    event.waitUntil(Promise.resolve());
  }
});
