const CACHE_NAME = 'videoportfolio-v6';
const STATIC_CACHE = 'static-v6';

// Статические ресурсы для кэширования
const staticAssets = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/icon-192x192.png',
    '/assets/icon-512x512.png'
];

// Домены, которые НЕ нужно кэшировать (только сетевые запросы)
const EXTERNAL_DOMAINS = [
    'dl.dropboxusercontent.com',
    'dropbox.com',
    'youtube.com',
    'youtu.be',
    'instagram.com',
    'fonts.bunny.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];

// Функция для открытия кэша
const openCache = async (cacheName) => {
    return await caches.open(cacheName);
};

// Функция для кэширования статических ресурсов
const cacheStaticAssets = async () => {
    try {
        const cache = await openCache(STATIC_CACHE);
        return await cache.addAll(staticAssets);
    } catch (error) {
        console.log('Cache static assets error:', error);
    }
};

// Проверка, является ли запрос внешним (не кэшируем)
const isExternalRequest = (request) => {
    const url = request.url.toLowerCase();
    return EXTERNAL_DOMAINS.some(domain => url.includes(domain));
};

// Проверка, является ли запрос видео
const isVideoRequest = (request) => {
    const url = request.url.toLowerCase();
    const acceptHeader = request.headers.get('Accept');
    return url.includes('.mp4') || 
           url.includes('.webm') ||
           url.includes('.avi') ||
           (acceptHeader && acceptHeader.includes('video')) ||
           url.includes('video');
};

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        Promise.all([
            cacheStaticAssets(),
            self.skipWaiting()
        ]).catch(error => {
            console.log('Install error:', error);
        })
    );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        Promise.all([
            // Очищаем старые кэши
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            self.clients.claim()
        ]).catch(error => {
            console.log('Activate error:', error);
        })
    );
});

// Перехват запросов - УПРОЩЕННАЯ ВЕРСИЯ
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = request.url;

    // 1. Пропускаем неподдерживаемые схемы и не-GET запросы
    if (request.method !== 'GET' ||
        url.startsWith('chrome-extension://') ||
        url.includes('extension') ||
        !(url.startsWith('http'))) {
        return;
    }

    // 2. ВСЕ внешние запросы (Dropbox, видео, шрифты) - только сеть, НЕ кэшируем
    if (isExternalRequest(request) || isVideoRequest(request)) {
        event.respondWith(fetch(request));
        return;
    }

    // 3. Только для локальных статических файлов - Cache First
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                // Если есть в кэше - возвращаем
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Иначе - сетевой запрос
                return fetch(request)
                    .then((networkResponse) => {
                        // Кэшируем только успешные ответы для локальных ресурсов
                        if (networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(STATIC_CACHE)
                                .then((cache) => {
                                    cache.put(request, responseToCache);
                                });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Fallback для страниц
                        if (request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('Network error', { status: 408 });
                    });
            })
    );
});

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
    console.log('Background sync:', event.tag);
});

// Обработка push уведомлений
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const options = {
            body: data.body || 'Новое уведомление',
            icon: '/assets/icon-192x192.png',
            badge: '/assets/icon-192x192.png',
            data: {
                url: data.url || '/'
            }
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'Уведомление', options)
        );
    } catch (error) {
        console.log('Push notification error:', error);
    }
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});
