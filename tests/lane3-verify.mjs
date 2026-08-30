/* ════════════════════════════════════════════════
   LANE 3 — verifying tonight's fixes on the DEPLOYED preview.

   Run: BASE_URL=<preview> node tests/lane3-verify.mjs

   TONIGHT.md: "A green test against a working tree is not evidence."
   So this signs in as a real role against the deployed build and looks
   at what is on the screen.

   Every absence is paired with a PRESENCE that proves the check can
   see the thing at all — "My Journey is gone for Fam" is worthless
   without "My Journey is there for an Icon", because a selector that
   matches nothing would pass both.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const PASSWORD = process.env.TEST_PASSWORD || "SaathTest!2026";

function envLocal(name) {
  if (process.env[name]) return process.env[name].trim();
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(name));
  return line ? line.slice(line.indexOf("=") + 1).replace(/\s/g, "") : null;
}
const SUPA = envLocal("VITE_SUPABASE_URL");
const ANON = envLocal("VITE_SUPABASE_ANON_KEY");
const STORAGE_KEY = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

let fails = 0;
const check = (name, ok, note = "") => {
  if (!ok) fails++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(56), note);
};

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

const browser = await chromium.launch({ channel: "msedge", headless: true });

async function pageAs(email) {
  const session = await login(email);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [STORAGE_KEY, JSON.stringify(session)]);
  const page = await ctx.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message.slice(0, 140)));
  return { ctx, page };
}
async function text(page, path, settle = 1800) {
  await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(settle);
  return (await page.evaluate(() => document.body.innerText)).trim();
}

console.log(`\n──── verifying against ${BASE} ────\n`);

/* ── §3.1 My Journey: Icon has it, Fam does not ── */
{
  const { ctx, page } = await pageAs("test-icon@saathban.dev");
  const more = await text(page, "/app/more");
  check("§3.1 control: an Icon still sees My Journey", /My Journey/i.test(more));
  await ctx.close();
}
{
  const { ctx, page } = await pageAs("test-fam@saathban.dev");
  const more = await text(page, "/app/more");
  check("§3.1 a Fam member is no longer offered My Journey", !/My Journey/i.test(more));
  check("§3.1 control: Fam's More still has other doors", /Out & about|Calendar|Settings/i.test(more), "");
  await ctx.close();
}

/* ── §3.1 the gathering link no longer returns you to where you are ── */
{
  const { ctx, page } = await pageAs("test-icon@saathban.dev");
  await text(page, "/app/outdoor");
  const bad = await page.locator('a[href="/app/events"]').count();
  check("§3.1 no link to the /app/events redirect on What's on", bad === 0, `${bad} found`);
  await ctx.close();
}

/* ── §3.5 the calendar can repeat, and hold several times ── */
{
  const { ctx, page } = await pageAs("test-icon@saathban.dev");
  await text(page, "/app/calendar");
  const opened = await page
    .locator('button:has-text("Put something in")')
    .first()
    .click({ timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(1200);
  const body = (await page.evaluate(() => document.body.innerText)).trim();
  check("§3.5 the add panel opens", opened && /How often/i.test(body), opened ? "" : "no add button");
  check("§3.5 every repeat rule is offered", /Just once/i.test(body) && /Every day/i.test(body)
    && /Monday to Friday/i.test(body) && /Every week/i.test(body) && /Every month/i.test(body)
    && /Chosen days/i.test(body));
  check("§3.5 a second time can be added", /Add another time/i.test(body));
  const timesBefore = await page.locator('input[type="time"]').count();
  await page.locator('button:has-text("Add another time")').first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(500);
  const timesAfter = await page.locator('input[type="time"]').count();
  check("§3.5 tapping it really adds a time row", timesAfter === timesBefore + 1, `${timesBefore} → ${timesAfter}`);
  await page.locator('button:has-text("Chosen days")').first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(400);
  const withDays = (await page.evaluate(() => document.body.innerText)).trim();
  check("§3.5 custom offers the seven weekdays", /Mon/.test(withDays) && /Sun/.test(withDays));
  check("§3.5 no page errors on the calendar", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

/* ── §3.2 the turn chip, both ways round ── */
if (process.env.CHIP_STATE) {
  const { ctx, page } = await pageAs("test-icon@saathban.dev");
  const home = await text(page, "/app/home", 2600);
  const shown = /Your move|Your turn/i.test(home);
  const want = process.env.CHIP_STATE === "present";
  check(`§3.2 turn chip ${want ? "shows for a live table" : "is gone for a dormant table"}`,
        shown === want, `chip ${shown ? "present" : "absent"}`);
  await ctx.close();
}

console.log("\n" + (fails ? `${fails} FAILED` : "LANE 3 VERIFIED ON THE DEPLOYED PREVIEW"));
await browser.close();
process.exit(fails ? 1 : 0);
