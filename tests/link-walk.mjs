/* ════════════════════════════════════════════════
   Link walk — every door in the app, opened, as a real role.

   TONIGHT.md LANE 3.1: "My Journey, Calendar and several other menu
   items all open the Out & about page", "Places near you not opening
   at all". The instruction is to walk EVERY link and confirm each
   lands where its label says.

   This does that by clicking, not by reading the route table. A route
   table that looks right is exactly what the reports have been saying
   while the app did something else, so the only evidence worth having
   is the landed URL after a real click in a real browser.

   Run:  BASE_URL=<deployed preview> node tests/link-walk.mjs
         node tests/link-walk.mjs            (localhost:5173)
         ROLE=fam node tests/link-walk.mjs   (icon | fam | buddy | admin)

   Credentials and the session-injection trick are smoke.mjs's, kept
   identical on purpose: one way of signing in for the whole rig.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

/* NO DEFAULT PORT. An assumed localhost default cost a full run of
   tests/messages-arrival.mjs: every lane works in this one directory,
   the port was taken, vite preview walked up to another, and the
   neighbour on the assumed port answered 200 to everything — so the
   assertions ran against a STALE BUILD and read like a broken feature.
   A default that silently points somewhere plausible is worse than no
   default. Read the port vite actually printed and pass it. */
const BASE = (process.env.BASE_URL || "").replace(new RegExp("/+$"), "");
if (!BASE) {
  console.error("Set BASE_URL — a deployed URL, or the port vite preview actually printed.");
  process.exit(2);
}
let _u;
try { _u = new URL(BASE); } catch { _u = null; }
if (!_u || !_u.hostname || (_u.protocol === "http:" && _u.hostname === "localhost" && !_u.port)) {
  console.error("BASE_URL is not a usable URL: " + JSON.stringify(BASE));
  process.exit(2);
}
const PASSWORD = process.env.TEST_PASSWORD || "SaathTest!2026";
const ROLE = process.env.ROLE || "icon";

function envLocal(name) {
  if (process.env[name]) return process.env[name].trim();
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const line = raw.split(/\r?\n/).find((l) => l.startsWith(name));
    return line ? line.slice(line.indexOf("=") + 1).replace(/\s/g, "") : null;
  } catch {
    return null;
  }
}
const SUPA = envLocal("VITE_SUPABASE_URL");
const ANON = envLocal("VITE_SUPABASE_ANON_KEY");
if (!SUPA || !ANON) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  process.exit(2);
}
const STORAGE_KEY = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

async function login(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`${email}: ${JSON.stringify(j).slice(0, 120)}`);
  return j;
}

const EMAIL = {
  icon: "test-icon@saathban.dev",
  fam: "test-fam@saathban.dev",
  buddy: "test-buddy@saathban.dev",
  admin: "test-admin@saathban.dev",
}[ROLE];

const browser = await chromium.launch({ channel: "msedge", headless: true });
const session = await login(EMAIL);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [
  STORAGE_KEY,
  JSON.stringify(session),
]);
const page = await ctx.newPage();
const errors = [];
/* RECORD WHERE, NOT JUST WHAT. This printed bare messages, so
   "Access is denied for this document" arrived with no way to tell
   which of 55 screens produced it — and since the reader is now asked
   to judge whether an error is the app or the harness, a message with
   no location cannot be judged at all. It was worth finding: the same
   localStorage call is READABLE in every other suite here, so an error
   from it means this walk reaches a context the others never touch. */
page.on("pageerror", (e) => errors.push(page.url().replace(BASE, "") + "  —  " + e.message.slice(0, 120)));

const go = async (path, settle = 1300) => {
  await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(settle);
};
const here = () => new URL(page.url()).pathname + new URL(page.url()).search;
const heading = async () =>
  (await page
    .evaluate(() => {
      const h = document.querySelector("h1, h2");
      return h ? h.innerText.trim().slice(0, 44) : "";
    })
    .catch(() => "")) || "";

/* Collect every anchor on the current screen: its visible label and
   the href it claims. Buttons are collected separately because their
   destination is only knowable by pressing them. */
async function anchors() {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]"))
      .filter((a) => a.offsetParent !== null)
      .map((a) => ({
        label: (a.innerText || a.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40),
        href: a.getAttribute("href"),
      }))
      .filter((a) => a.href && a.href.startsWith("/"))
  );
}

const rows = [];
function record(from, label, claimed, landed, head, note = "") {
  const ok = landed === claimed || landed.startsWith(claimed + "/") || landed.startsWith(claimed + "?");
  rows.push({ from, label, claimed, landed, head, ok, note });
  console.log(
    (ok ? "ok  " : "WRONG").padEnd(6),
    (label || "(no label)").padEnd(26),
    "claims", claimed.padEnd(26),
    "→ landed", landed.padEnd(28),
    head
  );
}

/* Walk one screen: list every link on it, then OPEN each href and
   record where it actually lands. Navigating rather than clicking is
   deliberate: the reported fault is a door opening the wrong room,
   which is a routing answer, and a direct visit asks the router the
   question without a click that might miss. */
async function walk(screen) {
  await go(screen);
  const start = here();
  const list = await anchors();
  const seen = new Set();
  console.log(`\n── ${screen}  (${list.length} links; screen shows as: ${await heading()})`);
  if (start !== screen) console.log(`   NOTE: ${screen} itself redirected to ${start}`);
  for (const { label, href } of list) {
    const keyed = label + "|" + href;
    if (seen.has(keyed)) continue;
    seen.add(keyed);
    await go(href, 1100);
    record(screen, label, href, here(), await heading());
  }
}
for (const screen of (process.env.SCREENS || "/app/more,/app,/app/outdoor,/app/games,/app/people,/app/community/messages").split(",")) {
  await walk(screen.trim());
}

console.log("\n──────── summary ────────");
const wrong = rows.filter((r) => !r.ok);
console.log(`${rows.length} links walked as ${ROLE}, ${wrong.length} landing somewhere other than their href`);
for (const r of wrong) console.log(`  ${r.from}  "${r.label}"  ${r.claimed} → ${r.landed}`);
if (errors.length) {
  console.log("\npage errors:");
  for (const e of [...new Set(errors)]) console.log("  " + e);
}
await ctx.close();
await browser.close();
/* IT USED TO EXIT 0 WHATEVER IT FOUND.

   This walks every link as a role and records the ones that land
   somewhere other than their href — it is how the doors that opened the
   wrong room were found in the first place. Then it printed the list and
   returned success, so in a batch run it was indistinguishable from a
   clean sweep, and the finding existed only if a person happened to read
   the scrollback.

   Same disease as thread-heart printing "should be 0" and exiting 0: a
   number on stdout is not an assertion. If a link lands somewhere other
   than it claims, that is a failure, and it belongs in the one channel a
   batch run actually reads. Page errors count too — a link that reaches
   the right route with a broken screen has not worked. */
/* FAIL ON THE THING THIS TOOL IS ABOUT, AND ONLY THAT.

   First attempt counted page errors as failures too, and it went red on
   a run where nothing was wrong: headless contexts throw "Access is
   denied for this document" reading localStorage, which is the harness,
   not the app. An assertion that fires on environmental noise gets
   ignored within a week, and an ignored assertion is worth less than
   none — it trains people to skip the one channel a batch run reads.

   A link landing somewhere other than its href cannot be environmental,
   so that is the failure. Page errors are printed loudly and left as a
   judgement for whoever is reading, because this tool cannot tell an
   app error from a sandbox one. */
const errs = [...new Set(errors)];
if (errs.length) console.log(errs.length + " page error(s) above — check whether any are the app rather than the harness");
console.log(wrong.length ? wrong.length + " LINK(S) LANDED SOMEWHERE ELSE" : "LINK WALK OK — every link landed where it claimed");
process.exit(wrong.length ? 1 : 0);
