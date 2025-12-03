// sw.js — оптимизированная версия
const CACHE = 'videoportfolio-v12';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icon-192x192.png',
  '/assets/icon-512x512.png',
  '/assets/preview-1200x630.jpg'
];

// Установка
self.addEventListener('install', e => {
  console.log('[Service Worker] Установка');
  self.skipWaiting();
  
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.log('[SW] Ошибка кэширования при установке:', err))
  );
});

// Активация
self.addEventListener('activate', e => {
  console.log('[Service Worker] Активация');
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE) {
            console.log('[SW] Удаление старого кэша:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Обработка запросов
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isExternal = url.origin !== self.location.origin;
  
  // Пропускаем внешние ресурсы (Dropbox, YouTube и т.д.)
  if (isExternal) {
    return;
  }
  
  // Для навигационных запросов (страниц)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/index.html').then(cachedResponse => {
        return cachedResponse || fetch(e.request);
      })
    );
    return;
  }
  
  // Для статических ресурсов (CSS, JS, шрифты)
  e.respondWith(
    caches.match(e.request)
      .then(cached => {
        if (cached) return cached;
        
        return fetch(e.request)
          .then(networkResponse => {
            // Кэшируем только успешные ответы
            if (networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE)
                .then(cache => cache.put(e.request, clone))
                .catch(err => console.log('[SW] Ошибка кэширования:', err));
            }
            return networkResponse;
          })
          .catch(() => {
            // Fallback для важных ресурсов
            if (e.request.url.includes('.css')) {
              return new Response('/* Fallback CSS */', {
                headers: { 'Content-Type': 'text/css' }
              });
            }
            if (e.request.url.includes('.js')) {
              return new Response('// Fallback JS', {
                headers: { 'Content-Type': 'application/javascript' }
              });
            }
            return new Response('Оффлайн');
          });
      })
  );
});
