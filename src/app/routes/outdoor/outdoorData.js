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
    // created_at is what "since 3:40" is made of (§12.4) — how long
    // someone has been somewhere, so a person knows whether they have
    // missed them.
    .select("id, place_id, profile_id, visibility, created_at, expires_at, ended_at")
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

/* §12's "Who can see it — My people / My area".

   The community writer builds the payload and does not know about
   audience, and that file belongs to another lane, so the choice is
   recorded here: create the happening, then write the audience onto
   the post the writer just returned.

   If that second write is refused the happening still stands — losing
   an invitation because a visibility flag would not save is the wrong
   trade — but the caller is told, so the control is never silently
   decorative. A switch that does nothing is worse than no switch. */
export async function startActivityHere(userId, { audience = "people", ...args } = {}) {
  const postId = await communityShareActivity(userId, args);
  if (!postId) return { postId: null, audienceSaved: false };

  /* MERGE, never replace. The writer normalises the payload (trimmed
     activity, place_id, starts_at, limit, rsvp) and announce_activity
     stamps `announced: true` onto it. Writing an object built from my
     own arguments would silently undo both — and the visible symptom
     would be an invitation announcing itself twice, days later, with
     nothing pointing back here. */
  const { data: row } = await supabase
    .from("community_posts")
    .select("payload")
    .eq("id", postId)
    .maybeSingle();
  const { error } = await supabase
    .from("community_posts")
    .update({ payload: { ...(row?.payload || {}), audience } })
    .eq("id", postId)
    .eq("author_id", userId);
  return { postId, audienceSaved: !error };
}
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

/* ── Access notes (OUT_AND_ABOUT_SPEC §4) ──

   Fetched for the whole visible list in one query and grouped here,
   rather than per place row: the list renders every place in a city
   at once, and a request per row is how a list of twenty places
   becomes twenty requests. */
export async function fetchAccessNotes() {
  const { data, error } = await supabase
    .from("outdoor_place_access")
    .select("place_id, feature")
    // 0065: a chip cannot say "probably". An unverified note is a
    // guess — mine, seeded for testing — and showing a guess in the
    // same green as a checked fact is the harm the spec names: if it
    // says "flat walk" and there are steps, somebody made a trip they
    // could not finish. So the public screens see confirmed notes
    // only, and an admin confirms them on the manage screen.
    .eq("verified", true);
  if (error) throw error;
  const byPlace = {};
  for (const r of data || []) (byPlace[r.place_id] ||= []).push(r.feature);
  return byPlace;
}

/* ── Admin side (§4.1: admin-seeded is what launches) ──
   Everything, verified or not, because the whole job of the admin
   screen is to see which is which and settle it. */
export async function fetchAllAccessNotes() {
  const { data, error } = await supabase
    .from("outdoor_place_access")
    .select("place_id, feature, verified, verified_at");
  if (error) throw error;
  const byPlace = {};
  for (const r of data || []) (byPlace[r.place_id] ||= []).push(r);
  return byPlace;
}

/* Add or remove one note. Admin-only at the database (0064), so a
   non-admin calling this is refused there rather than trusted here. */
export async function setAccessNote(placeId, feature, on, { verified = true } = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!on) {
    const { error } = await supabase
      .from("outdoor_place_access")
      .delete()
      .eq("place_id", placeId)
      .eq("feature", feature);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from("outdoor_place_access").upsert(
    {
      place_id: placeId,
      feature,
      noted_by: user?.id,
      verified,
      verified_by: verified ? user?.id : null,
      verified_at: verified ? new Date().toISOString() : null,
    },
    { onConflict: "place_id,feature" }
  );
  if (error) throw new Error(error.message);
}

/* Confirm a seeded guess without retyping it — the common action on
   the admin screen, since 0064 seeded a handful and every one of them
   is waiting on somebody actually looking. */
export async function confirmAccessNote(placeId, feature) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("outdoor_place_access")
    .update({ verified: true, verified_by: user?.id, verified_at: new Date().toISOString() })
    .eq("place_id", placeId)
    .eq("feature", feature);
  if (error) throw new Error(error.message);
}

/* "Something wrong here?" — §4 requires this whatever §4.1 decides
   about who writes the notes in the first place.

   It goes into community_reports, the queue admins already work,
   rather than a private table nobody opens. target_author_id is left
   null on purpose: a place has no author to answer for it, and the
   point is to correct a note, not to judge a person. */
export async function reportPlaceAccess(userId, place, note) {
  const { error } = await supabase.from("community_reports").insert({
    reporter_id: userId,
    target_kind: "place_access",
    target_id: place.id,
    target_excerpt: `${place.name}${place.area ? `, ${place.area}` : ""}`,
    reason: (note || "").trim().slice(0, 500) || null,
  });
  if (error) throw error;
}

/* ── §6: "Private — plus an option to NOTIFY CHOSEN FRIENDS, so the
      people who matter still hear about it." ──

   Private means the happening does not widen. It does not mean
   nobody is told. Without this, choosing the private option costs a
   person the two friends they actually wanted to invite, which is
   why they would stop choosing it.

   Sent through social_notify_kind rather than a plain insert so the
   recipient's §19 notification settings still decide (0058), so
   created_by is stamped (0101) and §6.1's "mute this person" works
   on it, and so the kind is carried for "mute this kind of thing". */
export async function notifyChosenFriends(ids, { title, body, link, kind = "outing" }) {
  if (!ids || ids.length === 0) return 0;
  let sent = 0;
  for (const id of ids) {
    const { error } = await supabase.rpc("social_notify_kind", {
      p_profile: id,
      p_title: title,
      p_body: body || null,
      p_link: link || null,
      p_kind: kind,
    });
    if (!error) sent++;
  }
  return sent;
}

/* The people a person could choose to tell: their circle and anyone
   they already have an accepted conversation with. Deliberately not
   "everyone nearby" — this list is for the handful who matter. */
export async function fetchMyPeople() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const me = user.id;
  const [{ data: circ }, { data: dms }] = await Promise.all([
    supabase.from("circle_members").select("icon_id, member_id").or(`icon_id.eq.${me},member_id.eq.${me}`),
    supabase.from("dm_requests").select("requester_id, recipient_id").eq("status", "accepted")
      .or(`requester_id.eq.${me},recipient_id.eq.${me}`),
  ]);
  const ids = new Set();
  (circ || []).forEach((c) => ids.add(c.icon_id === me ? c.member_id : c.icon_id));
  (dms || []).forEach((d) => ids.add(d.requester_id === me ? d.recipient_id : d.requester_id));
  ids.delete(me);
  const arr = [...ids];
  if (!arr.length) return [];
  const { data } = await supabase.from("safe_profiles").select("id, full_name").in("id", arr);
  return (data || []).map((p) => ({ id: p.id, name: p.full_name || "" }));
}
