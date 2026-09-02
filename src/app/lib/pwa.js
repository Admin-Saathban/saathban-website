/* Registers the app-shell service worker (public/sw.js, scope /app),
   and — the part that did not exist before — notices when the build on
   the server has moved past the one this page is running.

   Called from AppRoot so only /app visitors ever register it; the
   marketing site stays a plain website. Production only: under the dev
   server the cached shell cannot satisfy on-demand module requests and
   HMR fights stale caches.

   Every failure path is silent. Offline support and update detection
   are both progressive — the app works identically without either. */

import { BUILD } from "../../shared/build.js";

/* How often to ask the server whether a new worker exists, while the
   app is open and in front of somebody. A phone PWA is never closed,
   so without this a session could run for days on old code. Fifteen
   minutes is far below anybody's patience and far above anything that
   could be called polling. */
const RECHECK_MS = 15 * 60 * 1000;
const REPLY_TIMEOUT_MS = 2000;

let listener = null;
let alreadySaid = false;

/* The notice is shown once per page life. Saying it twice would imply
   two updates, and there is only ever one answer: reload. */
export function onAppUpdate(fn) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

/* A worker that has installed but is parked in the waiting slot is
   asked to take over. Without this it can sit there indefinitely —
   observed on exactly the migration that matters, from the old
   worker that could never update. */
function askWaitingToActivate(reg) {
  const waiting = reg && reg.waiting;
  if (!waiting) return;
  try { waiting.postMessage({ type: "SB_SKIP_WAITING" }); } catch { /* nothing to do */ }
}

function announce() {
  if (alreadySaid || !listener) return;
  alreadySaid = true;
  try { listener(); } catch { /* a broken listener must not break the app */ }
}

/* Ask a worker what build it is. A worker that does not answer — an
   old one from before this protocol existed, or one mid-install — is
   simply unknown, and unknown is never treated as stale. */
function askVersion(worker) {
  return new Promise((resolve) => {
    if (!worker) { resolve(null); return; }
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(null), REPLY_TIMEOUT_MS);
    try {
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => {
        clearTimeout(timer);
        finish(e.data && e.data.type === "SB_VERSION" ? e.data : null);
      };
      worker.postMessage({ type: "SB_VERSION" }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

/* THE ONE DIRECTION THAT MEANS SOMETHING.

   Worker newer than page: this page is running code the server has
   moved past — say so. Worker older than page, or equal: normal. The
   older case is what every fresh load looks like for the moment
   between the new HTML arriving and the new worker activating, and
   announcing there would put a "please refresh" on a page that had
   just been refreshed. */
async function compareWithController() {
  const worker = navigator.serviceWorker.controller;
  if (!worker) return;
  const reply = await askVersion(worker);
  if (!reply || !reply.builtAt || !BUILD.time) return;
  if (reply.version === BUILD.hash) return;
  if (reply.builtAt > BUILD.time) announce();
}

export function registerAppServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    let reg;
    try {
      /* updateViaCache "none": the browser must not answer an update
         check out of its own HTTP cache. The worker is the one file
         whose freshness the whole scheme rests on. */
      reg = await navigator.serviceWorker.register("/sw.js", {
        scope: "/app",
        updateViaCache: "none",
      });
    } catch {
      return;
    }

    askWaitingToActivate(reg);

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      compareWithController();
    });

    reg.addEventListener("updatefound", () => {
      const incoming = reg.installing;
      if (!incoming) return;
      incoming.addEventListener("statechange", () => {
        /* The worker calls skipWaiting, so a new one reaches
           "activated" on its own and takes over. Both states are
           checked because a browser that ignores skipWaiting parks it
           at "installed" instead, and a person on that browser should
           still be told. */
        if (incoming.state !== "installed" && incoming.state !== "activated") return;
        askWaitingToActivate(reg);
        if (!navigator.serviceWorker.controller) return;  // first ever install
        askVersion(incoming).then((reply) => {
          if (reply && reply.builtAt && BUILD.time && reply.builtAt > BUILD.time) announce();
          else compareWithController();
        });
      });
    });

    const recheck = () => { try { reg.update(); } catch { /* offline */ } };

    /* Coming back to the app is the moment worth checking: a phone PWA
       is resumed far more often than it is launched. */
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      recheck();
      askWaitingToActivate(reg);
      compareWithController();
    });
    window.setInterval(recheck, RECHECK_MS);

    compareWithController();
  });
}
