/* Shared field primitives for the vetting flow.

   Local to src/app/routes/vetting/ on purpose: this lane owns no other
   folder, so nothing here imports from components/ or lib/ (which other
   lanes are still shaping) — only the shared brand tokens. Every
   control: ≥18px text, ≥48px targets, errors as text with a mark,
   never colour alone. */

import { useRef } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

export const inputStyle = (hasError) => ({
  width: "100%",
  minHeight: A11Y.minTapTargetPx + 4,
  padding: "12px 16px",
  borderRadius: 14,
  border: `2px solid ${hasError ? C.brown : C.warmGray}`,
  background: C.white,
  fontSize: 18,
  lineHeight: 1.5,
  fontFamily: "inherit",
  color: C.textMain,
});

/* Error messages arrive as locale KEYS (vetting.errors.*) and are
   translated here; anything that isn't a key — e.g. a server message —
   passes through t() verbatim. */
export function FieldError({ id, children }) {
  const { t } = useI18n();
  if (!children) return null;
  return (
    <p
      id={id}
      style={{
        fontSize: 18,
        lineHeight: 1.45,
        color: C.brown,
        fontWeight: 700,
        margin: "8px 0 0",
      }}
    >
      <span aria-hidden="true">⚠ </span>
      {typeof children === "string" ? t(children) : children}
    </p>
  );
}

export function Field({ id, label, hint, error, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: 19,
          fontWeight: 700,
          color: C.textMain,
          marginBottom: hint ? 4 : 8,
        }}
      >
        {label}
      </label>
      {hint && (
        <p
          id={`${id}-hint`}
          style={{ fontSize: 18, color: C.textMuted, margin: "0 0 8px", lineHeight: 1.5 }}
        >
          {hint}
        </p>
      )}
      {children}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

export function TextField({ id, label, hint, error, ...props }) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={
          [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
          undefined
        }
        style={inputStyle(!!error)}
        {...props}
      />
    </Field>
  );
}

export function TextAreaField({ id, label, hint, error, counter, ...props }) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        aria-invalid={!!error}
        aria-describedby={
          [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
          undefined
        }
        style={{ ...inputStyle(!!error), resize: "vertical" }}
        {...props}
      />
      {counter && (
        <p style={{ fontSize: 18, color: C.textMuted, margin: "6px 0 0", textAlign: "right" }}>
          {counter}
        </p>
      )}
    </Field>
  );
}

export function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        minHeight: A11Y.minTapTargetPx,
        minWidth: A11Y.minTapTargetPx,
        padding: "10px 18px",
        borderRadius: 14,
        border: `2px solid ${selected ? C.green : C.warmGray}`,
        background: selected ? C.green : C.white,
        color: selected ? C.cream : C.textMain,
        fontSize: 18,
        fontWeight: selected ? 700 : 500,
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
      }}
    >
      {selected && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}

/* Large tappable checkbox row (declarations, consents). */
export function CheckRow({ id, checked, onChange, disabled, error, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <button
        type="button"
        id={id}
        role="checkbox"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: "100%",
          minHeight: 60,
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "14px 16px",
          borderRadius: 14,
          border: `2px solid ${error ? C.brown : checked ? C.green : C.warmGray}`,
          background: checked ? "#eef3ea" : C.white,
          fontFamily: "inherit",
          textAlign: "start",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            border: `2.5px solid ${checked ? C.green : C.textMuted}`,
            background: checked ? C.green : C.white,
            color: C.cream,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 19,
            fontWeight: 700,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {checked ? "✓" : ""}
        </span>
        <span style={{ fontSize: 18, lineHeight: 1.55, color: C.textMain }}>{children}</span>
      </button>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/* Yes / No pair for the criminal-record disclosure. */
export function YesNo({ id, value, onChange, error, yesLabel, noLabel }) {
  const opt = (val, label) => (
    <button
      type="button"
      role="radio"
      aria-checked={value === val}
      onClick={() => onChange(val)}
      style={{
        flex: 1,
        minHeight: 56,
        borderRadius: 14,
        border: `2px solid ${value === val ? C.green : C.warmGray}`,
        background: value === val ? C.green : C.white,
        color: value === val ? C.cream : C.textMain,
        fontSize: 18,
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      {value === val ? "✓ " : ""}
      {label}
    </button>
  );
  return (
    <div style={{ marginBottom: 8 }}>
      <div role="radiogroup" aria-labelledby={`${id}-label`} style={{ display: "flex", gap: 10 }}>
        {opt(true, yesLabel)}
        {opt(false, noLabel)}
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/* Photo picker. Hands the chosen File to the parent; the actual upload to
   the PRIVATE buddy-documents bucket happens at submit time
   (supabaseVetting.js). Never a public bucket (SPEC.md, sensitive data). */
export function UploadBox({ id, label, hint, error, fileName, onFile, capture }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  return (
    <div style={{ marginBottom: 22 }}>
      <span
        id={`${id}-label`}
        style={{ display: "block", fontSize: 19, fontWeight: 700, color: C.textMain, marginBottom: 4 }}
      >
        {label}
      </span>
      <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 8px", lineHeight: 1.5 }}>
        {hint}
      </p>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={capture}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => inputRef.current && inputRef.current.click()}
        style={{
          width: "100%",
          minHeight: 88,
          borderRadius: 16,
          border: `2px dashed ${error ? C.brown : fileName ? C.green : C.textMuted}`,
          background: fileName ? "#eef3ea" : C.white,
          fontFamily: "inherit",
          fontSize: 18,
          color: fileName ? C.green : C.textMain,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "14px 16px",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 26 }}>{fileName ? "✓" : "📷"}</span>
        <span style={{ wordBreak: "break-word" }}>
          {fileName
            ? t("vetting.fields.tapToReplace", { name: fileName })
            : t("vetting.fields.tapToAdd")}
        </span>
      </button>
      <p style={{ fontSize: 18, color: C.textMuted, margin: "8px 0 0", lineHeight: 1.5 }}>
        {t("vetting.fields.storedPrivately")}
      </p>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/* Section intro used at the top of each step. */
export function StepIntro({ children }) {
  return (
    <p style={{ fontSize: 18, lineHeight: 1.6, color: C.textMuted, margin: "0 0 24px" }}>
      {children}
    </p>
  );
}
