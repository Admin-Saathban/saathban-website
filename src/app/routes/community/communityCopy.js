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
