/* ════════════════════════════════════════════════
   Does the screen inside the world have unsent words in it?

   The world's back arrow is one control that closes whatever the world
   currently holds, and only that screen knows whether anything is
   half-written. A chat draft lives in ThreadPage; the arrow lives in
   MessagesWorld; neither is the other's parent.

   So the screen REGISTERS a question and the arrow asks it. One
   function, module scope, no context provider and no state — the arrow
   needs an answer at the instant it is pressed, not a value that has to
   have re-rendered first.

   Registration is cleared on unmount, so a stale answer from a screen
   that has gone cannot hold the arrow hostage. That is the failure mode
   worth guarding: a person trapped in the world by a guard belonging to
   a chat they already left.
   ════════════════════════════════════════════════ */

let ask = null;

export function registerDraftGuard(fn) {
  ask = typeof fn === "function" ? fn : null;
  return () => { if (ask === fn) ask = null; };
}

export function hasUnsentDraft() {
  try {
    return !!ask && !!ask();
  } catch {
    /* A guard that throws must not become a door that cannot be opened. */
    return false;
  }
}
