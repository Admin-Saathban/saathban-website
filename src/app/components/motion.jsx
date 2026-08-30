/* ════════════════════════════════════════════════
   The motion vocabulary — MOTION_SPEC.md, in one place.

   That file exists because five lanes each invented their own
   transition. Writing it down without giving lanes something to
   import would produce a sixth. So the rule, the three containers and
   the timings live here, once.

   THE ONE RULE: a thing arrives from where you touched it, and leaves
   the same way. The corollary matters as much — back reverses the
   arrival — which is why the direction travels WITH the navigation
   rather than being decided by the screen that receives it.

   THREE CONTAINERS AND NO OTHERS (§2):
     full screen  somewhere you stay and do something
     drawer       More and Notifications, nothing else
     sheet        one decision, then gone

   REDUCED MOTION (§3): transitions become instant. Not slower, not
   smaller — instant. Nothing bounces, nothing scales. The screen still
   arrives; it simply does not travel.
   ════════════════════════════════════════════════ */

export const TIMING = {
  fullIn: 220,
  fullOut: 220,
  drawerOpen: 200,
  drawerClose: 160,
  sheetUp: 240,
  sheetDown: 180,
  tab: 180,
};

export const DIM = 0.42; // §4 — the screen behind a drawer

export function wantsLessMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/* Navigate to a full-screen destination, remembering which edge it
   came from so the destination can arrive from there and the back
   gesture can reverse it. The direction rides in history state
   because it is a fact about the JOURNEY, not about the page: the
   same profile screen arrives from the left off the header avatar and
   from the right off a search result. */
export function openFullScreen(navigate, to, from = "right", state = {}) {
  navigate(to, { state: { ...state, sbFrom: from } });
}

/* The CSS for every container. Injected once by MotionStyles rather
   than per-component, so a lane cannot half-adopt it. */
export const MOTION_CSS = `
@keyframes sb-in-right { from { transform: translateX(100%); } to { transform: none; } }
@keyframes sb-in-left  { from { transform: translateX(-100%); } to { transform: none; } }
@keyframes sb-in-up    { from { transform: translateY(100%); } to { transform: none; } }

/* A drawer GROWS from its button (§4): small at that corner, then up
   and out into place. Not a flat slide — the difference is what makes
   it read as coming from the thing you pressed. */
@keyframes sb-grow-br {
  from { transform: scale(0.25) translate(38%, 38%); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
@keyframes sb-grow-tr {
  from { transform: scale(0.25) translate(38%, -38%); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
@keyframes sb-dim-in { from { opacity: 0; } to { opacity: 1; } }

.sb-full-right { animation: sb-in-right ${TIMING.fullIn}ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.sb-full-left  { animation: sb-in-left  ${TIMING.fullIn}ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.sb-sheet      { animation: sb-in-up    ${TIMING.sheetUp}ms cubic-bezier(0.22, 1, 0.36, 1) both; }

/* Slight overshoot on open, per §3's easing column. */
.sb-drawer-br  { animation: sb-grow-br ${TIMING.drawerOpen}ms cubic-bezier(0.34, 1.36, 0.64, 1) both;
                 transform-origin: bottom right; }
.sb-drawer-tr  { animation: sb-grow-tr ${TIMING.drawerOpen}ms cubic-bezier(0.34, 1.36, 0.64, 1) both;
                 transform-origin: top right; }
.sb-dim        { animation: sb-dim-in ${TIMING.drawerOpen}ms ease-out both; }

@media (prefers-reduced-motion: reduce) {
  /* Instant, not merely calmer. The container still appears — it just
     does not travel, scale or bounce to get there. */
  .sb-full-right, .sb-full-left, .sb-sheet,
  .sb-drawer-br, .sb-drawer-tr, .sb-dim {
    animation: none !important;
  }
}
`;

export function MotionStyles() {
  return <style>{MOTION_CSS}</style>;
}

/* The class a full-screen route should wear, from the direction it was
   opened with. Defaults to the right, which is the common case. */
export function arrivalClass(locationState) {
  const from = locationState?.sbFrom;
  if (wantsLessMotion()) return "";
  return from === "left" ? "sb-full-left" : "sb-full-right";
}
