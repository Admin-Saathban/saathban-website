/* ════════════════════════════════════════════════
   "Discard?" — one dialog, three places.

   Backing out of anything with unsent words in it used to throw them
   away without asking. That is a small bug on a fast phone and a large
   one for somebody who typed slowly: a message composed over four
   minutes disappears because a thumb found the back arrow, and there is
   no undo anywhere.

   WHAT COUNTS AS "ANYTHING TYPED" INCLUDES A RECORDING. A voice note is
   the version of this that hurts most — it cannot be retyped from
   memory the way a sentence can, and the person who chose voice over
   the keyboard is usually the person for whom typing it again is the
   hard part. So `hasDraft` takes the recording as seriously as the
   text.

   TWO BUTTONS, AND KEEP WRITING IS THE SAFE ONE, so it is first and it
   is the filled one. Discard is the destructive answer and reads as
   the quieter of the two: the dialog exists to protect the words, and a
   dialog that makes throwing them away the obvious tap is worse than no
   dialog, because it adds a step and still loses the message.
   ════════════════════════════════════════════════ */

import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { MotionStyles } from "../../lib/motion.jsx";

export default function DiscardDialog({ onKeep, onDiscard }) {
  const { t, ts } = useI18n();
  return (
    <div
      onClick={onKeep}
      className="sb-dim"
      style={{
        position: "fixed",
        inset: 0,
        /* Above the composer and the comment sheet, both of which are
           the thing it is asking about. */
        zIndex: 120,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <MotionStyles />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={t("community.discard.title")}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: C.surface,
          borderRadius: 20,
          padding: "20px 18px 18px",
        }}
      >
        <h2 style={{ margin: "0 0 6px", fontSize: ts(21), fontWeight: 800, color: C.textMain }}>
          {t("community.discard.title")}
        </h2>
        <p style={{ margin: "0 0 18px", fontSize: ts(A11Y.minBodyPx), lineHeight: 1.5, color: C.textMuted }}>
          {t("community.discard.body")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={onKeep}
            style={{
              minHeight: Math.max(52, A11Y.minTapTargetPx),
              border: "none",
              borderRadius: 50,
              background: C.green,
              color: C.white,
              fontFamily: "inherit",
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("community.discard.keep")}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            style={{
              minHeight: Math.max(52, A11Y.minTapTargetPx),
              border: `1px solid ${C.warmGray}`,
              borderRadius: 50,
              background: "transparent",
              color: C.error,
              fontFamily: "inherit",
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("community.discard.discard")}
          </button>
        </div>
      </div>
    </div>
  );
}
