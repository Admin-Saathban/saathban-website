/* ════════════════════════════════════════════════
   Notifications — data layer (migration 0007).

   RLS is the boundary: every policy on public.notifications keys on
   profile_id = auth.uid(), so these helpers never filter by user — the
   database returns only the signed-in person's rows. Notifications are
   created by staff RPCs / the service role, never written here.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

/* Dispatched on window after marking read, so the header bell's badge
   refreshes without a reload. */
export const NOTIFICATIONS_READ_EVENT = "sb:notifications-read";

export function announceRead() {
  try {
    window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
  } catch {
    /* no window (SSR) — nothing to refresh */
  }
}

export async function fetchNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, kind, read_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchUnreadCount() {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return count || 0;
}

export async function markRead(id) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

export async function markAllRead() {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw new Error(error.message);
}
