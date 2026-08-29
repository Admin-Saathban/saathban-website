/* ════════════════════════════════════════════════
   My Circle data layer — every Supabase call for circles, invites,
   and reminders (migrations 0005 + 0011), shared by the Fam screens
   (routes/fam/) and the Icon-side Circle page (routes/circle/).

   RLS is the security boundary throughout: these helpers request what
   the UI wants and render whatever comes back. A missing permission
   means missing rows, never a client-side check standing alone.

   Names ending in a role (…AsIcon / …AsMember) mark which side of a
   membership the caller must be on — the queries filter by auth.uid()
   through RLS either way.
   ════════════════════════════════════════════════ */

import supabase from "./supabase.js";

const MEMBER_COLUMNS =
  "id, icon_id, member_id, is_sos_contact, sos_order, can_see_mood, can_see_health, can_manage_reminders, location_access, created_at";

/* Attach safe_profiles rows (name, city…) for a list of profile ids.
   safe_profiles has no FK PostgREST can embed through, so this is a
   second query by design. Returns a Map(id → profile). */
async function profilesById(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from("safe_profiles")
    .select("id, full_name, city, avatar_url, is_org")
    .in("id", unique);
  if (error) throw new Error(error.message);
  return new Map((data || []).map((p) => [p.id, p]));
}

/* ─── Fam side ─── */

/* Circles this account belongs to, each with the Icon's public profile.
   The permission fields on each row are what the Icon granted — RLS
   already enforces them on the data tables; the UI only mirrors them. */
export async function fetchMembershipsAsMember() {
  const { data, error } = await supabase
    .from("circle_members")
    .select(MEMBER_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const mine = (data || []).filter((m) => m.member_id !== m.icon_id);
  const profiles = await profilesById(mine.map((m) => m.icon_id));
  return mine
    .map((m) => ({ ...m, icon_profile: profiles.get(m.icon_id) || null }))
    .filter((m) => m.icon_profile); // a blocked Icon vanishes from safe_profiles
}

/* Today's log rows for one Icon. RLS trims this to exactly the granted
   classes: mood/sleep/exercise/diet/water with can_see_mood,
   medication/BP/sugar/weight/pain with can_see_health. */
export async function fetchTodayLogs(iconId, localIsoDate) {
  const { data, error } = await supabase
    .from("daily_logs")
    .select("module, payload, mood_value, updated_at")
    .eq("icon_id", iconId)
    .eq("log_date", localIsoDate);
  if (error) throw new Error(error.message);
  return data || [];
}

/* Outgoing join requests still waiting on an Icon's yes. Only requests
   whose email actually matched an Icon can ever be approved, but the
   list shows every open one — the requester must not learn which. */
export async function fetchMyPendingRequests() {
  const { data, error } = await supabase
    .from("circle_invites")
    .select("id, invitee_email, created_at, expires_at")
    .eq("direction", "member_to_icon")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/* Always resolves to "request_sent" on success — by design (0005,
   decision #6) the caller cannot tell whether the email matched. */
export async function requestToJoinCircle(email) {
  const { data, error } = await supabase.rpc("request_to_join_circle", {
    p_email: email,
  });
  if (error) throw new Error(error.message);
  return data;
}

/* Redeem a code an Icon read aloud / sent. Returns the membership id. */
export async function acceptCircleInvite(code) {
  const { data, error } = await supabase.rpc("accept_circle_invite", {
    p_code: code.replace(/\D/g, ""),
  });
  if (error) throw new Error(error.message);
  return data;
}

/* ─── Icon side ─── */

export async function fetchCircleAsIcon() {
  const { data, error } = await supabase
    .from("circle_members")
    .select(MEMBER_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const mine = (data || []).filter((m) => m.icon_id !== m.member_id);
  const profiles = await profilesById(mine.map((m) => m.member_id));
  return mine.map((m) => ({
    ...m,
    member_profile: profiles.get(m.member_id) || null,
  }));
}

/* New single-use invite (48 h). Returns { invite_id, code }. */
export async function createCircleInvite(email, phone) {
  const { data, error } = await supabase.rpc("create_circle_invite", {
    p_email: email || null,
    p_phone: phone || null,
  });
  if (error) throw new Error(error.message);
  // returns table(...) → an array with one row
  return Array.isArray(data) ? data[0] : data;
}

export async function fetchOpenInvitesAsIcon() {
  const { data, error } = await supabase
    .from("circle_invites")
    .select("id, code, invitee_email, invitee_phone, created_at, expires_at")
    .eq("direction", "icon_to_member")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function cancelInvite(inviteId) {
  const { error } = await supabase.from("circle_invites").delete().eq("id", inviteId);
  if (error) throw new Error(error.message);
}

/* Pending join requests aimed at this Icon, with each requester's
   public profile for the one-tap approval card. */
export async function fetchJoinRequestsAsIcon() {
  const { data, error } = await supabase
    .from("circle_invites")
    .select("id, created_by, created_at, expires_at")
    .eq("direction", "member_to_icon")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data || []).filter((r) => r.created_by);
  const profiles = await profilesById(rows.map((r) => r.created_by));
  return rows.map((r) => ({
    ...r,
    requester_profile: profiles.get(r.created_by) || null,
  }));
}

export async function approveJoinRequest(inviteId) {
  const { data, error } = await supabase.rpc("approve_circle_request", {
    p_invite_id: inviteId,
  });
  if (error) throw new Error(error.message);
  return data;
}

/* Permission patch on one membership row — Icon only (RLS). Accepts
   any subset of: is_sos_contact, sos_order, can_see_mood,
   can_see_health, can_manage_reminders, location_access. */
export async function updateMemberPermissions(membershipId, patch) {
  const { error } = await supabase
    .from("circle_members")
    .update(patch)
    .eq("id", membershipId);
  if (error) throw new Error(error.message);
}

/* One tap: the Icon removes anyone; a member may leave. No
   confirmation maze, no notification to the removed person. */
export async function removeMembership(membershipId) {
  const { error } = await supabase.from("circle_members").delete().eq("id", membershipId);
  if (error) throw new Error(error.message);
}

/* ─── Reminders (migration 0011) ───
   Readable/writable by the Icon and by circle members holding
   can_manage_reminders — the database checks the grant live. */

export async function fetchReminders(iconId) {
  const { data, error } = await supabase
    .from("reminders")
    .select("id, icon_id, created_by, label, emoji, remind_time, days_label")
    .eq("icon_id", iconId)
    .order("remind_time", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addReminder(iconId, { label, remind_time, days_label, emoji }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("reminders")
    .insert({
      icon_id: iconId,
      created_by: user?.id,
      label,
      remind_time,
      days_label,
      emoji: emoji || "⏰",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateReminder(id, patch) {
  const { error } = await supabase.from("reminders").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteReminder(id) {
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ─── Small shared helpers ─── */

export function localIsoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function hoursLeft(expiresAt) {
  return Math.max(0, Math.round((new Date(expiresAt) - new Date()) / 3600000));
}

/* "482 915" — the spoken form of a 6-digit code. */
export function formatInviteCode(code) {
  const d = (code || "").replace(/\D/g, "");
  return d.length === 6 ? `${d.slice(0, 3)} ${d.slice(3)}` : code;
}
