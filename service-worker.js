const CACHE_NAME = 'videoportfolio-v4';
const STATIC_CACHE = 'static-v4';
const DYNAMIC_CACHE = 'dynamic-v4';

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
    const cache = await openCache(STATIC_CACHE);
    return await cache.addAll(staticAssets);
};

// Функция для кэширования динамических запросов
const cacheDynamicData = async (request, response) => {
    const cache = await openCache(DYNAMIC_CACHE);
    await cache.put(request, response.clone());
    return response;
};

// Проверка, является ли запрос видео
const isVideoRequest = (request) => {
    const url = request.url.toLowerCase();
    return url.includes('.mp4') || 
           url.includes('dropboxusercontent.com') ||
           request.headers.get('Accept')?.includes('video') ||
           url.includes('video');
};

// Проверка, является ли запрос большим файлом
const isLargeFile = (request) => {
    const url = request.url.toLowerCase();
    return url.includes('large') || 
           url.includes('big') ||
           url.includes('highres') ||
           url.includes('original');
};

// Функция для получения из кэша с fallback
const getFromCache = async (request) => {
    // Пытаемся получить из статического кэша
    const staticCache = await caches.open(STATIC_CACHE);
    const staticResponse = await staticCache.match(request);
    if (staticResponse) return staticResponse;

    // Пытаемся получить из динамического кэша
    const dynamicCache = await caches.open(DYNAMIC_CACHE);
    const dynamicResponse = await dynamicCache.match(request);
    if (dynamicResponse) return dynamicResponse;

    // Если нет в кэше, делаем сетевой запрос
    try {
        const networkResponse = await fetch(request);
        
        // Кэшируем успешные ответы (кроме видео и больших файлов)
        if (networkResponse.status === 200 && 
            !isVideoRequest(request) && 
            !isLargeFile(request)) {
            await cacheDynamicData(request, networkResponse);
        }
        
        return networkResponse;
    } catch (error) {
        // Fallback для страниц
        if (request.destination === 'document' || request.mode === 'navigate') {
            return await staticCache.match('/index.html');
        }
        
        throw error;
    }
};

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        Promise.all([
            cacheStaticAssets(),
            self.skipWaiting()
        ])
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
        ])
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

    // Для видео и больших файлов - только сетевой запрос (НЕ КЭШИРУЕМ)
    if (isVideoRequest(request) || isLargeFile(request)) {
        event.respondWith(fetch(request));
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

    // Для статических ресурсов - Cache First стратегия
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
