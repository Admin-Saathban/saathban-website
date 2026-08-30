/* ════════════════════════════════════════════════
   How the app moves — MOTION_SPEC.md, written once.

   That file exists because five lanes each invented their own
   transition. So this is the vocabulary, in one place, and a lane that
   needs a fourth container asks rather than adds one here.

   THE ONE RULE: a thing arrives from where you touched it and leaves
   the same way. Back always reverses the arrival.

   Three containers and no others (§2):

     full screen — anywhere you stay and do something. Slides in from
                   the side that was touched, covers everything.
     drawer      — More and Notifications ONLY. Grows from its button.
     sheet       — one decision, then gone. Rises from the bottom.

   Timings are §3's, to the millisecond, and every one of them
   collapses to an instant cross-fade under prefers-reduced-motion —
   nothing bounces, nothing scales. That is not a nicety: a senior with
   vestibular trouble gets sick from a 220ms slide they did not ask
   for, and the media query is how they say so.

   Used as a <style> block by whichever screen owns the container, so
   there is no global stylesheet to fight over and a lane can adopt it
   one screen at a time.
   ════════════════════════════════════════════════ */

export const MOTION = {
  pushIn: 220,
  pushOut: 220,
  drawerOpen: 200,
  drawerClose: 160,
  sheetUp: 240,
  sheetDown: 180,
  tab: 180,
};

export const MOTION_CSS = `
/* ── Full screen: arrives from the side that was touched (§2) ── */
@keyframes sb-push-in-right {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}
@keyframes sb-push-out-right {
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
}
.sb-push {
  animation: sb-push-in-right ${MOTION.pushIn}ms cubic-bezier(0.16, 0.84, 0.44, 1) both;
  will-change: transform;
}
/* RTL: Urdu reads right-to-left, so "from the side you touched" is the
   other side. The header icon sits in the top-INLINE-end either way. */
[dir="rtl"] .sb-push { animation-name: sb-push-in-left; }
@keyframes sb-push-in-left {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}

/* ── Sheet: rises from the bottom edge (§2) ── */
@keyframes sb-sheet-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.sb-sheet {
  animation: sb-sheet-up ${MOTION.sheetUp}ms cubic-bezier(0.16, 0.84, 0.44, 1) both;
  will-change: transform;
}
@keyframes sb-dim-in { from { opacity: 0; } to { opacity: 1; } }
.sb-dim { animation: sb-dim-in ${MOTION.sheetUp}ms ease-out both; }

/* ── The §11 highlight: a coloured bar down the left edge, fading.
      Tied to the action, never stored — see useFresh. ── */
@keyframes sb-landed {
  0%   { box-shadow: inset 4px 0 0 0 var(--sb-landed, #4E6E4E); }
  70%  { box-shadow: inset 4px 0 0 0 var(--sb-landed, #4E6E4E); }
  100% { box-shadow: inset 4px 0 0 0 rgba(0,0,0,0); }
}
[data-fresh="true"] {
  animation: sb-landed 3s ease-out both;
}

@media (prefers-reduced-motion: reduce) {
  /* §3: instant cross-fades. Nothing slides, nothing bounces. */
  .sb-push, .sb-sheet, .sb-dim {
    animation-duration: 1ms !important;
    animation-name: sb-dim-in !important;
  }
  [data-fresh="true"] { animation-duration: 3s; }
}
`;

/* Drop this once inside any screen that uses a container above. */
export function MotionStyles() {
  return <style>{MOTION_CSS}</style>;
}
