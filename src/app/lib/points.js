/* ════════════════════════════════════════════════
   Points & milestones data layer (migration 0017), shared by the
   milestones screens and anything that wants to show progress.

   Participation only, never performance: points are a flat 10 per log
   row (rest days included — resting counts), badges mark firsts and
   presence, and nothing here can compare one person with another.
   ════════════════════════════════════════════════ */

import supabase from "./supabase.js";

export const POINTS_PER_LOG = 10;
export const ARC_TARGET_DAYS = 100; // the 100-day arc — lifetime, never resets

/* { points, presence_days, current_streak, points_today, daily_cap }
   for the caller (0039 added the last two).

   points_today is what the server will actually credit today — the
   screen renders it rather than re-deriving the rule, so the number
   can never read higher than the record. daily_cap is for LOGIC only
   and is never displayed: a visible ceiling turns participation into
   a target, which is precisely what this scoring refuses to be
   (POINTS.md). */
export async function fetchMyProgress() {
  const { data, error } = await supabase.rpc("my_progress");
  if (error) throw new Error(error.message);
  return data || { points: 0, presence_days: 0, current_streak: 0, points_today: 0, daily_cap: 60 };
}

/* When the server figure is unavailable (offline, or the first paint
   before it lands), an honest local estimate of the SAME rule: one
   award per durable module, all of a day's trackers counting once,
   never above the cap. Never the old entries × 10, which counted
   each tracker separately and read higher than the truth. */
export function estimatePointsToday(entries, log, { cap = 60, isDone, durableModules } = {}) {
  const durable = durableModules ? new Set(durableModules) : null;
  let sources = 0;
  let anyTracker = false;
  for (const entry of entries) {
    if (!isDone(entry, log)) continue;
    if (entry.kind === "tracker") {
      anyTracker = true; // however many, they are one row and one award
      continue;
    }
    // Only entries that actually become a daily_logs row may count. A
    // UI-only module would put the old over-counting bug back, just at
    // first paint instead of always.
    if (durable && !durable.has(entry.id)) continue;
    sources += 1;
  }
  if (anyTracker) sources += 1;
  return Math.min(sources * POINTS_PER_LOG, cap);
}

/* All badge definitions, in display order. Content in EN + UR. */
export async function fetchBadgeDefinitions() {
  const { data, error } = await supabase.from("badges").select("*").order("sort");
  if (error) throw new Error(error.message);
  return data || [];
}

/* The caller's earned badges (RLS scopes rows to the owner). */
export async function fetchMyEarnedBadges() {
  const { data, error } = await supabase
    .from("earned_badges")
    .select("id, badge_key, earned_at, seen_at, message, message_at")
    .order("earned_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

/* Catch-up awarding for the caller (idempotent server-side; the DB
   triggers already award on new logs/posts). Returns new keys. */
export async function awardMyBadges() {
  const { data, error } = await supabase.rpc("award_my_badges");
  if (error) throw new Error(error.message);
  return data || [];
}

/* Mark one celebration as shown. Column-level grant on the server
   means seen_at is the ONLY field this can ever touch. */
export async function markBadgeSeen(earnedId) {
  const { error } = await supabase
    .from("earned_badges")
    .update({ seen_at: new Date().toISOString() })
    .eq("id", earnedId);
  if (error) throw new Error(error.message);
}

/* ─── Admin: the personalised milestone message ─── */

/* Recent awards across everyone (admin-only by RLS), with public names. */
export async function adminFetchRecentAwards(limit = 30) {
  const { data, error } = await supabase
    .from("earned_badges")
    .select("id, profile_id, badge_key, earned_at, message, message_at")
    .order("earned_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = data || [];
  const ids = [...new Set(rows.map((r) => r.profile_id))];
  let names = new Map();
  if (ids.length) {
    const { data: profiles, error: pErr } = await supabase
      .from("safe_profiles")
      .select("id, full_name")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    names = new Map((profiles || []).map((p) => [p.id, p]));
  }
  return rows.map((r) => ({ ...r, profile: names.get(r.profile_id) || null }));
}

/* Attach the human congratulation; lands as a 'milestone' notification. */
export async function adminAttachMilestoneMessage(earnedId, message) {
  const { data, error } = await supabase.rpc("attach_milestone_message", {
    p_earned: earnedId,
    p_message: message,
  });
  if (error) throw new Error(error.message);
  return data; // notification id
}
