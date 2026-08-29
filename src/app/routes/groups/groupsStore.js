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

export async function createGroup(name, description) {
  const { data, error } = await supabase.rpc("create_group", { p_name: name, p_description: description || null });
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
    .from("group_posts").select("id, author_id, body, created_at").eq("group_id", groupId)
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
