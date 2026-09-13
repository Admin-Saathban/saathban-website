/* Blocked and muted — MESSAGES_SPEC §5.2, and the Messages rework.

   A list and one way out of each thing on it. Unblocking is deliberately
   plain and undramatic: the serious act was blocking, and making the
   reversal feel weighty would keep people in a state they have decided
   to leave. It reuses the community lane's unblock so there is one
   definition of what blocked means.

   MUTED CHATS LIVE HERE TOO. A mute is set from a conversation's menu
   and undone from the same menu — but a person looking for "where did I
   switch that off" comes to Menu, and this is the screen named for it.

   The unblock call used to pass no kind, and unblock() filters on kind,
   so it matched no row: the button emptied the list on screen and left
   the block in place. It names the kind now. */

import { useCallback, useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import { unblock } from "../community/communityData.js";
import { fetchBlockedPeople, fetchMutedChats, muteChat, refreshUnreadChats } from "./messagesData.js";
import Avatar from "./Avatar.jsx";

function PersonRow({ person, actionLabel, busy, onAction }) {
  const { t, ts } = useI18n();
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 68, padding: "8px 2px" }}>
      <Avatar person={person} size={48} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: ts(19), fontWeight: 600, color: C.textMain, overflowWrap: "anywhere" }}>
          {person?.full_name || t("msg.someone")}
        </span>
        {person?.city && (
          <span style={{ display: "block", fontSize: ts(16), color: C.textMuted }}>{person.city}</span>
        )}
      </span>
      <button
        type="button"
        onClick={onAction}
        disabled={busy}
        style={{
          minHeight: A11Y.minTapTargetPx, padding: "0 16px", borderRadius: 50,
          border: `2px solid ${C.warmGray}`, background: C.white, color: C.textMain,
          fontFamily: "inherit", fontSize: ts(16), fontWeight: 700, cursor: "pointer", flexShrink: 0,
          opacity: busy ? 0.6 : 1,
        }}
      >
        {actionLabel}
      </button>
    </li>
  );
}

export default function BlockedPeople() {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;
  const [rows, setRows] = useState(null);
  const [muted, setMuted] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!myId) return;
    const [b, m] = await Promise.all([
      fetchBlockedPeople(myId).catch(() => []),
      fetchMutedChats(myId).catch(() => []),
    ]);
    setRows(b);
    setMuted(m);
  }, [myId]);
  useEffect(() => { load(); }, [load]);

  const lift = async (r) => {
    setBusy(r.id);
    try {
      await unblock(myId, r.id, "block");
      setRows((cur) => (cur || []).filter((x) => x.id !== r.id));
      pushToast(t("msg.thread.unblockedToast", { name: (r.person?.full_name || "").split(" ")[0] }));
    } catch {
      /* the row stays, so it can be tried again */
      pushToast(t("msg.thread.failed"), { tone: "error" });
    }
    setBusy("");
  };

  const unmute = async (c) => {
    setBusy(c.requestId);
    try {
      await muteChat(myId, c.requestId, false);
      setMuted((cur) => (cur || []).filter((x) => x.requestId !== c.requestId));
      refreshUnreadChats();
      pushToast(t("msg.thread.unmutedToast", { name: (c.person?.full_name || "").split(" ")[0] }));
    } catch {
      pushToast(t("msg.thread.failed"), { tone: "error" });
    }
    setBusy("");
  };

  if (rows === null || muted === null) {
    return <p role="status" style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx) }}>···</p>;
  }

  if (!rows.length && !muted.length) {
    return (
      <p style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx), padding: "24px 8px", textAlign: "center" }}>
        {t("msg.blocked.empty")}
      </p>
    );
  }

  const heading = { fontSize: ts(18), fontWeight: 800, color: C.textMain, margin: "8px 0 4px" };

  return (
    <>
      {rows.length > 0 && (
        <section>
          <h2 style={heading}>{t("msg.blocked.blockedTitle")}</h2>
          <ul style={{ listStyle: "none", margin: "0 0 16px", padding: 0 }}>
            {rows.map((r) => (
              <PersonRow
                key={r.id}
                person={r.person}
                actionLabel={t("msg.blocked.unblock")}
                busy={busy === r.id}
                onAction={() => lift(r)}
              />
            ))}
          </ul>
        </section>
      )}
      {muted.length > 0 && (
        <section>
          <h2 style={heading}>{t("msg.blocked.mutedTitle")}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {muted.map((c) => (
              <PersonRow
                key={c.requestId}
                person={c.person}
                actionLabel={t("msg.blocked.unmute")}
                busy={busy === c.requestId}
                onAction={() => unmute(c)}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
