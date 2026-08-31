/* ════════════════════════════════════════════════
   My Circle — UI primitives, local to routes/circle/ so the lane owns
   its own look and never edits another lane's files. Accessibility
   floors live here once: ≥48px controls, ≥18px text via ts(), visible
   focus, and state shown in words (never colour alone) — every toggle
   is a role="switch" that says On / Off.
   ════════════════════════════════════════════════ */

import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

/* Extra props (className, ref, data-*) pass through: the feedback
   layer marks a freshly created or deep-linked card by class + ref,
   and a component that swallows them silently does nothing. */
/* IN LINE WITH THE COMMUNITY CARD, and for the same two reasons.

   §4.1: an outline means you can tap it. A member card answers no
   press — the controls INSIDE it do — so the 1px box around it was
   promising something it does not deliver, on the screen where the
   things being described are people.

   And a rounded card floating on the ground was the last place in the
   app still doing that, which made My Circle look like a screen from an
   older version of the product sitting next to Home and Community. The
   surface tones now do the separating: content on ground, with a gap
   between rather than a line around. */
export function Card({ children, style, className, ...rest }) {
  return (
    <section
      {...rest}
      className={["sb-bleed", className].filter(Boolean).join(" ")}
      style={{
        background: C.surface,
        padding: "16px",
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </section>
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
        margin: "24px 0 12px",
      }}
    >
      {children}
    </p>
  );
}

export function BodyText({ children, muted, style }) {
  const { ts } = useI18n();
  return (
    <p style={{ fontSize: ts(A11Y.minBodyPx), color: muted ? C.textMuted : C.textMain, margin: "0 0 10px", lineHeight: 1.55, ...style }}>
      {children}
    </p>
  );
}

export function Pill({ children, tone = "neutral", style }) {
  const { ts } = useI18n();
  const tones = {
    /* A neutral pill was C.cream on a white card — a chip you could
       not see. Chips are labels, so they take the ground. */
    neutral: { bg: C.ground, fg: C.textMuted, border: C.warmGray },
    brown: { bg: C.tint, fg: C.brown, border: C.navEdge },
    green: { bg: C.selected, fg: C.green, border: C.green },
  };
  const t = tones[tone] ?? tones.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        // Pills carry status (SOS contact) — floor at 18 (QUALITY_REPORT §3).
        fontSize: ts(18),
        fontWeight: 600,
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 50,
        padding: "5px 13px",
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
        padding: "0 26px",
        borderRadius: 50,
        border: "none",
        background: C.green,
        color: C.cream,
        fontSize: ts(19),
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

/* A labelled on/off switch. State is announced (On/Off text + a knob
   position + aria-checked), never colour alone. */
export function Toggle({ checked, onChange, label, hint, busy }) {
  const { t, ts } = useI18n();
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 0" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 600, margin: 0, color: C.textMain }}>{label}</p>
        {hint && (
          <p style={{ fontSize: ts(16), color: C.textMuted, margin: "3px 0 0", lineHeight: 1.5 }}>{hint}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={busy}
        onClick={onChange}
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          minHeight: A11Y.minTapTargetPx,
          padding: "0 8px 0 14px",
          borderRadius: 50,
          border: `2px solid ${checked ? C.green : C.warmGray}`,
          background: checked ? C.selected : C.white,
          color: checked ? C.green : C.textMuted,
          // On/Off announces the state of a role="switch" — floor at 18
          // (QUALITY_REPORT §3, interactive text).
          fontSize: ts(18),
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: busy ? "default" : "pointer",
        }}
      >
        <span>{checked ? t("circle.toggle.on") : t("circle.toggle.off")}</span>
        <span
          aria-hidden="true"
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: checked ? C.green : C.warmGray,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.cream,
            fontSize: 16,
            fontWeight: 800,
          }}
        >
          {checked ? "✓" : ""}
        </span>
      </button>
    </div>
  );
}

/* Two-option segmented control (used for location: Never / Only in SOS).
   Selection carries a ✓ and a heavier border, not colour alone. */
export function Segmented({ label, hint, value, options, onChange }) {
  const { ts } = useI18n();
  return (
    <div style={{ padding: "12px 0" }}>
      <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 600, margin: 0, color: C.textMain }}>{label}</p>
      {hint && (
        <p style={{ fontSize: ts(16), color: C.textMuted, margin: "3px 0 10px", lineHeight: 1.5 }}>{hint}</p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: hint ? 0 : 10 }}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              style={{
                minHeight: A11Y.minTapTargetPx,
                padding: "0 18px",
                borderRadius: 14,
                border: `${active ? 3 : 1.5}px solid ${active ? C.green : C.warmGray}`,
                background: active ? C.white : "transparent",
                color: C.textMain,
                // Option labels on a role="radio" — floor at 18
                // (QUALITY_REPORT §3, interactive text).
                fontSize: ts(18),
                fontWeight: active ? 700 : 500,
                fontFamily: "inherit",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span aria-hidden="true" style={{ color: C.green, visibility: active ? "visible" : "hidden" }}>✓</span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
