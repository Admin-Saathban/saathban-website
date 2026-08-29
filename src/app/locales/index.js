/* ════════════════════════════════════════════════
   Locale registry — everything the app needs to know about a
   language in one place: its strings, its direction, and the font
   stack that renders it.

   Adding a language later = one strings file + one entry here.
   Components never branch on the language code — they read
   meta.dir / meta.fonts / meta.lineHeight from useI18n().
   ════════════════════════════════════════════════ */

import { FONTS } from "../../shared/tokens.js";
import en from "./en.js";
import ur from "./ur.js";

export const DEFAULT_LANG = "en";

// Loaded by LanguageProvider alongside the brand fonts. Nastaliq is a
// heavy face; display=swap keeps the placeholder text readable while
// it arrives.
export const NASTALIQ_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap";

export const LOCALES = {
  en: {
    strings: en,
    meta: {
      code: "en",
      dir: "ltr",
      // A language's own name is shown in that language — this is
      // convention, not a string for the translator, so it lives here.
      label: "English",
      fonts: { body: FONTS.sans, heading: FONTS.serif },
      lineHeight: 1.6,
    },
  },
  ur: {
    strings: ur,
    meta: {
      code: "ur",
      dir: "rtl",
      label: "اردو",
      // Nastaliq carries both body and headings — Playfair/DM Sans have
      // no Arabic-script glyphs. The Latin faces stay in the stack so
      // untranslated [UR] placeholders still render cleanly.
      fonts: {
        body: "'Noto Nastaliq Urdu', 'DM Sans', serif",
        heading: "'Noto Nastaliq Urdu', 'Playfair Display', serif",
      },
      // Nastaliq hangs far below the baseline; anything under ~2.0
      // clips descenders on the ~18px+ sizes the app uses.
      lineHeight: 2.1,
    },
  },
};
