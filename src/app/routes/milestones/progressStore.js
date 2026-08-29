/* Per-badge progress (0034 milestone_progress): the caller's own counts
   against each badge's target, computed by the same rules that award.
   Self-referential only — never another person's numbers. */

import supabase from "../../lib/supabase.js";

export async function fetchMilestoneProgress() {
  const { data, error } = await supabase.rpc("milestone_progress");
  if (error) throw new Error(error.message);
  return data || {};
}
