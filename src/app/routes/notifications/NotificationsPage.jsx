/* ════════════════════════════════════════════════
   Notifications screen — the signed-in person's own messages
   (migration 0007), newest first, with mark-as-read.

   Any role. Accessibility floors: ≥18px text via ts(), ≥48px tap
   targets, visible focus, unread shown with a dot + the word "unread"
   (never colour alone). RTL and font come from the LanguageProvider.
   ════════════════════════════════════════════════ */

import { useEffect, useState, useCallback } from "react";
import ShareTableButton from "../games/ShareTableButton.jsx";
import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { STRINGS, KIND_EMOJI, relativeTime } from "./strings.js";
import { fetchNotifications, markRead, markAllRead, announceRead, muteNotificationPerson, muteNotificationKind } from "./data.js";

/* Quiet by design: these are not actions most people want most of
   the time, and a loud "MUTE" button beside every notification would
   read as the app expecting to annoy you. */
const muteBtn = (ts) => ({
  minHeight: A11Y.minTapTargetPx,
  background: "none",
  border: "none",
  padding: 0,
  color: C.textMuted,
  fontFamily: "inherit",
  fontSize: ts(15),
  textDecoration: "underline",
  cursor: "pointer",
});

export default function NotificationsPage() {
  const { lang, ts, meta } = useI18n();
  const s = STRINGS[lang] || STRINGS.en;

  const [items, setItems] = useState(null); // null = loading
  const [error, setError] = useState("");
  /* §6.1 — which rows have just been muted, so the row can say what
     happened in place rather than vanishing under the person's
     finger. Keyed by notification id: the mute applies to the person
     or the kind, but the acknowledgement belongs to the row they
     touched. */
  const [muted, setMuted] = useState({});

  const load = useCallback(async () => {
    try {
      setItems(await fetchNotifications());
      setError("");
    } catch {
      setError(s.loadError);
      setItems([]);
    }
  }, [s.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const onMarkOne = async (id) => {
    setItems((cur) => cur.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    try {
      await markRead(id);
      announceRead();
    } catch {
      load(); // reconcile on failure
    }
  };

  const onMarkAll = async () => {
    const now = new Date().toISOString();
    setItems((cur) => cur.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    try {
      await markAllRead();
      announceRead();
    } catch {
      load();
    }
  };

  const unread = (items || []).filter((n) => !n.read_at).length;

  /* Quiet, immediate, reversible. No confirm step: asking "are you
     sure?" about something undoable is how a person learns to fear
     buttons, and this one exists precisely so the app is easy to turn
     down. */
  const onMute = async (n, what) => {
    try {
      if (what === "person") await muteNotificationPerson(n.created_by);
      else await muteNotificationKind(n.kind);
      setMuted((m) => ({ ...m, [n.id]: what }));
    } catch {
      setError(s.muteFailed);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.textMain, padding: "20px 16px 64px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(32), fontWeight: 700, color: C.green, margin: "4px 0 6px" }}>
            {s.title}
          </h1>
          {unread > 0 && (
            <button
              type="button"
              onClick={onMarkAll}
              style={{
                minHeight: A11Y.minTapTargetPx,
                padding: "0 16px",
                borderRadius: 50,
                border: `2px solid ${C.warmGray}`,
                background: C.white,
                color: C.brown,
                fontSize: ts(16),
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {s.markAll}
            </button>
          )}
        </div>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 20px" }}>{s.subtitle}</p>

        {error && (
          <p role="alert" style={{ fontSize: ts(A11Y.minBodyPx), color: C.error, fontWeight: 600 }}>{error}</p>
        )}

        {items === null ? (
          <p aria-busy="true" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>···</p>
        ) : items.length === 0 ? (
          <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.6 }}>{s.empty}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((n) => {
              const isUnread = !n.read_at;
              return (
                <li
                  key={n.id}
                  style={{
                    background: C.white,
                    border: `1px solid ${isUnread ? C.sage : C.warmGray}`,
                    borderInlineStart: `4px solid ${isUnread ? C.green : "transparent"}`,
                    borderRadius: 16,
                    padding: "16px 18px",
                  }}
                >
                  {/* Where it's from: emoji + a worded kind label, so a
                      game invite never looks like a document request. */}
                  {s.kinds[n.kind] && (
                    <p style={{ fontSize: ts(14), fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.greenMuted, margin: "0 0 6px" }}>
                      <span aria-hidden="true">{KIND_EMOJI[n.kind] || "🔔"}</span> {s.kinds[n.kind]}
                    </p>
                  )}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    {isUnread && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: ts(14), fontWeight: 700, color: C.green }}>
                        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: C.green, display: "inline-block" }} />
                        {s.unread}
                      </span>
                    )}
                    {/* GAMES_WIRING §1: rows with a deep link open it
                        (game invites, your-turn, table ready…) and
                        count as read on tap. Linkless rows unchanged. */}
                    {n.link ? (
                      <h2 style={{ fontSize: ts(20), fontWeight: 700, margin: 0 }}>
                        <Link
                          to={n.link}
                          onClick={() => { if (isUnread) onMarkOne(n.id); }}
                          style={{ color: C.green, textDecoration: "underline" }}
                        >
                          {n.title}
                        </Link>
                      </h2>
                    ) : (
                      <h2 style={{ fontSize: ts(20), fontWeight: 700, color: C.textMain, margin: 0 }}>{n.title}</h2>
                    )}
                  </div>
                  {/* A game invite is the other place a person wants to
                      pass the table on — "come and play" is usually said
                      to more than one person. The row knows the session,
                      the button fetches the code. */}
                  {n.kind === "game" && /\/app\/games\/s\/[0-9a-f-]{36}$/.test(n.link || "") && (
                    <div style={{ marginTop: 10 }}>
                      <ShareTableButton compact sessionId={(n.link || "").split("/").pop()} />
                    </div>
                  )}
                  {n.body && (
                    <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, margin: "8px 0 0", lineHeight: 1.6 }}>{n.body}</p>
                  )}
                  {/* ── OUT_AND_ABOUT_SPEC §6.1 ──
                      "Inline in the notification: mute this person and
                       mute this kind of thing. Both reversible from
                       Settings. A notification a person cannot stop
                       from the place they receive it is a notification
                       they will stop by leaving."

                      Neither is a new mechanism: the person mute is the
                      same user_blocks row the feed writes, and the kind
                      mute is the same profiles.settings->notify override
                      the notify settings screen edits — so "reversible
                      from Settings" is literally true rather than a
                      promise. Muting is quiet and needs no confirming:
                      it is reversible, and asking "are you sure?" about
                      a reversible thing is how a person learns to fear
                      buttons. */}
                  {muted[n.id] ? (
                    <p style={{ fontSize: ts(15), color: C.textMuted, margin: "12px 0 0" }}>
                      {muted[n.id] === "person" ? s.mutedPerson : s.mutedKind}
                    </p>
                  ) : (
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
                      {n.created_by && (
                        <button
                          type="button"
                          onClick={() => onMute(n, "person")}
                          style={muteBtn(ts)}
                        >
                          {s.mutePerson}
                        </button>
                      )}
                      {n.kind && (
                        <button
                          type="button"
                          onClick={() => onMute(n, "kind")}
                          style={muteBtn(ts)}
                        >
                          {s.muteKind}
                        </button>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: ts(15), color: C.textMuted }}>{relativeTime(n.created_at, s)}</span>
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => onMarkOne(n.id)}
                        style={{
                          minHeight: A11Y.minTapTargetPx,
                          padding: "0 16px",
                          borderRadius: 50,
                          border: "none",
                          background: "transparent",
                          color: C.green,
                          fontSize: ts(16),
                          fontWeight: 700,
                          fontFamily: "inherit",
                          textDecoration: "underline",
                          cursor: "pointer",
                        }}
                      >
                        {s.markOne}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
