/* ════════════════════════════════════════════════
   Events data layer — every Supabase call for the events area
   (migration 0012), plus the marketing site's shared events file
   normalized into the same shape the list renders.

   RLS is the boundary: drafts are invisible to non-admins, RSVP rows
   are visible only to their owner (and admins), and the going-count
   comes from a definer function that only ever exposes a number.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";
import { EVENTS as SITE_EVENTS } from "../../../shared/eventsData.js";

/* ─── Shared (marketing) events, normalized ───
   These are content, not rows — no RSVP, no capacity. `when` may be
   null if the date string ever fails to parse; such events sort last
   among past ones rather than crashing anything. */
export function sharedEvents() {
  return SITE_EVENTS.map((e) => {
    const parsed = new Date(e.date);
    return {
      source: "site",
      id: `site:${e.id}`,
      title: e.title,
      dateLabel: e.date,
      when: Number.isNaN(parsed.getTime()) ? null : parsed,
      venue: e.loc,
      description: e.desc,
    };
  });
}

/* ─── App-managed events ─── */

function rowToEvent(row) {
  return {
    source: "app",
    id: row.id,
    title: row.title,
    when: new Date(`${row.event_date}T${row.start_time || "00:00:00"}`),
    // Local-midnight parse: a bare date string would be read as UTC and
    // shift a day west of Greenwich.
    dateLabel: new Date(`${row.event_date}T00:00:00`).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    timeLabel: row.start_time
      ? `${clock(row.start_time)}${row.end_time ? ` – ${clock(row.end_time)}` : ""}`
      : null,
    venue: [row.venue, row.city].filter(Boolean).join(", "),
    description: row.description,
    capacity: row.capacity,
    is_published: row.is_published,
    event_date: row.event_date,
    raw: row,
  };
}

function clock(t) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

/* Published events (RLS also lets admins see drafts here; the list
   screen filters those out — drafts belong on the manage page). */
export async function fetchAppEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToEvent);
}

export async function fetchGoingCount(eventId) {
  const { data, error } = await supabase.rpc("event_going_count", { p_event: eventId });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

/* My RSVPs with the event embedded (FK join; RLS scopes rows to me). */
export async function fetchMyRsvps() {
  const { data, error } = await supabase
    .from("event_rsvps")
    .select("id, event_id, status, checked_in_at, event:events(*)")
    .eq("status", "going");
  if (error) throw new Error(error.message);
  return (data || [])
    .filter((r) => r.event)
    .map((r) => ({ rsvpId: r.id, ...rowToEvent(r.event) }));
}

export async function rsvpToEvent(eventId) {
  const { data, error } = await supabase.rpc("rsvp_to_event", { p_event: eventId });
  if (error) throw new Error(error.message);
  return data;
}

export async function cancelRsvp(eventId) {
  const { error } = await supabase.rpc("cancel_event_rsvp", { p_event: eventId });
  if (error) throw new Error(error.message);
}

/* ─── Personal calendar (owner-only at the database) ─── */

export async function fetchCalendarEntries() {
  const { data, error } = await supabase
    .from("calendar_entries")
    .select("id, kind, title, entry_date, entry_time, repeats_yearly")
    .order("entry_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addCalendarEntry(entry) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("calendar_entries").insert({
    owner_id: user?.id,
    ...entry,
  });
  if (error) throw new Error(error.message);
}

export async function deleteCalendarEntry(id) {
  const { error } = await supabase.from("calendar_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* A yearly entry's next occurrence on/after today. */
export function nextOccurrence(entry, today = new Date()) {
  const base = new Date(`${entry.entry_date}T00:00:00`);
  if (!entry.repeats_yearly) return base;
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const thisYear = new Date(todayMid.getFullYear(), base.getMonth(), base.getDate());
  return thisYear >= todayMid
    ? thisYear
    : new Date(todayMid.getFullYear() + 1, base.getMonth(), base.getDate());
}

/* ─── Admin ─── */

export async function adminSaveEvent(fields, id) {
  if (id) {
    const { error } = await supabase.from("events").update(fields).eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("events")
    .insert({ ...fields, created_by: user?.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/* Door list for one event: RSVPs + public names, admin-only by RLS. */
export async function adminFetchAttendees(eventId) {
  const { data, error } = await supabase
    .from("event_rsvps")
    .select("id, profile_id, status, checked_in_at")
    .eq("event_id", eventId)
    .eq("status", "going")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data || [];
  const ids = rows.map((r) => r.profile_id);
  let names = new Map();
  if (ids.length) {
    const { data: profiles, error: pErr } = await supabase
      .from("safe_profiles")
      .select("id, full_name, city")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    names = new Map((profiles || []).map((p) => [p.id, p]));
  }
  return rows.map((r) => ({ ...r, profile: names.get(r.profile_id) || null }));
}

export async function adminSetCheckedIn(rsvpId, arrived) {
  const { error } = await supabase
    .from("event_rsvps")
    .update({ checked_in_at: arrived ? new Date().toISOString() : null })
    .eq("id", rsvpId);
  if (error) throw new Error(error.message);
}

/* ─── Small helpers ─── */

export function localIsoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isUpcoming(ev, today = localIsoDate()) {
  if (ev.source === "app") return ev.event_date >= today;
  return ev.when != null && localIsoDate(ev.when) >= today;
}
