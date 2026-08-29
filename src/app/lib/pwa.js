/* Registers the app-shell service worker (public/sw.js, scope /app).

   Called from AppRoot so only /app visitors ever register it — the
   marketing site stays a plain website. Production builds only: under
   the dev server the worker's cached shell can't satisfy on-demand
   module requests, and HMR fights stale caches.

   Offline support is progressive — every failure path here is
   silent, and the app works identically without it. */

export function registerAppServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/app" }).catch(() => {});
  });
}
