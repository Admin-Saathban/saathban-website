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
import { freezeShutter, thawShutter } from "./useShutter.js";
import { swipeLog, swipeDebugOn } from "./swipeDebug.js";

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

/* ── AND THE SAME THRESHOLD, RAISED, FOR A GESTURE THAT BEGAN ON A
   CONTROL ──

   The owner reports that on the Games screen a swipe takes two or three
   attempts before it moves. It does, and the cause is one line further
   down: a gesture beginning on anything tappable was killed outright.
   The Games screen is a heading and then tiles — Ludo, Snakes, the
   riddle card, the code button — so almost every square inch of it
   refused the gesture, and the attempts that "worked" were the ones
   that happened to land in a gap between cards.

   The outright refusal was there so a drag could never steal a press
   however far a thumb rolls. It does not have to be outright to do
   that, and the reason is already written in RESPONSIVENESS.md: a touch
   that travels more than about 16px is a scroll as far as Chrome is
   concerned, and it CANCELS the click it would otherwise synthesise.
   That happens with or without this hook.

   So a gesture that starts on a control engages at 24px instead of 12.
   By 24px the browser has already thrown away the click — there is no
   press left to steal, and the guarantee is arithmetic rather than a
   threshold somebody has to feel good about. Under 24px nothing moves
   and the press lands exactly as it does today.

   The outright refusal stays for the things where it is not about
   presses at all: a field, a slider, a contenteditable, and anything
   that scrolls sideways. Those own the horizontal axis themselves. */
const ENGAGE_ON_CONTROL = 24;

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
  /* position comes from the inline transform the gesture writes */
  will-change: transform;
}
html.sb-settling [data-sb-pane] {
  /* position comes from the inline transform the gesture writes */
  transition: transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
html.sb-dragging [data-sb-pane][data-sb-into],
html.sb-settling [data-sb-pane][data-sb-into] {
  /* OUT OF FLOW, and that is not a detail. Shown as a normal block the
     incoming pane stacks BELOW the current one and doubles the page.
     Measured during a drag: the document went 6304 to 7232 and
     window.innerHeight went 844 to 1624, so the fixed bottom bar — which
     resolves bottom:0 against that — was pushed 780px off the screen for
     the whole gesture and snapped back at the end. That is the bar the
     owner sees opening and closing while he swipes, and my own
     incoming-pane work caused it.

     Fixed and inset:0 covers the viewport, adds no height, and leaves
     the page underneath exactly as tall as it was. */
  display: block !important;
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: 1;
  /* likewise: offset by a viewport, then dragged, both inline */
}
/* Laid out, not drawn. visibility:hidden still costs the browser the
   layout — which is the point, that is the cost being moved — but no
   paint and no compositing, so a touch that turns out to be a tap or a
   scroll has spent almost nothing. */
[data-sb-pane][data-sb-warm]:not([data-sb-into]) {
  display: block !important;
  position: fixed;
  inset: 0;
  overflow: hidden;
  visibility: hidden;
  z-index: 0;
  pointer-events: none;
}

html.sb-dragging, html.sb-dragging body { overscroll-behavior-x: none; }

/* A PANE MOVED RIGHT MUST NOT MAKE THE PAGE WIDER.

   The outgoing pane is ordinary content with a transform on it, and a
   transform that pushes content past the right edge adds to the
   document's scrollable width. Measured on a phone-sized touch viewport:
   scrollWidth went 390, 430, 450, 470 as the finger moved right, and
   window.innerWidth grew with it, because a mobile browser widens the
   layout viewport to fit what overflows. Moving LEFT overflows nothing
   scrollable, which is why only one direction misbehaved.

   clip rather than hidden: hidden on the root turns it into a scroll
   container and the sticky header stops sticking; clip trims the paint
   and creates nothing. Only for as long as something is moving. */
html.sb-dragging, html.sb-dragging body,
html.sb-settling, html.sb-settling body { overflow-x: clip; }

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
/* The longest the incoming pane is held in place waiting for the route to
   commit before it is let go regardless. Only reached if a navigation is
   refused outright; a normal commit clears it long before. */
const LANDING_MS = 700;

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
                      t: 0, lastX: 0, lastT: 0, v: 0, timer: 0, samples: [] });

  useEffect(() => {
    if (!enabled || !items || items.length < 2) return undefined;
    ensureStyles();

    const root = document.documentElement;
    /* THE TWO PANES THAT ARE MOVING, AND NOTHING ELSE.

       This used to set --sb-drag on documentElement every move. A
       custom property on the root invalidates style for everything
       that could inherit it, which here is the whole document.
       Attributed with Performance.getMetrics over one swipe at 6x
       CPU: 1559ms of style recalculation out of 3142ms of task time
       — half the gesture — across 23 recalcs of 2742 nodes, about
       68ms each. That is the slide feeling heavy, and it is paid
       whether or not anything mounts.

       Writing the transform straight onto the outgoing and incoming
       panes confines the work to two subtrees. Both are looked up
       once when the gesture engages, because querying per move would
       reintroduce the cost in a different form. */
    let outEl = null;
    let inEl = null;
    let side = 1;
    /* Set by this effect's cleanup. A landing timer from this instance must
       not clear visuals that belong to the next one. */
    let disposed = false;

    /* ── THE PANE ON SCREEN, NOT THE FIRST ONE THAT HAS LAYOUT ──

       This took the first pane in document order whose display was not
       none. That was the screen you are on while every other pane was
       display:none — and stopped being true when b296373 began laying the
       two neighbours out at touchstart (display:block, visibility:hidden)
       to take their layout cost off the first frame of the drag.

       From then on the "outgoing" pane was whichever warmed neighbour came
       first in tab order. Traced at 6x CPU on every transition: the screen
       you were leaving stood perfectly still while an invisible neighbour
       slid under it. On the four look-alike tabs that read as the new
       screen sliding over the old one. Out of Messages it was worse — the
       first warmed pane is Groups, which is ALSO the incoming pane, so one
       element was given two transforms on every move and was caught at
       x=-110 before snapping to -350. A double movement, from one pane
       playing both parts.

       TabPanes marks the active pane with an inline display:block and
       every other with display:none; the warm and incoming layers get their
       display from a stylesheet. So the inline value is the one reading
       that cannot be confused with a neighbour being prepared. */
    const findOut = () =>
      [...document.querySelectorAll("[data-sb-pane]")].find(
        (el) => el.style.display === "block" && !el.hasAttribute("data-sb-into")
      ) || null;

    /* ── THE SCREEN'S WIDTH, READ ONCE, WHEN THE FINGER LANDS ──

       This read window.innerWidth on every move, and innerWidth is not
       the width of the glass: it is the layout viewport, and a mobile
       browser grows that when content overflows. Swiping right pushed the
       outgoing pane past the edge, innerWidth went 390 -> 430, and the
       incoming pane was placed 430px away instead of 390 — so it trailed
       the finger by exactly the distance already dragged. Traced on
       Messages -> Groups at 6x CPU: outgoing at +40, incoming at -390
       where it belonged at -350. The screen slid, and the pane meant to
       be joined to it slid behind it: a double movement.

       The visual viewport is the width of what the person can see and
       does not grow with overflow. Taken at touchstart, before anything
       has moved, and used for every position in that gesture. */
    const screenW = () => st.current.w || window.innerWidth;
    const setDrag = (px) => {
      if (outEl) outEl.style.transform = "translate3d(" + px + "px,0,0)";
      if (inEl) inEl.style.transform =
        "translate3d(" + (side * screenW() + px) + "px,0,0)";
    };

    const dropTransforms = () => {
      if (outEl) outEl.style.transform = "";
      if (inEl) inEl.style.transform = "";
      outEl = null;
      inEl = null;
    };
    /* Reveal the neighbour on the side the finger is heading, if that
       pane is already in the document. */
    /* ── THE LAYOUT IS PAID WHILE NOTHING IS MOVING ──

       showIncoming() takes a pane out of display:none, and a pane is a
       whole screen. The browser has to lay that screen out before it
       can draw a pixel of it, and this was happening INSIDE the
       touchmove that crosses the twelfth pixel — the first frame of the
       drag, the one whose smoothness decides whether the gesture feels
       attached to the finger. One screen's layout in that frame is the
       stutter at the start of the slide.

       So both neighbours are made ready at touchstart instead, laid out
       but not painted. A finger resting on the glass before it moves is
       several frames of doing nothing, and that is where the cost
       belongs. Engaging then only flips visibility on one of them and
       drops the other, which is a paint rather than a layout.

       Both, because touchstart does not yet know which way the finger
       is going — the direction is the first thing a drag tells you and
       it arrives too late to be useful here. Neither adds a pixel of
       height: they are the same fixed, inset:0 layers the drag uses, so
       the document is exactly as tall as it was and the fixed bar has
       nothing new to resolve against.

       Only for a gesture that could still become a swipe. A touch that
       began on a button or inside a sideways scroller is already dead
       by this point and pays none of it. */
    const warmOff = () => {
      document.querySelectorAll("[data-sb-warm]")
        .forEach((el) => el.removeAttribute("data-sb-warm"));
    };
    const warmNeighbours = () => {
      warmOff();
      const i = st.current.idx;
      if (i < 0) return;
      [i - 1, i + 1].forEach((n) => {
        if (n < 0 || n >= items.length) return;
        const key = paneKeyFor(items[n].to);
        const el = key && document.querySelector('[data-sb-pane="' + key + '"]');
        if (el && !el.hasAttribute("data-sb-into")) el.setAttribute("data-sb-warm", "");
      });
    };

    const hideIncoming = () => {
      document.querySelectorAll("[data-sb-into]")
        .forEach((el) => { el.removeAttribute("data-sb-into"); el.style.transform = ""; });
      inEl = null;
    };
    const showIncoming = (dx) => {
      hideIncoming();
      const n = neighbour(dx);
      if (n < 0 || n >= items.length) return;
      const key = paneKeyFor(items[n].to);
      const el = key && document.querySelector('[data-sb-pane="' + key + '"]');
      if (!el) return;
      el.setAttribute("data-sb-into", "");
      inEl = el;
      side = dx < 0 ? 1 : -1;
      setDrag(dx);
      root.style.setProperty("--sb-side", dx < 0 ? "1" : "-1");
    };

    /* Released exactly once per gesture, whichever way it ends —
       committed, abandoned, cancelled by the OS, or unmounted. */
    const thaw = () => {
      const s = st.current;
      if (!s.froze) return;
      s.froze = false;
      thawShutter();
    };

    /* The visuals only. Split out because the ONE path that commits has
       to put the pane down and navigate while the bar is still held,
       and every other path can let go immediately. */
    const clearVisuals = () => {
      dropTransforms();
      root.classList.remove("sb-dragging", "sb-settling");
      root.style.removeProperty("--sb-drag");
      root.style.removeProperty("--sb-side");
      hideIncoming();
      warmOff();
    };

    const clear = () => {
      clearVisuals();
      thaw();
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
      /* A landing that never committed: let it go before this gesture
         starts laying out panes of its own. */
      if (s.landing) { window.clearTimeout(s.landing); s.landing = 0; clear(); }
      root.classList.remove("sb-settling");
      root.style.removeProperty("--sb-drag");
      s.on = false; s.dx = 0; s.v = 0; s.samples = [];
      if (e.touches.length !== 1) { s.dead = true; return; }
      const el = e.target instanceof Element ? e.target : null;
      /* Refused outright: it owns the horizontal axis, or it is a field. */
      s.dead =
        !el ||
        scrollsSideways(el) ||
        !!el.closest("input, textarea, select, [contenteditable='true'], [role='slider']");
      /* Allowed, but it has to mean it. A disabled control is not one of
         these at all — there is no press to protect, so a resting game's
         tile is as swipeable as the ground beside it. */
      const onControl = !s.dead && !!el.closest(TAPPABLE) && !el.closest("[disabled], [aria-disabled='true']");
      s.engage = onControl ? ENGAGE_ON_CONTROL : ENGAGE;
      s.idx = indexOfPath();
      if (s.idx < 0) s.dead = true;
      if (swipeDebugOn()) {
        swipeLog("DOWN", {
          x: e.touches[0].clientX, y: e.touches[0].clientY,
          tag: el ? el.tagName.toLowerCase() : "none",
          dead: s.dead,
          why: !el ? "no-target" : scrollsSideways(el) ? "sideways-scroller"
               : el.closest("input, textarea, select, [contenteditable='true'], [role='slider']") ? "field"
               : s.idx < 0 ? "not-a-tab" : "-",
          engage: s.engage,
          idx: s.idx,
        });
      }
      /* THE BAR STOPS LISTENING THE MOMENT A FINGER LANDS.

         Not at engage and not at the switch: the damage happens in
         between. Panes carry their own scroll positions, so swapping
         them moves the document under the shutter, which reads it as
         a gesture nobody made and slides the bar away mid-drag. On
         the owner's recording the bar was displaced with its labels
         clipped for about 350ms of every slide.

         Frozen here rather than at engage because the pane swap can
         begin before the twelfth pixel. A gesture that turns out to
         be a scroll thaws immediately below, so vertical scrolling
         still hides the bar exactly as it did. */
      if (!s.dead && !s.froze) { s.froze = true; freezeShutter(); }
      if (!s.dead) {
        /* Measured, not assumed. If this number is large on the owner's
           phone then the layout is the stutter and moving it here is
           the fix; if it is small, the stutter is somewhere else and
           the trace says so rather than another round of guessing. */
        const t0 = performance.now();
        warmNeighbours();
        /* Reading a layout property forces the work to happen NOW
           rather than at the next style pass, which is the only way the
           number above means anything and also the only way the cost is
           actually paid before the finger moves. */
        document.documentElement.clientHeight;
        if (swipeDebugOn()) swipeLog("WARM", { ms: Math.round(performance.now() - t0) });
      }
      s.w = Math.round(window.visualViewport?.width || document.documentElement.clientWidth || window.innerWidth);
      s.x = e.touches[0].clientX;
      s.y = e.touches[0].clientY;
      s.lastX = s.x;
      s.lastT = e.timeStamp || Date.now();
      s.samples = [{ x: s.x, t: s.lastT }];
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
        if (Math.abs(dy) >= Math.abs(dx) && Math.abs(dy) > ENGAGE) { s.dead = true; thaw(); swipeLog("VERTICAL", { dx, dy }); return; }
        if (Math.abs(dx) < (s.engage || ENGAGE)) return;
        /* Sideways ENOUGH. Passing ENGAGE is not the same as meaning
           it — a thumb arcing down the screen crosses 12px of x while
           crossing 11px of y, and that is a scroll. */
        if (Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;
        s.on = true;
        swipeLog("ENGAGE", { dx, dy });
        outEl = findOut();
        if (!wantsLessMotion()) {
          root.classList.add("sb-dragging");
          root.classList.remove("sb-settling");
          const t0 = performance.now();
          showIncoming(dx);
          if (swipeDebugOn()) swipeLog("SHOW-IN", { ms: Math.round(performance.now() - t0) });
        }
      }

      /* RUBBER BAND AT THE ENDS. The first and last tabs do not wrap, so
         the pane resists rather than refusing: a dead gesture reads as a
         broken screen, a heavy one reads as an edge. */
      /* Velocity over the gap since the last move, not over the whole
       gesture: a slow drag that ends in a flick should commit on the
       flick, which is what a thumb actually does. */
      /* ── OVER A WINDOW, NOT OVER THE LAST GAP ──

         This measured the distance since the PREVIOUS touchmove divided
         by the time since it, which is the instantaneous speed at the
         instant the finger stopped. A real thumb decelerates into the
         lift: the last move of a genuinely fast flick is often its
         SLOWEST, and a flick that everybody watching would call fast
         then failed the velocity test and sprang back. The owner's
         words are that a fast swipe does not work, and this is a
         mechanism that would do exactly that.

         Sampling over the last 110ms takes the speed of the flick
         rather than of its final millisecond. Where there is only one
         sample — a flick so quick that touchend follows the first move
         — it falls back to that one, which is the old behaviour and
         correct there: one sample IS the whole gesture. */
      const now = e.timeStamp || Date.now();
      const x = e.touches[0].clientX;
      s.samples.push({ x, t: now });
      while (s.samples.length > 2 && now - s.samples[0].t > 110) s.samples.shift();
      const first = s.samples[0];
      const span = now - first.t;
      if (span > 0) s.v = (x - first.x) / span;
      else { const gap = now - (s.lastT || now); if (gap > 0) s.v = (x - s.lastX) / gap; }
      s.lastX = x;
      s.lastT = now;

      const n = neighbour(dx);
      const resist = n < 0 || n >= items.length ? 0.28 : 1;
      s.dx = dx * resist;

      if (!wantsLessMotion()) {
        setDrag(s.dx);
        /* Owns the finger now, so the page must stop scrolling under it.
           Only once ENGAGED — before that the listener is passive in
           spirit and vertical scrolling is untouched. */
        if (e.cancelable) e.preventDefault(); else swipeLog("NOT-CANCELABLE", { dx: s.dx });
      }
    };

    const end = () => {
      const s = st.current;
      const { on, dx, idx, dead } = s;
      s.on = false; s.dead = true;
      if (dead || !on) { clear(); return; }

      const n = neighbour(dx);
      const far = Math.abs(dx) >= Math.min(screenW() * COMMIT, 140);
      /* A flick commits on speed even when it is short — but only if it
         is still travelling the way the pane is, so a drag that reverses
         at the last instant lands back where it started. */
      const flick = Math.abs(s.v) > FLICK_V && Math.abs(dx) > FLICK_MIN &&
                    (s.v < 0) === (dx < 0);
      const going = (far || flick) && n >= 0 && n < items.length && idx >= 0;
      swipeLog("UP", { dx, v: Math.round(s.v * 100) / 100, far, flick, going,
                       n: s.samples.length, to: going && items[n] ? items[n].to : "-" });

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
      setDrag(going ? (dx < 0 ? -screenW() : screenW()) : 0);

      s.timer = window.setTimeout(() => {
        s.timer = 0;
        /* ── THE ORDER WAS BACKWARDS, AND THAT IS THE WHOLE BUG ──

           This read clear(); navigate(). clear() releases the shutter's
           hold, so the hold was let go ONE LINE BEFORE the thing it
           exists to cover. Swapping panes is what moves the document
           under the shutter; that happens inside navigate(), and the
           bar was already listening again by the time it did.

           It matches the owner's recording exactly. The bar is steady
           for the whole of his finger's travel and then, about four
           tenths of a second AFTER the tab has already changed, slides
           down with its labels clipped off the bottom of the screen for
           three frames and snaps back. Nothing was wrong during the
           gesture. The freeze was simply not still on when the pane
           swapped, and a 450ms quieten timer in TabPanes was carrying a
           job that a timer cannot be relied on to finish.

           So: navigate while still held, put the pane down, and let go
           only once the arrival has stopped moving the page. TabPanes
           takes its own hold the moment the new tab mounts and releases
           it when its scroll restore has finished, so the two overlap
           and there is no instant in between with nobody holding. The
           frames below are the belt for the gap before that effect
           runs — the counter exists precisely so two holders are fine. */
        if (!going) {
          clearVisuals();
          requestAnimationFrame(() => requestAnimationFrame(thaw));
          return;
        }
        /* ── THE INCOMING PANE STAYS WHERE IT IS UNTIL THE ROUTE LANDS ──

           This navigated and cleared the visuals on the same line. The
           router commits a navigation a beat later, not on that line, so
           for the frames in between the incoming layer was already gone
           and the tab the person had just swiped AWAY from was back on
           screen. Traced at 6x CPU, every transition did it: Groups ->
           Home showed Groups again for 200ms after the slide finished,
           Home -> Groups for 300ms. On the four look-alike tabs that is a
           flicker of a similar screen. Out of Messages it is a completely
           different screen returning, and it read as a second movement.

           Nothing is cleared here now. This effect depends on the
           pathname, so its cleanup runs AT the commit — after the new
           pane is the active one in the DOM — and that cleanup already
           calls clear(). The pane is let go at exactly the moment there
           is something to let go onto. The timer below only matters if
           the navigation never commits. */
        navigate(items[n].to);
        s.landing = window.setTimeout(() => { s.landing = 0; if (!disposed) clear(); }, LANDING_MS);
      }, going ? SETTLE_MS : SETTLE_MS + 40);
    };

    /* Put it back and forget it: no navigation, no committed state. */
    const abandon = () => {
      /* THE ONE THAT SYNTHETIC INPUT NEVER FIRES. If this appears in
         the trace, the browser claimed the gesture — overscroll
         navigation, the system edge zone, or a scrolling child. */
      swipeLog("CANCEL", { on: st.current.on, dx: st.current.dx });
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
      disposed = true;
      if (st.current.landing) { window.clearTimeout(st.current.landing); st.current.landing = 0; }
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
