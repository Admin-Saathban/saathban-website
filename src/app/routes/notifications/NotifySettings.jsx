/* ════════════════════════════════════════════════
   What may interrupt you — PRODUCT_DECISIONS §19.

   "An interruption must be about a person, not about the app."

   The screen is built around that sentence rather than around a list
   of switches, because the sentence is what makes the defaults
   understandable. Two groups, each with its own line of explanation:

     Things people do    — on, and worth keeping on
     Things the app does — off, and here if you want them

   Nothing is described as a "notification type". Each row says what
   actually happens: "Someone sends you a message", not "Messages".

   The defaults live in ONE place — 0058's notify_default_off — and
   this screen only ever writes the differences. Somebody who has
   never changed anything stores nothing at all, so a kind added later
   arrives with its default rather than with whatever was frozen into
   a row on the day they signed up.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import supabase from "../../lib/supabase.js";

/* Kept in step with 0058's notify_default_off. The server is the
   authority — it refuses to write a kind you have turned off — and
   this list decides what the screen OFFERS and how it is grouped. */
export const PERSON_KINDS = [
  "message", "your_move", "reminder_added", "question_answered",
  "reaction", "game_invite", "family_message", "buddy_contact",
  "badge", "allotment",
];
export const APP_KINDS = ["streak_nudge", "log_reminder", "feed_activity"];

function Toggle({ kind, on, onChange, busy }) {
  const { t, ts } = useI18n();
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        minHeight: 56,
        padding: "6px 2px",
        borderBottom: `1px solid ${C.warmGray}`,
      }}
    >
      <input
        type="checkbox"
        checked={on}
        disabled={busy}
        onChange={(e) => onChange(kind, e.target.checked)}
        style={{ width: 28, height: 28, flexShrink: 0 }}
      />
      <span style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, flex: 1 }}>
        {t(`notify.kind.${kind}`)}
      </span>
    </label>
  );
}

export default function NotifySettings() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const [overrides, setOverrides] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOverrides(profile?.settings?.notify || {});
  }, [profile]);

  const isOn = (kind) =>
    kind in overrides ? !!overrides[kind] : !APP_KINDS.includes(kind);

  const set = async (kind, value) => {
    if (busy) return;
    setBusy(true);
    const next = { ...overrides, [kind]: value };
    setOverrides(next); // optimistic: a switch must move when tapped
    const { error } = await supabase
      .from("profiles")
      .update({ settings: { ...(profile?.settings || {}), notify: next } })
      .eq("id", profile.id);
    if (error) {
      setOverrides(overrides);
      pushToast(t("notify.saveFailed"), { tone: "error", key: "notify" });
    }
    setBusy(false);
  };

  const Group = ({ titleKey, noteKey, kinds }) => (
    <section style={{ marginBottom: 26 }}>
      <h2
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(20),
          fontWeight: 700,
          color: C.green,
          margin: "0 0 4px",
        }}
      >
        {t(titleKey)}
      </h2>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 10px" }}>
        {t(noteKey)}
      </p>
      {kinds.map((k) => (
        <Toggle key={k} kind={k} on={isOn(k)} onChange={set} busy={busy} />
      ))}
    </section>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "8px 0 40px" }}>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(26),
          fontWeight: 800,
          color: C.brown,
          lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.25,
          margin: "0 0 6px",
        }}
      >
        {t("notify.title")}
      </h1>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 22px" }}>
        {t("notify.intro")}
      </p>

      <Group titleKey="notify.people.title" noteKey="notify.people.note" kinds={PERSON_KINDS} />
      <Group titleKey="notify.app.title" noteKey="notify.app.note" kinds={APP_KINDS} />
    </div>
  );
}
