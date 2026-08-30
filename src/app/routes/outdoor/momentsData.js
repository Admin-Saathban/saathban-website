/* ════════════════════════════════════════════════
   Moments — "I'm at X" (OUT_AND_ABOUT_SPEC §8)

   A person says where they are without creating a permanent place.
   §4.1's ruling makes places admin-seeded, so without this the only
   ways to say "I'm at the chai stall on the corner" would be to
   petition for a civic record of a chai stall, or to say nothing.

   The three windows — live, past, gone at 48 hours — are enforced in
   the row's read policy (0066), not here. What is here is only the
   reading and writing; if this file were wrong, the database would
   still refuse. That is the intended order.
   ════════════════════════════════════════════════ */

import { supabase } from "../../lib/supabase.js";

/* Live right now: in the tab, by the ordinary widening rules. */
export async function fetchLiveMoments() {
  const { data, error } = await supabase
    .from("outdoor_moments")
    .select("id, profile_id, label, visibility, created_at, expires_at")
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/* Over, but not yet gone. RLS already limits this to the author and
   the people who were there — the filter here is about which SHELF a
   row belongs on, never about who may see it. */
export async function fetchPastMoments() {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("outdoor_moments")
    .select("id, profile_id, label, created_at, expires_at, ended_at")
    .or(`ended_at.not.is.null,expires_at.lte.${nowIso}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function startMoment({ label, visibility = "connections" }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("outdoor_moments")
    .insert({ profile_id: user?.id, label: (label || "").trim(), visibility })
    .select("id, label, visibility, created_at, expires_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/* Ending early. Not a required step — a moment ends itself — which is
   the point of §5's rule that nobody has to remember to check out. */
export async function endMoment(id) {
  const { error } = await supabase
    .from("outdoor_moments")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/* "I'm here too." This is what makes a past moment visible to the
   people who were there — presence is the record, so it can only be
   claimed while the moment is still live (0066 enforces that). */
export async function joinMoment(momentId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("outdoor_moment_presence")
    .upsert({ moment_id: momentId, profile_id: user?.id }, { onConflict: "moment_id,profile_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function fetchMomentPresence(momentIds) {
  if (!momentIds || momentIds.length === 0) return {};
  const { data, error } = await supabase
    .from("outdoor_moment_presence")
    .select("moment_id, profile_id")
    .in("moment_id", momentIds);
  if (error) throw error;
  const byMoment = {};
  for (const r of data || []) (byMoment[r.moment_id] ||= []).push(r.profile_id);
  return byMoment;
}
