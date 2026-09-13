/* ════════════════════════════════════════════════
   Streak UI primitives — built to the owner's streaks mock
   (artifact 6d530740…), mapped onto the app's tokens:

     mock --teal       → C.green     (#0E6B5C, the one accent)
     mock --teal-soft  → C.selected  (#DCEDE7)
     mock --comment    → C.comment   (#EBF0F4)
     mock --ground     → C.ground    (#EFF3EE)
     mock --card       → C.surface   (#FFFFFF)
     mock --hair       → C.warmGray  (the light hairline)
     mock --muted      → C.textMuted
     mock --amber      → MEANING.hands (#F5A623), with ink on it

   The mock's radii and spacing are kept (cards 16, sheets 20, options
   14, buttons 16). Its 12–15px type is not: this app's floor is 16px
   through ts(), and every control is at least 48px tall. Selection is
   always a tick or a word as well as a colour.
   ════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";
import { APP_COLORS as C, A11Y, MEANING } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import Icon from "../../components/Icon.jsx";
import useBackToClose from "../../components/useBackToClose.js";
import Avatar from "../messages/Avatar.jsx";

export const TAP = 48;
export const AMBER = MEANING.hands;

/* A bottom sheet: dimmed ground, a grab bar, closes on back and on a tap
   outside. Focus goes to the sheet so a screen reader starts at its top. */
export function Sheet({ open, onClose, label, children }) {
  const panel = useRef(null);
  useBackToClose(open, onClose);
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,17,19,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{
          width: "min(100%, 600px)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: C.surface,
          borderRadius: "20px 20px 0 0",
          padding: "16px 16px calc(22px + var(--sb-safe-bottom, 0px))",
          boxShadow: "0 -8px 28px rgba(0,0,0,.14)",
          outline: "none",
          boxSizing: "border-box",
        }}
      >
        <div aria-hidden="true" style={{ width: 38, height: 4, borderRadius: 2, background: C.warmGray, margin: "0 auto 12px" }} />
        {children}
      </div>
    </div>
  );
}

export function SheetTitle({ children }) {
  const { ts } = useI18n();
  return <h2 style={{ fontSize: ts(21), fontWeight: 800, color: C.textMain, margin: "0 0 4px", lineHeight: 1.3 }}>{children}</h2>;
}

export function Muted({ children, style }) {
  const { ts } = useI18n();
  return <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 14px", lineHeight: 1.5, ...style }}>{children}</p>;
}

export function Label({ children, style }) {
  const { ts } = useI18n();
  return (
    <p style={{ fontSize: ts(15), letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700, color: C.textMuted, margin: "18px 0 8px", ...style }}>
      {children}
    </p>
  );
}

export function Btn({ kind = "primary", children, style, disabled, ...props }) {
  const { ts } = useI18n();
  const look =
    kind === "secondary"
      ? { background: "transparent", color: C.green, border: `1.5px solid ${C.green}` }
      : kind === "quiet"
      ? { background: C.comment, color: C.green, border: "none" }
      : { background: C.green, color: C.white, border: "none" };
  return (
    <button
      type="button"
      disabled={disabled}
      {...props}
      style={{
        width: "100%",
        minHeight: 52,
        borderRadius: 16,
        padding: "12px 14px",
        fontSize: ts(17),
        fontWeight: 700,
        fontFamily: "inherit",
        marginTop: 8,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ...look,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Card({ children, style }) {
  return (
    <div style={{ background: C.surface, borderRadius: 16, padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,.06)", ...style }}>
      {children}
    </div>
  );
}

/* The soft square an item's drawn icon sits in. */
export function ItemIcon({ name, size = 40 }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 12, background: C.selected, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: C.green }}>
      <Icon name={name} size={Math.round(size * 0.55)} />
    </span>
  );
}

/* A tick: on, off, or locked (already reached today). Never colour alone
   — on and locked both carry the mark; off is an empty ring. */
export function Tick({ state }) {
  const on = state === "on";
  const lock = state === "lock";
  return (
    <span
      aria-hidden="true"
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `2px solid ${on ? C.green : lock ? C.comment : C.warmGray}`,
        background: on ? C.green : lock ? C.comment : C.surface,
        color: on ? C.white : C.textMuted,
      }}
    >
      {on || lock ? <Icon name={lock ? "locked" : "check"} size={16} /> : null}
    </span>
  );
}

/* One person with a tick. role=checkbox for choosing; a locked row is
   disabled and says why in words. "away" is someone this streak no longer
   goes to (they stepped away, 0170): disabled, unticked, and said in the
   sub line. */
export function PersonRow({ person, sub, state, onToggle }) {
  const { ts } = useI18n();
  const away = state === "away";
  const locked = state === "lock" || away;
  return (
    <button
      type="button"
      role="checkbox"
      data-person-state={state}
      aria-checked={state === "on" || state === "lock"}
      aria-disabled={locked ? "true" : undefined}
      onClick={locked ? undefined : onToggle}
      style={{
        width: "100%",
        minHeight: 64,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 4px",
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${C.warmGray}`,
        fontFamily: "inherit",
        textAlign: "start",
        cursor: locked ? "default" : "pointer",
        opacity: locked ? 0.62 : 1,
      }}
    >
      <Avatar person={person} size={42} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: ts(18), fontWeight: 700, color: C.textMain, overflowWrap: "anywhere" }}>{person.full_name}</span>
        {sub && <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>{sub}</span>}
      </span>
      <Tick state={state} />
    </button>
  );
}

/* − value + . The value is announced; each button says what it does. */
export function Stepper({ label, value, unitLine, onDown, onUp, downLabel, upLabel, downOff, upOff }) {
  const { ts } = useI18n();
  const btn = (off) => ({
    width: TAP,
    height: TAP,
    borderRadius: "50%",
    background: C.comment,
    border: "none",
    fontSize: ts(24),
    color: C.green,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: off ? "default" : "pointer",
    opacity: off ? 0.4 : 1,
    flexShrink: 0,
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
      {label && <span style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, minWidth: 96 }}>{label}</span>}
      <button type="button" onClick={onDown} disabled={downOff} aria-label={downLabel} style={btn(downOff)}>−</button>
      <span role="status" style={{ flex: 1, textAlign: "center" }}>
        <span style={{ display: "block", fontSize: ts(24), fontWeight: 800, color: C.textMain, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {unitLine && <span style={{ display: "block", fontSize: ts(14), letterSpacing: "0.04em", textTransform: "uppercase", color: C.textMuted, fontWeight: 600 }}>{unitLine}</span>}
      </span>
      <button type="button" onClick={onUp} disabled={upOff} aria-label={upLabel} style={btn(upOff)}>+</button>
    </div>
  );
}

/* A full screen outside the tab panes: the back row and a column. */
export function StreakScreen({ title, onBack, backLabel, children }) {
  const { ts, meta } = useI18n();
  return (
    <main style={{ minHeight: "100vh", background: C.ground, color: C.textMain, padding: "14px 16px 96px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            style={{ minWidth: TAP, minHeight: TAP, border: "none", background: "transparent", color: C.green, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
          >
            <Icon name={meta.dir === "rtl" ? "chevron" : "chevronBack"} size={26} />
          </button>
          <h1 style={{ fontSize: ts(20), fontWeight: 800, margin: 0, lineHeight: 1.3, overflowWrap: "anywhere" }}>{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}

/* The big centred block: a small line, the flame and the number, a line. */
export function Focus({ above, big, below, bigSize = 46 }) {
  const { ts } = useI18n();
  return (
    <div style={{ background: C.surface, borderRadius: 18, padding: "20px 16px", textAlign: "center" }}>
      {above && <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: 0 }}>{above}</p>}
      <p style={{ fontSize: ts(bigSize), fontWeight: 800, color: C.green, lineHeight: 1.1, margin: "6px 0 0", fontVariantNumeric: "tabular-nums" }}>{big}</p>
      {below && <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "8px 0 0" }}>{below}</p>}
    </div>
  );
}

/* A line that says what happened or why not — in words, with role. */
export function Note({ children, tone = "info" }) {
  const { ts } = useI18n();
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      style={{
        fontSize: ts(A11Y.minBodyPx),
        lineHeight: 1.5,
        margin: "10px 0 4px",
        padding: "10px 14px",
        borderRadius: 14,
        background: tone === "done" ? C.selected : C.comment,
        borderInlineStart: `4px solid ${tone === "error" ? C.error : C.green}`,
        color: C.textMain,
      }}
    >
      {children}
    </p>
  );
}
