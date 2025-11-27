// Service Worker для видеопортфолио - минимальная версия
const CACHE_NAME = 'videoportfolio-vercel-v1';

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('🎬 Service Worker: Установка...');
  self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker: Активация...');
  event.waitUntil(self.clients.claim());
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // НЕ кэшируем видео и большие медиафайлы
  if (url.pathname.match(/\.(mp4|webm|avi|mov|mpeg)$/i) || 
      url.hostname.includes('dropboxusercontent.com')) {
    return;
  }
  
  // Для HTML - сеть сначала, потом кэш
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  
  // Для остального - стандартная стратегия
  event.respondWith(
    caches.match(request)
      .then(response => response || fetch(request))
  );
});
