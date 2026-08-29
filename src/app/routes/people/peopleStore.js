/* ════════════════════════════════════════════════
   People — data layer for the person profile view and its DM thread.

   Profiles come from safe_profiles (the only lawful cross-account
   source); the connection and its granted permissions come from the
   circle_members row between the caller and the person (RLS returns
   it from whichever side the caller is on). Threads reuse the
   community DM tables (0014) through open_dm_with() (0019): circle
   pairs land accepted immediately, everyone else goes through the
   normal request gate. Blocks beat everything, at the database.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

/* Warm sticker set — sent as the message body, rendered large. */
export const STICKERS = [
  "❤️", "💚", "🌸", "🌷", "🌻", "🌹",
  "🤲", "🙏", "👋", "🤗", "😊", "🥰",
  "🍵", "☕", "🍰", "💐", "🌿", "🍃",
  "🌙", "⭐", "✨", "☀️", "🌈", "🕊️",
];

/* A "sticker" message is a short, emoji-only body. */
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}‍️\s]{1,8}$/u;
export function isStickerBody(body) {
  try {
    return EMOJI_ONLY.test(body);
  } catch {
    return false;
  }
}

export async function fetchPerson(profileId) {
  const { data, error } = await supabase
    .from("safe_profiles")
    .select("id, full_name, city, role, is_org, created_at")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/* The circle rows linking me and this person — RLS already scopes
   circle_members to rows I'm on, so filtering by their id leaves only
   ours. Both directions can exist (each of us in the other's circle). */
export async function fetchMembershipsWith(profileId) {
  const { data, error } = await supabase
    .from("circle_members")
    .select(
      "id, icon_id, member_id, is_sos_contact, sos_order, can_see_mood, can_see_health, can_manage_reminders, location_access, created_at"
    )
    .or(`icon_id.eq.${profileId},member_id.eq.${profileId}`);
  if (error) throw new Error(error.message);
  return data || [];
}

/* Returns the dm_requests row id for the thread with this person —
   accepted instantly for circle pairs (0019), request-gated otherwise. */
export async function openDmWith(profileId) {
  const { data, error } = await supabase.rpc("open_dm_with", { p_other: profileId });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchDmRequest(requestId) {
  const { data, error } = await supabase
    .from("dm_requests")
    .select("id, requester_id, recipient_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchMessages(requestId) {
  const { data, error } = await supabase
    .from("dm_messages")
    .select("id, sender_id, body, created_at, read_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function sendDm(requestId, body) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("dm_messages").insert({
    request_id: requestId,
    sender_id: user?.id,
    body,
  });
  if (error) throw new Error(error.message);
}

/* Mark everything they sent as read (the 0014 policy allows exactly
   this: the non-sender touching read_at). */
export async function markThreadRead(requestId, myId) {
  const { error } = await supabase
    .from("dm_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .neq("sender_id", myId)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}
