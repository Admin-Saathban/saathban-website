/* Games-lane UI primitives — local to routes/games/ per house
   convention. Floors enforced once: ≥48px controls, ≥18px text via
   ts(), visible focus, state never colour alone. */

import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

export function GamesScreen({ children, backTo, backLabel, width = 640 }) {
  const { ts, meta } = useI18n();
  return (
    <main
      className="sb-games"
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        padding: "20px 16px 64px",
      }}
    >
      <style>{`
        .sb-games *, .sb-games *::before, .sb-games *::after { box-sizing: border-box; }
        .sb-games input, .sb-games textarea, .sb-games select {
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
        .sb-games input:focus-visible,
        .sb-games select:focus-visible,
        .sb-games button:focus-visible,
        .sb-games a:focus-visible {
          outline: 3px solid ${C.greenMuted};
          outline-offset: 2px;
        }
        .sb-games ::placeholder { color: ${C.textMuted}; opacity: 0.8; }
        @keyframes sb-games-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
      `}</style>
      <div style={{ maxWidth: width, margin: "0 auto" }}>
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
        padding: 20,
        marginBottom: 16,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function BodyText({ children, muted, style, ...props }) {
  const { ts } = useI18n();
  return (
    <p
      {...props}
      style={{
        fontSize: ts(A11Y.minBodyPx),
        lineHeight: 1.55,
        color: muted ? C.textMuted : C.textMain,
        margin: "0 0 12px",
        overflowWrap: "anywhere",
        ...style,
      }}
    >
      {children}
    </p>
  );
}

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
        margin: "24px 0 10px",
      }}
    >
      {children}
    </p>
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
        minHeight: A11Y.minTapTargetPx + 8,
        padding: "0 26px",
        borderRadius: 50,
        border: "none",
        background: C.green,
        color: C.cream,
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        opacity: props.disabled ? 0.6 : 1,
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
        padding: "0 18px",
        borderRadius: 50,
        border: `2px solid ${C.warmGray}`,
        background: C.white,
        color: C.textMain,
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        opacity: props.disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Toast({ text }) {
  const { ts } = useI18n();
  if (!text) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        insetInlineStart: "50%",
        transform: "translateX(-50%)",
        bottom: 24,
        zIndex: 50,
        maxWidth: "min(92vw, 560px)",
        background: C.brown,
        color: C.cream,
        fontSize: ts(A11Y.minBodyPx),
        lineHeight: 1.5,
        padding: "14px 22px",
        borderRadius: 16,
        boxShadow: "0 6px 24px rgba(45, 36, 24, 0.35)",
      }}
    >
      {text}
    </div>
  );
}
