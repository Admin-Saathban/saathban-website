/* ════════════════════════════════════════════════
   The tappable half of a profile — PRODUCT_DECISIONS §8.

   LANGUAGES ARE THE HIGHEST-VALUE FIELD in the whole app: they decide
   whether a Buddy can genuinely talk with somebody. So they are
   multiple-selectable and tapped, never typed — a free-text box turns
   "Punjabi" into "punjabi", "Panjabi" and "پنجابی" and nothing can
   match on it afterwards.

   WHAT YOU ENJOY IS TAPPED TOO, for the same reason and one more: a
   person asked to WRITE what they enjoy writes nothing. A person shown
   "chai" taps it.

   THE PROMPT IS THE FIELD. §8: "Where did you grow up?" gets a real
   sentence; "tell people about yourself" gets nothing. So the prompt
   is chosen from a short list and stored with the answer, and the
   profile shows the question alongside it — a sentence without its
   question is a stray remark.

   These lists are OPEN, not exhaustive. "Others" exists for languages
   because Pakistan has more than five, and the interest list ends with
   more rather than pretending to be complete.
   ════════════════════════════════════════════════ */

/* Stored as stable ids; displayed through the locale files, so a
   profile written in Urdu reads correctly in English and the matching
   a Buddy needs is an id comparison rather than a string one. */
export const LANGUAGES = [
  "urdu",
  "punjabi",
  "english",
  "sindhi",
  "pashto",
  "saraiki",
  "balochi",
  "other",
];

export const INTERESTS = [
  "chai",
  "walking",
  "ludo",
  "gardening",
  "poetry",
  "cricket",
  "cooking",
  "prayer",
  "music",
  "grandchildren",
  "news",
  "sewing",
];

/* Four questions worth answering. Each is concrete and about a life
   rather than about a self — which is the whole difference between a
   sentence and an empty box. */
export const ABOUT_PROMPTS = ["grewUp", "work", "weekend", "proud"];

/* WHAT IS MISSING, for the soft dot (§8) — and deliberately NOT a
   percentage. A percentage tells a lonely person they are incomplete;
   a list of specific invitations tells them what would help and why.
   Photo first: §8 says it is the biggest factor in whether somebody
   connects. */
export function missingFromProfile(p) {
  if (!p) return [];
  const missing = [];
  if (!p.avatar_url) missing.push("photo");
  if (!(p.languages || []).length) missing.push("languages");
  if (!(p.interests || []).length) missing.push("interests");
  if (!(p.about || "").trim()) missing.push("about");
  return missing;
}

/* The dot asks once and then leaves. It stops as soon as it has been
   seen and dismissed, and returns at most weekly — §8 calls it an
   invitation, and an invitation that repeats daily is a nag. */
export const NUDGE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldPulse(p) {
  if (!p) return false;
  if (missingFromProfile(p).length === 0) return false;
  const last = p.settings?.profile_nudge_dismissed_at;
  if (!last) return true;
  const at = Date.parse(last);
  if (Number.isNaN(at)) return true;
  return Date.now() - at >= NUDGE_INTERVAL_MS;
}
