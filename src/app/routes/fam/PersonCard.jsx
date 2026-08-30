/* ════════════════════════════════════════════════
   How someone is doing — a picture, not a paragraph.

   Replaces "3 daily logs so far today · last log at 4:52 PM", which
   told a Fam member almost nothing about the person they love.

   WHAT MAY BE SHOWN IS DECIDED AT THE DATABASE, NOT HERE. Every row
   comes back already filtered by the Icon's own grants: without
   can_see_mood the daily rows never arrive, without can_see_health the
   medicine row never arrives. So this component draws whatever it was
   given and NOTHING is added when a module is missing — an ungranted
   module is simply an absent chip, never a "you can't see this" line
   stacked in the middle of the card. The one quiet sentence at the
   foot says what isn't shared, once, and only when something isn't.

   TWO THINGS DELIBERATELY NOT SHOWN, because RLS says a Fam member may
   not have them and inventing a permission would be the wrong fix:
   - EARNED BADGES are owner-only (0017). The badge chips here come
     from what the person CHOSE to share to the community — the same
     lawful window famMoments uses. A badge nobody shared stays theirs.
   - EVENT RSVPs are closed to Fam entirely (verified against live RLS:
     zero rows). So there is no "next event" row. It is left out rather
     than faked from something adjacent.

   Never surveillance framing: no "compliance", no percentages, no
   missed-day counting. A quiet day is blank, not a gap to explain.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import supabase from "../../lib/supabase.js";
import { MOOD_BY_VALUE } from "./famCopy.js";
import { BodyText } from "./ui.jsx";

const DAY_MS = 86400000;
const isoOf = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/* Each module the log can carry, with the icon that stands for it and
   how to say what was recorded in as few words as possible. Order is
   the order they appear on the Icon's own log. */
const MODULES = [
  { key: "sleep", icon: "🌙", value: (r) => (r.payload?.hours != null ? `${r.payload.hours}h` : null) },
  { key: "water", icon: "💧", value: (r) => (r.payload?.glasses != null ? `${r.payload.glasses}` : r.payload?.ml != null ? `${r.payload.ml}ml` : null) },
  { key: "medication", icon: "💊", value: (r) => {
      const taken = (r.payload?.taken || []).length;
      const total = r.payload?.total ?? (r.payload?.items || []).length;
      return total ? `${taken}/${total}` : taken ? `${taken}` : null;
    } },
  { key: "exercise", icon: "🚶", value: (r) => (r.payload?.minutes != null ? `${r.payload.minutes}m` : null) },
  { key: "diet", icon: "🍲", value: (r) => {
      const n = (r.payload?.items || r.payload?.meals || []).length;
      return n ? `${n}` : null;
    } },
];

function Chip({ icon, label, value, done, ts }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: 38,
        padding: "0 12px",
        borderRadius: 50,
        background: done ? C.white : "transparent",
        border: `1.5px ${done ? "solid" : "dashed"} ${done ? C.green : C.warmGray}`,
        color: done ? C.textMain : C.textMuted,
        fontSize: ts(16),
        fontWeight: done ? 700 : 500,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: ts(18) }}>{icon}</span>
      <span>{label}</span>
      {done && value && <span style={{ color: C.green, fontWeight: 800 }}>{value}</span>}
      {/* Done-ness is a word for a screen reader, never the tick alone. */}
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {done ? "✓" : ""}
      </span>
    </span>
  );
}

export default function PersonCard({ view, permissions: p }) {
  const { t, ts, meta, lang } = useI18n();
  const [week, setWeek] = useState(null);
  const [nextReminder, setNextReminder] = useState(null);

  const rows = view.todayRows || [];
  const iconId = view.iconId;
  const first = (view.name || "").split(" ")[0];

  useEffect(() => {
    if (!iconId || !p.seeDailyLogs) return undefined;
    let alive = true;
    (async () => {
      const since = isoOf(new Date(Date.now() - 6 * DAY_MS));
      const { data } = await supabase
        .from("daily_logs")
        .select("log_date, module, mood_value")
        .eq("icon_id", iconId)
        .gte("log_date", since)
        .order("log_date", { ascending: true });
      if (alive) setWeek(data || []);
    })();
    return () => { alive = false; };
  }, [iconId, p.seeDailyLogs]);

  useEffect(() => {
    if (!iconId || !p.manageReminders) return undefined;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("reminders")
        .select("label, emoji, remind_times")
        .eq("icon_id", iconId);
      if (!alive || !data?.length) return;
      // The next one due today, else the first of tomorrow.
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      let best = null;
      for (const r of data) {
        for (const hms of r.remind_times || []) {
          const [h, m] = String(hms).split(":").map(Number);
          const at = h * 60 + m;
          const delta = at >= mins ? at - mins : at - mins + 1440;
          if (!best || delta < best.delta) best = { delta, at, r };
        }
      }
      if (best) {
        const d = new Date();
        d.setHours(Math.floor(best.at / 60), best.at % 60, 0, 0);
        setNextReminder({
          label: best.r.label,
          emoji: best.r.emoji,
          when: d.toLocaleTimeString(meta.dir === "rtl" ? "ur-PK" : "en-GB", { hour: "numeric", minute: "2-digit" }),
          tomorrow: best.delta > 0 && best.at < mins,
        });
      }
    })();
    return () => { alive = false; };
  }, [iconId, p.manageReminders, meta.dir]);

  const moodRow = rows.find((r) => r.module === "mood");
  const mood = moodRow ? MOOD_BY_VALUE[moodRow.mood_value] : null;

  /* Which modules to show at all: the ones this person actually keeps.
     A module they never log is not a hole in the card. */
  const present = MODULES.filter((mod) => {
    if (mod.key === "medication" && !p.seeHealth) return false;
    if (mod.key !== "medication" && !p.seeDailyLogs) return false;
    return rows.some((r) => r.module === mod.key) || (week || []).some((r) => r.module === mod.key);
  });

  /* Days in a row with anything logged, counted back from today —
     warmly, and only when there is something to be warm about. */
  const streak = (() => {
    if (!week) return 0;
    const days = new Set(week.map((r) => r.log_date));
    let n = 0;
    for (let i = 0; i < 7; i++) {
      if (days.has(isoOf(new Date(Date.now() - i * DAY_MS)))) n += 1;
      else if (i > 0) break;
    }
    return n;
  })();

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * DAY_MS);
    const iso = isoOf(d);
    const dayMood = (week || []).find((r) => r.log_date === iso && r.module === "mood");
    return {
      iso,
      letter: d.toLocaleDateString(meta.dir === "rtl" ? "ur-PK" : "en-GB", { weekday: "narrow" }),
      face: dayMood ? MOOD_BY_VALUE[dayMood.mood_value]?.face : null,
      isToday: i === 6,
    };
  });

  const badges = (view.moments || []).filter((m) => m.post_type === "badge").slice(0, 3);

  /* One quiet line, once, at the foot — never three sentences stacked
     through the card. Says only what is closed, and only if something is. */
  const closed = [
    !p.seeDailyLogs && t("fam.card.closedDaily"),
    !p.seeHealth && t("fam.card.closedHealth"),
    p.location !== "sos_only" && t("fam.card.closedLocation"),
  ].filter(Boolean);

  return (
    <>
      {/* ── Today at a glance ── */}
      {p.seeDailyLogs && (
        <div style={{ background: C.cream, borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: present.length ? 12 : 0 }}>
            <span aria-hidden="true" style={{ fontSize: ts(40), lineHeight: 1 }}>
              {mood ? mood.face : "🕊️"}
            </span>
            <span>
              <span style={{ display: "block", fontSize: ts(22), fontWeight: 800, color: C.textMain }}>
                {mood ? t(mood.labelKey) : t("fam.card.quietSoFar")}
              </span>
              {streak > 1 && (
                <span style={{ display: "block", fontSize: ts(16), color: C.green, fontWeight: 700 }}>
                  {t("fam.card.streak", { n: streak })}
                </span>
              )}
            </span>
          </div>

          {present.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {present.map((mod) => {
                const row = rows.find((r) => r.module === mod.key);
                return (
                  <Chip
                    key={mod.key}
                    icon={mod.icon}
                    label={t(`settings.dailyLog.modules.${mod.key}`)}
                    value={row ? mod.value(row) : null}
                    done={Boolean(row)}
                    ts={ts}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── The last seven days. A quiet day is blank, not a failure. ── */}
      {p.seeDailyLogs && week && (
        <div
          role="img"
          aria-label={t("fam.card.weekLabel", { name: first })}
          style={{ display: "flex", justifyContent: "space-between", gap: 4, marginBottom: 12 }}
        >
          {weekDays.map((d) => (
            <span key={d.iso} style={{ textAlign: "center", flex: 1 }}>
              <span
                style={{
                  display: "block",
                  fontSize: ts(20),
                  lineHeight: 1.5,
                  opacity: d.face ? 1 : 0.35,
                }}
                aria-hidden="true"
              >
                {d.face || "·"}
              </span>
              <span style={{ display: "block", fontSize: ts(13), color: d.isToday ? C.green : C.textMuted, fontWeight: d.isToday ? 800 : 500 }}>
                {d.letter}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* ── What they chose to celebrate ── */}
      {badges.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {badges.map((b) => (
            <span
              key={b.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minHeight: 34,
                padding: "0 12px",
                borderRadius: 50,
                background: C.white,
                border: `1.5px solid ${C.olive}`,
                fontSize: ts(15),
                fontWeight: 700,
              }}
            >
              <span aria-hidden="true">{b.payload?.emoji || "🏅"}</span>
              {(lang === "ur" ? b.payload?.name_ur : b.payload?.name_en) || b.payload?.name_en}
            </span>
          ))}
        </div>
      )}

      {/* ── The next nudge in their day ── */}
      {nextReminder && (
        <BodyText muted style={{ margin: "0 0 12px", fontSize: ts(16) }}>
          <span aria-hidden="true">{nextReminder.emoji || "⏰"}</span>{" "}
          {t(nextReminder.tomorrow ? "fam.card.nextReminderTomorrow" : "fam.card.nextReminder", {
            label: nextReminder.label,
            time: nextReminder.when,
          })}
        </BodyText>
      )}

      {/* ── One quiet line, at the foot, only if something is closed ── */}
      {closed.length > 0 && (
        <BodyText muted style={{ margin: 0, fontSize: ts(15) }}>
          {t("fam.card.closedFoot", { name: first, what: closed.join(t("fam.card.closedJoin")) })}
        </BodyText>
      )}
    </>
  );
}
