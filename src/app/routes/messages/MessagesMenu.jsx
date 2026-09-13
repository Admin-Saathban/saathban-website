/* ════════════════════════════════════════════════
   Menu — MESSAGES_SPEC.md §5.

   NO "DELETE CHAT" HERE, and that is the spec's own emphasis:
   "deleting is per-conversation, not a global tool, and a row called
   Delete near an older person's thumb is a bad idea."

   Rows that carry a value SHOW that value beneath them rather than
   making somebody open the row to find out what it is currently set
   to. "Who can write to you" especially — it is the setting that keeps
   Requests small rather than a spam pile.

   WHAT CHANGED IN THE MESSAGES REWORK, row by row:
   · Archived chats and Blocked people were relative links, and the world
     is mounted on a splat route, so they resolved to …/menu/menu/… and
     opened blank screens. Absolute now. Blocked people also lists muted
     chats, because both are undone from there.
   · Who can write to you and Text size open the setting itself, inside
     Messages, instead of the top of the long Settings page.
   · Read receipts is gone until the thread draws read ticks — a switch
     that changes nothing anybody can see is a placeholder. The column is
     left alone.
   · "Sound and notifications" is "Notifications": there is no sound
     setting, and the row goes straight to the notification settings.
   · The online switch saved twice per tap (the row and the switch both
     handled it). The whole row is the switch now, once.
   · Rows had no box-sizing, so padding and border pushed them 16px past
     the screen and clipped the switch — on the right in English and the
     left in Urdu.
   · It waited for the server on every visit before drawing a single row.
     It draws the settings it last saw now (heldData.js) and refreshes
     them behind the rows.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n, TEXT_SIZES } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import Icon from "../../components/Icon.jsx";
import { saveMessageSetting, WORLD } from "./messagesData.js";
import { heldFor, holdFor, loadSettings } from "./heldData.js";

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  boxSizing: "border-box",
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
  cursor: "pointer",
};

function Words({ label, value }) {
  const { ts } = useI18n();
  return (
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.textMain }}>
        {label}
      </span>
      {value && (
        <span style={{ display: "block", fontSize: ts(16), color: C.textMuted, marginTop: 2 }}>
          {value}
        </span>
      )}
    </span>
  );
}

function LinkRow({ to, label, value }) {
  const { meta } = useI18n();
  return (
    <Link to={to} style={rowStyle}>
      <Words label={label} value={value} />
      <Icon name={meta.dir === "rtl" ? "chevronBack" : "chevron"} size={22} style={{ color: C.textMuted, flexShrink: 0 }} />
    </Link>
  );
}

function SwitchRow({ label, value, on, busy, onToggle }) {
  const { t, ts } = useI18n();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={onToggle}
      style={{ ...rowStyle, border: `1px solid ${C.warmGray}`, opacity: busy ? 0.7 : 1 }}
    >
      <Words label={label} value={value} />
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          minWidth: 64,
          minHeight: A11Y.minTapTargetPx,
          boxSizing: "border-box",
          padding: "0 12px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 50,
          border: `2px solid ${on ? C.green : C.warmGray}`,
          background: on ? C.selected : C.white,
          color: on ? C.green : C.textMuted,
          fontSize: ts(16),
          fontWeight: 800,
        }}
      >
        {/* Never colour alone: the state is a word as well as a tint. */}
        {on ? `✓ ${t("msg.menu.on")}` : t("msg.menu.off")}
      </span>
    </button>
  );
}

const WHO_KEYS = {
  met: "settings.whoCanMessage.met",
  anyone: "settings.whoCanMessage.anyone",
  connected: "settings.whoCanMessage.connected",
};

export default function MessagesMenu() {
  const { t, ts, textSize } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [s, setS] = useState(() => heldFor("settings", myId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!myId) return;
    try {
      setS(await loadSettings(myId));
      setFailed(false);
    } catch {
      /* Held rows stay as they are; only an empty screen says so. */
      setFailed(true);
    }
  }, [myId]);
  useEffect(() => { load(); }, [load]);

  const flipPresence = async () => {
    if (!s || busy) return;
    setBusy(true);
    setError("");
    const next = !s.showPresence;
    setS((cur) => ({ ...cur, showPresence: next }));
    try {
      await saveMessageSetting(myId, { show_presence: next });
      holdFor("settings", myId, { ...s, showPresence: next });
    } catch {
      setS((cur) => ({ ...cur, showPresence: !next }));
      setError("msg.menu.saveFailed");
    }
    setBusy(false);
  };

  if (!s) {
    return failed
      ? <p role="alert" style={{ color: C.brown, fontWeight: 700, fontSize: ts(A11Y.minBodyPx) }}>⚠ {t("common.loadError")}</p>
      : <p role="status" style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx) }}>···</p>;
  }

  const sizeKey = TEXT_SIZES.find((x) => x.id === textSize)?.labelKey;

  return (
    <>
      {error && (
        <p role="alert" style={{ color: C.brown, fontWeight: 700, fontSize: ts(A11Y.minBodyPx) }}>
          ⚠ {t(error)}
        </p>
      )}

      <LinkRow to={`${WORLD}/menu/archived`} label={t("msg.menu.archived")} />
      <LinkRow to={`${WORLD}/menu/blocked`} label={t("msg.menu.blocked")} />

      {/* The setting that keeps Requests small. Its current value is
          on the row, in words, not behind it. */}
      <LinkRow
        to={`${WORLD}/menu/who`}
        label={t("msg.menu.whoCanWrite")}
        value={t(WHO_KEYS[s.whoCanMessage] || WHO_KEYS.met)}
      />

      <SwitchRow
        label={t("msg.menu.presence")}
        value={t("msg.menu.presenceSub")}
        on={s.showPresence}
        busy={busy}
        onToggle={flipPresence}
      />

      <LinkRow to="/app/notifications/settings" label={t("msg.menu.sound")} />
      <LinkRow
        to={`${WORLD}/menu/text-size`}
        label={t("msg.menu.textSize")}
        value={sizeKey ? t(sizeKey) : null}
      />
    </>
  );
}
