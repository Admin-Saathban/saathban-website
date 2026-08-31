/* ════════════════════════════════════════════════
   i18n — language, direction, and text size for everything
   under /app (SPEC.md, Language & accessibility).

   <LanguageProvider> wraps the /app route table once (AppRoot.jsx)
   and renders a wrapper div carrying dir="rtl|ltr", lang, the body
   font for the active language, and the --sb-text-scale CSS
   variable. Because dir lives on the wrapper — not on <html> — the
   marketing site at / is never affected.

   Components use:

     const { t, meta, ts, lang } = useI18n();

     t("settings.title")        looked-up string, English fallback
     meta.dir / .fonts / .lineHeight   language rendering facts
     ts(20)                     a font-size that obeys the in-app
                                text size control: ts(20) ≈ 20px at
                                Standard, 30px at Largest

   Layout rules that make RTL free:
   - use textAlign: "start"/"end", never "left"/"right"
   - use marginInlineStart/End, paddingInlineStart/End for
     asymmetric spacing — flexbox flips on its own under dir=rtl

   Choices persist in localStorage so they survive reload and are
   already right on the login screen. When per-account settings land
   (build step 9's Settings screen), Supabase becomes the source of
   truth and localStorage stays as the pre-login cache.
   ════════════════════════════════════════════════ */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { A11Y, APP_COLORS } from "../../shared/tokens.js";
import { DEFAULT_LANG, LOCALES, NASTALIQ_FONT_URL } from "../locales/index.js";

// The in-app text size control (independent of the phone's setting).
// `labelKey` points into the locale files; `scale` multiplies every
// ts() font-size. A11Y.minBodyPx is the floor at scale 1 — every step
// only goes up from there.
export const TEXT_SIZES = [
  { id: "standard", scale: 1, labelKey: "settings.textSize.sizes.standard" },
  { id: "large", scale: 1.15, labelKey: "settings.textSize.sizes.large" },
  { id: "larger", scale: 1.3, labelKey: "settings.textSize.sizes.larger" },
  { id: "largest", scale: 1.5, labelKey: "settings.textSize.sizes.largest" },
];
const DEFAULT_SIZE = "standard";

const LANG_KEY = "saathban.app.lang";
const SIZE_KEY = "saathban.app.textSize";

// localStorage can throw (private browsing, storage disabled) — the
// app must still work, just without remembering the choice.
function readStored(key, allowed, fallback) {
  try {
    const v = window.localStorage.getItem(key);
    return allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* fine — the choice just won't survive a reload */
  }
}

const I18nContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() =>
    readStored(LANG_KEY, Object.keys(LOCALES), DEFAULT_LANG)
  );
  const [textSize, setTextSize] = useState(() =>
    readStored(SIZE_KEY, TEXT_SIZES.map((s) => s.id), DEFAULT_SIZE)
  );

  useEffect(() => writeStored(LANG_KEY, lang), [lang]);
  useEffect(() => writeStored(SIZE_KEY, textSize), [textSize]);

  const meta = LOCALES[lang].meta;
  const scale = TEXT_SIZES.find((s) => s.id === textSize)?.scale ?? 1;

  // t("a.b.c", {name: "…"}) — active language first, English when the
  // key is missing or still untranslated-missing, the key itself as a
  // last resort so a typo is visible on screen, never a blank.
  const t = useCallback(
    (path, vars) => {
      const dig = (obj) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
      let s = dig(LOCALES[lang].strings);
      if (typeof s !== "string") s = dig(LOCALES[DEFAULT_LANG].strings);
      if (typeof s !== "string") return path;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
      return s;
    },
    [lang]
  );

  // ts(18) → a CSS length that follows the text size control. Use it
  // for every fontSize under /app instead of a raw px number.
  const ts = useCallback((px) => `calc(${px}px * var(--sb-text-scale, 1))`, []);

  const value = useMemo(
    () => ({ lang, setLang, textSize, setTextSize, meta, scale, t, ts }),
    [lang, textSize, meta, scale, t, ts]
  );

  return (
    <I18nContext.Provider value={value}>
      {/* Nastaliq is requested unconditionally so switching to Urdu
          doesn't flash fallback glyphs while the font downloads. */}
      <style>{`@import url('${NASTALIQ_FONT_URL}');`}</style>
      {/* THE GROUND AND THE FACE GO ON THE DOCUMENT, not only on the
          wrapper below. The wrapper styles its own subtree, so
          anything outside it — the ground behind a short screen, a
          fixed layer, the moment before React paints — fell back to
          the browser default, which is Times on a white page.

          Measured on the deployed build: document.body reported
          "Times New Roman" while every visible word was already sans,
          because the face was never on the element the browser falls
          back to. Nobody would have seen it in a screenshot; it shows
          up as a flash on a slow phone and as serif behind a short
          page. */}
      <style>{`html, body { margin: 0; background: ${APP_COLORS.bg};` +
        ` color: ${APP_COLORS.textMain}; font-family: ${meta.fonts.body}; }`}</style>
      <div
        dir={meta.dir}
        lang={lang}
        style={{
          "--sb-text-scale": scale,
          fontFamily: meta.fonts.body,
          lineHeight: meta.lineHeight,
          fontSize: ts(A11Y.minBodyPx),
        }}
      >
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider> (see AppRoot.jsx)");
  return ctx;
}
