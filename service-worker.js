// sw.js
const CACHE_NAME = 'videoportfolio-v9';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icon-192x192.png',
  '/assets/icon-512x512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Не трогаем Dropbox, Telegram, видео
  if (url.hostname.includes('dropbox') || url.pathname.match(/\.(mp4|webm|mov)$/i)) {
    return fetch(e.request);
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).then(net => {
        if (net && net.status === 200 && net.type === 'basic') {
          const clone = net.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return net;
      });
    }).catch(() => {
      if (e.request.destination === 'document') {
        return caches.match('/index.html');
      }
    })
  );
});
