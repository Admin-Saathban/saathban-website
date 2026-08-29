/* ════════════════════════════════════════════════
   Shared app UI primitives.

   Accessibility floors are enforced here, once, so no screen can
   drift under them: every control is ≥48px tall, every string ≥18px
   (scaled up by the in-app text size control via ts()), focus is
   always visible, and colour is never the only signal (errors always
   carry words + role="alert").
   ════════════════════════════════════════════════ */

import { useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { LOCALES } from "../locales/index.js";
import supabase from "../lib/supabase.js";

/* Page shell for the auth screens: warm background, logo, language
   toggle. Direction and the language's font stack come from the
   LanguageProvider wrapper; sizes here follow the text size control
   through ts() / the --sb-text-scale variable. */
export function AuthScreen({ children, width = 620 }) {
  const { lang, setLang, ts } = useI18n();
  const other = lang === "en" ? "ur" : "en";

  return (
    <main
      className="sb-auth"
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        padding: "20px 16px 56px",
      }}
    >
      <style>{`
        .sb-auth *, .sb-auth *::before, .sb-auth *::after { box-sizing: border-box; }
        .sb-auth input {
          width: 100%;
          min-height: ${A11Y.minTapTargetPx}px;
          font-size: calc(${A11Y.minBodyPx}px * var(--sb-text-scale, 1));
          font-family: inherit;
          color: ${C.textMain};
          background: ${C.white};
          border: 2px solid ${C.warmGray};
          border-radius: 12px;
          padding: 10px 14px;
        }
        .sb-auth input:focus-visible,
        .sb-auth button:focus-visible,
        .sb-auth a:focus-visible {
          outline: 3px solid ${C.greenMuted};
          outline-offset: 2px;
        }
        .sb-auth ::placeholder { color: ${C.textMuted}; opacity: 0.8; }
      `}</style>

      <div style={{ maxWidth: width, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <a href="/" style={{ display: "block", flexShrink: 0 }}>
            <img
              src="/logo-extended.png"
              alt="Saathban"
              style={{ height: 44, width: "auto", display: "block" }}
            />
          </a>

          {/* The label is the OTHER language's own name, rendered in that
              language's own script and font. */}
          <button
            type="button"
            lang={other}
            dir={LOCALES[other].meta.dir}
            onClick={() => setLang(other)}
            style={{
              minHeight: A11Y.minTapTargetPx,
              padding: "0 22px",
              borderRadius: 50,
              border: `2px solid ${C.warmGray}`,
              background: C.white,
              color: C.textMain,
              fontSize: ts(A11Y.minBodyPx),
              fontFamily: LOCALES[other].meta.fonts.body,
              cursor: "pointer",
            }}
          >
            {LOCALES[other].meta.label}
          </button>
        </header>

        {children}
      </div>
    </main>
  );
}

export function Title({ children }) {
  const { meta } = useI18n();
  return (
    <h1
      style={{
        fontFamily: meta.fonts.heading,
        fontSize: "calc(clamp(1.7rem, 4vw, 2.3rem) * var(--sb-text-scale, 1))",
        fontWeight: 700,
        color: C.green,
        lineHeight: Math.max(1.25, meta.lineHeight - 0.4),
        margin: "0 0 12px",
      }}
    >
      {children}
    </h1>
  );
}

export function Intro({ children }) {
  const { ts } = useI18n();
  return (
    <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 28px" }}>
      {children}
    </p>
  );
}

/* Label + control + optional hint, wired together for screen readers. */
export function Field({ id, label, hint, optionalTag, children }) {
  const { ts } = useI18n();
  return (
    <div style={{ marginBottom: 22 }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {label}
        {optionalTag && (
          <span style={{ fontWeight: 400, color: C.textMuted }}> — {optionalTag}</span>
        )}
      </label>
      {children}
      {hint && (
        <p
          id={`${id}-hint`}
          style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "6px 0 0" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

export function Button({ children, busy, style, ...props }) {
  const { ts } = useI18n();
  return (
    <button
      type="submit"
      disabled={busy || props.disabled}
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: 56,
        padding: "0 28px",
        borderRadius: 50,
        border: "none",
        background: C.green,
        color: C.cream,
        fontSize: ts(19),
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.7 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* Understated button that reads as a link but keeps the tap-target floor. */
export function LinkButton({ children, style, ...props }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: A11Y.minTapTargetPx,
        padding: "0 12px",
        border: "none",
        background: "none",
        color: C.brown,
        fontSize: ts(A11Y.minBodyPx),
        fontFamily: "inherit",
        textDecoration: "underline",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function ErrorText({ children }) {
  const { ts } = useI18n();
  if (!children) return null;
  return (
    <p
      role="alert"
      style={{
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        color: C.error,
        margin: "0 0 18px",
      }}
    >
      {children}
    </p>
  );
}

/* SPEC.md, Signup flow: "Every onboarding screen carries a visible
   'this isn't me' exit." Signs out (harmless when signed out) and
   returns to the role choice. */
export function NotMeExit() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const exit = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* no session to clear — fine */
    }
    navigate("/app/auth");
  };
  return (
    <div style={{ textAlign: "center", marginTop: 28 }}>
      <LinkButton onClick={exit} style={{ color: C.textMuted }}>
        {t("auth.common.notMe")}
      </LinkButton>
    </div>
  );
}
