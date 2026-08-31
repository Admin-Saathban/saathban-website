/* ════════════════════════════════════════════════
   Outdoor lane — non-copy constants only.

   All copy moved to locales/en.js + ur.js under outdoor.* (home,
   place) with a drafted Urdu pass — components resolve it with t()
   from useI18n(). What stays here are symbols and display helpers.
   ════════════════════════════════════════════════ */

/* Names from the app's drawn set (components/Icon.jsx), not emoji.

   Emoji were the last mixed-vocabulary thing on these screens: they
   render in the system font, so a place row carried Apple's tree next
   to a hand-drawn bell in the header, at a weight and colour nothing
   else in the app uses. The drawn set takes currentColor and one
   stroke width, so a place mark finally matches the bar it sits above.

   Every name here exists in that set — checked against it rather than
   guessed, because Icon renders NOTHING for a name it does not know
   and a missing mark is the kind of absence that ships. */
export const TYPE_ICONS = {
  park: "park",
  mosque: "mosque",
  market: "market",
  community_centre: "museum",
  walking_track: "walk",
  seafront: "promenade",
};

/* The mark for a place whose type is unknown, and for the two other
   things these screens mark: a Saathban gathering, and a happening
   with no place attached. */
export const PLACE_FALLBACK_ICON = "place";
export const EVENT_ICON = "gathering";

/* First name only, everywhere presence is shown (SPEC.md). */
export const firstNameOf = (fullName) => (fullName || "").trim().split(/\s+/)[0] || "…";
