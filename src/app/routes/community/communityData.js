/* ════════════════════════════════════════════════
   Community lane — every Supabase call, in one place.

   RLS (migration 0014) is the boundary for all of it: these helpers
   never filter for permission themselves — a row the caller shouldn't
   see simply never arrives, and a write they may not make fails.
   Author names come from safe_profiles (never the full profiles row).
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

const BUCKET = "community-images";

/* ─── Access ─── */

export async function canUseCommunity() {
  const { data, error } = await supabase.rpc("can_use_community");
  if (error) throw error;
  return !!data;
}

export async function canPostCommunity() {
  const { data, error } = await supabase.rpc("can_post_community");
  if (error) throw error;
  return !!data;
}

/* ─── Author display: one safe_profiles fetch per id set ─── */

export async function fetchAuthors(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const { data, error } = await supabase
    .from("safe_profiles")
    .select("id, full_name, role, is_org")
    .in("id", unique);
  if (error) throw error;
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
}

/* ─── Feed ─── */

export async function fetchFeed(limit = 50) {
  const { data, error } = await supabase
    .from("community_posts")
    .select("id, author_id, body, image_path, post_type, ref_id, payload, created_at")
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export function imageUrl(path) {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function createPost(userId, body, file) {
  let image_path = null;
  if (file) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    image_path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(image_path, file, { contentType: file.type });
    if (upErr) throw upErr;
  }
  const { error } = await supabase
    .from("community_posts")
    .insert({ author_id: userId, body: body.trim(), image_path });
  if (error) throw error;
}

export async function deleteOwnPost(postId) {
  const { error } = await supabase.from("community_posts").delete().eq("id", postId);
  if (error) throw error;
}

/* ─── Reactions: one per person per post ─── */

export async function fetchReactions(postIds) {
  if (postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("post_reactions")
    .select("post_id, profile_id, emoji")
    .in("post_id", postIds);
  if (error) throw error;
  return data || [];
}

export async function setReaction(postId, userId, emoji) {
  const { error } = await supabase
    .from("post_reactions")
    .upsert(
      { post_id: postId, profile_id: userId, emoji },
      { onConflict: "post_id,profile_id" }
    );
  if (error) throw error;
}

export async function clearReaction(postId, userId) {
  const { error } = await supabase
    .from("post_reactions")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", userId);
  if (error) throw error;
}

/* ─── Comments ─── */

export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from("post_comments")
    .select("id, author_id, body, created_at")
    .eq("post_id", postId)
    .is("hidden_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addComment(postId, userId, body) {
  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, author_id: userId, body: body.trim() });
  if (error) throw error;
}

/* ─── Report / block / mute ─── */

export async function fileReport(userId, kind, targetId, targetAuthorId, excerpt, reason) {
  const { error } = await supabase.from("community_reports").insert({
    reporter_id: userId,
    target_kind: kind,
    target_id: targetId,
    target_author_id: targetAuthorId,
    target_excerpt: (excerpt || "").slice(0, 500),
    reason: (reason || "").slice(0, 500) || null,
  });
  if (error) throw error;
}

export async function blockOrMute(userId, targetId, kind) {
  const { error } = await supabase
    .from("user_blocks")
    .upsert(
      { blocker_id: userId, blocked_id: targetId, kind },
      { onConflict: "blocker_id,blocked_id,kind", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function unblock(userId, targetId, kind) {
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", targetId)
    .eq("kind", kind);
  if (error) throw error;
}

/* ─── Shares (migration 0018) ───
   A share is a post with a type and a payload SNAPSHOT taken at share
   time — the card renders from the snapshot (localized at view time),
   so it stays visible even when the referenced row isn't. */

export async function createShare(userId, type, refId, payload, body = "") {
  const { error } = await supabase.from("community_posts").insert({
    author_id: userId,
    body,
    post_type: type,
    ref_id: refId,
    payload,
  });
  if (error) throw error;
}

export async function fetchPlacesLite() {
  const { data, error } = await supabase
    .from("outdoor_places")
    .select("id, name, city")
    .order("city")
    .order("name");
  if (error) throw error;
  return data || [];
}

/* "Who's up for a walk?": one action creates BOTH the planned outing
   (announced to the park board — a walk you're inviting neighbours to
   is public by intent) and the community post that points at it. */
export async function shareWalk(userId, place, startsAtIso, note) {
  const { data, error } = await supabase
    .from("outdoor_outings")
    .insert({
      place_id: place.id,
      creator_id: userId,
      starts_at: startsAtIso,
      note: (note || "").trim() || null,
      visibility: "board",
    })
    .select("id")
    .single();
  if (error) throw error;
  await createShare(userId, "walk", data.id, {
    place_id: place.id,
    place_name: place.name,
    starts_at: startsAtIso,
    note: (note || "").trim() || null,
  });
}

/* Join = the viewer's OWN outing row for the same place and time,
   through the ordinary 0016 policies (Icons only — RLS refuses the
   rest, so the button is only shown to Icons). */
export async function joinWalk(userId, post) {
  const { error } = await supabase.from("outdoor_outings").insert({
    place_id: post.payload.place_id,
    creator_id: userId,
    starts_at: post.payload.starts_at,
    visibility: "board",
  });
  if (error) throw error;
}

/* The viewer's circle connections, both directions — the Friends tab
   filter. RLS on circle_members already scopes rows to memberships
   the caller is part of. */
export async function fetchConnections(userId) {
  const { data, error } = await supabase
    .from("circle_members")
    .select("icon_id, member_id")
    .or(`icon_id.eq.${userId},member_id.eq.${userId}`);
  if (error) throw error;
  return new Set(
    (data || []).map((r) => (r.icon_id === userId ? r.member_id : r.icon_id))
  );
}

/* ─── DMs ─── */

export async function sendDmRequest(recipientId) {
  const { data, error } = await supabase.rpc("send_dm_request", {
    p_recipient: recipientId,
  });
  if (error) throw error;
  return data;
}

export async function fetchDmOverview(userId) {
  const { data, error } = await supabase
    .from("dm_requests")
    .select("id, requester_id, recipient_id, status, created_at")
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  return {
    incoming: rows.filter((r) => r.recipient_id === userId && r.status === "pending"),
    outgoing: rows.filter((r) => r.requester_id === userId && r.status === "pending"),
    threads: rows.filter((r) => r.status === "accepted"),
  };
}

export async function respondToRequest(requestId, status) {
  const { error } = await supabase
    .from("dm_requests")
    .update({ status })
    .eq("id", requestId);
  if (error) throw error;
}

export async function fetchThread(requestId) {
  const [{ data: req, error: reqErr }, { data: msgs, error: msgErr }] = await Promise.all([
    supabase
      .from("dm_requests")
      .select("id, requester_id, recipient_id, status")
      .eq("id", requestId)
      .maybeSingle(),
    supabase
      .from("dm_messages")
      .select("id, sender_id, body, created_at, read_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true }),
  ]);
  if (reqErr) throw reqErr;
  if (msgErr) throw msgErr;
  return { request: req, messages: msgs || [] };
}

export async function sendMessage(requestId, userId, body) {
  const { error } = await supabase
    .from("dm_messages")
    .insert({ request_id: requestId, sender_id: userId, body: body.trim() });
  if (error) throw error;
}

export async function markThreadRead(requestId, userId) {
  // Best-effort; unread state is a nicety, not a guarantee.
  await supabase
    .from("dm_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .neq("sender_id", userId)
    .is("read_at", null);
}
