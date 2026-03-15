// Update the version number to force a total reset
const CACHE_NAME = 'cycle-flow-v7';

// We removed './manifest.json' from this list to prevent iOS confusion
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js'
];

// --- INSTALL EVENT ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting(); 
});

// --- ACTIVATE EVENT ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// --- FETCH EVENT (Development Friendly) ---
self.addEventListener('fetch', (event) => {
  event.respondWith(
    // Try the network first
    fetch(event.request).catch(() => {
      // If network fails (offline), then look in the cache
      return caches.match(event.request);
    })
  );
});
