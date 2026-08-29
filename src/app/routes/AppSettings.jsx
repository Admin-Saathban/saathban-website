/* ════════════════════════════════════════════════
   /app/settings — demo settings page for the i18n foundation.

   Proves the three SPEC.md Language & accessibility requirements
   end to end:
     1. language toggle (English / اردو) via useI18n
     2. RTL flip — dir comes from the LanguageProvider wrapper, this
        file contains no left/right logic at all
     3. in-app text size control — every fontSize goes through ts()

   The real Settings screen (log modules, reminders, circle — SPEC.md
   §Settings) grows out of this file; the language and text size
   sections here are its permanent residents.
   ════════════════════════════════════════════════ */

import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { LOCALES } from "../locales/index.js";
import { TEXT_SIZES, useI18n } from "../lib/i18n.jsx";

/* A choice button: 48px floor, and the active state is border weight +
   a check mark, never colour alone (SPEC.md accessibility). */
function ChoiceBtn({ active, onClick, children, lang, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      lang={lang}
      style={{
        minHeight: A11Y.minTapTargetPx,
        minWidth: A11Y.minTapTargetPx,
        padding: "8px 20px",
        borderRadius: 14,
        border: active ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
        background: active ? C.white : "transparent",
        color: C.textMain,
        fontFamily: "inherit",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{ color: C.green, fontWeight: 700, visibility: active ? "visible" : "hidden" }}
      >
        ✓
      </span>
      {children}
    </button>
  );
}

function Section({ title, hint, ts, children }) {
  return (
    <section
      style={{
        background: C.white,
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        border: `1px solid ${C.warmGray}`,
      }}
    >
      <h2 style={{ fontSize: ts(22), fontWeight: 700, color: C.green, marginBottom: 6 }}>
        {title}
      </h2>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, marginBottom: 18 }}>{hint}</p>
      {children}
    </section>
  );
}

export default function AppSettings() {
  const { t, ts, lang, setLang, textSize, setTextSize, meta } = useI18n();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        padding: "24px 16px 64px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <Link
          to="/app"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: A11Y.minTapTargetPx,
            fontSize: ts(A11Y.minBodyPx),
            color: C.brown,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          {/* dir-aware arrow: ← in LTR, → in RTL, without any JS branching */}
          <span aria-hidden="true" style={{ marginInlineEnd: 8 }}>
            {meta.dir === "rtl" ? "→" : "←"}
          </span>
          {t("common.backToHome")}
        </Link>

        <h1
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(34),
            fontWeight: 700,
            color: C.green,
            margin: "12px 0 28px",
          }}
        >
          {t("settings.title")}
        </h1>

        {/* ── Language ── */}
        <Section title={t("settings.language.title")} hint={t("settings.language.hint")} ts={ts}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {Object.values(LOCALES).map(({ meta: m }) => (
              <ChoiceBtn
                key={m.code}
                active={lang === m.code}
                onClick={() => setLang(m.code)}
                lang={m.code}
                style={{
                  fontFamily: m.fonts.body,
                  fontSize: ts(A11Y.minBodyPx),
                  lineHeight: m.lineHeight,
                }}
              >
                {m.label}
              </ChoiceBtn>
            ))}
          </div>
        </Section>

        {/* ── Text size ── */}
        <Section title={t("settings.textSize.title")} hint={t("settings.textSize.hint")} ts={ts}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
            {TEXT_SIZES.map((s) => (
              <ChoiceBtn
                key={s.id}
                active={textSize === s.id}
                onClick={() => setTextSize(s.id)}
                style={{ fontSize: ts(A11Y.minBodyPx), flexDirection: "column", gap: 2 }}
              >
                {/* fixed px on purpose: each button previews its own step,
                    so it must not follow the currently applied scale */}
                <span aria-hidden="true" style={{ fontSize: A11Y.minBodyPx * s.scale, fontWeight: 700 }}>
                  Aa
                </span>
                <span>{t(s.labelKey)}</span>
              </ChoiceBtn>
            ))}
          </div>
        </Section>

        {/* ── Preview ── */}
        <Section title={t("settings.preview.title")} hint={t("settings.preview.hint")} ts={ts}>
          <div
            style={{
              background: C.cream,
              borderRadius: 16,
              padding: 20,
              borderInlineStart: `4px solid ${C.sage}`,
            }}
          >
            <h3
              style={{
                fontFamily: meta.fonts.heading,
                fontSize: ts(24),
                fontWeight: 700,
                color: C.brown,
                marginBottom: 8,
              }}
            >
              {t("settings.preview.heading")}
            </h3>
            <p style={{ fontSize: ts(A11Y.minBodyPx), marginBottom: 16 }}>
              {t("settings.preview.body")}
            </p>
            <button
              type="button"
              style={{
                minHeight: A11Y.minTapTargetPx,
                padding: "0 28px",
                borderRadius: 50,
                border: "none",
                background: C.green,
                color: C.cream,
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {t("settings.preview.button")}
            </button>
          </div>

          {/* Fixed Urdu sample, independent of the toggle and of translation
              progress — proves Noto Nastaliq Urdu renders even while the
              ur.js strings are still [UR] placeholders. */}
          <p style={{ fontSize: ts(15), color: C.textMuted, margin: "20px 0 4px" }}>
            {t("settings.preview.scriptSampleLabel")}
          </p>
          <p
            dir="rtl"
            lang="ur"
            style={{
              fontFamily: LOCALES.ur.meta.fonts.body,
              lineHeight: LOCALES.ur.meta.lineHeight,
              fontSize: ts(20),
              color: C.textMain,
            }}
          >
            خوش آمدید — ساتھ بن میں آپ کا استقبال ہے
          </p>
        </Section>
      </div>
    </main>
  );
}
