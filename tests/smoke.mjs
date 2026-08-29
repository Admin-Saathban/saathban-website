/* ════════════════════════════════════════════════
   Saathban app smoke suite.

   Run:  npm run smoke                (against http://localhost:5173)
         BASE_URL=<url> npm run smoke (against a deployed preview)

   Requires:
   - playwright-core (devDependency) + Microsoft Edge installed
     (channel "msedge" — no browser download needed)
   - .env.local with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
     (or the same values in the environment)
   - the four seeded test accounts (password SaathTest!2026):
     test-icon / test-buddy / test-fam / test-admin @saathban.dev

   Covers: signed-out guard redirects, signup entry redirect, each
   role's home (+ cross-role bounce), Icon daily-log persistence
   across a reload, and the Buddy vetting status screen.

   Sessions are established via a real password grant and injected
   as the supabase-js localStorage key — the exact session shape the
   client itself stores — so the suite exercises real RLS-backed
   reads, not mocks.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

// ─── Config ───
const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const PASSWORD = process.env.TEST_PASSWORD || "SaathTest!2026";

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
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (env or .env.local).");
  process.exit(2);
}
const STORAGE_KEY = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

// ─── Tiny harness ───
let failures = 0;
const results = [];
function check(name, ok, note = "") {
  if (!ok) failures++;
  results.push([ok, name, note]);
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(46), note);
}

async function login(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`${email}: login failed — ${JSON.stringify(j).slice(0, 100)}`);
  return j;
}

async function pageFor(browser, session) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message.slice(0, 100)));
  page.on("console", (m) => m.type() === "error" && page.errors.push(m.text().slice(0, 100)));
  if (session) {
    await page.addInitScript(
      ([k, v]) => localStorage.setItem(k, v),
      [STORAGE_KEY, JSON.stringify(session)]
    );
  }
  return { ctx, page };
}

async function goto(page, path, settle = 1400) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(settle);
  return (await page.evaluate(() => document.body.innerText)).trim();
}
const pathOf = (page) => new URL(page.url()).pathname;

// ─── Suite ───
const browser = await chromium.launch({ channel: "msedge", headless: true });

// 1. Signed-out: guards redirect to login; signup entry reachable.
{
  const { ctx, page } = await pageFor(browser, null);
  for (const p of ["/app/home", "/app/admin", "/app/fam", "/app/vetting", "/app/circle"]) {
    await goto(page, p, 900);
    check(`guard ${p} → login`, pathOf(page) === "/app/auth/login", `landed ${pathOf(page)}`);
  }
  const roleText = await goto(page, "/app/auth", 900);
  check("signup entry shows role cards", roleText.includes("Saath-Icon") && roleText.includes("Saath-Buddy"));
  await ctx.close();
}

// 2. Each role's home + one cross-role bounce, zero console errors.
const ROLES = [
  ["test-icon@saathban.dev", "icon", "/app/home", "/app/admin"],
  ["test-admin@saathban.dev", "admin", "/app/admin", "/app/home"],
  ["test-fam@saathban.dev", "fam", "/app/fam", "/app/admin"],
  ["test-buddy@saathban.dev", "buddy", "/app/vetting", "/app/fam"],
];
for (const [email, label, home, foreign] of ROLES) {
  const session = await login(email);
  const { ctx, page } = await pageFor(browser, session);
  const body = await goto(page, home);
  check(
    `${label}: own home renders`,
    body.length > 40 && page.errors.length === 0,
    page.errors.join(" | ")
  );
  await goto(page, foreign, 900);
  check(
    `${label}: bounced from ${foreign}`,
    !pathOf(page).startsWith(foreign),
    `landed ${pathOf(page)}`
  );
  await ctx.close();
}

// 3. Icon log persistence: pick a mood, wait for the sync flush,
//    reload in a FRESH context (no cache) — the server row must feed it.
{
  const session = await login("test-icon@saathban.dev");
  const { ctx, page } = await pageFor(browser, session);
  await goto(page, "/app/home");
  const moodHeader = page
    .locator('button[aria-expanded]')
    .filter({ has: page.locator("text=Mood") })
    .first();
  if ((await moodHeader.getAttribute("aria-expanded")) === "false") await moodHeader.click();
  // First mood option (whatever the locale calls it).
  await page.locator('button[aria-pressed]').filter({ hasText: "😄" }).first().click();
  await page.waitForTimeout(2500); // debounce (700ms) + upsert
  await ctx.close();

  const session2 = await login("test-icon@saathban.dev");
  const { ctx: ctx2, page: page2 } = await pageFor(browser, session2);
  const body2 = await goto(page2, "/app/home", 2000);
  check("icon: mood persists across fresh session", body2.includes("😄"), "");
  await ctx2.close();
}

// 4. Buddy vetting status: the live application renders as the
//    pipeline status screen, never a blank re-application form.
{
  const session = await login("test-buddy@saathban.dev");
  const { ctx, page } = await pageFor(browser, session);
  const body = await goto(page, "/app/vetting", 2000);
  const isStatus =
    body.includes("conversation stage") || // interviewing
    body.includes("review team") || // pending
    body.includes("Probation") ||
    body.includes("full Saath-Buddy"); // active
  check("buddy: vetting shows pipeline status", isStatus, JSON.stringify(body.slice(0, 60)));
  check("buddy: no blank re-application form", !body.includes("CNIC number") || isStatus);
  await ctx.close();
}

await browser.close();

console.log(`\n${results.length} checks, ${failures} failed.`);
process.exit(failures ? 1 : 0);
