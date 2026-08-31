/* ════════════════════════════════════════════════
   Distance bands — PRODUCT_DECISIONS §12.

   "Distance bands are computed from AREA, not kilometres. Seniors
   think in 'can I walk', 'short rickshaw', 'across town'."

   So there is no geometry here and there deliberately never will be.
   Two places are Walkable if they are in the same neighbourhood,
   Nearby if they are in the same city, and Across the city otherwise.
   That is the whole model, and it is right: a person who knows Model
   Town does not need a radius to tell them the park is walkable, and
   a number in metres would be less true, not more — half a kilometre
   across a main road is not walkable at seventy.

   WITH NO AREA OF THEIR OWN, everything in their city reads as
   NEARBY. §2 makes area optional ("prompted but optional"), so the
   person who skipped it must still get a usable screen. The failure to
   avoid is not mis-banding — it is a screen that shows them nothing,
   or that shows every happening under a heading implying they cannot
   reach any of it. A band is a kindness, not a gate.

   Pure functions, no imports: this is the file a test can pin without
   a browser, and §20.3 asks that each check be proved able to fail.
   ════════════════════════════════════════════════ */

export const WALKABLE = "walkable";
export const NEARBY = "nearby";
export const ACROSS = "across";

/* Areas and cities are typed by people. "model town", "Model Town" and
   " Model  Town " are one place; this is the only normalisation, and
   it deliberately does not try to be clever about spelling. */
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Which band does `place` fall into, for a person in `me`?
 * @param {{city?: string, area?: string}} me
 * @param {{city?: string, area?: string}} place
 */
export function bandFor(me, place) {
  const myCity = norm(me?.city);
  const myArea = norm(me?.area);
  const itsCity = norm(place?.city);
  const itsArea = norm(place?.area);

  /* Same neighbourhood is the only thing that earns "walkable" — and
     both sides must actually say which neighbourhood they mean. Two
     blanks are not a match; they are two unknowns. */
  if (myArea && itsArea && myArea === itsArea && (!myCity || !itsCity || myCity === itsCity)) {
    return WALKABLE;
  }
  /* Same city, or we don't know where the person is: Nearby. Somebody
     with no city set is new, and a new person should see the city's
     life rather than a screen insisting everything is far away. */
  if (!myCity || !itsCity || myCity === itsCity) return NEARBY;
  return ACROSS;
}

export const BAND_ORDER = [WALKABLE, NEARBY, ACROSS];

/* Group happenings into bands, preserving each caller's sort within a
   band. Returns only bands that HAVE something: §0.6 — a section that
   would be empty is absent, never an empty box announcing a gap. */
export function groupByBand(items, me, placeOf) {
  const out = new Map();
  for (const item of items) {
    const band = bandFor(me, placeOf(item) || {});
    if (!out.has(band)) out.set(band, []);
    out.get(band).push(item);
  }
  return BAND_ORDER.filter((b) => out.has(b)).map((b) => [b, out.get(b)]);
}

/* ── When, in the same spirit as where ──
   §12 groups by distance first, then "Tomorrow" and "Coming up". A
   happening is TODAY if it starts before midnight tonight, TOMORROW
   for the following day, and COMING UP after that. Local midnight,
   not UTC — a plan at 9pm in Lahore is tonight's plan. */
export const TODAY = "today";
export const TOMORROW = "tomorrow";
export const LATER = "later";

export function dayBucket(when, now = new Date()) {
  if (!when) return TODAY; // an open invitation with no time is for today
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const tomorrow = new Date(start);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const t = when instanceof Date ? when : new Date(when);
  if (t < tomorrow) return TODAY;
  if (t < dayAfter) return TOMORROW;
  return LATER;
}

/* "since 3:40" — §12 wants how long someone has been somewhere, not a
   duration in minutes. The clock time is what a person can act on:
   it tells them whether they have missed them. */
export function sinceLabel(iso, locale) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(locale === "ur" ? "ur-PK" : "en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}
