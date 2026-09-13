/* ════════════════════════════════════════════════
   Chats — MESSAGES_SPEC.md §3. (§9's "Not heard from" faces are in New chat.)

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

   ONLY CONVERSATIONS (owner, 2026-09-13). Chats shows the conversations
   a person has and nothing that starts one. Everything about starting —
   the people you know, finding someone new, inviting, and the "Not heard
   from" faces that open a hello — lives in + New chat, so the two screens
   no longer offer the same doors. Empty is said plainly: "No
   conversations yet", with no buttons under it. Received streaks and
   streak groups stay, because those are conversations already.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import {
  fetchChats,
  previewOf,
  isAbout,
  cachedChats,
  rememberChatsScroll,
  rememberedChatsScroll,
  cachedStreakMail,
  fetchStreakMail,
  WORLD,
} from "./messagesData.js";
import Avatar from "./Avatar.jsx";
import Icon from "../../components/Icon.jsx";
import { itemNoun, itemTitle, itemIcon, tn } from "../streaks/streaksData.js";
import { ItemIcon } from "../streaks/ui.jsx";

/* A received streak, as a row among the conversations (streaks mock,
   screen 5). It opens the focused window — that one item, nothing else. */
function StreakMailRow({ r, onOpen }) {
  const { t, ts } = useI18n();
  const first = (r.sender_name || "").split(" ")[0];
  const noun = itemNoun(t, r.item_key, r.item_name);
  return (
    <li>
      <Link
        to={`/app/streak/${r.send_id}`}
        onClick={onOpen}
        className="sb-press"
        data-streak-row={r.send_id}
        style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 68, padding: "10px 4px", textDecoration: "none", color: "inherit" }}
      >
        <Avatar person={{ full_name: r.sender_name, avatar_url: r.sender_avatar_url }} size={52} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: ts(18), fontWeight: 700, color: C.textMain, lineHeight: 1.35 }}>
            {t("streaks.inbox.sent", { name: first, noun })}
          </span>
          <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: r.replied ? C.textMuted : C.green, fontWeight: r.replied ? 400 : 600, lineHeight: 1.4 }}>
            {tn(t, r.replied ? "streaks.inbox.runReplied" : "streaks.inbox.runTap", r.run_count, { noun })}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function ChatsList() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  /* SEEDED FROM MEMORY, not from null. null means "we have never
     looked" and draws a placeholder; on a return from a conversation
     we HAVE looked, moments ago, and the rows should simply still be
     there. This is the whole of the instant back. */
  const [chats, setChats] = useState(() => cachedChats(myId));
  const [mail, setMail] = useState(() => cachedStreakMail(myId));
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!myId) return;
    try {
      setChats(await fetchChats(myId));
    } catch {
      /* Only blank on a failure with nothing to show. If rows are on
         screen, a dropped refresh must not take them away. */
      setChats((prev) => prev ?? []);
    }
  }, [myId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!myId) return undefined;
    let alive = true;
    fetchStreakMail(myId)
      .then((m) => alive && setMail(m))
      .catch(() => alive && setMail((prev) => prev ?? { received: [], groups: [] }));
    return () => { alive = false; };
  }, [myId]);

  /* WHERE HE WAS STANDING.

     Restored before paint (useLayoutEffect) so the list never appears
     at the top and then jumps — a jump is its own kind of lost. Only
     when there are already rows to stand on: with no seeded rows the
     page has no height yet and the scroll would be discarded.

     The window scrolls, not this element, so the position is read and
     written on the window. */
  useLayoutEffect(() => {
    if (!chats) return;
    const y = rememberedChatsScroll();
    if (y > 0) window.scrollTo(0, y);
    // Once, on the mount that has rows — not on every later refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats === null]);

  /* Saved at the moment of leaving rather than on scroll: the browser
     fires a scroll reset of its own before unmount, so a scroll
     listener faithfully records 0 and hands back the top of the list.
     A tap on a row is the last honest reading there is. */
  const leaving = () => rememberChatsScroll(window.scrollY || 0);

  const open = useMemo(() => (chats || []).filter((c) => !c.archived), [chats]);

  /* §3 — search by NAME. Not message content: searching what people
     said to you is a different and much heavier promise. */
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return open;
    return open.filter((c) => (c.person?.full_name || "").toLowerCase().includes(needle));
  }, [open, q]);

  const now = Date.now();

  /* Received streaks sit among the conversations by time — newest first,
     whichever kind it is. Search by name reaches them too. */
  const received = mail?.received || [];
  const groups = mail?.groups || [];
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rec = needle ? received.filter((r) => (r.sender_name || "").toLowerCase().includes(needle)) : received;
    return [
      ...shown.map((c) => ({ kind: "chat", at: c.at, c })),
      ...rec.map((r) => ({ kind: "streak", at: r.created_at, r })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, mail, q]);

  /* A search box over an empty list is furniture, and furniture is
     what made this screen read as a placeholder. It appears once there
     are conversations to search. Kept while typing, so a search that
     matches nothing does not delete the field mid-word. */
  const searchable = open.length > 0 || received.length > 0 || q !== "";

  return (
    <>
      {searchable && (
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
      )}

      {/* The "Not heard from" faces moved to New chat: a face there opens a
          hello, which is starting a conversation, and Chats no longer
          offers ways to start one. */}

      {chats === null ? (
        <p role="status" style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx) }}>···</p>
      ) : items.length === 0 && (q || groups.length === 0) ? (
        /* Said plainly, with no buttons (owner, 2026-09-13): starting a
           conversation is + New chat's, in the header above, and a second
           set of doors here was the overlap he asked to remove. Still not
           a scoreboard — it says where conversations will appear, not
           that there is nobody. */
        <div data-chats-empty="" style={{ padding: "28px 8px", textAlign: "center" }}>
          <p style={{ fontSize: ts(20), fontWeight: 700, color: C.textMain, margin: "0 0 8px" }}>
            {q ? t("msg.noMatches") : t("msg.emptyTitle")}
          </p>
          {!q && (
            <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: 0 }}>
              {t("msg.emptyBody")}
            </p>
          )}
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((it) => {
            if (it.kind === "streak") return <StreakMailRow key={"s-" + it.r.send_id} r={it.r} onOpen={leaving} />;
            const c = it.c;
            const pv = previewOf(c, myId);
            const about = isAbout(c.person, now);
            return (
              <li key={c.requestId}>
                <Link
                  to={`${WORLD}/with/${c.otherId}`}
                  onClick={leaving}
                  className="sb-press"
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
                  {/* Muted (0135), said in a word — never an icon alone. */}
                  {c.muted && (
                    <span style={{ flexShrink: 0, fontSize: ts(14), color: C.textMuted, border: `1px solid ${C.warmGray}`, borderRadius: 50, padding: "2px 10px" }}>
                      {t("msg.thread.mutedChip")}
                    </span>
                  )}
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

      {/* Streak groups — the person's own shared streaks: who is in
          today, never a ranking. */}
      {!q && groups.length > 0 && (
        <section data-streak-groups="" style={{ marginTop: 18 }}>
          <p style={{ fontSize: ts(15), letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700, color: C.textMuted, margin: "0 0 8px" }}>
            {t("streaks.inbox.groupsLabel")}
          </p>
          {groups.map((g) => {
            const members = g.members || [];
            const n = members.length;
            const sent = members.filter((m) => m.sent_today).length;
            const left = n - sent;
            return (
              <Link
                key={g.streak_id}
                to={`/app/streaks/${g.streak_id}`}
                onClick={leaving}
                className="sb-press"
                data-streak-group-row={g.streak_id}
                style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 64, padding: "12px 14px", marginBottom: 8, background: C.white, borderRadius: 16, textDecoration: "none", color: "inherit" }}
              >
                <ItemIcon name={itemIcon(g.item_key)} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: ts(18), fontWeight: 700, color: C.textMain }}>
                    {t("streaks.inbox.groupTitle", { item: itemTitle(t, g.item_key, g.item_name), n })}
                  </span>
                  <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                    {left === 0 ? t("streaks.inbox.groupAll") : sent === 0 ? t("streaks.inbox.groupNone") : t("streaks.inbox.groupLine", { sent, left })}
                  </span>
                </span>
                <Icon name={meta.dir === "rtl" ? "chevronBack" : "chevron"} size={20} style={{ color: C.green }} />
              </Link>
            );
          })}
        </section>
      )}

    </>
  );
}
