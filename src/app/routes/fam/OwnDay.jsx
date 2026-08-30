/* ════════════════════════════════════════════════
   Your own day — on the Fam member's home, not tucked away.

   PRODUCT_DECISIONS §10: "One-directional caring makes an Icon feel like
   a patient." So a Fam member keeps their own daily log as a NORMAL part
   of the app — same mood, same simple things — and what is theirs to
   choose is whether their Icon can see it.

   It sits among the things to react to and act on rather than in a
   section of its own, because §10 is explicit that their own log is
   "part of that liveliness, not homework". There is no streak here, no
   completion meter and no nudge: those are the things that would turn a
   day into a task.

   The sharing switch says what it does in the member's own words — "let
   {name} see how my day is going" — because the Icon seeing it is the
   entire point of the reciprocity, and burying it in settings would
   leave the correction half made.

   Writing this row was impossible before 0057: daily_logs INSERT
   required app_role() = 'saath_icon'.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";
import { Card, BodyText } from "./ui.jsx";

const MOODS = [
  { v: 5, emoji: "😊", key: "great" },
  { v: 4, emoji: "🙂", key: "good" },
  { v: 3, emoji: "😐", key: "ok" },
  { v: 2, emoji: "😔", key: "low" },
  { v: 1, emoji: "😢", key: "hard" },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function OwnDay({ iconId, iconName }) {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [mood, setMood] = useState(null);
  const [shares, setShares] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!myId) return;
    const { data } = await supabase
      .from("daily_logs")
      .select("mood_value")
      .eq("icon_id", myId)
      .eq("log_date", today())
      .eq("module", "mood")
      .maybeSingle();
    setMood(data?.mood_value ?? null);

    if (iconId) {
      const { data: cm } = await supabase
        .from("circle_members")
        .select("member_shares_log")
        .eq("icon_id", iconId)
        .eq("member_id", myId)
        .maybeSingle();
      setShares(!!cm?.member_shares_log);
    }
  }, [myId, iconId]);

  useEffect(() => {
    load();
  }, [load]);

  const pick = async (v) => {
    if (busy || !myId) return;
    setBusy(true);
    const previous = mood;
    setMood(v); // the tap answers immediately; the row follows
    const { error } = await supabase
      .from("daily_logs")
      .upsert(
        { icon_id: myId, log_date: today(), module: "mood", mood_value: v },
        { onConflict: "icon_id,log_date,module" }
      );
    if (error) setMood(previous);
    setBusy(false);
  };

  /* The member's own choice, written to their membership row. It is the
     only thing on this card that involves the Icon at all. */
  const toggleShare = async () => {
    if (busy || !iconId || !myId) return;
    setBusy(true);
    const next = !shares;
    setShares(next);
    const { error } = await supabase
      .from("circle_members")
      .update({ member_shares_log: next })
      .eq("icon_id", iconId)
      .eq("member_id", myId);
    if (error) setShares(!next);
    setBusy(false);
  };

  return (
    <Card>
      <p style={{ fontSize: ts(20), fontWeight: 700, color: C.textMain, margin: "0 0 10px" }}>
        {t("fam.ownDay.title")}
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {MOODS.map((m) => {
          const on = mood === m.v;
          return (
            <button
              key={m.v}
              type="button"
              onClick={() => pick(m.v)}
              disabled={busy}
              aria-pressed={on}
              aria-label={t(`fam.ownDay.mood_${m.key}`)}
              className="sb-pressable"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                minWidth: 60,
                minHeight: A11Y.minTapTargetPx + 12,
                padding: "6px 4px",
                borderRadius: 16,
                border: on ? `3px solid ${C.green}` : `2px solid ${C.warmGray}`,
                background: on ? "#EEF3E8" : C.white,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: ts(26) }}>{m.emoji}</span>
              {/* Never colour alone: the chosen one carries a tick and a word. */}
              <span style={{ fontSize: ts(13), fontWeight: on ? 800 : 500, color: C.textMain }}>
                {on ? "✓ " : ""}
                {t(`fam.ownDay.mood_${m.key}`)}
              </span>
            </button>
          );
        })}
      </div>

      {iconId && (
        <button
          type="button"
          onClick={toggleShare}
          disabled={busy}
          role="switch"
          aria-checked={shares}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            minHeight: A11Y.minTapTargetPx,
            padding: "0 14px",
            borderRadius: 14,
            border: `2px solid ${shares ? C.green : C.warmGray}`,
            background: shares ? "#EEF3E8" : C.white,
            fontFamily: "inherit",
            fontSize: ts(16),
            fontWeight: 600,
            color: C.textMain,
            textAlign: "start",
            cursor: "pointer",
          }}
        >
          <span aria-hidden="true">{shares ? "✓" : "○"}</span>
          {t("fam.ownDay.shareWith", { name: iconName })}
        </button>
      )}

      <BodyText muted style={{ margin: "10px 0 0", fontSize: ts(15) }}>
        {t("fam.ownDay.note")}
      </BodyText>
    </Card>
  );
}
