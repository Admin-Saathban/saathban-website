/* ════════════════════════════════════════════════
   The report chain — NAVIGATION_SPEC §7.

   "A person who reports something gets a report ID and can follow what
   happened to it. Silence after reporting a neighbour is its own
   discomfort."

   That discomfort is the whole point. Reporting somebody in a
   community of forty neighbours is not the anonymous act it is on a
   large platform — it is a thing you did about a person you will see
   at the park on Thursday. Getting no acknowledgement afterwards
   leaves you wondering whether it went anywhere, whether it was
   thought unreasonable, and whether they were told it was you. A
   reference and a status answer the first two. Nothing here answers
   the third, because nothing anywhere tells them.

   NO NEW TABLE, NO NEW POLICY. `community_reports` has carried
   `status`, `resolved_at` and `resolution_note` since 0014, and the
   policy "reports: reporter reads own" has always let the person who
   filed it read their own row back. The chain was already in the
   database; nothing in the app had ever shown it to them.

   WHAT IS DELIBERATELY NOT RETURNED: target_author_id. The reporter
   already knows who they reported, so it adds nothing here — and a
   list that pairs names with outcomes is a small dossier, which is not
   what a person asked for when they asked what happened.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

/* A short, sayable reference. The row's uuid is the real identity; a
   person reading it over the phone to a staffer needs something with
   fewer than eight syllables. Derived rather than stored, so it can
   never drift from the row it names. */
export function reportRef(id) {
  return String(id || "").replace(/-/g, "").slice(0, 6).toUpperCase();
}

export async function fetchMyReports(limit = 10) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("community_reports")
    .select("id, target_kind, target_excerpt, status, resolution_note, created_at, resolved_at")
    .eq("reporter_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
