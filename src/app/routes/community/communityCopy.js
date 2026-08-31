/* ════════════════════════════════════════════════
   Community lane — non-copy constants only.

   All copy moved to locales/en.js + ur.js under community.* (feed,
   dm) with a drafted Urdu pass — components resolve it with t() from
   useI18n(). What stays here is matching logic and symbols, which are
   not translated (QUALITY_REPORT §5 notes).
   ════════════════════════════════════════════════ */

/* Money-talk pattern (SPEC.md: money-talk patterns in a DM trigger a
   warning banner to the recipient). Deliberately over-broad, advisory
   only, checked client-side on render — nothing is blocked or logged
   (QUESTIONS.md C6). English + Urdu keywords. */
export const MONEY_PATTERN = new RegExp(
  [
    "\\brs\\.?\\s?\\d",
    "₨",
    "\\brupees?\\b",
    "\\brupay\\b",
    "\\bpais[ae]\\b",
    "\\beasypaisa\\b",
    "\\bjazz\\s?cash\\b",
    "\\bbank\\b",
    "\\biban\\b",
    "\\baccount\\s+number\\b",
    "\\bwestern\\s+union\\b",
    "\\bmoneygram\\b",
    "\\bloan\\b",
    "\\budhaar\\b",
    "\\bqarz\\b",
    "پیسے",
    "پیسہ",
    "رقم",
    "روپے",
    "بینک",
    "اکاؤنٹ",
    "قرض",
    "ادھار",
  ].join("|"),
  "i"
);

export const REACTIONS = ["👍", "❤️", "🌸", "🤲"];

/* WHAT IS STORED AND WHAT IS DRAWN ARE NOT THE SAME THING.

   The emoji above is the KEY: post_reactions rows carry it, and every
   reaction anybody has ever left is filed under it. Changing those
   values would need a migration and would orphan the existing ones, for
   no gain — a key is not seen by anyone.

   What IS seen is drawn from the app icon set, at one weight, in
   currentColor, like every other icon. A row of four emoji has four
   different line weights and four palettes decided by whoever made the
   font, which is the single thing that made this app read as a
   prototype.

   So: same keys, drawn glyphs. The name on the left of this map is what
   the database holds; the name on the right is what a person sees. */
export const REACTION_ICON = {
  "👍": "like",
  "❤️": "heart",
  "🌸": "good",
  "🤲": "helpOffer",
};

/* Locale keys for the accessible name. The buttons had NONE — the glyph
   was aria-hidden and the count was the only thing announced, so a
   screen reader read "button, 3" and a person using one could not tell
   the four apart. */
export const REACTION_LABEL = {
  "👍": "community.feed.reaction.like",
  "❤️": "community.feed.reaction.heart",
  "🌸": "community.feed.reaction.flower",
  "🤲": "community.feed.reaction.care",
};
