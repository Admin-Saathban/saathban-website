/* Saathban app-shell service worker — scope /app, registered by
   src/app/lib/pwa.js, production only.

   ─── WHY THIS WAS REWRITTEN ───

   The previous worker could not update. Its cache name was the string
   literal "saathban-app-v1" in a file with exactly one commit in its
   history, and the deployed copy was byte-identical to the repo. A
   browser only installs a new worker when the SCRIPT BYTES CHANGE, so
   on every device that ever opened the app, install and activate had
   run precisely once, on the day it shipped. Old hashed bundles were
   therefore never deleted — cache-first, in a cache nobody would ever
   clear — and one failed navigation served a shell whose asset URLs
   all still resolved out of it. Not slow to update: incapable of it.

   The version below is stamped with the commit hash at build time by
   the plugin in vite.config.js, so the bytes of this file differ on
   every deploy and an update is detectable at all.

   ─── THE THREE RULES ───

   1. The shell is NETWORK-FIRST WITH A DEADLINE. Cache is the answer
      when the network genuinely cannot answer — not when it is merely
      slow to. The request continues in the background after the
      deadline and refreshes the cache, so a bad minute costs one
      stale paint rather than a stale installation.

   2. A RESPONSE IS ONLY CACHED IF IT IS OK. The old worker cached
      whatever came back, so a captive portal page or a 5xx became the
      shell — a "successful" fetch that poisons the offline fallback.

   3. ONE CACHE PER BUILD, and every other one is deleted on activate.
      Safe here because the app builds to a single JS chunk: a running
      page has already loaded its bundle and asks for no lazy pieces.
      Were that to change, dropping the previous build's assets could
      strand a chunk mid-session and this would need to keep N-1. */

const VERSION = "__SB_SW_VERSION__";
/* WHICH SIDE IS OLDER cannot be read off a commit hash — hashes do
   not order. The page compares this instant with its own, so the
   notice fires only when the WORKER is newer than the PAGE, which
   is the one direction that means "you are looking at stale code".
   The reverse — worker behind a freshly loaded page — is the normal
   half-second after any deploy and must stay silent. */
const BUILT_AT = "__SB_SW_BUILT_AT__";
const CACHE = "saathban-app-" + VERSION;
const SHELL_URL = "/app";

/* Long enough not to punish a slow but working connection, short
   enough that nobody watches a white screen wondering. */
const NETWORK_DEADLINE_MS = 3000;

const SHELL = [
  SHELL_URL,
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
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      /* Prompt activation is deliberate: a worker that waits for every
         tab to close never activates on a phone, where the tab is the
         app and is never closed. */
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("saathban-app-") && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* The page asks what build this worker is, and compares it with its
   own. That comparison is what stops the update notice crying wolf on
   a fresh load, where the page ALREADY has the new code and only the
   worker was behind. */
self.addEventListener("message", (event) => {
  const data = event.data;

  /* ASKED TO STEP UP, because asking to on install is not reliable.

     Measured on the migration that matters — a device carrying the
     old pre-fix worker — this worker installed and then sat at
     "installed" in the waiting slot indefinitely, with the old one
     still active and controlling, despite skipWaiting() being
     called in its own install handler. Fifteen seconds, two
     navigations, no activation. So the page asks explicitly when it
     sees a worker waiting, and activation stops depending on a call
     whose effect could not be relied upon.

     Safe to activate under a live page ONLY because this app builds
     to a single JS chunk: the running page has its bundle already
     and asks for no lazy pieces, so dropping the previous build's
     cache cannot strand one mid-session. */
  if (data && data.type === "SB_SKIP_WAITING") { self.skipWaiting(); return; }

  if (!data || data.type !== "SB_VERSION") return;
  const reply = { type: "SB_VERSION", version: VERSION, builtAt: BUILT_AT };
  if (event.ports && event.ports[0]) event.ports[0].postMessage(reply);
  else if (event.source) event.source.postMessage(reply);
});

async function shellFirstFromNetwork(request) {
  const cache = await caches.open(CACHE);

  /* Kept alive past the deadline on purpose — whoever wins the race,
     this still refreshes the shell for next time. */
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(SHELL_URL, response.clone());
      return response;
    })
    .catch(() => null);

  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve(undefined), NETWORK_DEADLINE_MS);
  });

  const first = await Promise.race([network, deadline]);
  clearTimeout(timer);
  if (first) return first;

  const cached = await cache.match(SHELL_URL);
  if (cached) return cached;

  /* Nothing cached and the network was slow: wait it out rather than
     invent a failure. A first-ever load on a bad connection should be
     slow, not broken. */
  const late = await network;
  return late || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Cross-origin (Supabase, Google Fonts) is never intercepted.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname.startsWith("/app")) {
    event.respondWith(shellFirstFromNetwork(request));
    return;
  }

  // Hashed build output and icons: immutable by filename, cache-first,
  // inside THIS build's cache so the previous build's copies go away.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
