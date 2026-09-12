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

import { safeBottomNow } from "./safeArea.js";

let on = false;
try {
  on = typeof window !== "undefined" &&
       new URLSearchParams(window.location.search).get("swipedebug") === "1";
} catch { on = false; }

export const swipeDebugOn = () => on;

/* Enough to hold a whole gesture AND what the bar did afterwards. The
   owner's recording shows the bar misbehaving about four tenths of a
   second after the tab has already changed, so a trace that stops at
   the finger lifting stops one line before the evidence. */
const MAX = 30;
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

/* ── THE BAR'S BOX, WATCHED ──

   Frame-stepping the owner's recording is how the real symptom was
   found: the bar's BOTTOM edge never moves and its TOP edge drops, so
   it is getting shorter rather than sliding. That is a measurement
   nobody could have made from a description, and it is the measurement
   the phone should be making for itself.

   So while the overlay is on, the bar's height and position are read
   every frame and a line is written whenever either changes, with the
   inset the height is built from. One swipe, one screenshot, and the
   trace says whether the height moved and what moved with it —
   instead of a fourth round of somebody watching and guessing.

   Only while the overlay is on. Off, this function is never called. */
export function watchBar() {
  if (!on || typeof document === "undefined") return () => {};
  let last = "";
  let raf = 0;
  const tick = () => {
    const bar = document.querySelector("[data-sb-bar]");
    if (bar) {
      const r = bar.getBoundingClientRect();
      const now = Math.round(r.height) + ":" + Math.round(r.top) + ":" + Math.round(r.bottom);
      if (now !== last) {
        if (last) {
          const [h, t, b] = now.split(":");
          const [ph, pt] = last.split(":");
          swipeLog("BAR-BOX", {
            h, top: t, bottom: b,
            dh: Number(h) - Number(ph),
            dtop: Number(t) - Number(pt),
            inset: Math.round(safeBottomNow().live),
          });
        }
        last = now;
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

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
    /* What the bar is doing right now, read off the element rather
       than off the hook's state — this is the thing being complained
       about, and the DOM is the only account of it that cannot be
       out of date. */
    "bar=" + barWhere(),
    /* pinned is what the app now uses; live is what the browser says
       this instant. If those two ever differ on his phone, the inset
       really does move under the bar and pinning it was the fix. */
    "inset=" + (() => { const s = safeBottomNow(); return s.pinned + "/" + Math.round(s.live); })(),
    "docH=" + document.documentElement.scrollHeight,
  ];
}

/* The bottom bar's actual vertical offset. 0 is where it belongs; a
   positive number is it displaced downwards, which is exactly what the
   recordings show and what no amount of synthetic input reproduced. */
/* ── THE MEASUREMENT THE RECORDINGS FORCED ──

   The owner is right that the bar is DISPLACED rather than repainted,
   and the recordings say more than that: its bottom edge never moves
   and its top edge drops, which means it is getting SHORTER, not
   sliding. So the trace reports the height and the inset the height is
   built from, not just an offset — a number that says "down 24" would
   have sent us looking at the shutter for a fourth time. */
function barWhere() {
  const bar = document.querySelector("[data-sb-bar]");
  if (!bar) return "none";
  const r = bar.getBoundingClientRect();
  const below = Math.round(r.bottom - window.innerHeight);
  return "h" + Math.round(r.height) + (below === 0 ? " home" : " down" + below);
}
