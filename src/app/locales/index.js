/* ════════════════════════════════════════════════
   Locale registry — everything the app needs to know about a
   language in one place: its strings, its direction, and the font
   stack that renders it.

   Adding a language later = one strings file + one entry in LOADERS
   and LOCALES. Components never branch on the language code — they
   read meta.dir / meta.fonts / meta.lineHeight from useI18n().

   ─── ONE LANGUAGE IS DOWNLOADED, NOT BOTH ───

   Both string files used to be imported here, so every person paid for
   English (175KB) and Urdu (158KB) before their first screen, and each
   of them reads one. The strings now load on demand: the stored
   language is asked for as soon as the entry script runs (main.jsx,
   preloadStoredLocale), and the other only when somebody switches.

   META STAYS SYNCHRONOUS. Direction, fonts and the language's own name
   are tiny and needed before any strings are — the language switch
   shows "اردو" in Nastaliq without having downloaded Urdu.

   `LOCALES[code].strings` still exists for the screens that read a
   language directly, and answers null until that language has loaded.
   useLocaleStrings (lib/i18n.jsx) is how such a screen asks for it.
   ════════════════════════════════════════════════ */

import { APP_FONT } from "../../shared/tokens.js";

export const DEFAULT_LANG = "en";

/* Read here as well as in LanguageProvider, because main.jsx has to
   know which language to start downloading before React exists. */
export const LANG_STORAGE_KEY = "saathban.app.lang";

// Loaded by LanguageProvider alongside the brand fonts. Nastaliq is a
// heavy face; display=swap keeps the placeholder text readable while
// it arrives.
export const NASTALIQ_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap";

/* Static specifiers, so the bundler gives each language its own chunk. */
const LOADERS = {
  en: () => import("./en.js"),
  ur: () => import("./ur.js"),
};

const loaded = {};
const inflight = {};

/* The strings of a language if they have arrived, else null. */
export function localeStrings(code) {
  return loaded[code] || null;
}

/* Starts (or joins) the download of one language. A failure is not
   remembered, so the next attempt — back online — tries again. */
export function loadLocale(code) {
  const c = LOADERS[code] ? code : DEFAULT_LANG;
  if (loaded[c]) return Promise.resolve(loaded[c]);
  if (!inflight[c]) {
    inflight[c] = LOADERS[c]()
      .then((m) => {
        loaded[c] = m.default;
        return loaded[c];
      })
      .catch((e) => {
        delete inflight[c];
        throw e;
      });
  }
  return inflight[c];
}

export function storedLang() {
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    return LOADERS[v] ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function preloadStoredLocale() {
  return loadLocale(storedLang()).catch(() => null);
}

export const LOCALES = {
  en: {
    get strings() {
      return loaded.en || null;
    },
    meta: {
      code: "en",
      dir: "ltr",
      // A language's own name is shown in that language — this is
      // convention, not a string for the translator, so it lives here.
      label: "English",
      /* §0.5 — one face. A heading is heavier and larger, not a
         different typeface. */
      fonts: { body: APP_FONT, heading: APP_FONT },
      lineHeight: 1.6,
    },
  },
  ur: {
    get strings() {
      return loaded.ur || null;
    },
    meta: {
      code: "ur",
      dir: "rtl",
      label: "اردو",
      // Nastaliq carries both body and headings — Playfair/DM Sans have
      // no Arabic-script glyphs. The Latin faces stay in the stack so
      // untranslated [UR] placeholders still render cleanly.
      fonts: {
        body: `'Noto Nastaliq Urdu', ${APP_FONT}`,
        heading: `'Noto Nastaliq Urdu', ${APP_FONT}`,
      },
      // Nastaliq hangs far below the baseline; anything under ~2.0
      // clips descenders on the ~18px+ sizes the app uses.
      lineHeight: 2.1,
    },
  },
};
