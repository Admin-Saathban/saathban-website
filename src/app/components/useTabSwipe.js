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

/* Below ENGAGE the gesture is still undecided and the page scrolls
   normally; past it the drag owns the finger. 12px is small enough to
   feel immediate and large enough that a tap never starts a drag. */
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
html.sb-dragging main {
  transform: translate3d(var(--sb-drag, 0px), 0, 0);
  will-change: transform;
}
html.sb-settling main {
  transform: translate3d(var(--sb-drag, 0px), 0, 0);
  transition: transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
html.sb-dragging, html.sb-dragging body { overscroll-behavior-x: none; }
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
  const st = useRef({ x: 0, y: 0, dx: 0, on: false, dead: true, idx: -1 });

  useEffect(() => {
    if (!enabled || !items || items.length < 2) return undefined;
    ensureStyles();

    const root = document.documentElement;
    const setDrag = (px) => root.style.setProperty("--sb-drag", px + "px");
    const clear = () => {
      root.classList.remove("sb-dragging", "sb-settling");
      root.style.removeProperty("--sb-drag");
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

    const start = (e) => {
      const s = st.current;
      s.on = false; s.dx = 0;
      if (e.touches.length !== 1) { s.dead = true; return; }
      const el = e.target instanceof Element ? e.target : null;
      s.dead =
        !el ||
        scrollsSideways(el) ||
        !!el.closest("input, textarea, select, [contenteditable='true'], [role='slider']");
      s.idx = indexOfPath();
      if (s.idx < 0) s.dead = true;
      s.x = e.touches[0].clientX;
      s.y = e.touches[0].clientY;
    };

    const move = (e) => {
      const s = st.current;
      if (s.dead || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - s.x;
      const dy = e.touches[0].clientY - s.y;

      if (!s.on) {
        /* Undecided: a mostly-vertical drag is a scroll and this hook
           must let go of it for good, not keep testing every frame. */
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > ENGAGE) { s.dead = true; return; }
        if (Math.abs(dx) < ENGAGE) return;
        s.on = true;
        if (!wantsLessMotion()) {
          root.classList.add("sb-dragging");
          root.classList.remove("sb-settling");
        }
      }

      /* RUBBER BAND AT THE ENDS. The first and last tabs do not wrap, so
         the pane resists rather than refusing: a dead gesture reads as a
         broken screen, a heavy one reads as an edge. */
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
      const going = far && n >= 0 && n < items.length && idx >= 0;

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

      window.setTimeout(() => {
        clear();
        if (going) navigate(items[n].to);
      }, going ? SETTLE_MS : SETTLE_MS + 40);
    };

    document.addEventListener("touchstart", start, { passive: true });
    /* Not passive: once the drag is engaged it has to stop the page
       scrolling, and a passive listener may not preventDefault. */
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
      clear();
    };
  }, [items, enabled, pathname, navigate]);
}
