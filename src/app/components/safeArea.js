/* ════════════════════════════════════════════════
   THE BAR'S OWN HEIGHT MUST NOT BE THE BROWSER'S TO CHANGE.

   Measured off the owner's recording rather than reasoned about. Every
   frame of an 18-second clip was decoded and the bottom bar's box read
   out of the pixels: at rest its top edge sits at y=803 and its bottom
   at y=849. During a tab change the top edge moves DOWN to 827 while
   THE BOTTOM STAYS EXACTLY WHERE IT WAS, holds for about 300ms, and
   returns. Six separate times in one clip, always downward, never up.

   That is not the shutter. The shutter translates the bar by its whole
   height — about ninety pixels — and it moves the bottom edge with it.
   A bar whose bottom is pinned and whose top comes DOWN by twenty-four
   pixels has not moved at all. IT HAS GOT SHORTER.

   The bar's height is `6px + 6px + env(safe-area-inset-bottom)` plus
   its content, and it is anchored at bottom:0. So the one thing that
   can shrink it from underneath, pinning the bottom and dropping the
   top, is the inset going to zero — and env() is live: the browser
   re-reports it when its own chrome moves, which is exactly what a
   browser does when the page under it stops being scrollable. Swiping
   forward into a pane that has not mounted yet, or has mounted and not
   fetched, is precisely a page that briefly cannot scroll.

   It also explains the direction the owner reports. Going forward
   reaches a pane that may still be arriving; going back reaches one
   that is already there, already tall, already scrollable, and nothing
   about the browser's chrome changes. One direction shrinks the page
   and one does not, and only one of them moves the bar.

   SO THE INSET IS READ, NOT SUBSCRIBED TO. Once at startup and again
   whenever the screen actually changes shape — an orientation change, a
   fold — and never in between. It is kept as the LARGEST value ever
   seen, because the failure is asymmetric: an inset briefly too big
   leaves a few pixels of padding nobody notices, and an inset briefly
   zero drops the navigation a centimetre while somebody is looking at
   it. When there is genuinely less inset than there was, a resize says
   so and the ratchet is reset there.

   Nothing else changes. --sb-safe-bottom keeps its name and its
   meaning; it simply holds a number now instead of a question the
   browser is free to answer differently every frame.
   ════════════════════════════════════════════════ */

let biggest = 0;

/* env() cannot be read from JS, so it is read the only way it can be:
   put it on a real element as a length and measure the element. Hidden
   from everything — no size, no paint, no accessibility tree. */
function measure() {
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:fixed;left:-9999px;bottom:0;width:0;visibility:hidden;" +
    "pointer-events:none;height:env(safe-area-inset-bottom, 0px)";
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return Number.isFinite(px) ? px : 0;
}

function apply(reset) {
  const now = measure();
  if (reset) biggest = now;
  else if (now > biggest) biggest = now;
  document.documentElement.style.setProperty("--sb-safe-bottom", biggest + "px");
}

/* Returns its own teardown, so the shell can own it like any effect. */
export default function pinSafeArea() {
  if (typeof document === "undefined") return () => {};
  apply(true);

  /* ── MEASURING ONCE WOULD HAVE BEEN A WORSE BUG THAN THE ONE BEING
     FIXED ──

     The inset can read zero on the very first paint, before the browser
     has applied viewport-fit and worked out its own chrome. Pinning
     THAT number would take the bar's bottom padding away permanently
     and for everybody — the same twenty-four pixels, no longer for
     three hundred milliseconds but for the whole session. A fix that
     makes the defect permanent is not a fix.

     So the first second is read repeatedly, and the ratchet is what
     makes that safe: these reads can only raise the value, never lower
     it. The same reasoning covers resize. A resize is exactly the event
     the browser fires when it hides its own toolbar — the event this
     file exists to stop obeying — so it is allowed to make the bar
     TALLER and never shorter. Only a genuine change of shape resets. */
  const early = [0, 120, 400, 1000].map((ms) => window.setTimeout(() => apply(false), ms));
  const raf = requestAnimationFrame(() => apply(false));

  const onGrow = () => apply(false);
  window.addEventListener("resize", onGrow);
  window.visualViewport?.addEventListener?.("resize", onGrow);

  const onShape = () => apply(true);
  window.addEventListener("orientationchange", onShape);
  const mq = window.matchMedia ? window.matchMedia("(orientation: portrait)") : null;
  mq?.addEventListener?.("change", onShape);

  return () => {
    early.forEach(window.clearTimeout);
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onGrow);
    window.visualViewport?.removeEventListener?.("resize", onGrow);
    window.removeEventListener("orientationchange", onShape);
    mq?.removeEventListener?.("change", onShape);
    document.documentElement.style.removeProperty("--sb-safe-bottom");
  };
}

/* For the trace. The overlay shows what the bar is actually standing on,
   so the phone can say whether this was the cause rather than me. */
export function safeBottomNow() {
  return { pinned: biggest, live: typeof document === "undefined" ? 0 : measure() };
}
