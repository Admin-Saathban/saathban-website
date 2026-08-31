/* ════════════════════════════════════════════════
   The dismissing info panel — PRODUCT_DECISIONS §11.

   Tapping something not yet available, or anything needing a short
   explanation, opens a small panel that leaves on its own. §11 sets
   its behaviour exactly and every line of it is here:

   - It stays 5–6 seconds. Long enough to read slowly, in Nastaliq,
     which takes longer than the same sentence in Latin.
   - Any tap or scroll dismisses it immediately.
   - Touching or hovering it PAUSES the countdown — the one gesture
     that means "I am still reading" must not be the one that takes
     the words away.
   - It has a cross, for anyone who wants certainty rather than
     waiting.
   - IT NEVER CARRIES AN ACTION. These explain; they do not do.

   That last rule is enforced by shape, not by discipline: there is no
   children slot and no action prop. A panel cannot grow a button here
   without someone deliberately changing this file, which is the point
   — "just this once" is how every explain-only surface in every app
   ends up with a Buy Now on it.

   IT IS NOT THE TOAST HOST. lib/feedback.jsx pushes toasts, and §11
   is largely about stopping toasts standing in for results. This is
   the opposite thing: never a confirmation that something happened,
   only a sentence about something that did not.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";

const LIFETIME_MS = 5600; // §11: "5–6 seconds"

export default function InfoPanel({ open, title, body, onClose }) {
  const { t, ts } = useI18n();
  const [paused, setPaused] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  /* The clock. Restarts whenever the panel opens or the reader lets
     go — a paused countdown that resumed where it left off would give
     someone who touched it at second five a panel that vanishes the
     instant they release. */
  useEffect(() => {
    if (!open || paused) return undefined;
    const id = window.setTimeout(() => closeRef.current?.(), LIFETIME_MS);
    return () => window.clearTimeout(id);
  }, [open, paused, body, title]);

  /* Any tap or scroll anywhere else takes it away. Captured at the
     document, because the thing the person tapped is usually the
     reason they have stopped reading. Registered a beat late so the
     very tap that OPENED the panel cannot also close it. */
  useEffect(() => {
    if (!open) return undefined;
    let armed = false;
    const arm = window.setTimeout(() => {
      armed = true;
    }, 120);
    const bye = () => {
      if (armed) closeRef.current?.();
    };
    document.addEventListener("pointerdown", bye, true);
    document.addEventListener("scroll", bye, true);
    window.addEventListener("scroll", bye, { passive: true });
    return () => {
      window.clearTimeout(arm);
      document.removeEventListener("pointerdown", bye, true);
      document.removeEventListener("scroll", bye, true);
      window.removeEventListener("scroll", bye);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setPaused(false);
  }, [open]);

  if (!open) return null;

  return (
    <div
      /* status, not alert: this is an explanation somebody asked for,
         not an interruption. An assertive live region would talk over
         whatever a screen-reader user was already listening to. */
      role="status"
      aria-live="polite"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        margin: "10px 0 0",
        padding: "14px 14px 14px 16px",
        background: C.white,
        border: `2px solid ${C.olive || C.warmGray}`,
        borderRadius: 16,
        boxShadow: "0 4px 14px rgba(74,58,34,0.10)",
      }}
    >
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        {title && (
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: ts(A11Y.minBodyPx) }}>
            {title}
          </p>
        )}
        <p style={{ margin: 0, fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.5 }}>
          {body}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
        aria-label={t("common.dismiss")}
        style={{
          flex: "0 0 auto",
          width: A11Y.minTapTargetPx,
          height: A11Y.minTapTargetPx,
          marginTop: -6,
          marginInlineEnd: -6,
          border: "none",
          background: "transparent",
          color: C.textMuted,
          fontSize: 22,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}
