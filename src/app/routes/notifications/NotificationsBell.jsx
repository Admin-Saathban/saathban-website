/* ════════════════════════════════════════════════
   Notifications bell + unread badge, for the app header.

   Self-contained so it can drop into components/AppHeader.jsx with a
   single import + element (that shared file belongs to the header
   lane — see NOTIFICATIONS_WIRING.md, not edited here). Refreshes on
   mount and on window focus, and on the custom "sb:notifications-read"
   event the notifications screen dispatches after marking read, so the
   badge clears without a reload.

   The badge is a count in a pill; it also carries an aria-label with
   the number, so the state is never conveyed by the dot alone.
   ════════════════════════════════════════════════ */

import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { STRINGS } from "./strings.js";
import { fetchUnreadCount, NOTIFICATIONS_READ_EVENT } from "./data.js";

export default function NotificationsBell() {
  const { lang, ts } = useI18n();
  const s = STRINGS[lang] || STRINGS.en;
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setCount(await fetchUnreadCount());
    } catch {
      /* leave the last known count; the badge is a hint, not a source of truth */
    }
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATIONS_READ_EVENT, refresh);
    // A notification that arrives while the tab sits open and focused
    // used to stay invisible until the next blur/refocus — poll gently.
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const label = count > 0 ? `${s.bellLabel}, ${s.unreadLabel(count)}` : s.bellLabel;

  return (
    <Link
      to="/app/notifications"
      aria-label={label}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: A11Y.minTapTargetPx,
        minWidth: A11Y.minTapTargetPx,
        color: C.brown,
        textDecoration: "none",
        fontSize: ts(22),
      }}
    >
      <span aria-hidden="true">🔔</span>
      {count > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 4,
            insetInlineEnd: 2,
            minWidth: 20,
            height: 20,
            padding: "0 5px",
            borderRadius: 10,
            background: C.error,
            color: C.cream,
            fontSize: 12,
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
