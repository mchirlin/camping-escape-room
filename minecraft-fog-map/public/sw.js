// Service Worker for Minecraft Fog Map PWA
const CACHE_NAME = 'fogmap-v1';

// Assets to pre-cache for offline use
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './apple-touch-icon.png',
  './favicon.png',
  './atlas.json',
  './atlas.png',
  './markers/wood.png',
  './markers/stick.png',
  './markers/iron.png',
  './markers/string.png',
  './markers/gold.png',
  './markers/diamond.png',
  './markers/gunpowder.png',
  './markers/sand.png',
  './markers/redstone.png',
  './markers/coal.png',
  './markers/copper_ingot.png',
  './markers/amethyst_shard.png',
  './markers/paper.png',
  './markers/cobblestone.png',
  './markers/creeper.png',
  './markers/crafting.png',
  './markers/mine.png',
  './markers/tnt_chest.png',
  './markers/dig_site.png',
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API/Firebase, cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching for Firebase/Firestore requests
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebaseio.com')) {
    return;
  }

  // Skip caching for Leaflet tile requests
  if (url.hostname.includes('tile') || url.pathname.includes('/tile/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached if available, but also fetch fresh in background
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
