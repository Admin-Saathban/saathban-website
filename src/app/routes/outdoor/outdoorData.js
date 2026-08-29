/* ════════════════════════════════════════════════
   Outdoor lane — every Supabase call in one place. RLS (0016) is the
   boundary: check-ins arrive only per their visibility choice and
   only while live; expired presence simply never comes back. Names
   resolve through safe_profiles and render as first names only.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

export async function canUseCommunity() {
  const { data, error } = await supabase.rpc("can_use_community");
  if (error) throw error;
  return !!data;
}

export async function fetchPlaces() {
  const { data, error } = await supabase
    .from("outdoor_places")
    .select("id, name, city, area, place_type")
    .order("city")
    .order("area")
    .order("name");
  if (error) throw error;
  return data || [];
}

/* Live check-ins the caller is allowed to see, across all places —
   used for the "n here now" counts on the list. RLS trims it. */
export async function fetchLiveCheckins() {
  const { data, error } = await supabase
    .from("outdoor_checkins")
    .select("id, place_id, profile_id, visibility, expires_at, ended_at")
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
  return data || [];
}

export async function myLiveCheckin(userId) {
  const { data, error } = await supabase
    .from("outdoor_checkins")
    .select("id, place_id, expires_at")
    .eq("profile_id", userId)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function checkIn(placeId, visibility) {
  const { data, error } = await supabase.rpc("outdoor_check_in", {
    p_place: placeId,
    p_visibility: visibility,
  });
  if (error) throw error;
  return data;
}

export async function leaveCheckin(checkinId) {
  const { error } = await supabase
    .from("outdoor_checkins")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", checkinId);
  if (error) throw error;
}

export async function fetchAuthors(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const { data, error } = await supabase
    .from("safe_profiles")
    .select("id, full_name")
    .in("id", unique);
  if (error) throw error;
  return Object.fromEntries((data || []).map((p) => [p.id, p.full_name]));
}

export async function fetchOutings(placeId) {
  const { data, error } = await supabase
    .from("outdoor_outings")
    .select("id, creator_id, starts_at, note, visibility")
    .eq("place_id", placeId)
    .is("canceled_at", null)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export async function createOuting(placeId, userId, startsAt, note, visibility) {
  const { error } = await supabase.from("outdoor_outings").insert({
    place_id: placeId,
    creator_id: userId,
    starts_at: startsAt,
    note: (note || "").trim() || null,
    visibility,
  });
  if (error) throw error;
}

export async function cancelOuting(outingId) {
  const { error } = await supabase
    .from("outdoor_outings")
    .update({ canceled_at: new Date().toISOString() })
    .eq("id", outingId);
  if (error) throw error;
}

export async function fetchBoard(placeId) {
  const { data, error } = await supabase
    .from("park_board_messages")
    .select("id, author_id, body, created_at")
    .eq("place_id", placeId)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function postToBoard(placeId, userId, body) {
  const { error } = await supabase
    .from("park_board_messages")
    .insert({ place_id: placeId, author_id: userId, body: body.trim() });
  if (error) throw error;
}

export async function reportBoardMessage(userId, message) {
  const { error } = await supabase.from("community_reports").insert({
    reporter_id: userId,
    target_kind: "park_board",
    target_id: message.id,
    target_author_id: message.author_id,
    target_excerpt: (message.body || "").slice(0, 500),
  });
  if (error) throw error;
}

export async function blockAuthor(userId, targetId) {
  const { error } = await supabase.from("user_blocks").upsert(
    { blocker_id: userId, blocked_id: targetId, kind: "block" },
    { onConflict: "blocker_id,blocked_id,kind", ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function unblockAuthor(userId, targetId) {
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", targetId)
    .eq("kind", "block");
  if (error) throw error;
}
