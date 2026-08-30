/* ════════════════════════════════════════════════
   Outdoor lane — every Supabase call in one place. RLS (0016) is the
   boundary: check-ins arrive only per their visibility choice and
   only while live; expired presence simply never comes back. Names
   resolve through safe_profiles and render as first names only.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";
// "Who's up for…" writes delegate to the community lane's own store so
// there is exactly ONE authority for the activity payload shape
// (0027/0028: payload.activity/place_id/place_name/starts_at/limit/rsvp;
// a timed+placed activity also mirrors an outing row, linked by ref_id).
import {
  shareActivity as communityShareActivity,
  joinActivity as communityJoinActivity,
} from "../community/communityData.js";

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
/* Add a place. Only an Icon may (0047), and only as themselves: the
   INSERT policy checks created_by = auth.uid(), so passing anyone
   else's id is refused at the database rather than trusted here. New
   places are visible to everyone immediately — no approval queue. */
export async function addPlace({ name, area, city, placeType, lat = null, lng = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("outdoor_places")
    .insert({
      name,
      area,
      city,
      place_type: placeType,
      lat,
      lng,
      created_by: user?.id,
    })
    .select("id, name, city, area, place_type, created_by")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

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

/* All upcoming outings across every place — the list's happening
   badges. RLS trims to what this viewer may see, so counts stay
   personal exactly like the here-now counts. */
export async function fetchUpcomingOutingsAll() {
  const { data, error } = await supabase
    .from("outdoor_outings")
    .select("id, place_id, starts_at")
    .is("canceled_at", null)
    .gt("starts_at", new Date().toISOString());
  if (error) throw error;
  return data || [];
}

/* "Who's up for…" posts linked to any place (0027). Read-only here;
   the payload keys come from the community writer above. */
export async function fetchPlacedActivities() {
  const { data, error } = await supabase
    .from("community_posts")
    .select("id, author_id, post_type, ref_id, payload, created_at")
    .in("post_type", ["walk", "activity"])
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []).filter((p) => p.payload && p.payload.place_id);
}

/* "Today's / upcoming": a timed activity counts until it starts (and a
   grace hour after); a timeless "who's up for chai?" counts for 24h
   from posting — an open invitation is a today-happening. */
export function activityIsCurrent(post, now = Date.now()) {
  const s = post.payload?.starts_at;
  if (s) {
    const t = new Date(s).getTime();
    return t > now - 60 * 60 * 1000;
  }
  return new Date(post.created_at).getTime() > now - 24 * 60 * 60 * 1000;
}

/* Join counts + whether I'm among them, for a set of activity posts.
   post_joins is community-readable (0027), so counts are honest. */
export async function fetchActivityJoins(postIds, myId) {
  if (!postIds.length) return { counts: {}, mine: new Set() };
  const { data, error } = await supabase
    .from("post_joins")
    .select("post_id, profile_id")
    .in("post_id", postIds);
  if (error) throw error;
  const counts = {};
  const mine = new Set();
  for (const j of data || []) {
    counts[j.post_id] = (counts[j.post_id] || 0) + 1;
    if (j.profile_id === myId) mine.add(j.post_id);
  }
  return { counts, mine };
}

/* A timed+placed activity also creates a mirror outing row, linked by
   the post's ref_id (0028). Drop the mirrors so one plan never counts
   or lists twice. */
export function dropMirroredOutings(outings, activities) {
  const mirrored = new Set(activities.map((p) => p.ref_id).filter(Boolean));
  return outings.filter((o) => !mirrored.has(o.id));
}

export const startActivityHere = (userId, args) => communityShareActivity(userId, args);
export const joinPlacedActivity = (postId) => communityJoinActivity(postId);

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
