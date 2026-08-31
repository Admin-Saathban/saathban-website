/* Blocked people — MESSAGES_SPEC §5.2.

   A list and one way out of it. Unblocking is deliberately plain and
   undramatic: the serious act was blocking, and making the reversal
   feel weighty would keep people in a state they have decided to
   leave. It reuses the community lane's unblock so there is one
   definition of what blocked means. */

import { useCallback, useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { unblock } from "../community/communityData.js";
import { fetchBlockedPeople } from "./messagesData.js";
import Avatar from "./Avatar.jsx";

export default function BlockedPeople() {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!myId) return;
    setRows(await fetchBlockedPeople(myId).catch(() => []));
  }, [myId]);
  useEffect(() => { load(); }, [load]);

  const lift = async (r) => {
    setBusy(r.id);
    try {
      await unblock(myId, r.id);
      setRows((cur) => (cur || []).filter((x) => x.id !== r.id));
    } catch {
      /* the row stays, so it can be tried again */
    }
    setBusy("");
  };

  if (rows === null) return <p role="status" style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx) }}>···</p>;

  if (!rows.length) {
    return (
      <p style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx), padding: "24px 8px", textAlign: "center" }}>
        {t("msg.blocked.empty")}
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {rows.map((r) => (
        <li key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 68, padding: "8px 4px" }}>
          <Avatar person={r.person} size={48} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: ts(19), fontWeight: 600, color: C.textMain }}>
              {r.person?.full_name || t("msg.someone")}
            </span>
            {r.person?.city && (
              <span style={{ display: "block", fontSize: ts(16), color: C.textMuted }}>{r.person.city}</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => lift(r)}
            disabled={busy === r.id}
            style={{
              minHeight: A11Y.minTapTargetPx, padding: "0 18px", borderRadius: 50,
              border: `2px solid ${C.warmGray}`, background: C.white, color: C.textMain,
              fontFamily: "inherit", fontSize: ts(16), fontWeight: 700, cursor: "pointer", flexShrink: 0,
            }}
          >
            {t("msg.blocked.unblock")}
          </button>
        </li>
      ))}
    </ul>
  );
}
