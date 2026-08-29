/* ════════════════════════════════════════════════
   My journey — data layer. READ-ONLY over existing tables; no
   migration belongs to this lane.

   Everything queries the caller's OWN rows (icon_id = their id), so
   nothing here can ever show another person's record — and the trends
   in particular stay with the Icon alone regardless of any circle
   sharing permission, because sharing grants others access to THEIR
   queries, not to this page (SPEC: trends are more intimate than
   single days).
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

export { fetchMyProgress, fetchBadgeDefinitions, fetchMyEarnedBadges } from "../../lib/points.js";

/* Every log row in one calendar month, oldest first. */
export async function fetchMonthLogs(iconId, year, month /* 0-based */) {
  const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const last = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const { data, error } = await supabase
    .from("daily_logs")
    .select("log_date, module, payload, mood_value, is_backfilled")
    .eq("icon_id", iconId)
    .gte("log_date", first)
    .lte("log_date", last)
    .order("log_date");
  if (error) throw error;
  return data || [];
}

/* Group month rows by date → { 'YYYY-MM-DD': [rows] }. */
export function byDate(rows) {
  const out = {};
  for (const r of rows) (out[r.log_date] = out[r.log_date] || []).push(r);
  return out;
}

/* A day's at-a-glance facts for the calendar cell. */
export function dayGlance(rows) {
  const mood = rows.find((r) => r.module === "mood");
  const rest = rows.some((r) => r.module === "rest_day" && r.payload?.on !== false);
  const backfilled = rows.some((r) => r.is_backfilled);
  return { mood: mood?.payload?.choice ?? null, moodValue: mood?.mood_value ?? null, rest, backfilled, count: rows.length };
}

/* "10+" → 10, "7" → 7, anything unparseable → null. */
export function sleepHoursNumber(h) {
  const n = parseInt(String(h ?? "").replace("+", ""), 10);
  return Number.isFinite(n) ? n : null;
}

/* ── The longer view (auto-generated visuals) ──────────────────────
   Everything below reads the SAME own-rows-only query as the rest of
   this page: icon_id = the caller. Nothing here is shareable, and no
   figure is ever compared with another person's — these are one
   person's own patterns, drawn back to them. */

/* Every log row across the last N whole months (including this one),
   oldest first. One query; a year of one person's logs is small. */
export async function fetchRecentLogs(iconId, monthsBack = 6) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  const first = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  const { data, error } = await supabase
    .from("daily_logs")
    .select("log_date, module, payload, mood_value, is_backfilled")
    .eq("icon_id", iconId)
    .gte("log_date", first)
    .order("log_date");
  if (error) throw error;
  return data || [];
}

/* 'YYYY-MM' for a log_date string, without timezone surprises. */
export const monthKeyOf = (logDate) => String(logDate).slice(0, 7);

/* The last N month keys, oldest first, whether or not they hold data —
   a quiet month should still appear, as a quiet month. */
export function recentMonthKeys(monthsBack = 6) {
  const now = new Date();
  return Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/* Mood, month by month: the average of what was felt, plus how many
   days it rests on (so a single-day month can be shown as tentative
   rather than as a verdict). */
export function moodByMonth(rows, months) {
  const acc = Object.fromEntries(months.map((m) => [m, { sum: 0, days: 0 }]));
  for (const r of rows) {
    if (r.module !== "mood" || r.mood_value == null) continue;
    const k = monthKeyOf(r.log_date);
    if (!acc[k]) continue;
    acc[k].sum += r.mood_value;
    acc[k].days += 1;
  }
  return months.map((m) => ({
    month: m,
    days: acc[m].days,
    avg: acc[m].days ? acc[m].sum / acc[m].days : null,
  }));
}

/* One value per day for a numeric module, in date order. */
export function dailySeries(rows, module, valueOf) {
  return rows
    .filter((r) => r.module === module)
    .map((r) => ({ date: r.log_date, value: valueOf(r.payload || {}) }))
    .filter((d) => d.value != null && Number.isFinite(d.value));
}

/* Presence: how many modules were logged each day, and whether the day
   was marked a rest day. The heat view reads both. */
export function presenceByDay(rows) {
  const out = {};
  for (const r of rows) {
    const d = (out[r.log_date] = out[r.log_date] || { count: 0, rest: false });
    d.count += 1;
    if (r.module === "rest_day" && r.payload?.on !== false) d.rest = true;
  }
  return out;
}

/* Points earned per month (a flat 10 per log, rest days included) and
   the running total — participation only, never performance. */
export function pointsByMonth(rows, months, perLog = 10) {
  const acc = Object.fromEntries(months.map((m) => [m, 0]));
  for (const r of rows) {
    const k = monthKeyOf(r.log_date);
    if (k in acc) acc[k] += perLog;
  }
  let running = 0;
  return months.map((m) => {
    running += acc[m];
    return { month: m, earned: acc[m], total: running };
  });
}

/* Per-module summary for one month: how many days it was logged, and
   the module's own gentle statistic where it has one. */
export function moduleSummary(rows, monthKey) {
  const inMonth = rows.filter((r) => monthKeyOf(r.log_date) === monthKey);
  const byModule = {};
  for (const r of inMonth) (byModule[r.module] = byModule[r.module] || []).push(r);

  const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
  const out = [];
  for (const [module, list] of Object.entries(byModule)) {
    const days = new Set(list.map((r) => r.log_date)).size;
    let stat = null;
    if (module === "sleep") {
      const hours = list.map((r) => sleepHoursNumber(r.payload?.hours)).filter((h) => h != null);
      stat = { kind: "hours", value: avg(hours) };
    } else if (module === "water") {
      // Only days that actually carry a number. Counting a missing
      // value as zero would quietly drag the average down and
      // contradict the chart, which cannot plot a day with no value.
      const glasses = list
        .map((r) => r.payload?.glasses)
        .filter((g) => g != null && g !== "")
        .map(Number)
        .filter(Number.isFinite);
      stat = { kind: "glasses", value: avg(glasses) };
    } else if (module === "medication") {
      stat = { kind: "ticks", value: list.reduce((n, r) => n + (r.payload?.taken?.length || 0), 0) };
    } else if (module === "diet") {
      stat = { kind: "meals", value: list.reduce((n, r) => n + (r.payload?.meals?.length || 0), 0) };
    } else if (module === "mood") {
      const vals = list.map((r) => r.mood_value).filter((v) => v != null);
      stat = { kind: "mood", value: avg(vals) };
    }
    out.push({ module, days, stat });
  }
  return out.sort((a, b) => b.days - a.days);
}
