/* ════════════════════════════════════════════════
   Three families, visibly different — PRODUCT_DECISIONS §9.

   "Badges are visibly different by family, so a credential is never
   confused with an achievement."

   DIFFERENT BY SHAPE AS WELL AS COLOUR, always. §0.1 forbids colour
   alone anywhere in the app, and this is the exact case it was written
   for: somebody who cannot tell sage from brass must still be able to
   see that a credential is a different kind of thing from a Tuesday
   they showed up.

     presence    circle, sage      — showing up over time
     moment      leaf, amber       — a first, once
     credential  shield, brass     — something completed

   The shield is deliberate: a credential doubles as a trust signal to
   strangers (§8), and a shield is the shape people already read that
   way.
   ════════════════════════════════════════════════ */

import { COLORS as C } from "../../../shared/tokens.js";

export const FAMILIES = {
  presence: {
    id: "presence",
    ring: "#7BA97C",
    fill: "#EAF3EA",
    /* A circle: a thing that comes round again, which is what showing
       up over time actually is. */
    radius: "50%",
    clip: null,
  },
  moment: {
    id: "moment",
    ring: "#D9A441",
    fill: "#FBF1DC",
    /* A leaf: one-sided, grown once. */
    radius: "50% 8% 50% 8%",
    clip: null,
  },
  credential: {
    id: "credential",
    ring: "#9C7B3C",
    fill: "#F3E9D2",
    /* A shield — the shape a stranger already reads as a warrant. */
    radius: "18% 18% 46% 46%",
    clip: null,
  },
};

export function familyOf(badge) {
  return FAMILIES[badge?.family] || FAMILIES.moment;
}

/* Saathban's voice, varied. §9: "Vary the copy so twelve people
   earning the same badge in a week doesn't read like a printer."

   The variant is chosen from the earned row's own id rather than at
   random, so the sentence is stable — a post that rewords itself on
   every render is a different kind of wrong, and somebody re-reading
   their own milestone should find the words they were given. */
export function voiceVariant(seed, count) {
  const s = String(seed || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % count;
}

export const VOICE_VARIANTS = 3;

/* Which family a badge belongs to, from the only column that says so.

   `badges` (0017) has no `family` column — it has `trigger_kind`, and
   the family is a fact about what the trigger MEANS: a run of days is
   presence, a first is a moment, a finished course is a credential.
   Deriving it here rather than at each call site is what stops two
   screens drawing the same badge as two different shapes.

   Unknown kinds fall to `moment`, which is the honest default: a badge
   we cannot classify is at least something that happened once. */
const KIND_FAMILY = {
  presence_7: "presence",
  presence_30: "presence",
  presence_100: "presence",
  first_log: "moment",
  first_note: "moment",
  first_rest_day: "moment",
  first_post: "moment",
  first_outing: "moment",
  return_after_absence: "moment",
};

export function familyOfKind(triggerKind) {
  return FAMILIES[KIND_FAMILY[triggerKind]] || FAMILIES.moment;
}

/* The locale key for a family's name IN WORDS. §0.1 forbids meaning
   carried by colour alone, and the shapes help only somebody who
   already knows the code — so every badge says which kind it is. */
export const FAMILY_LABEL_KEY = {
  presence: "badges.familyPresence",
  moment: "badges.familyMoment",
  credential: "badges.familyCredential",
};
