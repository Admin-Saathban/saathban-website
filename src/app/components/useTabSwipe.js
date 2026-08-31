/* ════════════════════════════════════════════════
   Horizontal swipe moves between the five tabs, in bar order.

   Instagram's gesture, and it is worth having for the same reason it is
   worth having there: the bar is at the bottom of a 390px screen and a
   thumb already lives at the bottom of the screen. Moving between two
   neighbouring tabs should not require aiming.

   THE ORDER IS THE BAR'S ORDER, taken from the same barItems() the bar
   renders, never a second list. A swipe that disagrees with the tabs
   about what comes next is worse than no swipe, and two lists that must
   agree are two lists that eventually will not.

   RTL MIRRORS. In Urdu the bar reads right to left, so the gesture does
   too: dragging towards the start edge advances. Direction is read off
   the document rather than assumed, for the same reason the drawer
   origin is — an empty `dir` reads as `ltr`, which is a silent wrong
   answer rather than a loud one.

   ─── WHAT IT REFUSES TO DO ───

   TAB-SWIPE YIELDS. Anything that scrolls or swipes horizontally INSIDE
   a screen wins the gesture outright: a carousel, a horizontal chip
   row, a swipeable chat row, a slider. Two of these were already in the
   app before this hook existed, and a person dragging a carousel does
   not expect to leave the screen.

   The yield is automatic rather than opt-in. It walks up from the touch
   target looking for an ancestor that actually scrolls sideways —
   scrollWidth wider than clientWidth, with overflow-x set to something
   that moves. That way a lane does not have to know this hook exists in
   order to be safe from it, which matters because most of the surfaces
   it has to yield to belong to other lanes. `data-sb-swipe` is there as
   an explicit marker for a surface that handles its own drag without
   being a scroller (a swipeable row, say), since that kind cannot be
   detected by measurement.

   Text selection and form fields are excluded too: dragging across a
   message to select it is a horizontal drag, and it must not turn the
   page.
   ════════════════════════════════════════════════ */

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/* A swipe has to be decisively sideways. 64px stops a sloppy tap from
   turning the page; the 1.6 ratio stops a diagonal scroll from doing
   it, which is the one that actually happens on a feed. */
const DISTANCE = 64;
const SIDEWAYS = 1.6;

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

  useEffect(() => {
    if (!enabled || !items || items.length < 2) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    let x0 = null, y0 = null, dead = false;

    const start = (e) => {
      /* One finger only: two is a pinch or a browser gesture, and
         neither of those is asking to change tab. */
      if (e.touches.length !== 1) { dead = true; return; }
      const t = e.touches[0];
      const el = e.target instanceof Element ? e.target : null;
      dead =
        !el ||
        scrollsSideways(el) ||
        !!el.closest("input, textarea, select, [contenteditable='true'], [role='slider']");
      x0 = t.clientX;
      y0 = t.clientY;
    };

    const end = (e) => {
      const sx = x0, sy = y0;
      x0 = null; y0 = null;
      if (dead || sx == null) { dead = false; return; }
      dead = false;
      const t = e.changedTouches?.[0];
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < DISTANCE || Math.abs(dx) < Math.abs(dy) * SIDEWAYS) return;

      /* Longest match wins: /app/games/ludo must resolve to the Games
         tab, and a plain indexOf on the first prefix would not. */
      let here = -1, best = -1;
      items.forEach((it, i) => {
        if (pathname === it.to || pathname.startsWith(it.to + "/")) {
          if (it.to.length > best) { best = it.to.length; here = i; }
        }
      });
      if (here < 0) return;

      const rtl = (document.querySelector("[dir]")?.getAttribute("dir") || "ltr") === "rtl";
      /* Dragging the content leftwards brings the NEXT tab in from the
         right, which is the direction every phone already teaches. */
      const forward = rtl ? dx > 0 : dx < 0;
      const to = here + (forward ? 1 : -1);
      if (to < 0 || to >= items.length) return;   // the ends do not wrap
      navigate(items[to].to);
    };

    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchend", end);
    };
  }, [items, enabled, pathname, navigate]);
}
