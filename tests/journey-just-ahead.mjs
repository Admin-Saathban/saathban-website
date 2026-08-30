/* §14 — JUST AHEAD shows only what is genuinely close.

   "Never show far-off progress — a badge eighty days away is a number
   telling someone how far behind they are." That is the rule these
   checks exist to defend, so most of them assert ABSENCE. */
import {
  justAhead, badgeIsNear, daysUntil, chapters,
  BADGE_DAYS, BADGE_STEPS, EVENT_DAYS,
} from "../src/app/routes/history/justAhead.js";

let failures = 0;
const check = (n, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(64), String(note).slice(0, 38));
};
const NOW = new Date("2026-08-30T12:00:00");
const inDays = (n) => new Date(NOW.getTime() + n * 86400000);
const keys = (r) => r.map((x) => x.key).join(",");

/* The sentence §14 actually writes. */
check("a badge two steps away is mentioned", badgeIsNear({ remaining: 2 }));
check("a badge two days away is mentioned", badgeIsNear({ daysAway: 2 }));

/* The failure the rule exists to prevent. */
check("A BADGE EIGHTY DAYS AWAY IS NOT SHOWN", !badgeIsNear({ daysAway: 80 }));
check("a badge forty steps away is not shown", !badgeIsNear({ remaining: 40 }));
check("a badge with no distance known is not shown", !badgeIsNear({}));

const far = justAhead({
  badges: [{ key: "hundred", name: "The Hundredth Day", remaining: 61, daysAway: 61 }],
  events: [{ id: "e1", title: "Winter mela", when: inDays(90) }],
  birthdays: [{ id: "p1", name: "Ammi", when: inDays(200) }],
}, NOW);
check("a horizon full of far-off things renders EMPTY, not a list of distances",
  far.length === 0, `${far.length} items`);

const near = justAhead({
  badges: [
    { key: "moon", name: "A Full Moon", remaining: 2, daysAway: 2 },
    { key: "hundred", name: "The Hundredth Day", remaining: 61, daysAway: 61 },
  ],
  events: [{ id: "e1", title: "Chai reunion", when: inDays(3) }],
  birthdays: [{ id: "p1", name: "Ammi", when: inDays(5) }],
  course: { started: true, finished: false, title: "Saathban course", remaining: 2 },
}, NOW);
check("close things are shown", near.length === 4, `${near.length} items`);
check("and the far badge is still absent among them", !keys(near).includes("hundred"), keys(near));
check("soonest reads first", near[0].kind === "course" || near[0].sort <= near[1].sort, keys(near));

/* Earned badges belong to the chapters, not the horizon. */
const earned = justAhead({ badges: [{ key: "week", name: "A Week Together", earned: true, remaining: 0 }] }, NOW);
check("an already-earned badge is not 'just ahead'", earned.length === 0);

/* A course is an invitation only once it is a thing you started. */
check("an untouched course is not in your journey",
  justAhead({ course: { started: false, title: "c", remaining: 5 } }, NOW).length === 0);
check("a finished course is not still ahead of you",
  justAhead({ course: { started: true, finished: true, title: "c" } }, NOW).length === 0);

/* Things that have passed are not ahead. */
check("yesterday's event is not ahead",
  justAhead({ events: [{ id: "e", title: "x", when: inDays(-1) }] }, NOW).length === 0);
check("daysUntil counts whole days", daysUntil(inDays(3), NOW) === 3, String(daysUntil(inDays(3), NOW)));

/* Chapters: months, newest first, empty months absent. */
const ch = chapters(
  [{ log_date: "2026-08-02" }, { log_date: "2026-08-03" }, { log_date: "2026-06-11" }],
  [{ key: "week", earned_at: "2026-07-15" }],
  NOW
);
check("months become chapters, newest first", ch.map((c) => c.key).join(",") === "2026-08,2026-07,2026-06",
  ch.map((c) => c.key).join(","));
check("a month with only a badge still counts as a chapter",
  ch.find((c) => c.key === "2026-07")?.badges.length === 1);
check("a month with nothing at all is not a chapter",
  !ch.some((c) => c.key === "2026-05"));
check("a chapter counts distinct days, not rows",
  ch.find((c) => c.key === "2026-08")?.days === 2, String(ch.find((c) => c.key === "2026-08")?.days));

/* ── negative controls: each should be FALSE ── */
const controls = [
  ["the nearness test is not simply always-true", badgeIsNear({ remaining: BADGE_STEPS + 50, daysAway: BADGE_DAYS + 50 })],
  ["justAhead does not pass everything through", justAhead({ events: [{ id: "e", title: "x", when: inDays(EVENT_DAYS + 30) }] }, NOW).length > 0],
  ["chapters does not invent months", chapters([], [], NOW).length > 0],
];
for (const [name, wrong] of controls) {
  if (wrong) { failures++; console.log("FAIL ", `negative control: ${name}`); }
  else console.log("PASS ", `negative control: ${name}`);
}

console.log(`\n${failures} failed.`);
process.exit(failures ? 1 : 0);
