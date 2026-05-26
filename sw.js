const CACHE_NAME = "vixo-shell-v8";
const SHELL = [
  "index.html",
  "games/index.html",
  "play.html",
  "about.html",
  "privacy.html",
  "404.html",
  "ad-test.html",
  "css/styles.css",
  "css/kid-friendly.css",
  "css/fantasy-magic.css",
  "css/kid-animations.css",
  "css/ads.css",
  "css/home-pro.css",
  "js/routes.js",
  "js/animations.js",
  "js/magic-bg.js",
  "js/storage.js",
  "js/ui.js",
  "js/gamepix.js",
  "js/home.js",
  "js/ad-rail.js",
  "js/play.js",
  "logo/logo.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL).catch(function () {
        /* partial cache ok */
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) {
            return k !== CACHE_NAME;
          })
          .map(function (k) {
            return caches.delete(k);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      const network = fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(function () {
          return (
            cached ||
            caches.match("index.html") ||
            caches.match("404.html")
          );
        });
      return cached || network;
    })
  );
});
