// sw.js — финальная версия 2025
const CACHE = 'videoportfolio-v10';

const ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/assets/icon-192x192.png',
  '/assets/icon-512x512.png',
  '/assets/preview-1200x630.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Пропускаем всё внешнее и видео
  if (!url.origin.includes(self.location.origin) ||
      url.pathname.match(/\.(mp4|webm|mov|jpg|png|webp)$/i)) {
    return fetch(e.request);
  }

  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.status === 200) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      })
      .catch(() => caches.match(e.request) || caches.match('/index.html'))
  );
});
