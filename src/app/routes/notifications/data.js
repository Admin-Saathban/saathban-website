/* ════════════════════════════════════════════════
   Notifications — data layer (migration 0007).

   RLS is the boundary: every policy on public.notifications keys on
   profile_id = auth.uid(), so these helpers never filter by user — the
   database returns only the signed-in person's rows. Notifications are
   created by staff RPCs / the service role, never written here.
   ════════════════════════════════════════════════ */

import supabase, { sessionUser } from "../../lib/supabase.js";

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
  const rows = data || [];
  /* Who each one is from, by first name, so the off-switch can say
     "Mute Amina" rather than "them" — and whether that person is muted
     already, so the row offers the undo instead. */
  const actorIds = [...new Set(rows.map((n) => n.created_by).filter(Boolean))];
  if (!actorIds.length) return rows;
  const user = await sessionUser();
  const [{ data: people }, { data: mutes }] = await Promise.all([
    supabase.from("safe_profiles").select("id, full_name").in("id", actorIds),
    user
      ? supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id).eq("kind", "mute").in("blocked_id", actorIds)
      : Promise.resolve({ data: [] }),
  ]);
  const names = new Map((people || []).map((p) => [p.id, (p.full_name || "").split(" ")[0]]));
  const muted = new Set((mutes || []).map((m) => m.blocked_id));
  return rows.map((n) => ({
    ...n,
    actor_name: names.get(n.created_by) || "",
    actor_muted: muted.has(n.created_by),
    actor_self: !!user && n.created_by === user.id,
  }));
}

/* The kinds a person Mute cannot silence — kept identical to
   public.notification_kind_mutable (0144). They tell a person something
   was done to their own account or days, or come from the Saathban team,
   so the bell does not offer "Mute" on them: offering it would promise a
   silence the database will not keep. */
const NOT_MUTABLE = new Set([
  "circle", "reminder", "proposal",
  "broadcast", "general", "question_reply",
  "document_request", "document_response", "milestone",
  "break_glass", // 0186
]);

export function canMutePersonOn(n) {
  return !!n?.created_by && !n.actor_self && !NOT_MUTABLE.has(n.kind || "general");
}

/* A break-glass notice (0186–0187) tells a person that Saathban read
   their daily logs. No switch silences it — settings->notify is not
   read for it — so the bell does not offer "mute this kind" on it. */
const KIND_NEVER_MUTED = new Set(["break_glass"]);

export function canMuteKindOn(n) {
  return !!n?.kind && !KIND_NEVER_MUTED.has(n.kind);
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
   is the one Mute (0143–0145): the same `user_blocks` row with kind
   'mute' that a post's menu and a chat's menu write. Nothing that
   person does notifies you any more (0144 drops the row at the
   database), their posts leave your feed, your chat with them stays
   open, and they are never told. It is undone here, from the chat, or
   from Messages → Menu → Blocked and muted. Muting a kind
   writes the same `profiles.settings->notify` override that
   NotifySettings edits, so the settings screen shows what was done
   here and can undo it — which is what "reversible from Settings"
   has to mean to be true. */
export async function muteNotificationPerson(personId) {
  const user = await sessionUser();
  if (!user || !personId) return;
  const { error } = await supabase.from("user_blocks").upsert(
    { blocker_id: user.id, blocked_id: personId, kind: "mute" },
    { onConflict: "blocker_id,blocked_id,kind", ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
}

export async function unmuteNotificationPerson(personId) {
  const user = await sessionUser();
  if (!user || !personId) return;
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", personId)
    .eq("kind", "mute");
  if (error) throw new Error(error.message);
}

/* The read-modify-write is on the caller's OWN settings row, and it
   merges rather than replaces: settings holds more than notify, and
   a careless write here would silently drop somebody's text size or
   language. */
export async function muteNotificationKind(kind) {
  const user = await sessionUser();
  if (!user || !kind) return;
  const { data: me } = await supabase
    .from("profiles").select("settings").eq("id", user.id).maybeSingle();
  const settings = me?.settings || {};
  const next = { ...settings, notify: { ...(settings.notify || {}), [kind]: false } };
  const { error } = await supabase.from("profiles").update({ settings: next }).eq("id", user.id);
  if (error) throw new Error(error.message);
}
