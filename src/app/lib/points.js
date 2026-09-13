/* ════════════════════════════════════════════════
   Days and badges data layer, shared by the journey, milestones and
   anything that wants to say how long somebody has been here.

   POINTS ARE GONE. Nothing in the app awards or shows them any more.
   What is left is ONE headline number — days with Saathban, from
   my_days() (0140) — which counts every day anything was logged, never
   resets and never goes down, plus the badges, which mark firsts and
   presence. Nothing here can compare one person with another.
   ════════════════════════════════════════════════ */

import supabase from "./supabase.js";

export const ARC_TARGET_DAYS = 100; // the 100-day arc — lifetime, never resets

/* { days, logged_today, today, riddle_days_solved } for the caller.
   `today` is the person's LOCAL date as the server reckons it
   (profiles.timezone); `riddle_days_solved` is a cumulative count of
   days the riddle was solved, with no continuity implied. */
export async function fetchMyDays() {
  const { data, error } = await supabase.rpc("my_days");
  if (error) throw new Error(error.message);
  return data || { days: 0, logged_today: false, today: null, riddle_days_solved: 0 };
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
