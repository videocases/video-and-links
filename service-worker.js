// Service Worker для видеопортфолио
const CACHE_NAME = 'videoportfolio-v3';
const STATIC_CACHE = 'static-v3';
const DYNAMIC_CACHE = 'dynamic-v3';

// Статические ресурсы для кэширования
const STATIC_ASSETS = [
  '/',
  '/index.html',
  './manifest.json',
  './assets/icon-192x192.png',
  './assets/icon-512x512.png'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching Static Assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // Удаляем старые кэши
          if (cache !== STATIC_CACHE && cache !== DYNAMIC_CACHE && cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = request.url;

  // Пропускаем все видео и внешние домены - НЕ КЭШИРУЕМ ВИДЕО
  if (url.includes('.mp4') || 
      url.includes('.webm') || 
      url.includes('.avi') ||
      url.includes('dropboxusercontent.com') ||
      url.includes('fonts.bunny.net') ||
      url.includes('googleapis.com')) {
    return event.respondWith(fetch(request));
  }

  // Для HTML-страниц: сеть сначала, потом кэш
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Клонируем ответ для кэширования
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then((cache) => {
              cache.put(request, responseClone);
            });
          return response;
        })
        .catch(() => {
          // Если сеть недоступна, ищем в кэше
          return caches.match(request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match('/index.html');
            });
        })
    );
    return;
  }

  // Для статических ресурсов: кэш сначала, потом сеть
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((fetchResponse) => {
            // Проверяем валидность ответа
            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
              return fetchResponse;
            }

            // Клонируем ответ для кэширования
            const responseToCache = fetchResponse.clone();
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return fetchResponse;
          })
          .catch((error) => {
            console.log('Fetch failed; returning offline page', error);
            // Для изображений возвращаем placeholder
            if (request.destination === 'image') {
              return caches.match('/assets/icon-192x192.png');
            }
          });
      })
  );
});

// Фоновая синхронизация (если понадобится)
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
});

// Push-уведомления (если понадобится)
self.addEventListener('push', (event) => {
  console.log('Push notification received');
});
