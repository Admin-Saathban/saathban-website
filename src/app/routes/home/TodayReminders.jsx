/* ════════════════════════════════════════════════
   Today's reminders — one at a time, until there are none.

   A list of five reminders is five things you have not done. So the
   card shows ONE: the next one due, with a single large tick. Marking
   it reveals the next, and when the last is answered the whole card
   becomes a chip that says so and gets out of the way.

   The tick is a row in reminder_dones (0048), unique per reminder per
   day, so a double tap cannot double-record and tomorrow starts clean
   without anything being reset. Undo is a delete, so a mis-tap costs
   nothing — which is why the chip stays tappable rather than vanishing.

   Never a scoreboard: nothing counts how many days you managed, and a
   reminder left untouched is not marked late, missed or overdue. It is
   simply still there tomorrow.
   ════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import supabase from "../../lib/supabase.js";

const isoToday = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function TodayReminders({ iconId }) {
  const { t, ts, meta } = useI18n();
  const [reminders, setReminders] = useState([]);
  const [doneIds, setDoneIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const today = isoToday();

  useEffect(() => {
    if (!iconId) return undefined;
    let alive = true;
    (async () => {
      const [{ data: rem }, { data: dones }] = await Promise.all([
        supabase
          .from("reminders")
          .select("id, label, emoji, remind_times, days_label")
          .eq("icon_id", iconId),
        supabase
          .from("reminder_dones")
          .select("reminder_id")
          .eq("icon_id", iconId)
          .eq("done_date", today),
      ]);
      if (!alive) return;
      setReminders(rem || []);
      setDoneIds(new Set((dones || []).map((d) => d.reminder_id)));
    })();
    return () => { alive = false; };
  }, [iconId, today]);

  /* Order by the first time each is due, so "next" means next by the
     clock rather than next by whatever order they were typed in. */
  const ordered = useMemo(() => {
    const minutesOf = (r) => {
      const times = (r.remind_times || []).map((hms) => {
        const [h, m] = String(hms).split(":").map(Number);
        return h * 60 + m;
      });
      return times.length ? Math.min(...times) : 24 * 60;
    };
    return [...reminders].sort((a, b) => minutesOf(a) - minutesOf(b));
  }, [reminders]);

  const remaining = ordered.filter((r) => !doneIds.has(r.id));
  const next = remaining[0] || null;

  const fmt = (hms) => {
    const [h, m] = String(hms).split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(meta.dir === "rtl" ? "ur-PK" : "en-GB", { hour: "numeric", minute: "2-digit" });
  };

  const tick = async (r) => {
    if (busy) return;
    setBusy(true);
    // Optimistic: the next one should appear the instant it is tapped.
    setDoneIds((cur) => new Set([...cur, r.id]));
    const { error } = await supabase
      .from("reminder_dones")
      .insert({ reminder_id: r.id, icon_id: iconId, done_date: today });
    // A duplicate (23505) means it was already ticked — which is the
    // state we just drew, so it is not an error worth showing.
    if (error && error.code !== "23505") {
      setDoneIds((cur) => {
        const nextSet = new Set(cur);
        nextSet.delete(r.id);
        return nextSet;
      });
    }
    setBusy(false);
  };

  const untick = async (r) => {
    if (busy) return;
    setBusy(true);
    setDoneIds((cur) => {
      const nextSet = new Set(cur);
      nextSet.delete(r.id);
      return nextSet;
    });
    await supabase
      .from("reminder_dones")
      .delete()
      .eq("reminder_id", r.id)
      .eq("done_date", today);
    setBusy(false);
  };

  if (!reminders.length) return null;

  /* ── All answered: a chip, still tappable to look back or undo ── */
  if (!next) {
    return (
      <div style={{ marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            minHeight: A11Y.minTapTargetPx,
            padding: "0 16px",
            borderRadius: 50,
            border: `1.5px solid ${C.green}`,
            background: C.white,
            color: C.green,
            fontSize: ts(17),
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <span aria-hidden="true">✓</span>
          <span style={{ flex: 1, textAlign: meta.dir === "rtl" ? "right" : "left" }}>
            {t("hub.remindersAllDone")}
          </span>
          <span aria-hidden="true" style={{ color: C.textMuted }}>{expanded ? "▴" : "▾"}</span>
        </button>
        {expanded && (
          <div style={{ padding: "10px 6px 0" }}>
            {ordered.map((r) => (
              <div
                key={r.id}
                style={{ display: "flex", alignItems: "center", gap: 10, minHeight: A11Y.minTapTargetPx }}
              >
                <span aria-hidden="true">{r.emoji || "⏰"}</span>
                <span style={{ flex: 1, fontSize: ts(16), color: C.textMuted }}>{r.label}</span>
                <button
                  type="button"
                  onClick={() => untick(r)}
                  style={{
                    minHeight: A11Y.minTapTargetPx,
                    padding: "0 12px",
                    background: "none",
                    border: "none",
                    color: C.brown,
                    fontSize: ts(16),
                    fontFamily: "inherit",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  {t("hub.reminderUndo")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── One at a time ── */
  return (
    <section
      style={{
        background: C.white,
        border: `2px solid ${C.warmGray}`,
        borderRadius: 18,
        padding: "14px 18px",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h2
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(17),
            fontWeight: 700,
            color: C.brown,
            margin: "0 0 8px",
          }}
        >
          {t("hub.reminders")}
        </h2>
        {remaining.length > 1 && (
          <span style={{ fontSize: ts(15), color: C.textMuted }}>
            {t("hub.remindersLeft", { n: remaining.length })}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span aria-hidden="true" style={{ fontSize: ts(30) }}>{next.emoji || "⏰"}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700 }}>
            {next.label}
          </span>
          <span dir="ltr" style={{ display: "block", fontSize: ts(16), color: C.textMuted }}>
            {(next.remind_times || []).map(fmt).join(" · ")}
          </span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => tick(next)}
        disabled={busy}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          minHeight: 56,
          marginTop: 12,
          borderRadius: 50,
          border: "none",
          background: C.green,
          color: C.cream,
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: busy ? "default" : "pointer",
        }}
      >
        ✓ {t("hub.reminderDone")}
      </button>
    </section>
  );
}
