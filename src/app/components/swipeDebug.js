/* ════════════════════════════════════════════════
   A trace of what the finger actually did, on the actual phone.

   Why this exists: the tab swipe has been "fixed" three times and has
   never once been reproduced failing. Every verification was synthetic
   touch dispatched through CDP on a desktop, and the things most
   likely to break a real swipe are exactly the things a script cannot
   produce — the browser claiming the gesture for its own back
   navigation, a passive listener refusing preventDefault, coalesced
   moves under load, an edge zone eating the first thirty pixels.

   So instead of a fourth fix verified the same way: turn this on with
   ?swipedebug=1, swipe once, screenshot. The screenshot is the
   evidence.

   OFF COSTS NOTHING. `on` is read once at module load and every call
   site returns immediately when it is false — no string building, no
   array work, nothing retained.
   ════════════════════════════════════════════════ */

let on = false;
try {
  on = typeof window !== "undefined" &&
       new URLSearchParams(window.location.search).get("swipedebug") === "1";
} catch { on = false; }

export const swipeDebugOn = () => on;

const MAX = 22;
const lines = [];
const listeners = new Set();
const t0 = typeof performance !== "undefined" ? performance.now() : 0;

export function swipeLog(tag, data) {
  if (!on) return;
  const at = Math.round((performance.now() - t0) % 100000);
  let s = String(at).padStart(5) + " " + tag;
  if (data) {
    for (const k of Object.keys(data)) {
      const v = data[k];
      s += " " + k + "=" + (typeof v === "number" ? Math.round(v) : String(v));
    }
  }
  lines.push(s);
  while (lines.length > MAX) lines.shift();
  listeners.forEach((fn) => fn());
}

export function swipeLines() { return lines; }

export function onSwipeLog(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* Facts that do not change during a gesture but decide whether one is
   possible at all. Read from the live document so what is reported is
   what is actually computed, not what the stylesheet was meant to say. */
export function swipeFacts() {
  if (!on || typeof document === "undefined") return [];
  const pane = document.querySelector("[data-sb-pane]");
  const cs = pane ? getComputedStyle(pane) : null;
  const body = getComputedStyle(document.body);
  return [
    "panes=" + document.querySelectorAll("[data-sb-pane]").length,
    "pane touch-action=" + (cs ? cs.touchAction : "?"),
    "pane overscroll-x=" + (cs ? cs.overscrollBehaviorX : "?"),
    "body overscroll-x=" + body.overscrollBehaviorX,
    "dpr=" + (window.devicePixelRatio || 1),
    "vw=" + window.innerWidth,
  ];
}
