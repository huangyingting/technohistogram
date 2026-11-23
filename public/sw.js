// Service Worker for 技术演进全图 · Technology Histomap
const CACHE_VERSION = 'histomap-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(['./', './app.webmanifest', './icon.svg']).catch(() => {}),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('histomap-') && k !== STATIC_CACHE && k !== DATA_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin !== self.location.origin) return;

  const isDataOrAsset =
    /\/(data|arrival|assets|_next\/static)\//.test(url.pathname) ||
    /\.(woff2?|ttf|png|jpg|webp|svg|webmanifest)$/.test(url.pathname);

  if (isDataOrAsset) {
    const targetCache = /\/data\//.test(url.pathname) ? DATA_CACHE : STATIC_CACHE;
    event.respondWith(
      caches.open(targetCache).then(async (cache) => {
        const cached = await cache.match(req);
        const networkFetch = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      }),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match('./'))),
    );
  }
});
