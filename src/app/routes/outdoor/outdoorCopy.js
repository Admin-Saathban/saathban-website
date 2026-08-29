/* ════════════════════════════════════════════════
   Outdoor lane — non-copy constants only.

   All copy moved to locales/en.js + ur.js under outdoor.* (home,
   place) with a drafted Urdu pass — components resolve it with t()
   from useI18n(). What stays here are symbols and display helpers.
   ════════════════════════════════════════════════ */

export const TYPE_ICONS = {
  park: "🌳",
  mosque: "🕌",
  market: "🛍️",
  community_centre: "🏛️",
  walking_track: "🚶",
  seafront: "🌊",
};

/* First name only, everywhere presence is shown (SPEC.md). */
export const firstNameOf = (fullName) => (fullName || "").trim().split(/\s+/)[0] || "…";
