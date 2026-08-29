/* ════════════════════════════════════════════════
   Skills — data layer (migration 0012, public.skill_interest).

   Interest is the person's own row (RLS keys on profile_id =
   auth.uid()). Toggling on inserts, off deletes. Admin counts come
   from the skill_interest_counts() RPC, which returns aggregates only
   — never who is interested — and zero rows for non-admins.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

export async function fetchMyInterests() {
  const { data, error } = await supabase.from("skill_interest").select("skill");
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.skill);
}

export async function setInterest(profileId, skill, on) {
  if (on) {
    const { error } = await supabase
      .from("skill_interest")
      .insert({ profile_id: profileId, skill });
    // A double-tap that races can hit the unique constraint — that's the
    // desired end state (interested), so treat it as success.
    if (error && !/duplicate key|unique/i.test(error.message)) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("skill_interest")
      .delete()
      .eq("profile_id", profileId)
      .eq("skill", skill);
    if (error) throw new Error(error.message);
  }
}

export async function fetchCounts() {
  const { data, error } = await supabase.rpc("skill_interest_counts");
  if (error) throw new Error(error.message);
  // [{ skill, interested }] — bigint comes back as string; normalise.
  return Object.fromEntries((data || []).map((r) => [r.skill, Number(r.interested)]));
}
