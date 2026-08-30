/* ════════════════════════════════════════════════
   Notifications — NAVIGATION_SPEC §7. A drawer from the bell.

   Same container and same rules as More (MOTION_SPEC §4), growing from
   the top-right instead of the bottom-right because that is where the
   bell is. Mirrored in Urdu, where the bell is top-left.

   IT HOLDS THE REPORT CHAIN, and that is the part §7 adds rather than
   moves. Reporting somebody in a community of forty neighbours is not
   the anonymous act it is on a large platform — it is a thing you did
   about a person you will see on Thursday. Getting nothing back leaves
   you wondering whether it went anywhere and whether they were told it
   was you. A reference and a plain status answer what can be answered.

   The reports section is ABSENT when nothing has been reported (§0.6).
   A permanent "What you reported — nothing" heading invites the
   reading that reporting is a normal part of using the app.

   Notifications are marked read on opening the drawer, not on tapping
   each one. Opening it IS reading them; a person who has looked at the
   list and then has to clear a badge by hand is being given
   housekeeping.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import Drawer from "./Drawer.jsx";
import { openFullScreen } from "./motion.jsx";
import { STRINGS } from "../routes/notifications/strings.js";
import {
  fetchNotifications,
  markAllRead,
  announceRead,
} from "../routes/notifications/data.js";
import { fetchMyReports, reportRef } from "../routes/notifications/reportChain.js";

export const NOTIFICATIONS_DRAWER_ID = "notifications";

const SHOWN = 8;

export default function NotificationsDrawer({ open, onClose }) {
  const { lang, ts, meta } = useI18n();
  const s = STRINGS[lang] || STRINGS.en;
  const navigate = useNavigate();
  const dateLocale = lang === "ur" ? "ur-PK" : "en-GB";

  const [items, setItems] = useState(null);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    fetchNotifications()
      .then((rows) => {
        if (!alive) return;
        setItems(rows.slice(0, SHOWN));
        /* Opening the list is reading it. Clearing the badge by hand
           afterwards is housekeeping, not information. */
        if (rows.some((r) => !r.read_at)) {
          markAllRead().then(announceRead).catch(() => {});
        }
      })
      .catch(() => alive && setItems([]));
    fetchMyReports().then((r) => alive && setReports(r)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  const go = (to) => {
    if (!to) return;
    openFullScreen(navigate, to, meta.dir === "rtl" ? "left" : "right");
  };

  const statusLine = (r) =>
    r.status === "resolved"
      ? s.reportResolved
      : r.status === "dismissed"
      ? s.reportDismissed
      : s.reportOpen;

  const sectionTitle = {
    fontFamily: meta.fonts.heading,
    fontSize: ts(17),
    fontWeight: 700,
    color: C.green,
    margin: "16px 10px 8px",
  };

  return (
    <Drawer
      id={NOTIFICATIONS_DRAWER_ID}
      open={open}
      onClose={onClose}
      from="top"
      labelledBy="sb-notif-title"
    >
      <h2
        id="sb-notif-title"
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(19),
          fontWeight: 700,
          color: C.green,
          margin: "6px 10px 8px",
        }}
      >
        {s.title}
      </h2>

      {items !== null && items.length === 0 && (
        <p style={{ fontSize: ts(16), color: C.textMuted, margin: "0 10px", lineHeight: 1.55 }}>
          {s.empty}
        </p>
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {(items || []).map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => (n.link ? go(n.link) : onClose())}
              style={{
                width: "100%",
                display: "block",
                minHeight: A11Y.minTapTargetPx,
                padding: "10px 12px",
                borderRadius: 12,
                /* §4.1 — no outline; the fill and the whitespace do it. */
                border: "none",
                background: n.read_at ? "transparent" : C.white,
                color: C.textMain,
                fontFamily: "inherit",
                textAlign: "start",
                cursor: "pointer",
                marginBottom: 4,
              }}
            >
              <span style={{ display: "block", fontSize: ts(16), fontWeight: 700, lineHeight: 1.35 }}>
                {n.title}
              </span>
              {n.body && (
                <span
                  style={{
                    display: "block",
                    fontSize: ts(15),
                    color: C.textMuted,
                    lineHeight: 1.45,
                    marginTop: 2,
                  }}
                >
                  {n.body}
                </span>
              )}
              <span style={{ display: "block", fontSize: ts(13), color: C.textMuted, marginTop: 3 }}>
                {new Date(n.created_at).toLocaleDateString(dateLocale, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* ── The report chain (§7) ──
          Absent entirely when nothing has been reported: a standing
          "What you reported — nothing" heading quietly suggests that
          reporting neighbours is a normal part of the week. */}
      {reports.length > 0 && (
        <>
          <h3 style={sectionTitle}>{s.reportsTitle}</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {reports.map((r) => (
              <li
                key={r.id}
                style={{
                  padding: "10px 12px",
                  marginBottom: 4,
                  borderRadius: 12,
                  background: C.white,
                }}
              >
                <p style={{ margin: 0, fontSize: ts(15), fontWeight: 700 }}>
                  {s.reportKind?.[r.target_kind] || r.target_kind}
                  {" · "}
                  <span style={{ fontWeight: 600, color: C.textMuted }}>
                    {s.reportRef.replace("{ref}", reportRef(r.id))}
                  </span>
                </p>
                <p style={{ margin: "3px 0 0", fontSize: ts(15), color: C.green, fontWeight: 600 }}>
                  {statusLine(r)}
                </p>
                {/* The note a moderator typed, when there is one. It is
                    the only part of the chain that says anything about
                    the decision rather than its state. */}
                {r.resolution_note && (
                  <p style={{ margin: "3px 0 0", fontSize: ts(14), color: C.textMuted, lineHeight: 1.5 }}>
                    {r.resolution_note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        type="button"
        onClick={() => go("/app/notifications")}
        style={{
          minHeight: A11Y.minTapTargetPx,
          margin: "12px 10px 4px",
          padding: "0 16px",
          borderRadius: 50,
          /* An outline, because this one is a control and §4.1 says an
             outline is what that means. */
          border: `2px solid ${C.green}`,
          background: "transparent",
          color: C.green,
          fontSize: ts(16),
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        {s.seeAll}
      </button>
    </Drawer>
  );
}
