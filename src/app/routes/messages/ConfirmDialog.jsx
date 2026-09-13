/* ════════════════════════════════════════════════
   One question before a serious act — Messages rework.

   Used for Block (in the thread menu and on a request card) and for
   Report (in the thread menu). The body says in plain words what will
   happen and what will not, before it happens.

   WHICH BUTTON IS THE SAFE ONE DEPENDS ON THE ACT. For a block
   (`danger`) the filled, first button is Go back and the block is the
   quieter answer — the same rule DiscardDialog follows, because back is
   the gesture people make by accident. For a report the confirmation is
   the thing they came to do, so it is the filled one.
   ════════════════════════════════════════════════ */

import { useId } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { MotionStyles } from "../../lib/motion.jsx";
import useBackToClose from "../../components/useBackToClose.js";

export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const { ts, meta } = useI18n();
  const titleId = useId();
  /* Back resolves to the reversible answer. */
  useBackToClose(true, onCancel);

  const btn = {
    minHeight: Math.max(52, A11Y.minTapTargetPx),
    borderRadius: 50,
    fontFamily: "inherit",
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: 700,
    cursor: busy ? "default" : "pointer",
    padding: "8px 18px",
    opacity: busy ? 0.7 : 1,
  };
  const filled = { ...btn, border: "none", background: C.green, color: C.white };
  const quiet = { ...btn, border: `2px solid ${C.warmGray}`, background: "transparent", color: C.textMain };
  const dangerQuiet = { ...quiet, border: `2px solid ${C.brown}`, color: C.brown };

  const cancel = (
    <button key="cancel" type="button" onClick={onCancel} style={danger ? filled : quiet}>
      {cancelLabel}
    </button>
  );
  const confirm = (
    <button key="confirm" type="button" onClick={busy ? undefined : onConfirm} aria-busy={busy} style={danger ? dangerQuiet : filled}>
      {busy ? "…" : confirmLabel}
    </button>
  );

  return (
    <div
      onClick={onCancel}
      className="sb-dim"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <MotionStyles />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        dir={meta.dir}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          boxSizing: "border-box",
          background: C.surface,
          borderRadius: 20,
          padding: "20px 18px 18px",
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
      >
        <h2 id={titleId} style={{ margin: "0 0 8px", fontSize: ts(21), fontWeight: 800, color: C.textMain }}>
          {title}
        </h2>
        <p style={{ margin: "0 0 18px", fontSize: ts(A11Y.minBodyPx), lineHeight: 1.55, color: C.textMain }}>
          {body}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {danger ? [cancel, confirm] : [confirm, cancel]}
        </div>
      </div>
    </div>
  );
}
