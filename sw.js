const CACHE_NAME = 'english-v4';
const AUDIO_CACHE_NAME = 'english-audio-v2';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './episodes-index.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Install event - cache resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== AUDIO_CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    const url = event.request.url;
    
    // Handle audio files from archive.org - cache them for offline playback
    if (url.includes('archive.org') && url.includes('.mp3')) {
        event.respondWith(
            caches.open(AUDIO_CACHE_NAME).then(cache => {
                return cache.match(event.request).then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then(networkResponse => {
                        // Cache audio file for next time
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }
    
    // Skip other cross-origin requests
    if (!url.startsWith(self.location.origin)) {
        return;
    }
    
    // Skip chunk files - load them fresh each time to avoid caching issues
    if (url.includes('episodes-chunk-')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version if available
                if (response) {
                    return response;
                }
                // Otherwise fetch from network
                return fetch(event.request)
                    .then(response => {
                        // Only cache successful responses
                        if (response && response.status === 200 && response.type === 'basic') {
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                })
                                .catch(() => {}); // Silently fail cache write
                        }
                        return response;
                    })
                    .catch(err => {
                        // If fetch fails, return offline page or error
                        return new Response('Network error', {
                            status: 408,
                            headers: { 'Content-Type': 'text/plain' }
                        });
                    });
            })
            .catch(() => {
                // If cache match fails, fetch anyway
                return fetch(event.request);
            })
    );
});
