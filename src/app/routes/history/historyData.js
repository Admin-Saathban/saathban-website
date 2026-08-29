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
