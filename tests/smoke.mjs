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
   - the dedicated smoke pair smoke-icon / smoke-fam @saathban.dev
     (same password; in each other's circle). Every check that WRITES
     into a conversation or opens a table uses this pair, so the real
     test-icon ↔ test-fam thread the team retests in stays clean.

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
  for (const p of ["/app/home", "/app/admin", "/app/fam", "/app/vetting", "/app/circle", "/app/buddy"]) {
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
  ["test-buddy@saathban.dev", "buddy", "/app/buddy", "/app/fam"],
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
//    (The log page moved to /app/home/log when the hub landed.)
{
  const session = await login("test-icon@saathban.dev");
  const { ctx, page } = await pageFor(browser, session);
  const hubText = await goto(page, "/app/home");
  check("icon: hub renders area cards", hubText.includes("Community") && hubText.includes("Events"));
  await goto(page, "/app/home/log");
  const moodHeader = page
    .locator('button[aria-expanded]')
    .filter({ has: page.locator("text=Mood") })
    .first();
  if ((await moodHeader.getAttribute("aria-expanded")) === "false") await moodHeader.click();
  // First mood option (whatever the locale calls it).
  // The mood control is a multi-select chip group since 0033 (role=
  // checkbox + aria-checked); accept the older aria-pressed shape too
  // so this check tests persistence, not one lane's markup choice.
  await page
    .locator('[role="checkbox"], button[aria-pressed]')
    .filter({ hasText: "😄" })
    .first()
    .click();
  await page.waitForTimeout(2500); // debounce (700ms) + upsert
  await ctx.close();

  const session2 = await login("test-icon@saathban.dev");
  const { ctx: ctx2, page: page2 } = await pageFor(browser, session2);
  const body2 = await goto(page2, "/app/home/log", 2000);
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

// 5. Canonical DM thread (/app/people/<id>/chat): send lands, the
//    0030 bell notification fires for the recipient, opening the
//    thread shows the message scrolled-to-latest and clears the bell,
//    the reply arrives live over polling, and the old community
//    thread URL still redirects. Fails = DM regression.
{
  const iconSess = await login("smoke-icon@saathban.dev");
  const famSess = await login("smoke-fam@saathban.dev");
  const iconId = iconSess.user.id;
  const famId = famSess.user.id;

  const rest = async (sess, path) => {
    const r = await fetch(`${SUPA}/rest/v1/${path}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${sess.access_token}` },
    });
    return await r.json();
  };
  const unreadDm = async (sess) =>
    (await rest(sess, "notifications?select=id&kind=eq.dm&read_at=is.null")).length;
  // Icon opens the canonical surface (open_dm_with mints the pair's
  // one thread on first visit) and sends.
  const { ctx: iconCtx, page: iconPage } = await pageFor(browser, iconSess);
  await goto(iconPage, `/app/people/${famId}/chat`, 2500);
  const reqRows = await rest(
    iconSess,
    `dm_requests?select=id&or=(and(requester_id.eq.${iconId},recipient_id.eq.${famId}),and(requester_id.eq.${famId},recipient_id.eq.${iconId}))`
  );
  const requestId = reqRows[0]?.id;
  check("dm: one pair thread exists", reqRows.length === 1, JSON.stringify(reqRows).slice(0, 60));
  const before = await unreadDm(famSess);
  const marker = `smoke-dm-${Math.floor(Math.random() * 1e9)}`;
  await iconPage.fill("form input", marker);
  await iconPage.click('form button[type="submit"]');
  await iconPage.waitForTimeout(2500);
  const after = await unreadDm(famSess);
  check("dm: send reaches recipient's bell (0030)", after > before || before > 0, `${before} → ${after}`);

  // Fam opens the thread: message there, scrolled to latest, bell clears.
  const { ctx: famCtx, page: famPage } = await pageFor(browser, famSess);
  const famBody = await goto(famPage, `/app/people/${iconId}/chat`, 3000);
  check("dm: recipient sees message in canonical thread", famBody.includes(marker));
  const scrolled = await famPage.evaluate(() => {
    const box = [...document.querySelectorAll("div")].find((d) => d.style.overflowY === "auto");
    return box ? box.scrollTop + box.clientHeight >= box.scrollHeight - 60 : null;
  });
  check("dm: thread opens at latest message", scrolled !== false, `scrolled=${scrolled}`);
  await famPage.waitForTimeout(2500);
  check("dm: reading clears the bell", (await unreadDm(famSess)) === 0);

  // Fam replies; icon's already-open thread must catch it by polling.
  const reply = `smoke-reply-${Math.floor(Math.random() * 1e9)}`;
  await famPage.fill("form input", reply);
  await famPage.click('form button[type="submit"]');
  let live = false;
  for (let i = 0; i < 12 && !live; i++) {
    await iconPage.waitForTimeout(1000);
    live = (await iconPage.evaluate(() => document.body.innerText)).includes(reply);
  }
  check("dm: reply arrives live in open thread", live);

  // The pre-unification URL still lands people in the right place.
  if (requestId) {
    await goto(iconPage, `/app/community/messages/${requestId}`, 2200);
    check(
      "dm: old community URL redirects to canonical",
      pathOf(iconPage) === `/app/people/${famId}/chat`,
      `landed ${pathOf(iconPage)}`
    );
  }
  await iconCtx.close();
  await famCtx.close();
}

// 6. Games together layer: people-first create → invite → accept →
//    start → a real turn; then an open table joined by spoken code.
//    Each run creates two throwaway sessions (purge list covers them).
{
  const iconSess = await login("smoke-icon@saathban.dev");
  const famSess = await login("smoke-fam@saathban.dev");
  const buddySess = await login("test-buddy@saathban.dev");

  const { ctx: iconCtx, page: iconPage } = await pageFor(browser, iconSess);
  await goto(iconPage, "/app/games", 2000);
  await iconPage.locator('button:has-text("Open a table")').last().click(); // Race to 100
  await iconPage.waitForTimeout(1400);
  check(
    "games: create opens people picker",
    (await iconPage.evaluate(() => document.body.innerText)).includes("Who's playing?")
  );
  await iconPage.locator('button:has-text("Smoke Fam")').first().click();
  await iconPage.waitForTimeout(500);
  await iconPage.locator('button:has-text("set the table")').first().click();
  await iconPage.waitForTimeout(3000);
  const sessionPath = pathOf(iconPage);
  check("games: table created with invite", /^\/app\/games\/s\//.test(sessionPath), sessionPath);

  const { ctx: famCtx, page: famPage } = await pageFor(browser, famSess);
  const inviteTxt = await goto(famPage, sessionPath, 2500);
  check("games: invitee sees Take my seat", inviteTxt.includes("Take my seat"));
  await famPage.locator('button:has-text("Take my seat")').first().click();
  await famPage.waitForTimeout(3000);

  // Two humans fill the table — someone must now hold the dice.
  let rolled = false;
  for (const p of [iconPage, famPage]) {
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(2200);
    const roll = p.locator('button:has-text("Roll the dice")');
    if ((await roll.count()) > 0 && (await roll.first().isEnabled().catch(() => false))) {
      await roll.first().click();
      await p.waitForTimeout(2200);
      rolled = true;
      break;
    }
  }
  check("games: accept auto-starts and a turn plays", rolled);
  await famCtx.close();

  // Open table + code join.
  await goto(iconPage, "/app/games", 1800);
  await iconPage.locator('button:has-text("Open a table")').last().click();
  await iconPage.waitForTimeout(1200);
  await iconPage.locator('button:has-text("set the table"), button:has-text("open the table")').first().click();
  await iconPage.waitForTimeout(2800);
  const lobby = await iconPage.evaluate(() => document.body.innerText);
  const code = (lobby.match(/(\d[\s ]?){6}/) || [""])[0].replace(/\D/g, "");
  check("games: open table shows 6-digit code", code.length === 6, code);

  if (code.length === 6) {
    const { ctx: buddyCtx, page: buddyPage } = await pageFor(browser, buddySess);
    await goto(buddyPage, "/app/games", 1800);
    await buddyPage.locator('button:has-text("Have a code?")').click();
    await buddyPage.waitForTimeout(400);
    await buddyPage.fill('input[inputmode="numeric"]', code);
    await buddyPage.locator('button:has-text("Take me to the table")').click();
    await buddyPage.waitForTimeout(3000);
    check("games: buddy joins by code", /^\/app\/games\/s\//.test(pathOf(buddyPage)), pathOf(buddyPage));
    await buddyCtx.close();
  }
  await iconCtx.close();
}

// 7. Daily Riddle: solving works (or today's solve stands), the
//    people strip renders, and a cheer sends (or the daily cap
//    answers kindly) — riddle_touch through the real UI either way.
{
  const famSess = await login("test-fam@saathban.dev");
  const { ctx, page } = await pageFor(browser, famSess);
  const t0 = await goto(page, "/app/games/puzzle", 2200);
  if (t0.includes("Solved")) {
    check("riddle: today's solve stands", true, "already solved");
  } else {
    // The answer list for the seeded dev riddles includes "clock";
    // a wrong guess is still a pass for the MECHANISM if the guess
    // count moves — but assert the solve to catch RPC regressions.
    await page.fill("form input", "clock");
    // Submit explicitly: the form also carries "A hint, please", so
    // .last() clicked the hint and never sent the guess.
    await page.locator('form button[type="submit"], form button:has-text("Try it")').first().click();
    await page.waitForTimeout(2400);
    check(
      "riddle: guess submits and solves",
      (await page.evaluate(() => document.body.innerText)).includes("Solved")
    );
  }
  const strip = await page.evaluate(() => document.body.innerText);
  check("riddle: people strip shows a connection", strip.includes("Test Icon"));
  // Post-solve the strip offers a one-tap gesture per person: Shabash
  // to someone who has solved, a gentle invite to someone who has not.
  // Either is the affordance; which one depends on the day, so accept both.
  const cheer = page.locator('button:has-text("Shabash"), button:has-text("Invite them")');
  if ((await cheer.count()) > 0) {
    await cheer.first().click();
    await page.waitForTimeout(2000);
    const t1 = await page.evaluate(() => document.body.innerText);
    check("riddle: gesture sends or caps kindly", /Shabash sent|gentle word|plenty/i.test(t1), t1.slice(0, 60));
  } else {
    // Today's cheer already spent: the button yields to the 👏 ✓ mark
    // (riddle_touches cap). Either affordance passing is the check.
    check(
      "riddle: gesture sends or caps kindly",
      strip.includes("👏 ✓") || strip.includes("🕊️ ✓") || /plenty/i.test(strip),
      strip.includes("👏 ✓") || strip.includes("🕊️ ✓") ? "already reached out today" : "no cheer or invite affordance at all"
    );
  }
  await ctx.close();
}

// 8. Groups + activities: a group post lands; the standing activity
//    renders its join state on the outdoor place page (join_activity
//    path exercised by tapping when offered).
{
  const iconSess = await login("test-icon@saathban.dev");
  const { ctx, page } = await pageFor(browser, iconSess);
  await goto(page, "/app/groups", 2000);
  await page.locator('a:has-text("Sticker Test Group"), button:has-text("Sticker Test Group")').first().click();
  await page.waitForTimeout(2200);
  const marker = `smoke-group-${Math.floor(Math.random() * 1e9)}`;
  await page.locator("textarea, form input[type='text']").first().fill(marker);
  await page.locator('button:has-text("Post"), button:has-text("Share"), button:has-text("Send")').first().click();
  await page.waitForTimeout(2200);
  check(
    "group: post lands",
    (await page.evaluate(() => document.body.innerText)).includes(marker)
  );
  await ctx.close();

  const famSess = await login("test-fam@saathban.dev");
  const { ctx: famCtx, page: famPage } = await pageFor(browser, famSess);
  const outTxt = await goto(famPage, "/app/outdoor", 2200);
  // The fam fixture defaults to Karachi; the standing activity lives
  // in Lahore — switch chips when needed.
  if (!outTxt.includes("Model Town")) {
    await famPage.locator('button:has-text("Lahore")').first().click().catch(() => {});
    await famPage.waitForTimeout(1800);
  }
  await famPage.locator('a:has-text("Model Town"), button:has-text("Model Town")').first().click();
  await famPage.waitForTimeout(2200);
  const placeTxt = await famPage.evaluate(() => document.body.innerText);
  const joinBtn = famPage.locator('button', { hasText: "I'm in" });
  if ((await joinBtn.count()) > 0) {
    await joinBtn.first().click();
    await famPage.waitForTimeout(2200);
  }
  const after = await famPage.evaluate(() => document.body.innerText);
  check(
    "activity: happening renders with join state",
    /chai and carrom/i.test(placeTxt) && (/✓|in — room|on the list|is in/i.test(after)),
    after.match(/[^\n]*(room|is in|list)[^\n]*/)?.[0]?.slice(0, 70) || placeTxt.slice(0, 70)
  );
  await famCtx.close();
}

// 9. Fam-assisted daily-log setup (0033): the Fam dashboard offers the
//    "help set up their log" door for a granted member, the route
//    renders the shared panel, and an UNGRANTED member is told plainly
//    instead of being shown a form they cannot use.
{
  const famSess = await login("test-fam@saathban.dev");
  const { ctx, page } = await pageFor(browser, famSess);
  const home = await goto(page, "/app/fam", 2200);
  const link = page.locator('a[href*="log-setup"]');
  check("fam: log-setup door on the dashboard", (await link.count()) > 0, home.slice(0, 60));

  // The Icon whose log this Fam may configure — read from the link the
  // dashboard itself renders, so the check never hardcodes an id.
  const href = (await link.count()) ? await link.first().getAttribute("href") : "";
  const iconId = (href.match(/icon\/([0-9a-f-]{36})\/log-setup/) || [])[1];
  if (iconId) {
    const body = await goto(page, `/app/fam/icon/${iconId}/log-setup`, 2600);
    // Granted (baseline: can_configure_daily_log = true) → the panel.
    // Ungranted → the plain "hasn't asked for help" line, never a form.
    const granted = body.includes("Help set up") || body.includes("daily log");
    const refusedKindly = body.includes("hasn't asked for help") || body.includes("hasn’t asked for help");
    check("fam: log-setup renders the panel or a kind refusal", granted || refusedKindly, body.slice(0, 80));
    check("fam: log-setup never shows a dead page", body.trim().length > 60 && page.errors.length === 0, page.errors.join(" | "));
  }
  await ctx.close();
}

await browser.close();

console.log(`\n${results.length} checks, ${failures} failed.`);
process.exit(failures ? 1 : 0);
