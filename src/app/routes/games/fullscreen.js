/* ════════════════════════════════════════════════
   A table takes the whole screen.

   The play screen was already 100dvh with no app header and no page
   scroll, and on the owner's Android it still had the system status
   bar sitting above it — clock, battery, notification icons — which
   is the one piece of furniture that says "this is a web page inside
   a phone" rather than "this is a game". No amount of layout removes
   it. Only the Fullscreen API does.

   THE GESTURE PROBLEM, AND WHY THIS RETRIES. Browsers only grant
   fullscreen while a user gesture is still warm, and the tap that
   opened the table happened on the previous screen, before a route
   change and a network round trip. Sometimes that activation is
   still alive when the board mounts and sometimes it is not, and
   which one you get depends on how fast the table loaded — so a
   single attempt on mount would work on a good connection and fail
   on a bad one, which is the worst kind of behaviour to ship.

   So: try on mount, and if it is refused, wait for the next touch
   anywhere on the board and try again. The first thing anybody does
   at a table is press a die.

   NEVER A HALF-STATE. Whatever happens, the layout underneath is
   the immersive one already built — full-height, no chrome — so a
   refusal costs a status bar and nothing else. And this exits on
   leaving, on back and on unmount, guarded so it can only ever
   release fullscreen it actually took: a games screen must not be
   able to strand the rest of the app in it.

   iOS: `requestFullscreen` on an element does not exist on iPhone
   Safari at all. The feature test below simply comes back false and
   the fallback is the whole behaviour, which is correct — a PWA
   added to the home screen has no browser furniture to hide.
   ════════════════════════════════════════════════ */

import { useEffect } from "react";

/* ── WHAT ACTUALLY HAPPENED, WHERE THE OWNER CAN READ IT ────────

   I shipped this and called it "unwitnessed", and it did not work
   on his phone. The reason I could not tell is that a refused
   fullscreen request looks exactly like one that was never made:
   the promise rejects, the catch swallows it, and the layout
   underneath is the same either way. That is the same shape of
   defect as a check printing PASS over zero rows, and I shipped it
   a week after writing that down.

   So the attempt records itself, and the settings sheet prints it
   under the build stamp. Not telemetry — a line he can read out.
   `mode` is what the window actually is (a PWA reports standalone
   or fullscreen here, a browser tab reports browser), which is the
   fact that decides whether the API can help at all. */
export const fullscreenReport = { tried: 0, mode: "?", result: "not tried" };

function displayMode() {
  try {
    for (const m of ["fullscreen", "standalone", "minimal-ui", "browser"]) {
      if (window.matchMedia(`(display-mode: ${m})`).matches) return m;
    }
  } catch {
    /* no matchMedia: nothing to report */
  }
  return "?";
}

function enter(el) {
  const fn =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen;
  if (!fn) return Promise.reject(new Error("unsupported"));
  try {
    /* Some engines return a promise and some return undefined, so
       this is wrapped rather than returned. */
    return Promise.resolve(fn.call(el, { navigationUI: "hide" }));
  } catch (e) {
    return Promise.reject(e);
  }
}

function current() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

function leave() {
  const fn =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen;
  if (!fn || !current()) return;
  try {
    Promise.resolve(fn.call(document)).catch(() => {});
  } catch {
    /* already out, or refused — either way there is nothing to do */
  }
}

/* Hold the screen for as long as `active`. */
export function useGameFullscreen(active) {
  useEffect(() => {
    if (!active) return undefined;
    /* The whole document rather than one element. The play screen is
       already the only thing on it, and asking for documentElement
       avoids threading a ref through a screen that returns a
       fragment — a ref that is null on the first render is another
       way to end up half-in. */
    const el = document.documentElement;
    let mine = false;
    let armed = false;
    /* Held so the cleanup can remove a retry that never fired —
       someone who opens a table and immediately leaves would
       otherwise leave a capture-phase listener on the document for
       the rest of the session. */
    let retry = null;

    const take = () => {
      fullscreenReport.mode = displayMode();
      /* ALREADY THE WHOLE SCREEN. An installed app whose manifest
         asks for fullscreen has no bar to hide and no request to
         make, and that is a success rather than a thing that did
         not happen. */
      if (fullscreenReport.mode === "fullscreen") {
        fullscreenReport.result = "manifest";
        return;
      }
      if (current()) { fullscreenReport.result = "already"; return; }
      fullscreenReport.tried += 1;
      if (!document.documentElement.requestFullscreen &&
          !document.documentElement.webkitRequestFullscreen) {
        fullscreenReport.result = "no api";
        return;
      }
      enter(el).then(
        () => {
          mine = true;
          fullscreenReport.result = "granted";
        },
        (err) => {
          fullscreenReport.result =
            "refused: " + String((err && err.name) || err || "?").slice(0, 24);
          /* Refused — almost always "no user activation". Wait for
             the next touch and try once more, then stop asking: a
             listener that re-arms for ever would fire a rejected
             promise on every tap of the game. */
          if (armed) return;
          armed = true;
          retry = () => {
            document.removeEventListener("pointerdown", retry, true);
            retry = null;
            fullscreenReport.tried += 1;
            enter(el).then(
              () => {
                mine = true;
                fullscreenReport.result = "granted on tap";
              },
              (err2) => {
                fullscreenReport.result =
                  "refused on tap: " + String((err2 && err2.name) || err2 || "?").slice(0, 20);
              }
            );
          };
          document.addEventListener("pointerdown", retry, true);
        }
      );
    };

    take();

    /* Somebody pressed the system back gesture or Escape out of
       fullscreen. That is a decision, not a fault: stop claiming it
       so unmount does not try to exit something we no longer hold. */
    const onChange = () => {
      if (!current()) mine = false;
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      if (retry) document.removeEventListener("pointerdown", retry, true);
      /* ONLY WHAT WE TOOK. If the person put the browser into
         fullscreen themselves before opening a table, leaving the
         table must not take them out of it. */
      if (mine) leave();
    };
  }, [active]);
}

export default useGameFullscreen;
