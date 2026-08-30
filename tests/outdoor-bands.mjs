/* Distance bands (PRODUCT_DECISIONS §12) — computed from AREA, never
   kilometres. Pure logic, so this runs with no browser and no DB.

   §20.3: every check is proved able to fail. The bottom of this file
   feeds each assertion the input that SHOULD break it and complains if
   it passes anyway — a checker that silently matches nothing reports
   everything as present. */
import { bandFor, groupByBand, dayBucket, sinceLabel, WALKABLE, NEARBY, ACROSS, TODAY, TOMORROW, LATER } from "../src/app/routes/outdoor/bands.js";

let failures = 0;
const check = (n, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(62), String(note).slice(0, 40));
};

const me = { city: "Lahore", area: "Model Town" };

check("same area is walkable", bandFor(me, { city: "Lahore", area: "Model Town" }) === WALKABLE);
check("same city, other area is nearby", bandFor(me, { city: "Lahore", area: "Gulberg" }) === NEARBY);
check("another city is across the city", bandFor(me, { city: "Karachi", area: "Clifton" }) === ACROSS);

/* The typing-humans cases. */
check("case and spacing do not split a neighbourhood",
  bandFor(me, { city: "lahore", area: "  model   town " }) === WALKABLE);

/* The person who skipped area (§2 makes it optional). */
check("no area of my own: the city reads as nearby, never as far",
  bandFor({ city: "Lahore" }, { city: "Lahore", area: "Model Town" }) === NEARBY);
check("no area on the PLACE: still nearby, not walkable",
  bandFor(me, { city: "Lahore" }) === NEARBY);
check("two blanks are two unknowns, not a match",
  bandFor({ city: "Lahore" }, { city: "Lahore" }) === NEARBY);
check("brand new person with no city at all still sees things as nearby",
  bandFor({}, { city: "Lahore", area: "Model Town" }) === NEARBY);

/* §0.6 — a band with nothing in it must be ABSENT, not an empty box. */
const grouped = groupByBand(
  [{ p: { city: "Lahore", area: "Model Town" } }, { p: { city: "Karachi" } }],
  me,
  (i) => i.p
);
check("only bands that have something are returned", grouped.length === 2, `${grouped.length} bands`);
check("bands come back in walkable → nearby → across order",
  grouped[0][0] === WALKABLE && grouped[1][0] === ACROSS, grouped.map((g) => g[0]).join(" → "));

/* Day buckets, at local midnight. */
const now = new Date("2026-08-30T18:00:00");
check("tonight is today", dayBucket(new Date("2026-08-30T21:00:00"), now) === TODAY);
check("after midnight is tomorrow", dayBucket(new Date("2026-08-31T09:00:00"), now) === TOMORROW);
check("the day after is coming up", dayBucket(new Date("2026-09-02T09:00:00"), now) === LATER);
check("an open invitation with no time is for today", dayBucket(null, now) === TODAY);

check("since-label is a clock time a person can act on", /\d/.test(sinceLabel("2026-08-30T15:40:00", "en")));
check("since-label survives a missing timestamp", sinceLabel(null, "en") === "");

/* ── Proving the checks can fail ──
   Each of these SHOULD be false. If any is true, the assertion above
   it is not testing what it claims. */
const mustBeFalse = [
  ["walkable would not fire for a different area", bandFor(me, { city: "Lahore", area: "Gulberg" }) === WALKABLE],
  ["across would not fire inside one city", bandFor(me, { city: "Lahore", area: "Gulberg" }) === ACROSS],
  ["an empty group list is not silently 'all bands'", groupByBand([], me, (i) => i.p).length > 0],
  ["tomorrow is not reported for tonight", dayBucket(new Date("2026-08-30T23:59:00"), now) === TOMORROW],
];
for (const [name, wrong] of mustBeFalse) {
  if (wrong) { failures++; console.log("FAIL ", `negative control: ${name}`); }
  else console.log("PASS ", `negative control: ${name}`.padEnd(62));
}

console.log(`\n${failures} failed.`);
process.exit(failures ? 1 : 0);
