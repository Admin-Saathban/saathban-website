/* ════════════════════════════════════════════════
   Turning a repeat rule into the days it actually falls on.

   TONIGHT.md LANE 3.5. Kept as a pure module with no React and no
   Supabase in it, because "every Tuesday until the end of March, at
   8am and 8pm" is the kind of thing that is either exactly right or
   quietly wrong on the fifth week, and the only way to know which is
   to be able to run it a hundred times in a test.

   The rules, in the words the screen uses:
     daily     every day
     weekdays  Monday to Friday
     weekly    the same day of the week as the entry's own date
     monthly   the same date each month
     yearly    the same date each year (birthdays already use this)
     custom    a chosen set of weekdays

   WHAT MONTHLY DOES ABOUT THE 31st. Not every month has one. The
   choice here is to SKIP those months rather than slide to the 30th or
   spill into the 1st: a person who said "the 31st" and is shown the
   1st of the next month will trust the calendar less, not more, and a
   missing entry is easier to notice than a wrong one.

   Dates are handled in LOCAL time throughout — a calendar is a local
   idea, and building these from ISO strings with a Z on the end is how
   an 8pm entry becomes tomorrow's problem in Karachi.
   ════════════════════════════════════════════════ */

export const REPEAT_RULES = ["daily", "weekdays", "weekly", "monthly", "yearly", "custom"];

const DAY_MS = 86400000;

/* Local midnight for a YYYY-MM-DD string, with no timezone parsing. */
export function localDay(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ISO weekday: 1 = Monday … 7 = Sunday. JS gives 0 = Sunday. */
export const isoWeekday = (d) => ((d.getDay() + 6) % 7) + 1;

/* The times an entry happens at, as an array, whatever shape it was
   stored in. One reader for both the old scalar and the new array —
   every caller asks this rather than choosing between the columns. */
export function timesOf(entry) {
  const many = entry?.entry_times;
  if (Array.isArray(many) && many.length) return many.filter(Boolean);
  return entry?.entry_time ? [entry.entry_time] : [];
}

/* Does this rule fall on this day? `start` is the entry's own date,
   which anchors weekly (same weekday) and monthly/yearly (same date). */
export function fallsOn(entry, day, start) {
  const rule = entry.repeat_rule || (entry.repeats_yearly ? "yearly" : null);
  if (!rule) return isoOf(day) === isoOf(start);
  if (day < start) return false;
  if (entry.repeat_until) {
    const until = localDay(entry.repeat_until);
    if (until && day > until) return false;
  }
  switch (rule) {
    case "daily":
      return true;
    case "weekdays":
      return isoWeekday(day) <= 5;
    case "weekly":
      return day.getDay() === start.getDay();
    case "monthly":
      /* Skips the months that have no such date — see the header. */
      return day.getDate() === start.getDate();
    case "yearly":
      return day.getDate() === start.getDate() && day.getMonth() === start.getMonth();
    case "custom":
      return (entry.repeat_days || []).includes(isoWeekday(day));
    default:
      return isoOf(day) === isoOf(start);
  }
}

/* Every occurrence of one entry between two local days, inclusive, as
   Date objects carrying their time of day. An entry with three times
   yields three per day it falls on.

   `horizonDays` is a guard, not a policy: an unbounded daily rule is
   infinite, and something has to stop counting. The calendar asks for
   the window it is about to draw. */
export function occurrencesOf(entry, from, to, horizonDays = 400) {
  const start = localDay(entry.entry_date);
  if (!start) return [];
  const times = timesOf(entry);
  const out = [];

  let day = new Date(Math.max(from.getTime(), start.getTime()));
  day.setHours(0, 0, 0, 0);
  const last = new Date(to);
  last.setHours(0, 0, 0, 0);

  let guard = 0;
  while (day <= last && guard++ < horizonDays) {
    if (fallsOn(entry, day, start)) {
      if (times.length === 0) {
        out.push(new Date(day));
      } else {
        for (const time of times) {
          const [h, m] = String(time).split(":").map(Number);
          const at = new Date(day);
          at.setHours(h || 0, m || 0, 0, 0);
          out.push(at);
        }
      }
    }
    /* ADVANCE BY DATE, NOT BY 86,400,000ms. Adding a day's worth of
       milliseconds and snapping back to midnight looks equivalent and
       is not: on the morning the clocks go back, the day is 25 hours
       long, so +24h lands on the SAME calendar date, midnight snaps it
       to where it already was, and the loop stops advancing for ever.
       The test caught it as "monthly on the 15th" returning September
       and October and then nothing — the walk had stalled on the 1st
       of November. Asking for "the day after this one" cannot stall,
       because the calendar does the arithmetic. */
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  }
  return out;
}

/* One short line saying what the rule does, for the entry's row.
   Returns a locale KEY plus its values, never a sentence — the
   calendar is bilingual and a sentence built here could only be one
   of the two. */
export function repeatLabel(entry, dayNames) {
  const rule = entry.repeat_rule || (entry.repeats_yearly ? "yearly" : null);
  if (!rule) return null;
  if (rule === "custom") {
    const days = (entry.repeat_days || []).slice().sort((a, b) => a - b);
    if (!days.length) return null;
    return { key: "calendar.repeat.onDays", values: { days: days.map((d) => dayNames[d - 1]).join(", ") } };
  }
  return { key: `calendar.repeat.${rule}`, values: {} };
}
