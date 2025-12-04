// SillyDog: self-destructing service worker to fix bad caches

const CACHE_NAME = "sillydog-cache-v1";

// On install: activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// On activate: clear all caches and unregister this SW
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});

// Do NOT intercept any requests – let the browser hit the network normally
self.addEventListener("fetch", (_event) => {
  // no respondWith = no caching, no interference
});
