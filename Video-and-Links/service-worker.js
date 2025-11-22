const CACHE_NAME = 'portfolio-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icon-192x192.png',
  '/assets/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(error => {
        console.log('Cache installation failed:', error);
      })
  );
});

self.addEventListener('fetch', event => {
  // Не кэшируем видео и большие файлы
  if (event.request.url.includes('.mp4') || 
      event.request.url.includes('dropboxusercontent.com')) {
    return fetch(event.request);
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
      .catch(() => {
        // Fallback при ошибках
        return caches.match('/index.html');
      })
  );
});
