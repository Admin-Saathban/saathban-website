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

/* `scrollerRef` is optional and the default is the window, which is what
   every screen in the app scrolls. The Messages world does not: it is a
   fixed box whose content scrolls inside its own <main>, so window
   scrollY never moves there and the shutter would simply never fire.

   Passing the element rather than sniffing for one: a hook cannot see
   which of its callers is inside a fixed container, and guessing would
   be another absent-thing-reads-as-a-value. The caller knows. */
/* ── NOT EVERY SCROLL IS A GESTURE ──

   This hook reads scrolling as INTENT: down means give me the screen,
   up means give me the bars. That is right for a thumb and wrong for
   a scroll the app performed itself.

   Changing tab does exactly that. The incoming pane is put back to
   the position it was left at, and the shutter saw a jump of several
   hundred pixels and believed it. Traced on the deployed build: the
   bar sat still through the whole drag, then slid — 105, 48.8, 4.7 —
   AFTER the tab had changed. The owner sees the bar misbehaving
   during a slide, and it is the bar reacting to a scroll nobody made.

   `quieten` covers the restore: positions still track, so the next
   real gesture measures from where the page actually is, but the bar
   does not change state. `reveal` is separate and deliberate — you
   should ARRIVE at a tab with its navigation visible, wherever the
   previous tab happened to be scrolled to. */
let quietUntil = 0;
const revealers = new Set();

export function quietenShutter(ms = 450) {
  quietUntil = Date.now() + ms;
}

export function revealBars() {
  revealers.forEach((fn) => fn());
}

export default function useShutter(scrollerRef) {
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
    const el = () => scrollerRef?.current || null;
    const posY = () => (el() ? el().scrollTop : window.scrollY);
    const viewH = () => (el() ? el().clientHeight : window.innerHeight);
    const fullH = () => (el() ? el().scrollHeight : document.documentElement.scrollHeight);

    const tallEnough = () => fullH() > viewH() * ENOUGH_TO_SCROLL;

    const read = () => {
      frame = 0;
      const y = Math.max(0, posY());

      /* ── THE BAR HOLDS STILL UNDER A SHEET OR A KEYBOARD ──

         Opening "Join with a code" made the bar open and close
         repeatedly. The shutter reads scrolling as intent, and a
         software keyboard produces scrolling that is not intent: it
         shrinks the viewport and the browser scrolls the focused field
         into view, which arrives here as a real gesture. Then the
         layout settles, that arrives as another, and the bar oscillates.

         DETECTED RATHER THAN DECLARED. The alternative is every sheet
         in the app remembering to tell the shutter it exists, and the
         one that forgets is the one that flickers — this app has five
         lanes and more sheets than I can name. An open dialog or a
         focused field is visible from here, so nothing has to opt in
         and every sheet that raises a keyboard is covered by the same
         two lines, including the ones not written yet.

         Note this is a HOLD, not a hide: whatever the bar was doing, it
         goes on doing. A bar that vanished under every keyboard would
         be a different bug with the same cause. */
      const el = document.activeElement;
      const typing =
        !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (typing || document.querySelector('[role="dialog"]')) {
        lastY.current = y;
        anchor.current = y;
        return;
      }

      /* Quiet: keep the numbers current so the next real gesture is
         measured from here, and decide nothing. */
      if (Date.now() < quietUntil) {
        lastY.current = y;
        anchor.current = y;
        return;
      }
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
    /* LISTEN WHERE IT SCROLLS, not only where it is read. My first pass
       taught this hook to READ an element and left it listening to the
       window — and a scroll event does not bubble up from an element, so
       the world scrolled, the numbers were all available, and nothing
       ever fired. Reading and listening are two jobs; changing one of
       them is changing half a hook. */
    /* Every mounted shutter answers a reveal — there are two, the
       header's and the shell's, and a bar that comes back while the
       header stays away is worse than neither moving. */
    const onReveal = () => {
      lastY.current = posY();
      anchor.current = posY();
      setHidden(false);
    };
    revealers.add(onReveal);

    const target = scrollerRef?.current || window;
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      revealers.delete(onReveal);
      target.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [hidden, scrollerRef]);

  return hidden;
}
