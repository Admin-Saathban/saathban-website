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

   ─── THE FOUR RULES ───

   1. The shell is NETWORK-FIRST WITH A DEADLINE. Cache is the answer
      when the network genuinely cannot answer — not when it is merely
      slow to. The request continues in the background after the
      deadline and refreshes the cache, so a bad minute costs one
      stale paint rather than a stale installation.

   2. A RESPONSE IS ONLY CACHED IF IT IS OK. The old worker cached
      whatever came back, so a captive portal page or a 5xx became the
      shell — a "successful" fetch that poisons the offline fallback.

   3. ONE CACHE PER BUILD — AND THE LAST FEW BUILDS ARE KEPT.

      This used to delete every other build's cache on activate, which
      was safe only while the app was ONE JavaScript file: a running
      page had its whole bundle already and never asked for more.

      The app is split now. A page opened on Monday still loads pieces
      on demand on Tuesday — the admin screens, a language switch, the
      Games tab — and every one of those names a Monday file. Vercel
      serves only the current deployment, so after Tuesday's deploy the
      server answers those names with a 404. If activation had also
      thrown away Monday's cache, a person who had simply left the app
      open would find a screen that will not open.

      So each build's cache carries a marker saying when it was built,
      and activation keeps the newest KEEP_BUILDS of them. Assets are
      matched across ALL kept caches, so an older page finds its own
      files. A piece that older page never fetched cannot be in any
      cache; the page notices the failed import and reloads onto the
      current build once (src/main.jsx, vite:preloadError).

   4. THE CORE OF THE BUILD IS PRECACHED ON INSTALL, and whatever the
      page itself already loaded is handed over (SB_CACHE_URLS).

      Precache is the entry script and the app's static import graph —
      the shell, the header and bar, Home and the daily log — which is
      what has to be there for offline-first logging to open with no
      network at all. The list is injected at build time. Hashed files
      are served immutable, so on the device that just loaded them these
      fetches come out of the browser's HTTP cache and cost nothing.

      NOT precached: the other language, the admin screens, the other
      tabs. Downloading every screen and both languages on every deploy
      would spend a pensioner's mobile data on screens they never open.
      Those are cached the first time they are actually used. */

const VERSION = "__SB_SW_VERSION__";
/* WHICH SIDE IS OLDER cannot be read off a commit hash — hashes do
   not order. The page compares this instant with its own, so the
   notice fires only when the WORKER is newer than the PAGE, which
   is the one direction that means "you are looking at stale code".
   The reverse — worker behind a freshly loaded page — is the normal
   half-second after any deploy and must stay silent. */
const BUILT_AT = "__SB_SW_BUILT_AT__";
/* Hashed files of this build that must exist offline (rule 4). */
const PRECACHE = __SB_SW_PRECACHE__;

const CACHE_PREFIX = "saathban-app-";
const CACHE = CACHE_PREFIX + VERSION;
/* Where each build's cache records when it was built (rule 3). */
const MARKER = "/__sb_build_marker__";
/* This build plus the two before it. A page is very rarely open across
   more than two deploys; one that is gets the reload in main.jsx. */
const KEEP_BUILDS = 3;
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

function isCacheableAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/assets/");
}

/* Fetch-and-store one URL unless some kept build already holds it.
   Individually, never addAll: one missing file must not cost the rest. */
async function cacheOne(cache, href) {
  try {
    const url = new URL(href, self.location.origin);
    if (!isCacheableAsset(url)) return;
    if (await caches.match(url.href)) return;
    const response = await fetch(url.href);
    if (response && response.ok) await cache.put(url.href, response);
  } catch {
    /* offline or gone — it will be fetched when it is needed */
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.put(
        MARKER,
        new Response(JSON.stringify({ version: VERSION, builtAt: BUILT_AT }), {
          headers: { "Content-Type": "application/json" },
        })
      );
      try { await cache.addAll(SHELL); } catch { /* the shell refreshes on navigation */ }
      await Promise.all(PRECACHE.map((href) => cacheOne(cache, href)));
    })()
      /* Prompt activation is deliberate: a worker that waits for every
         tab to close never activates on a phone, where the tab is the
         app and is never closed. */
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

/* Keep the newest KEEP_BUILDS build caches, always including this one.
   A cache with no marker predates the split (a single-file build whose
   pages need nothing more from it) and goes. */
async function pruneOldBuilds() {
  const keys = (await caches.keys()).filter((k) => k.startsWith(CACHE_PREFIX));
  const dated = await Promise.all(
    keys.map(async (k) => {
      if (k === CACHE) return { k, at: BUILT_AT || "9999" };
      try {
        const hit = await (await caches.open(k)).match(MARKER);
        const meta = hit ? await hit.json() : null;
        return { k, at: (meta && meta.builtAt) || "" };
      } catch {
        return { k, at: "" };
      }
    })
  );
  const keep = new Set(
    dated
      .filter((d) => d.at)
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, KEEP_BUILDS)
      .map((d) => d.k)
  );
  keep.add(CACHE);
  await Promise.all(dated.filter((d) => !keep.has(d.k)).map((d) => caches.delete(d.k)));
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    pruneOldBuilds()
      .catch(() => {})
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

     Safe to activate under a live page because activation no longer
     drops the previous builds' files (rule 3): the running page keeps
     finding the chunks it names. */
  if (data && data.type === "SB_SKIP_WAITING") { self.skipWaiting(); return; }

  /* The page's first load happens before this worker controls it, so
     nothing it fetched went through here. It sends the list of what it
     loaded, which is exactly what it will need offline next time. */
  if (data && data.type === "SB_CACHE_URLS" && Array.isArray(data.urls)) {
    event.waitUntil(
      caches.open(CACHE).then((cache) =>
        Promise.all(data.urls.slice(0, 200).map((href) => cacheOne(cache, href)))
      )
    );
    return;
  }

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

  /* This build's shell first, then any kept build's: an older shell
     still names files that an older cache still holds. */
  const cached = (await cache.match(SHELL_URL)) || (await caches.match(SHELL_URL));
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

  /* Hashed build output and icons: immutable by filename, cache-first.
     caches.match looks in EVERY kept build's cache, which is what lets a
     page from the previous deploy keep loading its own pieces. New
     copies go into this build's cache. */
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
