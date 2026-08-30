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

   ── WHY THERE ARE TWO MOTION FILES, AND WHICH IS WHICH ──

   `src/app/lib/motion.jsx` exists too, and it is NOT dead code: the
   messages lane imports its MotionStyles in MessagesWorld and
   SayHelloSheet. It owns the SHEET and the push transition. This
   file owns FULL-SCREEN ARRIVAL and the DRAWER,
   which lib has no vocabulary for — §4's grow-from-its-button is only
   here.

   They were written independently and collided on two class names,
   `.sb-dim` and `.sb-sheet`, with different durations. Both are
   mounted at once on the messages screen, so whichever <style> came
   last silently won. Fixed by division rather than by merge: sheets
   are lib's alone, and the dim here is `.sb-drawer-dim`. The two
   files now share no class name at all.

   TWO CLASS NAMES STILL MEAN ONE CONTAINER. `.sb-full-right` here
   and `.sb-push` there are both §2's full-screen arrival: same
   220ms, and until 20e36b7 two different easing curves, so a
   person opening Messages watched a different motion from one
   opening Saved. Too small for anyone to file, which is precisely
   what MOTION_SPEC's opening line is about. Lane 38 converged
   theirs onto this file's curve — four screens to their two, and
   this file is the one that claims full-screen arrival. What is
   left is one container wearing two names.

   This is a truce, not the destination. MOTION_SPEC's whole point is
   one vocabulary, and two files is one and a half. The merge is lib's
   to accept, because folding this in means editing the messages
   lane's imports — so it is written down here rather than done to
   them without asking.
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
/* Which physical edge the app's inline-start is on right now.

   i18n puts dir on a wrapper DIV inside body, not on <html>, so
   documentElement.dir is empty and reading it would silently
   report ltr forever. The wrapper is the only element in the app
   subtree carrying an explicit dir. */
function docDir() {
  try {
    return document.querySelector("[dir]")?.getAttribute("dir") === "rtl" ? "rtl" : "ltr";
  } catch {
    return "ltr";
  }
}

/* `from` may be LOGICAL ("start" | "end") or physical ("left" |
   "right"). Prefer logical.

   Physical was the whole API until now, and four of the six call
   sites hard-coded "left" or "right" — so in Urdu, where the header
   mirrors and the avatar moves to the right while search and
   messages move to the left, every one of them arrived from the
   opposite edge to the button that was pressed. §1's rule, broken
   in exactly the language it is hardest to notice in. Lane 38
   spotted the risk from outside and could not verify it without
   editing my callers; they were right.

   Two call sites had the mirror written out as a ternary and were
   correct. That is the tell: a rule every caller must remember is a
   rule some caller will forget, so the mirror moves in here and the
   ternaries go. Resolution happens at DISPATCH, not on arrival,
   because the history entry should record the physical edge it
   actually came from — if someone switches language mid-session,
   going back should still reverse the animation they saw. */
export function openFullScreen(navigate, to, from = "end", state = {}) {
  const rtl = docDir() === "rtl";
  const physical =
    from === "start" ? (rtl ? "right" : "left")
    : from === "end" ? (rtl ? "left" : "right")
    : from;
  navigate(to, { state: { ...state, sbFrom: physical } });
}

/* The CSS for every container. Injected once by MotionStyles rather
   than per-component, so a lane cannot half-adopt it. */
export const MOTION_CSS = `
@keyframes sb-in-right { from { transform: translateX(100%); } to { transform: none; } }
@keyframes sb-in-left  { from { transform: translateX(-100%); } to { transform: none; } }

/* A drawer GROWS from its button (§4): small at that corner, then up
   and out into place. Not a flat slide — the difference is what makes
   it read as coming from the thing you pressed. */
@keyframes sb-grow-br {
  from { transform: scale(0.25) translate(38%, 38%); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
@keyframes sb-grow-bl {
  from { transform: scale(0.25) translate(-38%, 38%); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
@keyframes sb-grow-tl {
  from { transform: scale(0.25) translate(-38%, -38%); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
@keyframes sb-grow-tr {
  from { transform: scale(0.25) translate(38%, -38%); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
@keyframes sb-drawer-dim-in { from { opacity: 0; } to { opacity: 1; } }

.sb-full-right { animation: sb-in-right ${TIMING.fullIn}ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.sb-full-left  { animation: sb-in-left  ${TIMING.fullIn}ms cubic-bezier(0.22, 1, 0.36, 1) both; }

/* Slight overshoot on open, per §3's easing column. */
.sb-drawer-br  { animation: sb-grow-br ${TIMING.drawerOpen}ms cubic-bezier(0.34, 1.36, 0.64, 1) both;
                 transform-origin: bottom right; }
.sb-drawer-tr  { animation: sb-grow-tr ${TIMING.drawerOpen}ms cubic-bezier(0.34, 1.36, 0.64, 1) both;
                 transform-origin: top right; }
.sb-drawer-bl  { animation: sb-grow-bl ${TIMING.drawerOpen}ms cubic-bezier(0.34, 1.36, 0.64, 1) both;
                 transform-origin: bottom left; }
.sb-drawer-tl  { animation: sb-grow-tl ${TIMING.drawerOpen}ms cubic-bezier(0.34, 1.36, 0.64, 1) both;
                 transform-origin: top left; }
.sb-drawer-dim { animation: sb-drawer-dim-in ${TIMING.drawerOpen}ms ease-out both; }

@media (prefers-reduced-motion: reduce) {
  /* Instant, not merely calmer. The container still appears — it just
     does not travel, scale or bounce to get there. */
  .sb-full-right, .sb-full-left,
  .sb-drawer-br, .sb-drawer-tr, .sb-drawer-bl, .sb-drawer-tl, .sb-drawer-dim {
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
  if (wantsLessMotion()) return "";
  const from = locationState?.sbFrom;
  if (from === "left") return "sb-full-left";
  if (from === "right") return "sb-full-right";
  /* NO STATE. The old fallback was a bare "sb-full-right", commented
     "the common case" — which it is in English and wrong in Urdu,
     where the header mirrors and the buttons sit on the left. It was
     the same hard-coded physical side I had just deleted from four
     call sites, surviving as this helper's own default and inherited
     by every consumer.

     Reachable without any of them doing anything wrong: a refresh, a
     pasted URL, browser restore, or any navigate that does not go
     through openFullScreen. Found by Lane 38 while adopting this
     helper — the fix removes a physical side from the last place one
     was left.

     Defaults to the INLINE-END edge, mirrored, because that is where
     all but one of the app's openers sit. */
  return docDir() === "rtl" ? "sb-full-left" : "sb-full-right";
}
