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
import { useDrawer } from "../../components/Drawer.jsx";
import { NOTIFICATIONS_DRAWER_ID } from "../../components/NotificationsDrawer.jsx";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { IconChip } from "../../components/Icon.jsx";
import { STRINGS } from "./strings.js";
import { fetchUnreadCount, NOTIFICATIONS_READ_EVENT } from "./data.js";

export default function NotificationsBell() {
  const { lang, ts } = useI18n();
  /* NAVIGATION_SPEC §7 — the bell opens a DRAWER now, growing from
     itself, rather than navigating to a page. The open state lives in
     history (see Drawer.jsx), so this button only has to ask for it.
     The drawer itself is mounted by AppHeader, beside this. */
  const { open, openDrawer } = useDrawer(NOTIFICATIONS_DRAWER_ID);
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
    // A message or invite must light the bell within a few seconds
    // while the app is open — a HEAD count every 6s is cheap, and the
    // poll pauses while the tab is hidden (refreshing on return).
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 6000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const label = count > 0 ? `${s.bellLabel}, ${s.unreadLabel(count)}` : s.bellLabel;

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={label}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: A11Y.minTapTargetPx,
        minWidth: A11Y.minTapTargetPx,
        /* The chip paints the glyph itself, but this is what anything
           ELSE inside the button inherits, and on dark chrome brown is
           the colour of the bar. Latent rather than visible, which is
           the kind that waits for someone to add a character. */
        color: C.navInk,
        border: "none",
        background: "none",
        cursor: "pointer",
        fontSize: ts(22),
      }}
    >
      {/* BRONZE, not ink. The bell and Messages are the two things
          people hunt for in the chrome, and a landmark is easier to
          find when it is not the same colour as everything beside
          it. Bronze measures 4.28:1 on the dark chrome — non-text
          needs 3:1 (WCAG 1.4.11) — and it carries a count badge and
          an accessible name besides, so it is never colour alone. */}
      <IconChip name="bell" size={20} tone="bronze" variant="header" onDark />
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
    </button>
  );
}
