/* ════════════════════════════════════════════════
   Chats — MESSAGES_SPEC.md §3, and the drifted-faces row of §9.

   NO BORDERS ON ROWS (§3). Avatar, name, preview, held apart by
   whitespace rather than by lines. Row height ~68px, comfortably over
   the 44px floor.

   UNREAD IS A DOT (§3). "A count creates a small debt — you owe three
   replies. A dot says someone is there." The data layer returns a
   boolean for exactly this reason, so there is no number here to
   render even by accident. Requests keeps its number, because that is
   a queue you clear.

   THE PREVIEW ALWAYS SAYS SOMETHING. "Voice note · 0:12", "Photo",
   "Liked your message" — never a blank line, because a row that says
   nothing is the one a person taps to find out what it was.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import {
  fetchChats,
  previewOf,
  isAbout,
  driftedFrom,
  driftedRowAllowed,
  markDriftedSeen,
  hushDriftedRow,
} from "./messagesData.js";
import Avatar from "./Avatar.jsx";
import SayHelloSheet from "./SayHelloSheet.jsx";

export default function ChatsList() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [chats, setChats] = useState(null);
  const [q, setQ] = useState("");
  const [hello, setHello] = useState(null);   // the person the sheet is for
  const [showDrifted, setShowDrifted] = useState(false);

  const load = useCallback(async () => {
    if (!myId) return;
    try {
      setChats(await fetchChats(myId));
    } catch {
      setChats([]);
    }
  }, [myId]);

  useEffect(() => { load(); }, [load]);

  const open = useMemo(() => (chats || []).filter((c) => !c.archived), [chats]);

  /* §9 — at most once a day, and a dismissal rests it for some days.
     The decision is taken once when the list arrives so the row cannot
     appear and disappear as things re-render. */
  useEffect(() => {
    if (!chats) return;
    if (driftedFrom(chats).length && driftedRowAllowed()) {
      setShowDrifted(true);
      markDriftedSeen();
    }
  }, [chats]);

  const drifted = useMemo(() => (chats ? driftedFrom(chats) : []), [chats]);

  /* §3 — search by NAME. Not message content: searching what people
     said to you is a different and much heavier promise. */
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return open;
    return open.filter((c) => (c.person?.full_name || "").toLowerCase().includes(needle));
  }, [open, q]);

  const now = Date.now();

  return (
    <>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("msg.searchPh")}
        aria-label={t("msg.searchPh")}
        style={{
          width: "100%",
          boxSizing: "border-box",
          minHeight: A11Y.minTapTargetPx,
          fontSize: ts(A11Y.minBodyPx),
          fontFamily: "inherit",
          color: C.textMain,
          background: C.white,
          border: `2px solid ${C.warmGray}`,
          borderRadius: 50,
          padding: "10px 18px",
          marginBottom: 14,
        }}
      />

      {/* ── §9 the faces you have drifted from ── */}
      {showDrifted && drifted.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ flex: 1, fontSize: ts(16), fontWeight: 700, color: C.textMuted }}>
              {t("msg.drifted.label")}
            </span>
            <button
              type="button"
              onClick={() => { hushDriftedRow(); setShowDrifted(false); }}
              aria-label={t("msg.drifted.dismiss")}
              style={{
                minWidth: A11Y.minTapTargetPx,
                minHeight: A11Y.minTapTargetPx,
                border: "none",
                background: "transparent",
                color: C.textMuted,
                fontSize: ts(20),
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
            {drifted.map((c) => (
              <button
                key={c.requestId}
                type="button"
                onClick={() => setHello(c.person ? { ...c.person, id: c.otherId } : { id: c.otherId })}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 72,
                }}
              >
                {/* No ring, no presence dot (§9): these are people you
                    have drifted from, not people who are active, and a
                    liveness ring is the wrong signal entirely. */}
                <Avatar person={c.person} size={56} />
                <span style={{ fontSize: ts(14), color: C.textMain, maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(c.person?.full_name || "").split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {chats === null ? (
        <p role="status" style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx) }}>···</p>
      ) : shown.length === 0 ? (
        /* A door, not a scoreboard (§4, PRODUCT_DECISIONS §0.6).
           PARITY.md records this empty state was fixed once already. */
        <div style={{ padding: "28px 8px", textAlign: "center" }}>
          <p style={{ fontSize: ts(20), fontWeight: 700, color: C.textMain, margin: "0 0 8px" }}>
            {q ? t("msg.noMatches") : t("msg.emptyTitle")}
          </p>
          {!q && (
            <>
              <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 16px" }}>
                {t("msg.emptyBody")}
              </p>
              <Link
                to="/app/people"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: A11Y.minTapTargetPx,
                  padding: "0 24px",
                  borderRadius: 50,
                  background: C.green,
                  color: C.cream,
                  fontSize: ts(A11Y.minBodyPx),
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {t("msg.emptyCta")}
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {shown.map((c) => {
            const pv = previewOf(c, myId);
            const about = isAbout(c.person, now);
            return (
              <li key={c.requestId}>
                <Link
                  to={`/app/people/${c.otherId}/chat`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    minHeight: 68,
                    padding: "10px 4px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <Avatar person={c.person} size={52} about={about} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: ts(19),
                        fontWeight: c.unread ? 800 : 600,
                        color: C.textMain,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.person?.full_name || t("msg.someone")}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: ts(16),
                        color: c.unread ? C.textMain : C.textMuted,
                        fontWeight: c.unread ? 700 : 400,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t(pv.key, pv.values)}
                    </span>
                  </span>
                  {/* The dot. Never a number. */}
                  {c.unread && (
                    <span
                      aria-label={t("msg.unreadAria")}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 50,
                        background: C.green,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {hello && <SayHelloSheet person={hello} onClose={() => setHello(null)} />}
    </>
  );
}
