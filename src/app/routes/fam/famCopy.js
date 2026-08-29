/* ════════════════════════════════════════════════
   Saath-Fam lane — display maps only.

   All of this lane's copy now lives in locales/en.js + ur.js under
   fam.* (the Urdu pass); components resolve it with t() from
   useI18n(). What remains here is data-to-display mapping.
   ════════════════════════════════════════════════ */

// mood_value (1 lowest … 5 best) → face + label key, matching the
// Icon home's five options in order (labels shared via home.moods.*).
export const MOOD_BY_VALUE = {
  5: { face: "😄", labelKey: "home.moods.wonderful" },
  4: { face: "🙂", labelKey: "home.moods.good" },
  3: { face: "😐", labelKey: "home.moods.okay" },
  2: { face: "🙁", labelKey: "home.moods.low" },
  1: { face: "😞", labelKey: "home.moods.heavy" },
};
