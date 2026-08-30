/* How many things are on today — the live count §6 puts on the
   Calendar row ("2 things today").

   IT REUSES `occurrencesOf` RATHER THAN COUNTING ROWS. A calendar
   entry has been a RULE and not a date since TONIGHT §3.5, so "every
   Tuesday" is one row and none, one or several things today depending
   on what day it is. Counting rows would put a 1 beside a Calendar
   that shows nothing, or a 1 beside a Calendar showing three — and a
   count that disagrees with the screen it labels is worse than no
   count, because it is the number a person plans their morning by.

   Two sources, matching CalendarPage: outings I am part of, and my own
   entries. Both are owner-scoped at the database, so nothing here
   filters for privacy — it would be filtering something already
   filtered, and the appearance of a client-side guard is how a real
   one stops getting written. */

import supabase from "../lib/supabase.js";
import { occurrencesOf } from "../routes/calendar/recurrence.js";

export async function countToday() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);

  let n = 0;

  /* Outings are already a moment in time, so they need no expanding —
     only the window applied. */
  const { data: outings } = await supabase
    .from("outdoor_outings")
    .select("id, starts_at")
    .is("canceled_at", null)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .limit(50);
  n += (outings || []).length;

  const { data: entries } = await supabase
    .from("calendar_entries")
    .select(
      "id, kind, entry_date, entry_time, entry_times, repeats_yearly, repeat_rule, repeat_days, repeat_until"
    );
  for (const e of entries || []) {
    n += occurrencesOf(e, from, to).length;
  }

  return n;
}
