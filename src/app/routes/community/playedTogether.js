/* ════════════════════════════════════════════════
   Games you have actually played with this person — POSTS_SPEC §9.2.

   §9.2 asks the Play something sheet for "the games you both play",
   with "a sub-line giving a reason where one exists — 'You played this
   together in May'". Nothing computed that, so the sheet had been
   offering every two-seat game with no reason attached to any of them.

   This is the query. A shared game is a FINISHED table both people sat
   at: not a lobby somebody was invited to and never joined, and not a
   table abandoned mid-game, because neither is a memory either person
   has. The reason line uses the most recent one.

   THREE ROUND TRIPS, NOT A JOIN. game_seats has no view that pairs two
   people, and building one would be a migration for a sheet. Two id
   lists intersected in memory is a few hundred rows at the very most —
   a person's whole game history — and it keeps the rule in a file the
   community lane owns rather than in the games lane's schema.

   Returns a Map of game_key -> { count, at }, so the caller can ask
   about a game without scanning. Empty Map is the honest answer for
   two people who have never played, and the caller decides what to do
   with that; this file does not invent a reason where none exists.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

export async function playedTogether(myId, otherId) {
  const empty = new Map();
  if (!myId || !otherId || myId === otherId) return empty;

  /* Their tables and mine, as id lists. */
  const [mine, theirs] = await Promise.all([
    supabase.from("game_seats").select("session_id").eq("profile_id", myId),
    supabase.from("game_seats").select("session_id").eq("profile_id", otherId),
  ]);
  if (mine.error || theirs.error) return empty;

  const mineSet = new Set((mine.data || []).map((r) => r.session_id));
  const shared = [...new Set((theirs.data || []).map((r) => r.session_id))].filter((id) => mineSet.has(id));
  if (!shared.length) return empty;

  /* FINISHED only. A table that was never played is not a thing either
     person remembers, and "you played this together" would be false of
     it — which is exactly the kind of invented warmth this app must not
     do. */
  const { data, error } = await supabase
    .from("game_sessions")
    .select("game_key, finished_at")
    .in("id", shared)
    .eq("status", "finished")
    .order("finished_at", { ascending: false, nullsFirst: false });
  if (error) return empty;

  const out = new Map();
  for (const row of data || []) {
    const prev = out.get(row.game_key);
    if (!prev) out.set(row.game_key, { count: 1, at: row.finished_at });
    else {
      prev.count += 1;
      /* Rows arrive newest first, so the first `at` seen is the latest
         and later ones must not overwrite it. */
      if (!prev.at) prev.at = row.finished_at;
    }
  }
  return out;
}

/* "May", "May 2024" — the month, and the year only when it is not this
   one. Formatted through Intl in the reader's own language rather than
   from a hand-written month table, because a bilingual app that ships
   an English month name inside an Urdu sentence has done the hard part
   and failed at the last inch. */
export function playedWhen(at, lang) {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  const locale = lang === "ur" ? "ur-PK" : "en-GB";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  try {
    return new Intl.DateTimeFormat(locale, sameYear ? { month: "long" } : { month: "long", year: "numeric" }).format(d);
  } catch {
    return null;
  }
}
