/* Saathban app-shell service worker — registered with scope /app by
   src/app/lib/pwa.js, production only.

   Basic offline support (SPEC.md, Technical: PWA, installable):
   - the shell (/app HTML, manifest, icons, logo) is precached
   - app navigations are network-first with the cached shell as the
     offline fallback
   - hashed build assets are cache-first (immutable by filename)
   - everything else — Supabase, fonts, marketing pages — passes
     through untouched

   Bump VERSION on any change to this file: activation drops old
   caches. Offline log QUEUEING (SPEC.md, daily logs) is a later,
   separate piece — this file only keeps the shell opening. */

const VERSION = "saathban-app-v1";

const SHELL = [
  "/app",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/logo-extended.png",
  "/logo-sb.png",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Cross-origin (Supabase, Google Fonts) is never intercepted.
  if (url.origin !== self.location.origin) return;

  // App navigations: fresh when online, cached shell when not.
  if (request.mode === "navigate" && url.pathname.startsWith("/app")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put("/app", copy));
          return response;
        })
        .catch(() => caches.match("/app"))
    );
    return;
  }

  // Hashed build output and icons: immutable, cache-first.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
