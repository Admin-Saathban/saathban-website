/* ════════════════════════════════════════════════
   Display units for the daily log. LOGS store one canonical value
   (water in ml, weight in kg); Settings holds the person's preferred
   unit and these helpers translate at the edge of the screen — so a
   Fam member in Toronto reading "1.5 L" and an Icon in Lahore logging
   "6 glasses" are looking at the same row.

   One glass = 250 ml (the everyday Pakistani steel/glass tumbler).
   ════════════════════════════════════════════════ */

export const GLASS_ML = 250;
export const WATER_GOAL_ML = 2000;

export const WATER_UNITS = ["glasses", "l", "ml"];
export const WEIGHT_UNITS = ["kg", "lbs"];

/* Water */
export function waterToDisplay(ml, unit) {
  const v = Number(ml) || 0;
  switch (unit) {
    case "l":
      return Math.round((v / 1000) * 100) / 100;
    case "ml":
      return Math.round(v);
    default:
      return Math.round((v / GLASS_ML) * 10) / 10;
  }
}

export function waterFromDisplay(value, unit) {
  const v = Number(value) || 0;
  switch (unit) {
    case "l":
      return Math.round(v * 1000);
    case "ml":
      return Math.round(v);
    default:
      return Math.round(v * GLASS_ML);
  }
}

/* One tap of +/− in the chosen unit, expressed in ml. */
export function waterStepMl(unit) {
  switch (unit) {
    case "l":
      return 250;
    case "ml":
      return 100;
    default:
      return GLASS_ML;
  }
}

/* Legacy rows stored { glasses: n } before units existed. */
export function waterMlOf(value) {
  if (!value) return 0;
  if (typeof value.ml === "number") return value.ml;
  if (typeof value.glasses === "number") return value.glasses * GLASS_ML;
  return 0;
}

/* Weight */
export function weightToDisplay(kg, unit) {
  const v = Number(kg) || 0;
  return unit === "lbs" ? Math.round(v * 2.20462 * 10) / 10 : Math.round(v * 10) / 10;
}

export function weightFromDisplay(value, unit) {
  const v = Number(value) || 0;
  return unit === "lbs" ? Math.round((v / 2.20462) * 100) / 100 : Math.round(v * 100) / 100;
}
