/* ════════════════════════════════════════════════
   Haptics — a tap on the wrist, never a buzz.

   `navigator.vibrate` exists on Android Chrome and nowhere on iOS,
   so this is a garnish on a garnish: it must be invisible when
   absent, and it must never be the only way anything is announced.

   DURATIONS ARE SHORT ON PURPOSE. A vibration long enough to be
   "felt properly" is long enough to be startling, and a phone
   buzzing in the hand of someone who wasn't expecting it is the
   opposite of what this whole feature is for. Nothing here runs
   past 40ms in a single pulse.

   Hands change too. Reduced sensation makes a 10ms tick simply not
   register, which is fine — it is decoration — but it is the reason
   the patterns below lean on a short double-pulse for meaning rather
   than on one pulse being subtly longer than another.
   ════════════════════════════════════════════════ */

import { getSoundPrefs } from "./sound.js";

/* Shared with the sound prefs deliberately: someone silencing a game
   in a quiet room means "stop announcing yourself", and a phone
   buzzing on a table is louder than a soft tone. Mute means mute. */
function allowed() {
  try {
    const p = getSoundPrefs();
    if (!p.haptics || p.muted) return false;
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  } catch {
    return false;
  }
}

function buzz(pattern) {
  if (!allowed()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export function hapticsAvailable() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/* A press landed on something solid. */
export const hapticTap = () => buzz(10);

/* A goti was sent home, or a coin pocketed — one firmer tap. Distinct
   from a press by weight, not by length. */
export const hapticCapture = () => buzz(28);

/* You won. Two quick taps and done: the rhythm carries the meaning,
   so nothing has to be long. */
export const hapticWin = () => buzz([26, 70, 34]);

/* Your turn arrived while you were looking elsewhere. */
export const hapticTurn = () => buzz([14, 90, 14]);

export function stopHaptics() {
  try {
    navigator.vibrate?.(0);
  } catch {
    /* nothing to stop */
  }
}
