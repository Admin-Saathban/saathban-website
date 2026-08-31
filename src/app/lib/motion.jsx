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

/* The press tint needs a colour, and this file had never imported one.
   Written as a token reference with nothing in scope it would have
   emitted the text "undefined" into the stylesheet — a declaration the
   browser discards in silence, so every press would have done nothing
   while the code read as though it worked. */
import { APP_COLORS as C } from "../../shared/tokens.js";

export const MOTION = {
  pushIn: 220,
  pushOut: 220,
  drawerOpen: 200,
  drawerClose: 160,
  sheetUp: 240,
  sheetDown: 180,
  tab: 180,
  /* The double-tap heart. Long enough to be seen leaving, short
     enough that it never delays the next tap. */
  heartPop: 420,
  /* Press feedback. The games lane's .sb-pressable is 90ms; ten
     milliseconds apart is not a difference anyone can see, but it is
     two numbers for one feeling — flagged to them rather than quietly
     matched, since theirs predates this. */
  press: 100,
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
/* THE SAME CURVE components/motion.jsx USES, and that is the point.

   Both files implement §2's full-screen container — .sb-full-right
   there, .sb-push here — at the same 220ms, but with DIFFERENT easing:
   this was cubic-bezier(0.16, 0.84, 0.44, 1) against their
   (0.22, 1, 0.36, 1). Same duration, visibly different arrival. So
   opening Messages moved unlike opening Saved, which is precisely the
   thing MOTION_SPEC was written to stop: "five lanes each invented
   their own transition."

   Converged on theirs rather than the reverse because that file
   declares itself the owner of full-screen arrival and four screens
   already use it, against two here. The two class names are still a
   redundancy worth merging — noted to that lane — but a person can no
   longer SEE the difference, which is the half that mattered. */
.sb-push {
  animation: sb-push-in-right ${MOTION.pushIn}ms cubic-bezier(0.22, 1, 0.36, 1) both;
  will-change: transform;
}
/* RTL: Urdu reads right-to-left, so "from the side you touched" is the
   other side. The header icon sits in the top-INLINE-end either way. */
[dir="rtl"] .sb-push { animation-name: sb-push-in-left; }
@keyframes sb-push-in-left {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}

/* ── Press feedback ── */

/* A tap gave nothing until its result arrived, which on anything that
   waits on the network reads as a dead control — so people tap again,
   and the second tap is the one that does something unintended.

   TINT FOR THE BROAD RULE, SCALE ONLY WHERE ASKED. A background tint
   costs no layout: it cannot nudge a neighbour, cannot reflow a row,
   and cannot make a list jump while a thumb is on it. Scale is nicer
   and riskier, so it is opt-in via .sb-press rather than sprayed over
   every button in three folders.

   Scoped to MY surfaces by their existing markers — the post card
   (.sb-bleed), any sheet ([role=dialog]) and the Messages world — so
   this does not reach into another lane's chrome and become a second
   opinion about how their buttons feel.

   SURFACE.pressed already existed for this. I did not invent a value. */
.sb-bleed button:active,
.sb-bleed a:active,
[role="dialog"] button:active,
[role="dialog"] a:active,
[data-world="messages"] button:active,
[data-world="messages"] a:active {
  /* !important, and it is not laziness. Every surface in this app is
     styled inline — background: "none" sits in the element's style
     attribute, and an inline declaration beats any stylesheet rule
     however specific. Measured: the tint reported rgba(0,0,0,0) while
     held down, because the rule was correct and simply losing.

     A press tint is a transient state that must win over the resting
     paint by definition, so this is the one place the hammer is the
     right tool. The alternative is threading a pressed flag through
     several dozen call sites in three folders. */
  background-color: ${C.pressed} !important;
  transition: background-color ${MOTION.press}ms ease-out;
}

.sb-press { transition: transform ${MOTION.press}ms ease-out, background-color ${MOTION.press}ms ease-out; }
.sb-press:active { transform: scale(0.97); }

/* ── The double-tap heart (§3) ── */

/* It grows from the point the finger landed and fades going up, which
   is the ONE RULE applied to a thing with no container: a mark arrives
   where you touched. It is decorative and transient, so it is
   pointer-events:none — a heart under the thumb must never eat the
   next tap. */
@keyframes sb-heart-pop {
  0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
  35%  { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
  70%  { transform: translate(-50%, -62%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -95%) scale(0.9); opacity: 0; }
}
.sb-heart-pop {
  position: absolute;
  pointer-events: none;
  z-index: 5;
  animation: sb-heart-pop ${MOTION.heartPop}ms cubic-bezier(0.22, 1, 0.36, 1) both;
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

/* ── The §11 highlight is NOT here, deliberately. ──

   This file used to carry its own data-fresh="true" rule for the
   landed-post glow. It never once fired: useFresh writes the post's
   ID into data-fresh (so it can find the node to scroll to) and marks
   the fresh one with a CLASS, sb-fresh. The selector could not match
   anything, ever.

   (Backticks avoided in this comment on purpose — the whole block is
   inside a JS template literal, and a stray one ends the string.)

   It was also a second copy of something feedback.jsx already does
   properly — sbFreshGlow, 2.4s, standing down under reduced motion.
   AUDIT_11 names useFresh as THE mechanism for §11, so the right fix
   is one implementation rather than a corrected duplicate that can
   drift from it. Found by a test looking for the wrong selector and
   discovering that the code was looking for it too. */

@media (prefers-reduced-motion: reduce) {
  /* §3: instant cross-fades. Nothing slides, nothing bounces. */
  /* §3 — the pop does not travel or scale. It appears and goes, so
     the confirmation is still there for somebody who cannot take
     movement. Not removed: it is the only feedback the gesture has. */
  /* The TINT is not motion and stays: it is the only thing telling a
     person their tap landed. Only the scale is removed. */
  .sb-press:active { transform: none; }
  .sb-heart-pop {
    animation-name: sb-dim-in !important;
    animation-duration: 1ms !important;
  }
  .sb-push, .sb-sheet, .sb-dim {
    animation-duration: 1ms !important;
    animation-name: sb-dim-in !important;
  }
}
`;

/* Drop this once inside any screen that uses a container above. */
export function MotionStyles() {
  return <style>{MOTION_CSS}</style>;
}
