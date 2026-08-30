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

import { useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { LOCALES } from "../locales/index.js";
import { TEXT_SIZES, useI18n } from "../lib/i18n.jsx";
import { useSession } from "../lib/session.jsx";
import AppHeader from "../components/AppHeader.jsx";
import LogSetupPanel from "./home/LogSetupPanel.jsx";
import WhoCanMessage from "./WhoCanMessage.jsx";
import TaggingSetting from "./TaggingSetting.jsx";
import AccountSettings from "./AccountSettings.jsx";

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

/* Text input sized to the accessibility floors, following ts(). */
function TextInput({ value, onChange, placeholder, label, ts, style }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label || placeholder}
      style={{
        minHeight: A11Y.minTapTargetPx,
        boxSizing: "border-box",
        padding: "0 14px",
        borderRadius: 12,
        border: `1.5px solid ${C.warmGray}`,
        background: C.white,
        color: C.textMain,
        fontFamily: "inherit",
        fontSize: ts(A11Y.minBodyPx),
        width: "100%",
        ...style,
      }}
    />
  );
}

/* A removable row in one of the user-defined lists. */
function ListRow({ children, onRemove, removeLabel, ts }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 12,
        border: `1.5px solid ${C.warmGray}`,
        background: C.white,
      }}
    >
      <span style={{ flex: 1, fontSize: ts(A11Y.minBodyPx), lineHeight: 1.5 }}>{children}</span>
      <button
        type="button"
        onClick={onRemove}
        style={{
          minHeight: A11Y.minTapTargetPx,
          minWidth: A11Y.minTapTargetPx,
          padding: "0 14px",
          borderRadius: 10,
          border: `1.5px solid ${C.warmGray}`,
          background: "transparent",
          color: C.brown,
          fontFamily: "inherit",
          fontSize: ts(16),
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {removeLabel}
      </button>
    </div>
  );
}

function AddBtn({ onClick, disabled, children, ts }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: A11Y.minTapTargetPx,
        padding: "0 24px",
        borderRadius: 50,
        border: "none",
        background: C.green,
        color: C.cream,
        fontFamily: "inherit",
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function SubHeading({ children, ts }) {
  return (
    <h3 style={{ fontSize: ts(19), fontWeight: 700, color: C.brown, margin: "26px 0 6px" }}>
      {children}
    </h3>
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
  const { profile } = useSession();

  return (
    <>
    <AppHeader />
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        padding: "24px 16px 64px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Back affordance comes from AppHeader now (its own back link
            was removed to avoid two identical links). */}
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

        {/* ── My Circle (Icons only) — the circle's permanent home is
            Settings; it enters main navigation only once it has a
            member (SPEC.md §My Circle). */}
        {profile?.role === "saath_icon" && (
          <Section
            title={t("settings.circle.title")}
            hint={t("settings.circle.hint")}
            ts={ts}
          >
            <Link
              to="/app/circle"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: A11Y.minTapTargetPx,
                padding: "0 24px",
                borderRadius: 50,
                border: `2px solid ${C.green}`,
                color: C.green,
                background: C.white,
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              🏡 {t("settings.circle.cta")}
            </Link>
          </Section>
        )}

        {/* ── §7: the half that was missing entirely — the email
               you sign in with, a password (or a first one), who can
               see your profile and your check-ins, notifications, and
               a way out. ── */}
        <Section title={t("settings.accountTitle")} hint={t("settings.accountHint")} ts={ts}>
          <AccountSettings />
        </Section>

        {/* ── Who may send a first message (§6.5). Above Language
            because it is about other people reaching you, which is
            the kind of thing somebody comes to Settings to change. */}
        <WhoCanMessage />

        {/* POSTS_SPEC §5 — the third of the tagged person's three
            protections, and the only one that acts before the fact. */}
        <TaggingSetting />

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

        {/* ── Daily log: modules, medicines, meals, custom trackers.
            The daily log is the Icon home's centrepiece — showing its
            settings to Fam/Buddy/admin would promise a page those
            roles don't have (PARITY.md). ── */}
        {profile?.role === "saath_icon" && <LogSetupPanel iconId={profile.id} isOwn />}

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
    </>
  );
}
