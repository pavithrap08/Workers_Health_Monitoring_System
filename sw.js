self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("worker-safety-pwa-v1").then((cache) =>
      cache.addAll([
        "./",
        "./index.html",
        "./app.js",
        "./manifest.json",
        "./icon-192.png",
        "./icon-512.png"
      ].filter(Boolean))
    )
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();
});
