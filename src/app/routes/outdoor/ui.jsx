/* Outdoor-lane UI primitives — deliberately local to routes/outdoor/
   (each lane carries its own, per house convention). Floors enforced
   once: ≥48px controls, ≥18px text via ts(), visible focus, state
   never colour alone. */

import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

/* One number, so the card's cancel and the column's inset cannot
   drift apart. */
export const GUTTER = 16;

export function OutdoorScreen({ children, backTo, backLabel, width = 640 }) {
  const { ts, meta } = useI18n();
  return (
    <main
      className="sb-outdoor"
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        padding: "20px 16px 64px",
      }}
    >
      <style>{`
        .sb-outdoor *, .sb-outdoor *::before, .sb-outdoor *::after { box-sizing: border-box; }
        .sb-outdoor input, .sb-outdoor textarea, .sb-outdoor select {
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
        .sb-outdoor textarea { resize: vertical; }
        .sb-outdoor input:focus-visible,
        .sb-outdoor textarea:focus-visible,
        .sb-outdoor select:focus-visible,
        .sb-outdoor button:focus-visible,
        .sb-outdoor a:focus-visible {
          outline: 3px solid ${C.greenMuted};
          outline-offset: 2px;
        }
        .sb-outdoor ::placeholder { color: ${C.textMuted}; opacity: 0.8; }
      `}</style>
      <div style={{ maxWidth: width, margin: "0 auto", paddingInline: GUTTER }}>
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

/* Extra props (className, ref, data-*) pass through so the feedback
   layer can mark a freshly created card; a component that swallows
   them makes the highlight silently do nothing. */
export function Card({ children, style, ...rest }) {
  return (
    <section {...rest}
      style={{
        background: C.white,
        border: `1px solid ${C.warmGray}`,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        /* Deliberately does NOT cancel the column gutter.

           I tried that first, to keep the shell's edge-to-edge look,
           and the screens then had two gutters at once: Card ran to
           the glass while the place rows — which are Links with their
           own styling, not Cards — stayed inset. Adjacent screens in
           one section disagreeing about their margin looks like a
           bug, because it is one. One gutter for everything in
           outdoor. */
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
        ...style,
      }}
    >
      {children}
    </button>
  );
}
/* OUT_AND_ABOUT_SPEC section 10, FEEDBACK.md: the lane-local Toast that
   used to live here is gone. Every outcome in this area now goes
   through the shared feedback store, and a second toast
   implementation is how two toasts end up on screen at once. */
