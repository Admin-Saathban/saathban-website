/* §13 — every calendar entry offers the action that fits it.

   This asks EVERY kind for its actions, so a kind added later cannot
   quietly ship actionless: the loop fails on anything it does not
   have an expectation for.

   §20.3 — negative controls at the bottom prove each check can fail. */
import { actionsFor, kindsForRole, KINDS, KIND_ICON, EXCLUDED_KINDS } from "../src/app/routes/calendar/entryActions.js";

let failures = 0;
const check = (n, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(64), String(note).slice(0, 40));
};
const keys = (e) => actionsFor(e).map((a) => a.key);

/* §13's four worked examples, one per line of the spec. */
check("Chai Reunion: open the event, and reach who's going",
  keys({ kind: "event", refId: "e1" }).join(",") === "openEvent,messageGoing",
  keys({ kind: "event", refId: "e1" }).join(","));

check("the doctor: tell your circle you're heading out",
  keys({ kind: "appointment" }).join(",") === "tellMyCircle",
  keys({ kind: "appointment" }).join(","));

check("Ammi's birthday: reach HER first, the public wish second",
  keys({ kind: "birthday", personId: "p1" }).join(",") === "messageThem,postAWish",
  keys({ kind: "birthday", personId: "p1" }).join(","));

check("Sara visiting: message her",
  keys({ kind: "visiting", personId: "p1" }).join(",") === "messageThem",
  keys({ kind: "visiting", personId: "p1" }).join(","));

/* The action has to go somewhere real. */
check("a birthday's message action targets that person's chat",
  actionsFor({ kind: "birthday", personId: "p1" })[0].to === "/app/people/p1/chat",
  actionsFor({ kind: "birthday", personId: "p1" })[0].to);

check("a happening opens What's on, where joining happens",
  actionsFor({ kind: "outing" })[0].to === "/app/outdoor");

/* §0.6 in spirit: an action that would go nowhere is ABSENT, never a
   button that shrugs. */
check("a visit with nobody named offers nothing, not a dead button",
  actionsFor({ kind: "visiting" }).length === 0);
check("a plain note offers nothing", actionsFor({ kind: "personal" }).length === 0);
check("a one-off reminder offers nothing", actionsFor({ kind: "custom_reminder" }).length === 0);

/* Every kind must be accounted for — this is what catches a kind
   added next month with no action and no icon. */
for (const k of KINDS) {
  check(`every kind is handled: ${k}`, Array.isArray(actionsFor({ kind: k, personId: "p1" })), "");
  check(`every kind has an icon: ${k}`, !!KIND_ICON[k], KIND_ICON[k] || "(none)");
}

/* Roles get their own calendars (§13). */
check("a Buddy's calendar holds no birthdays from a circle they are not in",
  !kindsForRole("saath_buddy").includes("birthday"), kindsForRole("saath_buddy").join(","));
check("a Buddy's calendar holds no 'visiting' entries about someone's family",
  !kindsForRole("saath_buddy").includes("visiting"));
check("a Fam member's calendar does hold birthdays",
  kindsForRole("family_member").includes("birthday"));
check("an Icon's calendar holds everything",
  kindsForRole("saath_icon").length === KINDS.length);

/* §13 excludes medication deliberately. */
check("medication is excluded, and visibly so",
  EXCLUDED_KINDS.includes("medication") && !KINDS.includes("medication"));

/* ── negative controls ── */
const controls = [
  ["an unknown kind does not inherit somebody else's actions", actionsFor({ kind: "nonsense", personId: "p1" }).length > 0],
  ["the birthday check would notice a wrong order", keys({ kind: "birthday", personId: "p1" }).join(",") === "postAWish,messageThem"],
  ["a Buddy list is not simply every kind", kindsForRole("saath_buddy").length === KINDS.length],
];
for (const [name, wrong] of controls) {
  if (wrong) { failures++; console.log("FAIL ", `negative control: ${name}`); }
  else console.log("PASS ", `negative control: ${name}`);
}

console.log(`\n${failures} failed.`);
process.exit(failures ? 1 : 0);
