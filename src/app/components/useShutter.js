/* ════════════════════════════════════════════════
   The shutter — MOTION_SPEC.md §5.

   Both bars hide on scroll down and come back on scroll up, so a person
   reading a feed gets the whole screen for it. Specced from the
   beginning, never built, raised twice.

   TUNED FOR OLDER USERS, and the two clauses in §5 are the whole
   design:

   1. IT RETURNS ON THE SLIGHTEST UPWARD SCROLL. Facebook wants a
      deliberate flick; that is a young thumb's gesture. Four pixels up
      brings the bars back here — if somebody nudges the page looking
      for the navigation, they have found it. Hiding is the opposite:
      it takes a real push (28px) so a small wobble while reading never
      takes the bar away.

   2. IT NEVER HIDES ON A PAGE THAT BARELY SCROLLS. Under about 1.5
      screen heights there is nothing to gain and a person can end up
      on a short screen with no navigation and nothing to scroll to get
      it back. That is the failure worth engineering against, so the
      measurement is re-taken whenever the content changes rather than
      once on mount.

   Reduced motion: the bars still hide and return — that is layout, not
   decoration — but they do it instantly. Nothing slides.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";

/* A real push down; a nudge up. Asymmetric on purpose — see §5. */
const HIDE_AFTER = 28;
const SHOW_AFTER = 4;
/* Below this multiple of the viewport, the bars never leave. */
const ENOUGH_TO_SCROLL = 1.5;

export default function useShutter() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const anchor = useRef(0);

  useEffect(() => {
    let frame = 0;

    /* Re-measured on every scroll rather than once on mount: a feed
       arrives after its fetch, so a page that was one screen tall when
       this ran can be five by the time anybody scrolls it. Measuring
       once is how "never hides on a short page" turns into "never
       hides". */
    const tallEnough = () =>
      document.documentElement.scrollHeight > window.innerHeight * ENOUGH_TO_SCROLL;

    const read = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const dy = y - lastY.current;

      if (!tallEnough()) {
        if (hidden) setHidden(false);
        lastY.current = y;
        anchor.current = y;
        return;
      }

      /* Near the very top the bars are always present: a person who has
         scrolled back to the beginning is looking for where they are. */
      if (y < 12) {
        if (hidden) setHidden(false);
        lastY.current = y;
        anchor.current = y;
        return;
      }

      /* The anchor resets whenever the direction changes, so the
         thresholds measure THIS gesture rather than the whole page. */
      if ((dy > 0) !== (y - anchor.current > 0)) anchor.current = y;
      const travelled = y - anchor.current;

      if (dy > 0 && travelled > HIDE_AFTER && !hidden) setHidden(true);
      else if (dy < 0 && anchor.current - y > SHOW_AFTER && hidden) setHidden(false);

      lastY.current = y;
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };

    lastY.current = Math.max(0, window.scrollY);
    anchor.current = lastY.current;
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [hidden]);

  return hidden;
}
