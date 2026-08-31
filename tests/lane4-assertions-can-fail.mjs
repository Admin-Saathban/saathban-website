/* Proof that this lane's NEGATIVE assertions can fail.
 *
 * Half of what lane4-screens checks is an absence — the four-line
 * explainer is gone, the "Tap a place" hint is gone, the old confirm
 * wording is gone, the event action is never "Open". An absence is
 * satisfied by a blank page, by the previous page, and by an error
 * page. So a negative assertion that has never been SEEN to fail is
 * indistinguishable from one that cannot fail, and it will keep
 * reporting green long after the thing it guards has come back.
 *
 * This file puts the removed text back into the live DOM and requires
 * each assertion to go red. It is the same technique used on the §4
 * privacy migration: a test proves nothing until you have watched it
 * fail for the right reason.
 *
 * It is deliberately separate from lane4-screens rather than folded
 * into it. Mixing "the app is correct" with "the test can detect
 * incorrectness" in one run makes a failure ambiguous — you would not
 * know which of the two had broken.
 *
 * Run it whenever those assertions change, and after any rewording of
 * the strings they name. If one reports WEAK, the wording drifted and
 * the assertion is now guarding nothing.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (() => {
  const raw = process.env.BASE_URL;
  if (!raw) { console.error("BASE_URL is required — no default."); process.exit(2); }
  let u; try { u = new URL(raw); } catch { console.error("BASE_URL unusable: " + raw); process.exit(2); }
  if ((u.hostname === "localhost" || u.hostname === "127.0.0.1") && !u.port) {
    console.error("BASE_URL names no port: " + raw); process.exit(2);
  }
  return raw.replace(/\/$/, "");
})();

const raw = readFileSync("./.env.local", "utf8");
const g = (n) => { const l = raw.split(/\r?\n/).find((x) => x.startsWith(n)); return l.slice(l.indexOf("=") + 1).trim(); };
const SUPA = g("VITE_SUPABASE_URL"), ANON = g("VITE_SUPABASE_ANON_KEY");
const K = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

let weak = 0;
const mustGoRed = (name, wouldStillPass) => {
  if (wouldStillPass) weak++;
  console.log((wouldStillPass ? "WEAK" : "GOOD").padEnd(5), name.padEnd(54),
    wouldStillPass ? "STILL PASSES — it is guarding nothing" : "goes red when the text returns");
};

const s = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "test-icon@saathban.dev", password: "SaathTest!2026" }),
})).json();

const b = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
await ctx.addInitScript(([k, v]) => {
  localStorage.setItem(k, v); localStorage.setItem("saathban.app.lang", "en");
}, [K, JSON.stringify(s)]);
const p = await ctx.newPage();

/* The exact strings lane4-screens asserts are absent. If a needle
   here stops matching the shipped copy, the assertion it mirrors has
   quietly stopped guarding anything — which is what this file is for. */
const inject = (text) => p.evaluate((t) => {
  const el = document.createElement("p");
  el.textContent = t;
  document.body.appendChild(el);
}, text);

const at = async (path) => {
  await p.goto(BASE + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(2400);
  const landed = new URL(p.url()).pathname.replace(/\/$/, "");
  if (landed !== path.replace(/\/$/, "")) {
    console.error(`LANDED ON THE WRONG SCREEN: asked for ${path}, got ${landed}`);
    process.exit(4);
  }
};
const text = () => p.evaluate(() => document.body.innerText);

/* ── §2 on the places screen ── */
await at("/app/outdoor/places");
const clean = await text();
if (clean.includes("Good places to be out and about")) {
  console.error("BASELINE WRONG: the explainer is on screen before any injection.");
  process.exit(5);
}
await inject("Good places to be out and about — parks, markets, courtyards.");
await inject("👉 Tap a place to see who's there and check in yourself.");
const mutated = await text();
mustGoRed("§2 the four-line explainer is GONE", !mutated.includes("Good places to be out and about"));
mustGoRed('§2 the "Tap a place" hint is GONE', !mutated.includes("Tap a place to see who"));

/* ── §7 and §2 on What's on ── */
await at("/app/outdoor");
const askBtn = await p.$('button:has-text("Ask who")');
if (askBtn) { await askBtn.click(); await p.waitForTimeout(900); }

await inject("Ask them to confirm?");
const s1 = await text();
mustGoRed('§7 the old "Ask them to confirm?" wording is gone', !s1.includes("Ask them to confirm"));

/* The later-question check, which replaced an assertion that accepted
   any ellipsis on the page and so would have passed against the very
   seven-question scroll §7 exists to replace. */
await inject("Who can see it?");
const s2 = await text();
mustGoRed("§7 the LATER questions are not on screen",
  !s2.includes("Who can see it?") && !s2.includes("How many can come?"));

await inject("Open");
const s3 = await text();
mustGoRed('§2 the event action is never "Open"',
  !new RegExp("(^|\\n)\\s*Open\\s*(\\n|$)").test(s3));

await b.close();
console.log(`\n${weak} assertion(s) could not fail.`);
process.exit(weak ? 1 : 0);
