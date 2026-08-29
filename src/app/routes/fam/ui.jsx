/* ════════════════════════════════════════════════
   Fam-lane UI primitives — deliberately local to routes/fam/ so this
   lane never edits (or breaks with) other lanes' files. If these
   converge with components/ui.jsx later, merging them is a follow-up,
   not a dependency.

   Accessibility floors enforced here once: ≥48px controls, ≥18px text
   through ts(), visible focus, state never shown by colour alone.
   ════════════════════════════════════════════════ */

import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

/* Page shell: warm background, logo home-link, optional back link.
   Direction and font come from the LanguageProvider wrapper. */
export function FamScreen({ children, backTo, backLabel, width = 680 }) {
  const { ts, meta } = useI18n();
  return (
    <main
      className="sb-fam"
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        padding: "20px 16px 64px",
      }}
    >
      <style>{`
        .sb-fam *, .sb-fam *::before, .sb-fam *::after { box-sizing: border-box; }
        .sb-fam input, .sb-fam select {
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
        .sb-fam input:focus-visible,
        .sb-fam select:focus-visible,
        .sb-fam button:focus-visible,
        .sb-fam a:focus-visible {
          outline: 3px solid ${C.greenMuted};
          outline-offset: 2px;
        }
        .sb-fam ::placeholder { color: ${C.textMuted}; opacity: 0.8; }
      `}</style>

      <div style={{ maxWidth: width, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <a href="/app" style={{ display: "inline-block" }}>
            <img
              src="/logo-extended.png"
              alt="Saathban"
              style={{ height: 40, width: "auto", display: "block" }}
            />
          </a>
        </header>

        {backTo && (
          <Link
            to={backTo}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: A11Y.minTapTargetPx,
              fontSize: ts(A11Y.minBodyPx),
              color: C.brown,
              textDecoration: "none",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            <span aria-hidden="true" style={{ marginInlineEnd: 8 }}>
              {meta.dir === "rtl" ? "→" : "←"}
            </span>
            {backLabel}
          </Link>
        )}

        {children}
      </div>
    </main>
  );
}

export function Card({ children, style }) {
  return (
    <section
      style={{
        background: C.white,
        border: `1px solid ${C.warmGray}`,
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

/* Small uppercase section label above a group of cards. */
export function SectionLabel({ children }) {
  const { ts } = useI18n();
  return (
    <p
      style={{
        fontSize: ts(15),
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: C.olive,
        margin: "28px 0 12px",
      }}
    >
      {children}
    </p>
  );
}

/* Word-carrying badge — never colour alone. */
export function Pill({ children, tone = "neutral", style }) {
  const { ts } = useI18n();
  const tones = {
    neutral: { bg: C.cream, fg: C.textMuted, border: C.warmGray },
    green: { bg: "#e8f0e6", fg: C.green, border: C.sage },
    brown: { bg: "#f3e9df", fg: C.brown, border: "#d9c3b2" },
  };
  const t = tones[tone] ?? tones.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: ts(15),
        fontWeight: 600,
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 50,
        padding: "6px 14px",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function PrimaryBtn({ children, style, ...props }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 56,
        padding: "0 28px",
        borderRadius: 50,
        border: "none",
        background: C.green,
        color: C.cream,
        fontSize: ts(19),
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GhostBtn({ children, style, ...props }) {
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
        padding: "0 20px",
        borderRadius: 50,
        border: `2px solid ${C.warmGray}`,
        background: C.white,
        color: C.textMain,
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function BodyText({ children, muted, style }) {
  const { ts } = useI18n();
  return (
    <p
      style={{
        fontSize: ts(A11Y.minBodyPx),
        color: muted ? C.textMuted : C.textMain,
        margin: "0 0 12px",
        ...style,
      }}
    >
      {children}
    </p>
  );
}
