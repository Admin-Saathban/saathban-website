/* ════════════════════════════════════════════════
   Recurrence — asserting the rules the calendar screen will draw.

   Run: node tests/recurrence.mjs

   A repeat rule is either exactly right or quietly wrong on the fifth
   week, and nobody finds the second kind by looking at a screen once.
   So each rule is checked over a long enough window to break if the
   arithmetic drifts, and every case that could be explained by more
   than one implementation has a mirror case that rules the wrong one
   out — a daily rule and a weekdays rule agree on a Wednesday, so both
   are asked about a Saturday too.
   ════════════════════════════════════════════════ */

import {
  occurrencesOf,
  fallsOn,
  timesOf,
  localDay,
  isoOf,
  isoWeekday,
  repeatLabel,
} from "../src/app/routes/calendar/recurrence.js";

let fails = 0;
const check = (name, ok, note = "") => {
  if (!ok) fails++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(52), note);
};

const D = (iso) => localDay(iso);
const days = (entry, from, to) => occurrencesOf(entry, D(from), D(to)).map(isoOf);
const uniqueDays = (entry, from, to) => [...new Set(days(entry, from, to))];

/* 2026-09-01 is a Tuesday. Every date below is anchored to that so the
   weekday arithmetic is checkable by hand. */
check("the anchor really is a Tuesday", isoWeekday(D("2026-09-01")) === 2, isoOf(D("2026-09-01")));

// ── once ──
{
  const e = { entry_date: "2026-09-10", entry_time: "09:00" };
  check("no rule = exactly one day", days(e, "2026-09-01", "2026-09-30").length === 1);
  check("no rule = that day", days(e, "2026-09-01", "2026-09-30")[0] === "2026-09-10");
  check("no rule, outside the window = nothing", days(e, "2026-10-01", "2026-10-31").length === 0);
}

// ── daily ──
{
  const e = { entry_date: "2026-09-01", repeat_rule: "daily", entry_time: "08:00" };
  check("daily over 30 days = 30", uniqueDays(e, "2026-09-01", "2026-09-30").length === 30);
  check("daily includes a Saturday", uniqueDays(e, "2026-09-01", "2026-09-30").includes("2026-09-05"));
  check("daily never precedes its start", days(e, "2026-08-01", "2026-09-03")[0] === "2026-09-01");
}

// ── weekdays: the mirror of daily ──
{
  const e = { entry_date: "2026-09-01", repeat_rule: "weekdays" };
  const got = uniqueDays(e, "2026-09-01", "2026-09-30");
  check("weekdays skips Saturday", !got.includes("2026-09-05"), "2026-09-05 is a Sat");
  check("weekdays skips Sunday", !got.includes("2026-09-06"), "2026-09-06 is a Sun");
  check("weekdays keeps Friday", got.includes("2026-09-04"));
  check("weekdays in Sept 2026 = 22", got.length === 22, `got ${got.length}`);
}

// ── weekly: same weekday as the entry ──
{
  const e = { entry_date: "2026-09-01", repeat_rule: "weekly" };
  const got = uniqueDays(e, "2026-09-01", "2026-09-30");
  check("weekly = 5 Tuesdays in Sept 2026", got.length === 5, got.join(" "));
  check("weekly lands only on Tuesdays", got.every((d) => isoWeekday(D(d)) === 2));
  check("weekly still right 6 months out", uniqueDays(e, "2027-03-01", "2027-03-31").every((d) => isoWeekday(D(d)) === 2));
}

// ── monthly, and the 31st ──
{
  const e = { entry_date: "2026-01-31", repeat_rule: "monthly" };
  const got = uniqueDays(e, "2026-01-01", "2026-06-30");
  check("monthly on the 31st skips February", !got.some((d) => d.startsWith("2026-02")));
  check("monthly on the 31st skips April (30 days)", !got.some((d) => d.startsWith("2026-04")));
  check("monthly on the 31st keeps March", got.includes("2026-03-31"));
  check("monthly never slides to the 1st", got.every((d) => d.endsWith("-31")), got.join(" "));
}
{
  const e = { entry_date: "2026-09-15", repeat_rule: "monthly" };
  const got = uniqueDays(e, "2026-09-01", "2027-02-28");
  check("monthly on the 15th = 6 months running", got.length === 6, got.join(" "));
}

// ── yearly, including the legacy column ──
{
  const e = { entry_date: "2026-09-20", repeat_rule: "yearly" };
  check("yearly once per year", uniqueDays(e, "2026-09-01", "2027-09-30").length === 2);
  const legacy = { entry_date: "2026-09-20", repeats_yearly: true };
  check("repeats_yearly alone still repeats", uniqueDays(legacy, "2026-09-01", "2027-09-30").length === 2);
}

// ── custom weekdays ──
{
  const e = { entry_date: "2026-09-01", repeat_rule: "custom", repeat_days: [1, 4] }; // Mon + Thu
  const got = uniqueDays(e, "2026-09-01", "2026-09-30");
  check("custom lands only on the chosen days", got.every((d) => [1, 4].includes(isoWeekday(D(d)))));
  check("custom Mon+Thu in Sept 2026 = 8", got.length === 8, `got ${got.length}`);  // 4 Mondays + 4 Thursdays, counted by hand
  const empty = { entry_date: "2026-09-01", repeat_rule: "custom", repeat_days: [] };
  check("custom with no days chosen = nothing", days(empty, "2026-09-01", "2026-09-30").length === 0);
}

// ── an end date ──
{
  const e = { entry_date: "2026-09-01", repeat_rule: "daily", repeat_until: "2026-09-10" };
  const got = uniqueDays(e, "2026-09-01", "2026-09-30");
  check("repeat_until stops it", got.length === 10, `got ${got.length}`);
  check("repeat_until includes its own last day", got.includes("2026-09-10"));
  check("repeat_until excludes the day after", !got.includes("2026-09-11"));
}

// ── several times in one day ──
{
  const e = { entry_date: "2026-09-01", repeat_rule: "daily", entry_times: ["08:00", "14:00", "20:00"] };
  const all = occurrencesOf(e, D("2026-09-01"), D("2026-09-07"));
  check("3 times × 7 days = 21 occurrences", all.length === 21, `got ${all.length}`);
  check("7 distinct days", new Set(all.map(isoOf)).size === 7);
  const first = all.slice(0, 3).map((d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
  check("the times are the ones asked for", first.join(" ") === "8:00 14:00 20:00", first.join(" "));
  check("occurrences come out in time order", all.every((d, i) => i === 0 || d >= all[i - 1]));
}

// ── timesOf reads both shapes ──
check("timesOf: array wins", timesOf({ entry_times: ["07:00"], entry_time: "09:00" })[0] === "07:00");
check("timesOf: falls back to the scalar", timesOf({ entry_time: "09:00" })[0] === "09:00");
check("timesOf: nothing set = empty", timesOf({}).length === 0);
check("an all-day repeat still occurs", days({ entry_date: "2026-09-01", repeat_rule: "daily" }, "2026-09-01", "2026-09-03").length === 3);

// ── labels ──
{
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  check("no rule has no label", repeatLabel({}, names) === null);
  check("daily labels as daily", repeatLabel({ repeat_rule: "daily" }, names).key === "calendar.repeat.daily");
  const c = repeatLabel({ repeat_rule: "custom", repeat_days: [4, 1] }, names);
  check("custom names its days in order", c.values.days === "Mon, Thu", c.values.days);
  check("legacy yearly still labels", repeatLabel({ repeats_yearly: true }, names).key === "calendar.repeat.yearly");
}

// ── fallsOn directly, for the boundary ──
{
  const e = { entry_date: "2026-09-10", repeat_rule: "daily" };
  check("fallsOn is false before the start", fallsOn(e, D("2026-09-09"), D("2026-09-10")) === false);
  check("fallsOn is true on the start", fallsOn(e, D("2026-09-10"), D("2026-09-10")) === true);
}

console.log("\n" + (fails ? `${fails} FAILED` : "RECURRENCE OK — every rule checked, with mirrors"));
process.exit(fails ? 1 : 0);
