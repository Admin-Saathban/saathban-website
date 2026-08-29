/* ════════════════════════════════════════════════
   "Suggest a gathering" — data layer (migration 0019).

   Submitting is a direct insert (RLS: an Icon in good standing writes
   their own pending proposal). Review is admin-only through the
   approve/decline RPCs, which create the credited event and notify the
   proposer atomically. Place options come from outdoor_places, which
   every community member (Icons included) may read.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

/* Places the Icon can pick from, grouped-friendly (city then name). */
export async function fetchPlaces() {
  const { data, error } = await supabase
    .from("outdoor_places")
    .select("id, name, city, area, place_type")
    .order("city", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

/* Icon submits a proposal. proposer_id must be the caller (RLS with-check). */
export async function submitProposal({ title, place_id, place_text, event_date, start_time, note }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("event_proposals").insert({
    proposer_id: user?.id,
    title: title.trim(),
    place_id: place_id || null,
    place_text: place_text?.trim() || null,
    event_date,
    start_time: start_time || null,
    note: note?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

/* Pending proposals for the admin queue, with the proposer's public
   name and the picked place resolved. RLS lets admins read all rows;
   the place embeds through its FK, the proposer name comes from
   safe_profiles (the only lawful source for another person's name). */
export async function adminFetchPendingProposals() {
  const { data, error } = await supabase
    .from("event_proposals")
    .select("id, title, place_text, event_date, start_time, note, created_at, proposer_id, place:outdoor_places(name, city, area)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data || [];
  const ids = [...new Set(rows.map((r) => r.proposer_id))];
  let names = new Map();
  if (ids.length) {
    const { data: profiles, error: pErr } = await supabase
      .from("safe_profiles")
      .select("id, full_name")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    names = new Map((profiles || []).map((p) => [p.id, p.full_name]));
  }
  return rows.map((r) => ({
    ...r,
    proposerName: names.get(r.proposer_id) || "A member",
    placeLabel: r.place
      ? [r.place.name, r.place.area, r.place.city].filter(Boolean).join(", ")
      : r.place_text || "",
  }));
}

export async function approveProposal(id) {
  const { error } = await supabase.rpc("approve_event_proposal", { p_proposal: id });
  if (error) throw new Error(error.message);
}

export async function declineProposal(id, message) {
  const { error } = await supabase.rpc("decline_event_proposal", {
    p_proposal: id,
    p_message: message,
  });
  if (error) throw new Error(error.message);
}

/* First name for the credit toast, from a full name. */
export function firstName(full) {
  return (full || "").trim().split(" ")[0] || full || "";
}
