/* ════════════════════════════════════════════════
   Friend groups — data layer (migration 0026).

   RLS is the boundary throughout: membership helpers gate every read,
   writes to posts/chat are member-only policies, and lifecycle
   (create/invite/respond/remove/leave) goes through SECURITY DEFINER
   RPCs. Names come from safe_profiles (the only lawful source for
   another person's name), fetched and merged in a second query.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

async function myId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id;
}

async function namesFor(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return {};
  const { data } = await supabase.from("safe_profiles").select("id, full_name, city").in("id", unique);
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
}

/* Groups I'm a member of, newest first, with my role. */
export async function fetchMyGroups() {
  const me = await myId();
  const { data: mine, error } = await supabase
    .from("group_members").select("group_id, role").eq("member_id", me);
  if (error) throw new Error(error.message);
  const ids = (mine || []).map((m) => m.group_id);
  if (!ids.length) return [];
  const roleBy = Object.fromEntries((mine || []).map((m) => [m.group_id, m.role]));
  const { data: groups, error: e2 } = await supabase
    .from("groups").select("id, name, description, created_by, created_at").in("id", ids)
    .order("created_at", { ascending: false });
  if (e2) throw new Error(e2.message);
  return (groups || []).map((g) => ({ ...g, myRole: roleBy[g.id], isCreator: roleBy[g.id] === "creator" }));
}

/* Pending group invitations addressed to me. */
export async function fetchMyGroupInvites() {
  const me = await myId();
  const { data, error } = await supabase
    .from("group_invites").select("id, group_id, inviter_id, created_at")
    .eq("invitee_id", me).eq("status", "pending");
  if (error) throw new Error(error.message);
  const rows = data || [];
  if (!rows.length) return [];
  const [{ data: groups }, names] = await Promise.all([
    supabase.from("groups").select("id, name").in("id", rows.map((r) => r.group_id)),
    namesFor(rows.map((r) => r.inviter_id)),
  ]);
  const gname = Object.fromEntries((groups || []).map((g) => [g.id, g.name]));
  return rows.map((r) => ({
    ...r,
    groupName: gname[r.group_id] || "A group",
    inviterName: names[r.inviter_id]?.full_name || "A friend",
  }));
}

/* privacy is passed explicitly: 0063 made it the third argument and
   dropped the two-argument signature, because a defaulted parameter
   would have left two overloads that both match a two-argument call
   and PostgREST refuses that as not unique (the 0049 trap). */
export async function createGroup(name, description, privacy) {
  const { data, error } = await supabase.rpc("create_group", {
    p_name: name,
    p_description: description || null,
    p_privacy: privacy === "anyone" ? "anyone" : "invite_only",
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function respondInvite(inviteId, accept) {
  const { data, error } = await supabase.rpc("respond_group_invite", { p_invite: inviteId, p_accept: accept });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchGroup(id) {
  const { data, error } = await supabase
    .from("groups").select("id, name, description, created_by, created_at").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchMembers(groupId) {
  const { data, error } = await supabase
    .from("group_members").select("member_id, role, joined_at").eq("group_id", groupId)
    .order("joined_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data || [];
  const names = await namesFor(rows.map((r) => r.member_id));
  return rows.map((r) => ({ ...r, person: names[r.member_id] || null }));
}

export async function fetchPosts(groupId) {
  const { data, error } = await supabase
    .from("group_posts").select("id, author_id, body, created_at, pinned_at").eq("group_id", groupId)
    // Pinned first, then newest. Ordering it here rather than sorting
    // in the screen means every reader of this function gets the
    // welcome post at the top, which is the whole point of section 8:
    // a group whose pinned post says who we are and when we meet is
    // the difference between one that survives and one that dies.
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data || [];
  const names = await namesFor(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, authorName: names[r.author_id]?.full_name || "A member" }));
}

export async function addPost(groupId, body) {
  const me = await myId();
  const { error } = await supabase.from("group_posts").insert({ group_id: groupId, author_id: me, body: body.trim() });
  if (error) throw new Error(error.message);
}

export async function fetchMessages(groupId) {
  const { data, error } = await supabase
    .from("group_messages").select("id, sender_id, body, created_at").eq("group_id", groupId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data || [];
  const names = await namesFor(rows.map((r) => r.sender_id));
  return rows.map((r) => ({ ...r, senderName: names[r.sender_id]?.full_name || "A member" }));
}

export async function sendMessage(groupId, body) {
  const me = await myId();
  const { error } = await supabase.from("group_messages").insert({ group_id: groupId, sender_id: me, body: body.trim() });
  if (error) throw new Error(error.message);
}

/* People I can invite: my circle members + community friends (accepted DMs). */
export async function fetchConnections() {
  const me = await myId();
  const [{ data: circ }, { data: dms }] = await Promise.all([
    supabase.from("circle_members").select("icon_id, member_id").or(`icon_id.eq.${me},member_id.eq.${me}`),
    supabase.from("dm_requests").select("requester_id, recipient_id").eq("status", "accepted").or(`requester_id.eq.${me},recipient_id.eq.${me}`),
  ]);
  const ids = new Set();
  (circ || []).forEach((c) => ids.add(c.icon_id === me ? c.member_id : c.icon_id));
  (dms || []).forEach((d) => ids.add(d.requester_id === me ? d.recipient_id : d.requester_id));
  ids.delete(me);
  const arr = [...ids];
  if (!arr.length) return [];
  const names = await namesFor(arr);
  return arr.map((id) => names[id]).filter(Boolean);
}

export async function inviteToGroup(groupId, inviteeId) {
  const { error } = await supabase.rpc("invite_to_group", { p_group: groupId, p_invitee: inviteeId });
  if (error) throw new Error(error.message);
}

export async function removeMember(groupId, memberId) {
  const { error } = await supabase.rpc("remove_group_member", { p_group: groupId, p_member: memberId });
  if (error) throw new Error(error.message);
}

export async function leaveGroup(groupId) {
  const { error } = await supabase.rpc("leave_group", { p_group: groupId });
  if (error) throw new Error(error.message);
}

/* Report a group ('group') or a group post ('group_post') into the shared
   community_reports queue — the existing insert policy governs it. */
export async function reportTarget({ kind, targetId, authorId, excerpt, reason }) {
  const me = await myId();
  const { error } = await supabase.from("community_reports").insert({
    reporter_id: me,
    target_kind: kind,
    target_id: targetId,
    target_author_id: authorId || null,
    target_excerpt: excerpt || null,
    reason: reason || null,
  });
  if (error) throw new Error(error.message);
}

/* ── GROUPS_SPEC §4 — a group event IS an Out & about happening ──

   There is not a second events system. The row goes in
   outdoor_outings like any other happening; what makes it the
   group's is group_id, and that single column is what makes it
   inherit the group's privacy.

   The inheritance is NOT done here. 0063 put it in the row's read
   policy, because this function is one of several ways a happening
   can be written and a rule enforced in one writer is not a rule.
   What this does is set group_id — and if it were ever omitted, the
   event would silently become city-wide, which is the exact leak
   tests/group-event-privacy.mjs exists to catch. */
export async function createGroupEvent(groupId, { placeId, startsAt, note }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("outdoor_outings")
    .insert({
      place_id: placeId,
      creator_id: user?.id,
      starts_at: startsAt,
      note: (note || "").trim() || null,
      visibility: "board",
      group_id: groupId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/* The happenings this group has planned. Reads the same table the
   city-wide list reads; RLS decides what comes back. */
export async function fetchGroupEvents(groupId) {
  const { data, error } = await supabase
    .from("outdoor_outings")
    .select("id, place_id, starts_at, note")
    .eq("group_id", groupId)
    .is("canceled_at", null)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw new Error(error.message);
  return data || [];
}

/* Is this group private? Used only to tell the poster who will see
   what they are about to plan — never as the gate itself. */
export async function fetchGroupPrivacy(groupId) {
  const { data } = await supabase.from("groups").select("privacy").eq("id", groupId).maybeSingle();
  return data?.privacy || "invite_only";
}


/* ═══════════════════════════════════════════════
   §7 Managing a group, §8 the pinned post

   The join-request half of §7 belongs to Lane 2 (migration 0086) and
   is bound to here by name, not reimplemented: request_to_join_group,
   respond_join_request, group_pending_request_count. Two lanes
   writing the same rule is how the rule starts disagreeing with
   itself — 0068 exists because that already happened once tonight,
   with is_group_admin.
   ═══════════════════════════════════════════════ */

/* Am I one of the people who run this group? Creator, co-admin, or a
   platform admin — 0068 is the single answer to that question. */
export async function amIGroupAdmin(groupId) {
  const { data, error } = await supabase.rpc("is_group_admin", { p_group: groupId });
  if (error) return false;
  return !!data;
}

/* ── §7.1 member requests (Lane 2's 0086) ── */
export async function fetchJoinRequests(groupId) {
  const { data, error } = await supabase
    .from("group_join_requests")
    .select("id, requester_id, message, status, created_at")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw new Error(error.message);
  const rows = data || [];
  if (rows.length === 0) return [];
  /* The names and faces, in one lookup rather than one per row. */
  const { data: people } = await supabase
    .from("safe_profiles")
    .select("id, full_name, avatar_url")
    .in("id", rows.map((r) => r.requester_id));
  const byId = Object.fromEntries((people || []).map((x) => [x.id, x]));
  return rows.map((r) => ({ ...r, person: byId[r.requester_id] || null }));
}

export async function pendingRequestCount(groupId) {
  const { data, error } = await supabase.rpc("group_pending_request_count", { p_group: groupId });
  if (error) return 0;
  return data || 0;
}

export async function respondJoinRequest(requestId, approve) {
  const { error } = await supabase.rpc("respond_join_request", {
    p_request: requestId,
    p_approve: approve,
  });
  if (error) throw new Error(error.message);
}

export async function requestToJoinGroup(groupId, message = null) {
  const { data, error } = await supabase.rpc("request_to_join_group", {
    p_group: groupId,
    p_message: message,
  });
  if (error) throw new Error(error.message);
  return data;
}

/* My own request for this group, whatever became of it. §7's decline
   is silent in the bell but NOT silent here: a person who asked
   deserves to see what happened in the place they asked, rather than
   watching the row quietly vanish and wondering if it ever sent. */
export async function fetchMyJoinRequest(groupId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("group_join_requests")
    .select("id, status, created_at")
    .eq("group_id", groupId)
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  return (data || [])[0] || null;
}

/* ── §7.3 co-admins ── */
export async function setCoAdmin(groupId, memberId, make) {
  const { error } = await supabase.rpc("set_group_co_admin", {
    p_group: groupId,
    p_member: memberId,
    p_make: make,
  });
  if (error) throw new Error(error.message);
}

/* ── §7.4 group settings ── */
export async function updateGroup(groupId, fields) {
  const { error } = await supabase
    .from("groups")
    .update(fields)
    .eq("id", groupId);
  if (error) throw new Error(error.message);
}

/* ── §7.5 reports raised inside this group ── */
export async function fetchGroupReports(groupId) {
  /* §7.5 is "reports raised INSIDE this group", which is not the same
     as reports ABOUT the group. Matching only target_id = groupId
     caught the second and missed the first — so a member reporting a
     post in the group would never appear on the screen whose entire
     job is to show it. The post ids come first, then the reports
     against either them or the group itself. */
  const { data: posts } = await supabase
    .from("group_posts").select("id").eq("group_id", groupId);
  const ids = [groupId, ...(posts || []).map((p) => p.id)];

  const { data, error } = await supabase
    .from("community_reports")
    // 0078 added the media columns; a reported voice note would
    // otherwise render as a silent row with nothing to judge.
    .select("id, target_kind, target_id, target_excerpt, reason, status, created_at, target_media_bucket, target_media_path, target_media_kind")
    .in("target_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/* ── §8 the pinned post ── */
export async function pinPost(postId) {
  const { error } = await supabase.rpc("pin_group_post", { p_post: postId });
  if (error) throw new Error(error.message);
}

export async function unpinPost(postId) {
  const { error } = await supabase.rpc("unpin_group_post", { p_post: postId });
  if (error) throw new Error(error.message);
}

/* §1's seeded first post, pinned. Returns null if the group already
   has a pin, so this can never overwrite what a group has written. */
export async function seedWelcome(groupId, body) {
  const { data, error } = await supabase.rpc("seed_group_welcome", {
    p_group: groupId,
    p_body: body,
  });
  if (error) throw new Error(error.message);
  return data;
}


/* ── §7.3 — the owner alone may close a group or hand it over ──
   0069 added both; before it there was no delete path at all, not
   even for the owner. Deliberately routed through the RPCs rather
   than a table delete: `groups` has no delete policy, so a REST
   DELETE here would return 204 and do nothing, which is exactly how
   47 fixture groups ended up on the search screen. */
export async function deleteGroup(groupId) {
  const { error } = await supabase.rpc("delete_group", { p_group: groupId });
  if (error) throw new Error(error.message);
}

export async function transferGroupOwnership(groupId, toMemberId) {
  const { error } = await supabase.rpc("transfer_group_ownership", {
    p_group: groupId,
    p_to: toMemberId,
  });
  if (error) throw new Error(error.message);
}
