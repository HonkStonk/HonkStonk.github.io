// A simple Service Worker - for initial setup (no caching yet)

self.addEventListener('install', event => {
    console.log('Service Worker installed');
});

self.addEventListener('fetch', event => {
    //  Later, we'll add logic to serve from cache or network
});