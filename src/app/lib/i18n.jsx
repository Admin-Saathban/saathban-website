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
      {/* ── FULL BLEED IS AN OPT-OUT, NOT AN OVERRIDE ──

          The first version of this zeroed `main`'s padding app-wide
          with !important, and restored 16px only to a hand-picked
          list of element types at exactly two depths. Everything the
          list missed — buttons, inputs, lists, a span of bare text
          one level deeper — ended up flush against the glass on every
          screen in the app. Lane 4 found it. It was a rule written to
          beat forty screens rather than to agree with them, and a
          rule that has to fight the code it governs is the wrong
          rule.

          Inverted. The screens keep their own 16px, which is correct
          for text and controls and already written in forty places.
          What bleeds is a CARD BACKGROUND, and it says so: .sb-bleed
          pulls a surface back out to the screen edges by exactly the
          page inset it sits in.

          Below the tablet breakpoint only. Above it the maxWidth
          wrappers centre the column, and a card reaching for the
          window edge from inside a centred column would simply be
          wrong. */}
      {/* ── CHROME IS NOT TEXT ──

          Long-pressing a button on a phone opens the selection
          ribbon and puts blue over the label, which on a control
          looks like something went wrong. Older thumbs rest on a
          target longer before committing, so this audience triggers
          it far more often than the people who wrote the defaults.

          Chrome only. A post body, a message, a code, a name and
          anything inside an input STAY selectable, because copying
          them is a real thing to want — a person reading out an
          invite code needs to be able to hold it. */}
      <style>{`
        .sb-appshell nav, .sb-appshell header,
        .sb-appshell button, .sb-appshell label,
        .sb-appshell [role="tab"], .sb-appshell [role="button"] {
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
        .sb-appshell input, .sb-appshell textarea,
        .sb-appshell [contenteditable="true"],
        .sb-appshell .sb-selectable, .sb-appshell .sb-selectable * {
          -webkit-user-select: text;
          user-select: text;
          -webkit-touch-callout: default;
        }
      `}</style>
      <style>{`
        @media (max-width: 767px) {
          .sb-appshell .sb-bleed {
            margin-left: -16px;
            margin-right: -16px;
          }
        }
      `}</style>
      {/* ── THE SAFE AREAS, NAMED ──

          env() cannot be read back or overridden, which makes anything
          built on it impossible to inspect and impossible to test off a
          device. Behind a custom property it is both: the values still
          come from env(), and a check can set --sb-safe-top to 47px and
          watch the whole shell respond exactly as it would on a phone
          with a notch.

          The bars own their inset — the header the top, the bar the
          bottom — so the jet runs to the physical edge of the glass
          while the labels and icons inside them sit below the notch and
          above the home indicator. */}
      <style>{`
        :root {
          --sb-safe-top: env(safe-area-inset-top, 0px);
          --sb-safe-bottom: env(safe-area-inset-bottom, 0px);
        }
        /* THE UNDERLAY IS THE GROUND, AT EVERY LAYER.

           With viewport-fit=cover and a translucent status bar the whole
           screen belongs to the page, including the strips behind the
           notch and the home indicator. Anything that does not paint
           them shows whatever is underneath, and underneath a web view
           is black.

           So the colour is set on html, on body and on the shell root
           rather than once and hopefully inherited. The point is not
           redundancy for its own sake: it means that at any moment when
           a bar has travelled and the content beneath has not yet
           painted — a settle, a route change, a scroll on a slow frame —
           what shows is PAGE rather than void. A transient sage gap
           reads as the app; a transient black one reads as broken.

           The scroll container therefore owns the full viewport, and the
           safe-area insets are padding INSIDE it (on the bars, which are
           part of the page) rather than margin outside it. */
        html, body { background: ${APP_COLORS.bg}; }
        .sb-appshell { background: ${APP_COLORS.bg}; min-height: 100vh; }
      `}</style>
      <style>{`html, body { margin: 0; background: ${APP_COLORS.bg};` +
        ` color: ${APP_COLORS.textMain}; font-family: ${meta.fonts.body}; }`}</style>
      <div
        className="sb-appshell"
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
