/* ════════════════════════════════════════════════
   "Saathban has updated — refresh."

   The end of the stale-build saga. The old service worker could not
   update itself at all — its cache name was a literal in a file with
   one commit, so a browser had no changed bytes to react to and the
   worker installed once, on the day it shipped, per device. A phone
   could therefore sit on a months-old bundle with nothing on screen
   admitting it, which is why "fixed on my side, broken on his" ran for
   days.

   Detection lives in lib/pwa.js. This is only the sentence.

   ─── WHY A BAR AND NOT A TOAST ───

   Toasts here dismiss themselves on a timer. A message whose whole
   purpose is "the thing in front of you is out of date" must not
   vanish while somebody is reading it — the person who most needs it
   is the one who put the phone down mid-sentence. So it stays until
   it is answered or dismissed.

   ─── WHY IT CAN BE DISMISSED ───

   An undismissable bar is a thing that opens and never closes, which
   is a defect we spent two days removing. Somebody mid-message should
   be able to finish. They have been told; insisting would be the
   patronising register the spec rules out. The check runs again when
   they next return to the app.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C, SURFACE, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { onAppUpdate } from "../lib/pwa.js";
import Icon from "./Icon.jsx";

export default function UpdateNotice() {
  const { t, ts, meta } = useI18n();
  const [showing, setShowing] = useState(false);

  useEffect(() => onAppUpdate(() => setShowing(true)), []);

  if (!showing) return null;

  return (
    <div
      /* polite, not assertive: it is news, not an alarm, and it must
         not interrupt whatever a screen reader is part way through. */
      role="status"
      aria-live="polite"
      dir={meta.dir}
      style={{
        position: "fixed",
        insetInlineStart: 12,
        insetInlineEnd: 12,
        /* Above the bottom bar, which publishes its own height — the
           shell reserves space for its chrome rather than every screen
           guessing at it. */
        bottom: "calc(var(--sb-bar-h, 92px) + 12px)",
        zIndex: 95,
        display: "flex",
        alignItems: "center",
        gap: 10,
        maxWidth: 560,
        margin: "0 auto",
        background: SURFACE.nav,
        color: SURFACE.navInk,
        borderRadius: 14,
        padding: "8px 8px 8px 14px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.22)",
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: ts(A11Y.minBodyPx), fontWeight: 600 }}>
        {t("update.ready")}
      </span>

      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          minHeight: A11Y.minTapTargetPx,
          padding: "0 16px",
          border: "none",
          borderRadius: 10,
          background: SURFACE.navActive,
          color: SURFACE.nav,
          fontFamily: "inherit",
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {t("update.refresh")}
      </button>

      <button
        type="button"
        onClick={() => setShowing(false)}
        aria-label={t("update.later")}
        style={{
          minWidth: A11Y.minTapTargetPx,
          minHeight: A11Y.minTapTargetPx,
          display: "grid",
          placeItems: "center",
          border: "none",
          borderRadius: 10,
          background: "transparent",
          color: SURFACE.navInk,
          cursor: "pointer",
        }}
      >
        <Icon name="close" size={20} style={{ color: SURFACE.navInk }} />
      </button>
    </div>
  );
}
