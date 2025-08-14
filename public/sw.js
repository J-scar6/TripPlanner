const CACHE = 'trip-planner-v1';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Cache-first for built assets & Tailwind CDN
  if (url.pathname.startsWith('/assets/') || url.hostname.includes('cdn.tailwindcss.com')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(request).then(hit => hit || fetch(request).then(resp => {
          cache.put(request, resp.clone());
          return resp;
        }))
      )
    );
    return;
  }

  // Network-first for everything else; fallback to cache or index
  e.respondWith(
    fetch(request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return resp;
    }).catch(() => caches.match(request).then(hit => hit || caches.match('/index.html')))
  );
});
