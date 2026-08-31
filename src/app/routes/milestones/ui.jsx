/* Folder-local UI primitives for the milestones lane (per-lane
   convention — keeps this folder decoupled from folders other
   sessions are actively reshaping). Floors: ≥18px text, ≥48px
   targets, state never by colour alone. */

import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

export function Screen({ children, width = 680 }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        padding: "24px 16px 64px",
      }}
    >
      <div style={{ maxWidth: width, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

export function Card({ children, style }) {
  return (
    <div
      style={{
        background: C.white,
        border: `1.5px solid ${C.warmGray}`,
        borderRadius: 18,
        padding: "22px 20px",
        marginBottom: 16,
        ...style,
      }}
    >
      {children}
    </div>
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
        // greenMuted, not olive: olive is ~4.06:1 on cream, below AA
        // (QUALITY_REPORT §3 contrast).
        color: C.greenMuted,
        margin: "26px 0 12px",
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
        minHeight: 56,
        padding: "0 28px",
        borderRadius: 50,
        border: "none",
        background: C.green,
        color: C.cream,
        fontSize: ts(19),
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: props.disabled ? "wait" : "pointer",
        opacity: props.disabled ? 0.7 : 1,
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
        minHeight: A11Y.minTapTargetPx,
        padding: "0 22px",
        borderRadius: 50,
        border: `2px solid ${C.green}`,
        background: C.white,
        color: C.green,
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

export function BodyText({ children, muted, style, ...props }) {
  const { ts } = useI18n();
  return (
    <p
      {...props}
      style={{
        fontSize: ts(A11Y.minBodyPx),
        lineHeight: 1.6,
        color: muted ? C.textMuted : C.textMain,
        margin: "0 0 12px",
        ...style,
      }}
    >
      {children}
    </p>
  );
}

/* Takes ts so input text follows the in-app text-size control
   (QUALITY_REPORT §3: raw px never scales). */
export const inputStyle = (ts) => ({
  width: "100%",
  minHeight: A11Y.minTapTargetPx,
  padding: "10px 14px",
  borderRadius: 12,
  border: `1.5px solid ${C.warmGray}`,
  background: C.white,
  fontSize: ts(A11Y.minBodyPx),
  fontFamily: "inherit",
  color: C.textMain,
  marginTop: 6,
});
