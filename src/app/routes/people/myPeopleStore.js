/* ════════════════════════════════════════════════
   My People (unified surface) — list, presence, moments, requests,
   action helpers. Separate from peopleStore.js (the thread/data file
   the integration session owns this round) to avoid a mid-flight
   collision; the two can merge later.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";
/* The deduped list: circle + friends + shared groups, one row per
   person, recency-sorted. Safe fields + chips only (0029). */
export async function fetchMyPeople() {
  const { data, error } = await supabase.rpc("my_people");
  if (error) throw new Error(error.message);
  return data || [];
}

/* Shared moments: what this person chose to post to the community —
   the 0014/0018 read policies are the law (visible, not hidden, not
   blocked; badge/score/walk payloads are snapshots they shared). */
export async function fetchPersonMoments(profileId, limit = 3) {
  const { data, error } = await supabase
    .from("community_posts")
    .select("id, post_type, body, payload, created_at")
    .eq("author_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

/* Presence, strictly within existing visibility rules:
   - a live check-in ONLY if the 0016 policy already shows it to me
     (board visibility, or connections and I'm in their circle);
   - "in a game" ONLY if we share a session I can already view
     (participant/invitee — can_view_game is the policy).
   Anything RLS hides is simply absent. */
export async function fetchPersonPresence(profileId) {
  const [checkin, seats] = await Promise.all([
    supabase
      .from("outdoor_checkins")
      .select("place:outdoor_places(name)")
      .eq("profile_id", profileId)
      .is("ended_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data)
      .catch(() => null),
    supabase
      .from("game_seats")
      .select("session_id, session:game_sessions(status, game_key)")
      .eq("profile_id", profileId)
      .then(({ data }) => data || [])
      .catch(() => []),
  ]);
  const live = (seats || []).find((s) => s.session?.status === "active");
  return {
    checkinPlace: checkin?.place?.name || null,
    inGame: live ? { sessionId: live.session_id, gameKey: live.session.game_key } : null,
  };
}

/* ─── Requests (the unified inbox; friend_requests 0027) ─── */

export async function fetchRequests(myId) {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, requester_id, recipient_id, status, created_at")
    .or(`requester_id.eq.${myId},recipient_id.eq.${myId}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data || [];
  const ids = [...new Set(rows.flatMap((r) => [r.requester_id, r.recipient_id]))];
  let names = new Map();
  if (ids.length) {
    const { data: ps } = await supabase
      .from("safe_profiles").select("id, full_name, city").in("id", ids);
    names = new Map((ps || []).map((p) => [p.id, p]));
  }
  return rows.map((r) => ({
    ...r,
    otherId: r.requester_id === myId ? r.recipient_id : r.requester_id,
    incoming: r.recipient_id === myId,
    person: names.get(r.requester_id === myId ? r.recipient_id : r.requester_id) || null,
  }));
}

export async function respondRequest(requestId, accept) {
  const { error } = await supabase.rpc("respond_friend_request", {
    p_request: requestId,
    p_accept: accept,
  });
  if (error) throw new Error(error.message);
}

/* ─── Actions ─── */

/* Groups I belong to (invite targets — any member may invite, 0026). */
export async function fetchMyGroupsLite(myId) {
  const { data, error } = await supabase
    .from("group_members").select("group_id").eq("member_id", myId);
  if (error) throw new Error(error.message);
  const ids = (data || []).map((r) => r.group_id);
  if (!ids.length) return [];
  const { data: gs, error: e2 } = await supabase
    .from("groups").select("id, name").in("id", ids).order("name");
  if (e2) throw new Error(e2.message);
  return gs || [];
}

export async function inviteToGroup(groupId, inviteeId) {
  const { error } = await supabase.rpc("invite_to_group", {
    p_group: groupId,
    p_invitee: inviteeId,
  });
  if (error) throw new Error(error.message);
}

/* Block — one write, felt everywhere: the same user_blocks row every
   surface consults (caller_hides in feeds/lists, dm_open closes the
   thread both ways). Silent to the blocked person, per convention. */
export async function blockPerson(myId, targetId) {
  const { error } = await supabase.from("user_blocks").insert({
    blocker_id: myId,
    blocked_id: targetId,
    kind: "block",
  });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
}

/* ════════════════════════════════════════════════
   Chat depth (0034): reply-to, delete-for-me, delete-for-everyone,
   private per-thread photos. RLS + the definer RPC are the boundary.
   ════════════════════════════════════════════════ */

const DM_BUCKET = "dm-images";

/* The thread with everything the deep view needs, minus what I hid. */
export async function fetchThreadDeep(requestId, myId) {
  const [{ data: req, error: reqErr }, { data: msgs, error: msgErr }, { data: hides }] =
    await Promise.all([
      supabase.from("dm_requests").select("id, requester_id, recipient_id, status").eq("id", requestId).maybeSingle(),
      supabase
        .from("dm_messages")
        .select("id, sender_id, body, game_session_id, reply_to_id, deleted_at, image_path, created_at, read_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true }),
      supabase.from("dm_message_hides").select("message_id").eq("profile_id", myId),
    ]);
  if (reqErr) throw new Error(reqErr.message);
  if (msgErr) throw new Error(msgErr.message);
  const hidden = new Set((hides || []).map((h) => h.message_id));
  return { request: req, messages: (msgs || []).filter((m) => !hidden.has(m.id)) };
}

export async function sendDeep(requestId, myId, { body = null, replyToId = null, imagePath = null, gameSessionId = null } = {}) {
  const text = (body || "").trim() || null;
  if (!text && !imagePath && !gameSessionId) return;
  const { error } = await supabase.from("dm_messages").insert({
    request_id: requestId,
    sender_id: myId,
    body: text,
    reply_to_id: replyToId,
    image_path: imagePath,
    game_session_id: gameSessionId,
  });
  if (error) throw new Error(error.message);
}

/* Delete for me — a per-person hide; nobody else notices. */
export async function hideMessageForMe(messageId, myId) {
  const { error } = await supabase.from("dm_message_hides").insert({ message_id: messageId, profile_id: myId });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
}

/* Delete for everyone — sender, within 15 minutes; server enforces. */
export async function deleteMessageForEveryone(messageId) {
  const { error } = await supabase.rpc("delete_dm_message", { p_message: messageId });
  if (error) throw new Error(error.message);
}

export const DELETE_WINDOW_MS = 15 * 60 * 1000;
export function canDeleteForEveryone(m, myId) {
  return m.sender_id === myId && !m.deleted_at && Date.now() - new Date(m.created_at).getTime() < DELETE_WINDOW_MS;
}

/* Upload a photo into this thread's private folder; returns the path. */
export async function uploadChatImage(requestId, file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("bad-type");
  if (file.size > 5 * 1024 * 1024) throw new Error("too-big");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${requestId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(DM_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/* Private bucket → short-lived signed URLs, cached per path. */
const urlCache = new Map();
export async function chatImageUrl(path) {
  const hit = urlCache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(DM_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
