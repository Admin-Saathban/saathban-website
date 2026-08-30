/* Archived chats — MESSAGES_SPEC §5.1.

   Archiving is per person (0076), so this is "the ones I tidied away",
   never "the ones we both hid". Bringing one back is one tap and it
   returns to Chats in its own place in time order — nothing is lost by
   archiving, which is what makes it a safe thing to offer near a
   thumb where Delete would not be. */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { fetchChats, previewOf, archiveChat } from "./messagesData.js";
import Avatar from "./Avatar.jsx";

export default function ArchivedChats() {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;
  const [chats, setChats] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!myId) return;
    const all = await fetchChats(myId).catch(() => []);
    setChats(all.filter((c) => c.archived));
  }, [myId]);
  useEffect(() => { load(); }, [load]);

  const unarchive = async (c) => {
    setBusy(c.requestId);
    try {
      await archiveChat(myId, c.requestId, false);
      setChats((cur) => (cur || []).filter((x) => x.requestId !== c.requestId));
    } catch {
      /* left where it was; the row is still there to try again */
    }
    setBusy("");
  };

  if (chats === null) return <p role="status" style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx) }}>···</p>;

  if (!chats.length) {
    return (
      <p style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx), padding: "24px 8px", textAlign: "center" }}>
        {t("msg.archived.empty")}
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {chats.map((c) => {
        const pv = previewOf(c, myId);
        return (
          <li key={c.requestId} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 68 }}>
            <Link
              to={`/app/people/${c.otherId}/chat`}
              style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0, textDecoration: "none", color: "inherit", padding: "8px 4px" }}
            >
              <Avatar person={c.person} size={48} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: ts(19), fontWeight: 600, color: C.textMain }}>
                  {c.person?.full_name || t("msg.someone")}
                </span>
                <span style={{ display: "block", fontSize: ts(16), color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t(pv.key, pv.values)}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => unarchive(c)}
              disabled={busy === c.requestId}
              style={{
                minHeight: A11Y.minTapTargetPx, padding: "0 16px", borderRadius: 50,
                border: `2px solid ${C.warmGray}`, background: C.white, color: C.textMain,
                fontFamily: "inherit", fontSize: ts(16), fontWeight: 700, cursor: "pointer", flexShrink: 0,
              }}
            >
              {t("msg.archived.restore")}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
