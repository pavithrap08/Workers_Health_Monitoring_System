const CACHE_NAME = "worker-safety-pwa-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  // Add if you have:
  // "./icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(()=>{})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// Cache-first for same-origin static assets.
// Network-only for external APIs (ThingSpeak) to avoid stale safety data.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // External (ThingSpeak etc.) -> Network only
  if (url.origin !== self.location.origin){
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);

    if (cached) return cached;

    const res = await fetch(event.request);
    // Cache successful GET requests
    if (event.request.method === "GET" && res && res.ok){
      cache.put(event.request, res.clone()).catch(()=>{});
    }
    return res;
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
});
