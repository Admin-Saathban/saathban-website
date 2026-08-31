/* ════════════════════════════════════════════════
   Menu — MESSAGES_SPEC.md §5. Seven rows, no group headers.

   NO "DELETE CHAT" HERE, and that is the spec's own emphasis:
   "deleting is per-conversation, not a global tool, and a row called
   Delete near an older person's thumb is a bad idea."

   Rows that carry a value SHOW that value beneath them rather than
   making somebody open the row to find out what it is currently set
   to. "Who can write to you" especially — it is the setting that keeps
   Requests small rather than a spam pile, so it has to be legible at a
   glance, and its three options are §6's, not invented here.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { fetchMessageSettings, saveMessageSetting } from "./messagesData.js";

function Row({ to, onClick, label, value, children, danger }) {
  const { ts } = useI18n();
  const inner = (
    <>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: danger ? C.brown : C.textMain }}>
          {label}
        </span>
        {value && (
          <span style={{ display: "block", fontSize: ts(16), color: C.textMuted, marginTop: 2 }}>
            {value}
          </span>
        )}
      </span>
      {children}
    </>
  );
  const style = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    minHeight: 62,
    padding: "10px 14px",
    background: C.white,
    border: `1px solid ${C.warmGray}`,
    borderRadius: 14,
    marginBottom: 10,
    textDecoration: "none",
    color: "inherit",
    fontFamily: "inherit",
    textAlign: "start",
    cursor: onClick || to ? "pointer" : "default",
  };
  if (to) return <Link to={to} style={style}>{inner}</Link>;
  return (
    <div style={style} onClick={onClick}>
      {inner}
    </div>
  );
}

function Switch({ on, onChange, label, busy }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onChange}
      style={{
        minWidth: 64,
        minHeight: A11Y.minTapTargetPx,
        borderRadius: 50,
        border: `2px solid ${on ? C.green : C.warmGray}`,
        background: on ? "#EEF3E8" : C.white,
        color: on ? C.green : C.textMuted,
        fontFamily: "inherit",
        fontSize: ts(16),
        fontWeight: 800,
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {/* Never colour alone: the state is a word as well as a tint. */}
      {on ? "✓" : "○"}
    </button>
  );
}

const WHO_KEYS = {
  met: "settings.whoCanMessage.met",
  anyone: "settings.whoCanMessage.anyone",
  connected: "settings.whoCanMessage.connected",
};

export default function MessagesMenu() {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!myId) return;
    setS(await fetchMessageSettings(myId).catch(() => null));
  }, [myId]);
  useEffect(() => { load(); }, [load]);

  const flip = async (field) => {
    if (!s || busy) return;
    setBusy(true);
    setError("");
    const next = !s[field];
    const col = field === "showPresence" ? "show_presence" : "read_receipts";
    setS((cur) => ({ ...cur, [field]: next }));
    try {
      await saveMessageSetting(myId, { [col]: next });
    } catch {
      setS((cur) => ({ ...cur, [field]: !next }));
      setError("msg.menu.saveFailed");
    }
    setBusy(false);
  };

  if (!s) return <p role="status" style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx) }}>···</p>;

  return (
    <>
      {error && (
        <p role="alert" style={{ color: C.brown, fontWeight: 700, fontSize: ts(A11Y.minBodyPx) }}>
          ⚠ {t(error)}
        </p>
      )}

      <Row to="menu/archived" label={t("msg.menu.archived")} />
      <Row to="menu/blocked" label={t("msg.menu.blocked")} />

      {/* The setting that keeps Requests small. Its current value is
          on the row, in words, not behind it. */}
      <Row
        to="/app/settings"
        label={t("msg.menu.whoCanWrite")}
        value={t(WHO_KEYS[s.whoCanMessage] || WHO_KEYS.met)}
      />

      <Row
        label={t("msg.menu.presence")}
        value={t("msg.menu.presenceSub")}
        onClick={() => flip("showPresence")}
      >
        <Switch on={s.showPresence} busy={busy} label={t("msg.menu.presence")} onChange={() => flip("showPresence")} />
      </Row>

      <Row
        label={t("msg.menu.receipts")}
        value={t("msg.menu.receiptsSub")}
        onClick={() => flip("readReceipts")}
      >
        <Switch on={s.readReceipts} busy={busy} label={t("msg.menu.receipts")} onChange={() => flip("readReceipts")} />
      </Row>

      <Row to="/app/notifications/settings" label={t("msg.menu.sound")} />
      <Row to="/app/settings" label={t("msg.menu.textSize")} />
    </>
  );
}
