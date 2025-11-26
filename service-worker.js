const CACHE_NAME = 'videoportfolio-v5';
const STATIC_CACHE = 'static-v5';
const DYNAMIC_CACHE = 'dynamic-v5';

// Статические ресурсы для кэширования
const staticAssets = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/icon-192x192.png',
    '/assets/icon-512x512.png'
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

// Функция для кэширования динамических запросов
const cacheDynamicData = async (request, response) => {
    try {
        const cache = await openCache(DYNAMIC_CACHE);
        await cache.put(request, response.clone());
        return response;
    } catch (error) {
        console.log('Cache dynamic data error:', error);
        return response;
    }
};

// Проверка, является ли запрос видео (без опциональной цепочки)
const isVideoRequest = (request) => {
    const url = request.url.toLowerCase();
    const acceptHeader = request.headers.get('Accept');
    return url.includes('.mp4') || 
           url.includes('.webm') ||
           url.includes('.avi') ||
           url.includes('dropboxusercontent.com') ||
           (acceptHeader && acceptHeader.includes('video')) ||
           url.includes('video');
};

// Проверка, является ли запрос большим файлом
const isLargeFile = (request) => {
    const url = request.url.toLowerCase();
    return url.includes('large') || 
           url.includes('big') ||
           url.includes('highres') ||
           url.includes('original') ||
           url.includes('raw') ||
           url.includes('uncompressed');
};

// Функция для получения из кэша с fallback
const getFromCache = async (request) => {
    try {
        // Пытаемся получить из статического кэша
        const staticCache = await caches.open(STATIC_CACHE);
        const staticResponse = await staticCache.match(request);
        if (staticResponse) return staticResponse;

        // Пытаемся получить из динамического кэша
        const dynamicCache = await caches.open(DYNAMIC_CACHE);
        const dynamicResponse = await dynamicCache.match(request);
        if (dynamicResponse) return dynamicResponse;

        // Если нет в кэше, делаем сетевой запрос
        const networkResponse = await fetch(request);
        
        // Кэшируем успешные ответы (кроме видео и больших файлов)
        if (networkResponse.status === 200 && 
            !isVideoRequest(request) && 
            !isLargeFile(request)) {
            await cacheDynamicData(request, networkResponse);
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Cache fallback error:', error);
        
        // Fallback для страниц
        if (request.mode === 'navigate') {
            const staticCache = await caches.open(STATIC_CACHE);
            const fallback = await staticCache.match('/index.html');
            if (fallback) return fallback;
        }
        
        // Возвращаем ошибку для остальных случаев
        return new Response('Network error happened', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
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
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName !== CACHE_NAME) {
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

// Перехват запросов
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Пропускаем неподдерживаемые схемы
    if (request.url.startsWith('chrome-extension://') ||
        request.url.includes('extension') ||
        !(request.url.startsWith('http'))) {
        return;
    }

    // Для видео и больших файлов - только сетевой запрос
    if (isVideoRequest(request) || isLargeFile(request)) {
        event.respondWith(
            fetch(request).catch(error => {
                console.log('Video fetch failed:', error);
                return new Response('Video load failed');
            })
        );
        return;
    }

    // Для API запросов - Network First стратегия
    if (url.pathname.includes('/api/') || url.pathname.includes('/data/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Кэшируем успешные API ответы
                    if (response.status === 200) {
                        return cacheDynamicData(request, response);
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback для API
                    return caches.match(request);
                })
        );
        return;
    }

    // Для остальных запросов - Cache First стратегия
    event.respondWith(getFromCache(request));
});

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
    console.log('Background sync:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

// Функция фоновой синхронизации
const doBackgroundSync = async () => {
    console.log('Doing background sync...');
    // Здесь можно добавить логику синхронизации данных
};

// Обработка push уведомлений
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const options = {
            body: data.body || 'Новое уведомление',
            icon: '/assets/icon-192x192.png',
            badge: '/assets/icon-192x192.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/'
            },
            actions: [
                {
                    action: 'open',
                    title: 'Открыть'
                },
                {
                    action: 'close',
                    title: 'Закрыть'
                }
            ]
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
