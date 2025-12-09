const CACHE_NAME = 'videoportfolio-v1.3';
const STATIC_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/icon-192x192.png',
    '/assets/icon-512x512.png',
    '/assets/preview-1200x630.jpg'
];

self.addEventListener('install', event => {
    console.log('[Service Worker] Установка');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Кэширование статических файлов');
                return cache.addAll(STATIC_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    console.log('[Service Worker] Активация');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Пропускаем видео и большие медиафайлы
    if (url.pathname.endsWith('.mp4') || 
        url.pathname.endsWith('.jpg') || 
        url.hostname.includes('dropboxusercontent.com')) {
        return;
    }
    
    // Для статических файлов используем Cache First
    if (url.pathname === '/' || 
        url.pathname.includes('assets/') || 
        url.pathname === '/manifest.json') {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request)
                        .then(response => {
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                            return response;
                        });
                })
                .catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('/');
                    }
                })
        );
        return;
    }
    
    // Для всего остального используем Network First
    event.respondWith(
        fetch(event.request)
            .then(response => {
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});
