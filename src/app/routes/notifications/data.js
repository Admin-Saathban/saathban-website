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
    // created_by is who it is ABOUT — §6.1 needs it to offer "mute
    // this person" on the notification itself.
    .select("id, title, body, kind, link, read_at, created_at, created_by")
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

/* ── OUT_AND_ABOUT_SPEC §6.1 — an off-switch where the notification is ──

   "Inline in the notification: MUTE THIS PERSON and MUTE THIS KIND OF
    THING. Both reversible from Settings. A notification a person
    cannot stop from the place they receive it is a notification they
    will stop by leaving."

   Neither of these is a new mechanism, deliberately. Muting a person
   is the same `user_blocks` row with kind 'mute' that the community
   feed already writes, so a person muted here is muted everywhere and
   there is no second idea of "muted" to keep in step. Muting a kind
   writes the same `profiles.settings->notify` override that
   NotifySettings edits, so the settings screen shows what was done
   here and can undo it — which is what "reversible from Settings"
   has to mean to be true. */
export async function muteNotificationPerson(personId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !personId) return;
  const { error } = await supabase.from("user_blocks").upsert(
    { blocker_id: user.id, blocked_id: personId, kind: "mute" },
    { onConflict: "blocker_id,blocked_id,kind", ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
}

/* The read-modify-write is on the caller's OWN settings row, and it
   merges rather than replaces: settings holds more than notify, and
   a careless write here would silently drop somebody's text size or
   language. */
export async function muteNotificationKind(kind) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !kind) return;
  const { data: me } = await supabase
    .from("profiles").select("settings").eq("id", user.id).maybeSingle();
  const settings = me?.settings || {};
  const next = { ...settings, notify: { ...(settings.notify || {}), [kind]: false } };
  const { error } = await supabase.from("profiles").update({ settings: next }).eq("id", user.id);
  if (error) throw new Error(error.message);
}
