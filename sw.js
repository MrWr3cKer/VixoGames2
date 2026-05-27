const CACHE_NAME = "vixo-shell-v24";

const SHELL = [
  "index.html",
  "games/index.html",
  "categories.html",
  "about.html",
  "contact.html",
  "privacy.html",
  "404.html",
  "css/styles.css",
  "css/kid-friendly.css",
  "css/fantasy-magic.css",
  "css/kid-animations.css",
  "css/ads.css",
  "css/crazy-hub.css",
  "css/contact.css",
  "css/categories-page.css",
  "css/mobile.css",
  "js/routes.js",
  "js/animations.js",
  "js/magic-bg.js",
  "js/thumb-bg.js",
  "js/storage.js",
  "js/ui.js",
  "js/gamepix.js",
  "js/categories-page.js",
  "js/home.js",
  "js/ad-slot.js",
  "js/play.js",
  "logo/logo.png",
];

const HTML_PATHS = new Set(SHELL.filter(function (p) {
  return p.endsWith(".html");
}));

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
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  var path = url.pathname.replace(/^\//, "");
  var isHtml = HTML_PATHS.has(path) || path.endsWith(".html");

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(event.request).then(function (cached) {
            return cached || caches.match("index.html") || caches.match("404.html");
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(function () {
          return cached;
        });
      return cached || network;
    })
  );
});
