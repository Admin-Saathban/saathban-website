/* ════════════════════════════════════════════════
   Horizontal swipe moves between the five tabs — AS A DRAG.

   The pane follows the finger and settles. The first version of this
   jumped: it watched touchstart and touchend, decided at the end, and
   navigated. That is a gesture the app only reacts to once it is over,
   so there is no moment where the person can see what will happen and
   change their mind by dragging back — which is the entire reason the
   gesture is worth having. A jump is a swipe-shaped button.

   WHAT MOVES IS `main`, not the screen. Each route renders its own
   header and the shell owns the bars, so translating the route subtree
   would drag the header sideways with the content. `main` is the
   content of every screen in this app, so the drag is expressed as a
   custom property this hook sets and a stylesheet this module owns
   reads. Header stays put, bars stay put, content moves — which is what
   the gesture means.

   THE ORDER IS THE BAR'S ORDER, taken from the same barItems() the bar
   renders, never a second list. A swipe that disagrees with the tabs
   about what comes next is worse than no swipe, and two lists that must
   agree are two lists that eventually will not.

   RTL MIRRORS, read off the document rather than assumed: an empty
   `dir` reads as "ltr", which is a silent wrong answer.

   REDUCED MOTION GETS NO DRAG AT ALL. Not a faster drag — none. The
   gesture still works and still changes tab, instantly, on release.
   Somebody who has asked the system for less movement has asked for
   less movement, and a pane tracking their finger is the movement.

   ─── WHAT IT REFUSES TO DO ───

   TAB-SWIPE YIELDS. Anything that scrolls or drags horizontally INSIDE
   a screen wins the gesture outright: a carousel, a chip row, a
   swipeable chat row, a slider. The yield is automatic rather than
   opt-in — it walks up from the touch target for an ancestor that
   actually scrolls sideways — so a lane does not have to know this hook
   exists in order to be safe from it. That matters because nearly every
   surface it must yield to belongs to another lane. `data-sb-swipe` is
   the explicit marker for a surface that drags without being a
   scroller, which measurement cannot detect.

   Text selection and form fields are excluded: dragging across a
   message to select it is a horizontal drag, and it must not turn the
   page.
   ════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { wantsLessMotion } from "./motion.jsx";
import { paneFor as paneKeyFor } from "./TabPanes.jsx";

/* Below ENGAGE the gesture is still undecided and the page scrolls
   normally; past it the drag owns the finger. 12px is small enough to
   feel immediate and large enough that a tap never starts a drag. */
/* 12px, and the guard in `start` is what protects a tap — not this
   number.

   I raised this to 20 first, believing the drag was swallowing presses,
   because a thumb roll of 16px killed a tap on the deployed build. It
   does — and so does 16px of roll in any app: that is Chrome's own touch
   slop, which cancels the synthetic click when a touch travels too far.
   Verified by shipping the guard and measuring again; 16px still
   cancelled. It was never ours to fix.

   So the threshold stays low, because a LOW threshold is what makes the
   pane start moving WITH the finger rather than after it. */
const ENGAGE = 12;

/* ── THE DRAG STYLESHEET LIVES HERE, WITH THE HOOK THAT USES IT ──

   It was in lib/motion.jsx, the shared motion vocabulary. That file is
   the right HOME for a motion idiom and the wrong file for me to be
   writing in: Lane 3 is actively editing it, they found my rules there
   during the window between my applying them and committing them, and
   they left them alone rather than risk clobbering work in flight. They
   were right to flag it. Two lanes writing one file is how 357 lines
   were lost twice.

   So the drag owns its own stylesheet, injected once, next to the only
   code that sets the property it reads. Nothing else in the app can
   adopt half of it, which is the concern the vocabulary file exists to
   answer — it cannot be half-adopted if there is only one consumer.

   Injected imperatively rather than as a component so the whole gesture
   stays in one module and AppShellBar does not grow another child. */
const STYLE_ID = "sb-tab-drag-styles";
const DRAG_CSS = `
/* THE PANE MOVES, AND SO DOES THE ONE YOU ARE GOING TO.

   This translated the main element, so the screen you were leaving slid
   away over bare ground with no sign of where you were headed. Measured
   during a drag: exactly one pane was ever display:block. It looked like
   it was taking something away rather than bringing something in, which
   is most of why it reads as nothing happening.

   The incoming pane is marked [data-sb-into] by the hook and sits one
   screen away, so it tracks the finger from the first pixel. Only ever a
   pane that is already MOUNTED — mounting one mid-drag would fetch a
   screen somebody may be about to swipe away from. An unvisited
   neighbour still shows ground, which is honest: there is nothing there
   yet. */
html.sb-dragging [data-sb-pane] {
  transform: translate3d(var(--sb-drag, 0px), 0, 0);
  will-change: transform;
}
html.sb-settling [data-sb-pane] {
  transform: translate3d(var(--sb-drag, 0px), 0, 0);
  transition: transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
html.sb-dragging [data-sb-pane][data-sb-into],
html.sb-settling [data-sb-pane][data-sb-into] {
  display: block !important;
  transform: translate3d(calc(var(--sb-side, 1) * 100vw + var(--sb-drag, 0px)), 0, 0);
}
html.sb-dragging, html.sb-dragging body { overscroll-behavior-x: none; }

/* ACROSS A TAB CHANGE THE CHROME DOES NOT ANIMATE. The bars are shown at
   the moment the tab lands; letting that 180ms transition run means the
   bar slides up the screen while the new pane is still arriving, which
   is two movements arguing. !important because the transition is an
   inline style on those elements and a class cannot outrank one — narrow
   and transient, on a class that exists for a quarter of a second. */
html.sb-tabswitch [data-sb-bar],
html.sb-tabswitch header { transition: none !important; }
`;

function ensureStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = DRAG_CSS;
  document.head.appendChild(el);
}
/* How far it has to travel to commit, as a share of the screen. */
const COMMIT = 0.28;
const SETTLE_MS = 200;

/* SIDEWAYS ENOUGH TO BE A SWIPE. Requiring only that dx exceeds dy was
   not enough: a first touchmove of dx=14, dy=13 passed it, and a thumb
   arcing down the screen produces exactly that. A real diagonal now
   loses to the scroll, because 1.4 is a slope of about 35 degrees and
   nobody swiping sideways travels closer to the diagonal than that. */
const DOMINANCE = 1.4;

/* A FLICK IS A SWIPE EVEN WHEN IT IS SHORT. A thumb flick is 40-80px in
   about 80ms; the distance threshold alone is 109px on a 390px screen,
   so every genuine flick sprang back and read as the gesture not
   working. Velocity in px/ms, sampled over the last few moves. */
const FLICK_V = 0.45;
const FLICK_MIN = 24;

function scrollsSideways(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.dataset?.sbSwipe !== undefined) return true;
    const s = getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 4) return true;
  }
  return false;
}

export default function useTabSwipe(items, enabled = true) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  /* The live values the listeners read. Refs rather than state: a drag
     updates every frame, and re-rendering the whole shell sixty times a
     second to move one element is how a smooth gesture becomes a janky
     one. */
  const st = useRef({ x: 0, y: 0, dx: 0, on: false, dead: true, idx: -1,
                      t: 0, lastX: 0, lastT: 0, v: 0, timer: 0 });

  useEffect(() => {
    if (!enabled || !items || items.length < 2) return undefined;
    ensureStyles();

    const root = document.documentElement;
    const setDrag = (px) => root.style.setProperty("--sb-drag", px + "px");
    /* Reveal the neighbour on the side the finger is heading, if that
       pane is already in the document. */
    const hideIncoming = () => {
      document.querySelectorAll("[data-sb-into]")
        .forEach((el) => el.removeAttribute("data-sb-into"));
    };
    const showIncoming = (dx) => {
      hideIncoming();
      const n = neighbour(dx);
      if (n < 0 || n >= items.length) return;
      const key = paneKeyFor(items[n].to);
      const el = key && document.querySelector('[data-sb-pane="' + key + '"]');
      if (!el) return;
      el.setAttribute("data-sb-into", "");
      root.style.setProperty("--sb-side", dx < 0 ? "1" : "-1");
    };

    const clear = () => {
      root.classList.remove("sb-dragging", "sb-settling");
      root.style.removeProperty("--sb-drag");
      root.style.removeProperty("--sb-side");
      hideIncoming();
    };

    /* Longest match wins: /app/games/ludo must resolve to the Games tab,
       and a plain "starts with" on the first entry would not. */
    const indexOfPath = () => {
      let here = -1, best = -1;
      items.forEach((it, i) => {
        if (pathname === it.to || pathname.startsWith(it.to + "/")) {
          if (it.to.length > best) { best = it.to.length; here = i; }
        }
      });
      return here;
    };

    const rtl = () => (document.querySelector("[dir]")?.getAttribute("dir") || "ltr") === "rtl";
    /* Dragging the content leftwards brings the NEXT tab in from the
       right, which is what every phone already teaches. */
    const neighbour = (dx) => {
      const forward = rtl() ? dx > 0 : dx < 0;
      return st.current.idx + (forward ? 1 : -1);
    };

    /* YOU DO NOT SWIPE TABS BY STARTING ON A BUTTON. A gesture that
       begins on something tappable is a tap on that thing — a heart, a
       menu row, a chip. Excluding those outright means the drag can
       never interfere with a press however far a thumb rolls, which is
       a stronger guarantee than any threshold, because a threshold is
       always wrong for somebody. */
    const TAPPABLE = "button, a, [role='button'], [role='checkbox'], [role='switch'], [role='tab'], label, summary";

    const start = (e) => {
      const s = st.current;
      /* A SETTLE IS INTERRUPTIBLE. The old version kept the timeout id
         nowhere, so a second flick during the 200ms settle left the
         first navigation pending: it fired mid-way through the new
         gesture and landed on a tab the person had already left. Two
         quick flicks were the reproducible version of that.

         Touching the screen cancels whatever was in flight. The
         interrupted navigation is dropped rather than queued, because a
         finger back on the glass is somebody changing their mind. */
      if (s.timer) { window.clearTimeout(s.timer); s.timer = 0; }
      root.classList.remove("sb-settling");
      root.style.removeProperty("--sb-drag");
      s.on = false; s.dx = 0; s.v = 0;
      if (e.touches.length !== 1) { s.dead = true; return; }
      const el = e.target instanceof Element ? e.target : null;
      s.dead =
        !el ||
        scrollsSideways(el) ||
        !!el.closest(TAPPABLE) ||
        !!el.closest("input, textarea, select, [contenteditable='true'], [role='slider']");
      s.idx = indexOfPath();
      if (s.idx < 0) s.dead = true;
      s.x = e.touches[0].clientX;
      s.y = e.touches[0].clientY;
      s.lastX = s.x;
      s.lastT = e.timeStamp || Date.now();
    };

    const move = (e) => {
      const s = st.current;
      if (s.dead || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - s.x;
      const dy = e.touches[0].clientY - s.y;

      if (!s.on) {
        /* VERTICAL INTENT WINS INSTANTLY, and it wins for good — once
           this gesture is a scroll it is never reconsidered, because a
           hook that keeps re-testing every frame will grab the page
           halfway down a flick.

           The test is >= rather than >: a perfectly diagonal drag is
           not a swipe, and on a real thumb it is common. */
        if (Math.abs(dy) >= Math.abs(dx) && Math.abs(dy) > ENGAGE) { s.dead = true; return; }
        if (Math.abs(dx) < ENGAGE) return;
        /* Sideways ENOUGH. Passing ENGAGE is not the same as meaning
           it — a thumb arcing down the screen crosses 12px of x while
           crossing 11px of y, and that is a scroll. */
        if (Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;
        s.on = true;
        if (!wantsLessMotion()) {
          root.classList.add("sb-dragging");
          root.classList.remove("sb-settling");
          showIncoming(dx);
        }
      }

      /* RUBBER BAND AT THE ENDS. The first and last tabs do not wrap, so
         the pane resists rather than refusing: a dead gesture reads as a
         broken screen, a heavy one reads as an edge. */
      /* Velocity over the gap since the last move, not over the whole
       gesture: a slow drag that ends in a flick should commit on the
       flick, which is what a thumb actually does. */
      const now = e.timeStamp || Date.now();
      const gap = now - (s.lastT || now);
      if (gap > 0) s.v = (e.touches[0].clientX - s.lastX) / gap;
      s.lastX = e.touches[0].clientX;
      s.lastT = now;

      const n = neighbour(dx);
      const resist = n < 0 || n >= items.length ? 0.28 : 1;
      s.dx = dx * resist;

      if (!wantsLessMotion()) {
        setDrag(s.dx);
        /* Owns the finger now, so the page must stop scrolling under it.
           Only once ENGAGED — before that the listener is passive in
           spirit and vertical scrolling is untouched. */
        if (e.cancelable) e.preventDefault();
      }
    };

    const end = () => {
      const s = st.current;
      const { on, dx, idx, dead } = s;
      s.on = false; s.dead = true;
      if (dead || !on) { clear(); return; }

      const n = neighbour(dx);
      const far = Math.abs(dx) >= Math.min(window.innerWidth * COMMIT, 140);
      /* A flick commits on speed even when it is short — but only if it
         is still travelling the way the pane is, so a drag that reverses
         at the last instant lands back where it started. */
      const flick = Math.abs(s.v) > FLICK_V && Math.abs(dx) > FLICK_MIN &&
                    (s.v < 0) === (dx < 0);
      const going = (far || flick) && n >= 0 && n < items.length && idx >= 0;

      if (wantsLessMotion()) {
        clear();
        if (going) navigate(items[n].to);
        return;
      }

      /* SETTLE, both ways. Committing finishes the movement the finger
         started; abandoning returns it. Either way the pane arrives
         somewhere under its own power rather than snapping. */
      root.classList.remove("sb-dragging");
      root.classList.add("sb-settling");
      setDrag(going ? (dx < 0 ? -window.innerWidth : window.innerWidth) : 0);

      s.timer = window.setTimeout(() => {
        s.timer = 0;
        clear();
        if (going) navigate(items[n].to);
      }, going ? SETTLE_MS : SETTLE_MS + 40);
    };

    /* Put it back and forget it: no navigation, no committed state. */
    const abandon = () => {
      const s = st.current;
      const on = s.on;
      s.on = false; s.dead = true; s.v = 0;
      if (s.timer) { window.clearTimeout(s.timer); s.timer = 0; }
      if (!on || wantsLessMotion()) { clear(); return; }
      root.classList.remove("sb-dragging");
      root.classList.add("sb-settling");
      setDrag(0);
      s.timer = window.setTimeout(() => { s.timer = 0; clear(); }, SETTLE_MS + 40);
    };

    document.addEventListener("touchstart", start, { passive: true });
    /* Not passive: once the drag is engaged it has to stop the page
       scrolling, and a passive listener may not preventDefault. */
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end, { passive: true });
    /* CANCEL IS NOT A LIFT. The OS sends touchcancel when something
       takes the gesture away — a call arrives, the system claims the
       edge, a palm lands. Routing it to the same handler as a finger
       lifting meant an INTERRUPTED swipe still committed: the drag was
       past the threshold, so the app changed tab while the person was
       answering their phone. Found on synthetic input, which surprised
       me — it is the one hard case a scripted touch can produce
       faithfully, because touchcancel carries no coordinates to get
       wrong.

       Cancelling abandons: the pane settles back and nothing
       navigates. */
    document.addEventListener("touchcancel", abandon, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", abandon);
      /* A pending settle must not navigate after this hook is gone. */
      if (st.current.timer) { window.clearTimeout(st.current.timer); st.current.timer = 0; }
      clear();
    };
  }, [items, enabled, pathname, navigate]);
}
