import { chromium } from "playwright-core";

const BASE = "https://saathban-website-git-feature-app-basil-farooqs-projects.vercel.app";
const S = process.env.SCRATCH;
const PW = "SaathTest!2026";
const EMAIL = "smoke-icon@saathban.dev";

let failures = 0;
const ok = (l, c, n = "") => { if (!c) failures++; console.log(`${c ? "PASS" : "FAIL"} ${l} ${n}`); };

const b = await chromium.launch({ channel: "chrome", headless: true });

for (const lang of ["en", "ur"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));

  await p.goto(`${BASE}/app/auth/login`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  if (lang === "ur") {
    await p.evaluate(() => localStorage.setItem("saathban.app.lang", "ur"));
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2500);
  }

  /* §1 of PRODUCT_DECISIONS: the whole login is one screen now. */
  const form = p.locator('form:has(input[type="password"])');
  await form.locator('input[type="email"]').fill(EMAIL);
  await form.locator('input[type="password"]').fill(PW);
  await form.locator('button[type="submit"]').click();
  await p.waitForTimeout(6000);

  await p.screenshot({ path: `${S}/prev-${lang}-1-home.png`, fullPage: false });
  let body = await p.locator("body").innerText();

  /* §1 — Home is the feed. */
  ok(`${lang}: signed in and on Home`, /Good morning|Good afternoon|Good evening|صبح بخیر|دوپہر|شام/.test(body),
    body.slice(0, 50).replace(/\n/g, " "));

  /* §4 — the three doors, no menu needed. */
  ok(`${lang}: Out & about is on Home`, /Out & about|باہر/.test(body));
  ok(`${lang}: Friend groups is on Home`, /groups|گروپ/i.test(body));
  ok(`${lang}: Grow is on Home`, /Grow|بڑھ|سیکھ/i.test(body));

  /* §3 — one menu. The header hamburger must be gone. */
  const headerBurger = await p.locator("header button", { hasText: "☰" }).count();
  ok(`${lang}: NO hamburger in the header`, headerBurger === 0, `${headerBurger} found`);

  /* §2 — the bar. */
  const bar = await p.locator("nav a, nav button").allInnerTexts();
  const barText = bar.join(" | ");
  ok(`${lang}: Messages has a bar slot`, /Messages|پیغامات/.test(barText), barText.slice(0, 90));
  ok(`${lang}: Community is NOT a bar tab`, !/Community|کمیونٹی/.test(barText), barText.slice(0, 90));

  /* §1 — the real feed, not a reader: the composer must be here. */
  const composer = await p.locator("textarea").count();
  ok(`${lang}: the feed's composer is on Home`, composer > 0, `${composer} textarea`);

  /* §5 — back returns to More, not Home. */
  await p.goto(`${BASE}/app/more`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${S}/prev-${lang}-2-more.png`, fullPage: true });
  const moreBody = await p.locator("body").innerText();
  ok(`${lang}: Settings lives in More`, /Settings|ترتیبات/.test(moreBody));
  /* My regex, not the app: the label is "My profile" (lowercase p) and
     "میری معلومات" in Urdu — "my information", not a transliteration.
     The link was fine all along; the next assertion clicks it. */
  ok(`${lang}: Profile lives in More`, /my profile|میری معلومات/i.test(moreBody),
    (moreBody.match(/my profile|میری معلومات/i) || ["not found"])[0]);

  const profileLink = p.locator('a[href="/app/profile"]').first();
  if (await profileLink.count()) {
    await profileLink.click();
    await p.waitForTimeout(3000);
    const backBtn = p.locator("header button").first();
    if (await backBtn.count()) {
      await backBtn.click();
      await p.waitForTimeout(2500);
      ok(`${lang}: back from Profile returns to MORE`, p.url().includes("/app/more"), p.url());
    } else ok(`${lang}: a back control exists`, false);
  } else ok(`${lang}: profile is reachable from More`, false);

  /* §6 — the photo control, on the deployed profile. */
  await p.goto(`${BASE}/app/profile`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${S}/prev-${lang}-3-profile.png`, fullPage: true });
  const pb = await p.locator("body").innerText();
  ok(`${lang}: a photo control exists`, /Add a photo|Change photo|تصویر لگائیں|تصویر بدلیں/.test(pb));
  ok(`${lang}: languages are chips`, (await p.locator('button[aria-pressed]').count()) >= 8);
  ok(`${lang}: NO completion percentage`, !/%/.test(pb));

  /* §7 — the account half. */
  await p.goto(`${BASE}/app/settings`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${S}/prev-${lang}-4-settings.png`, fullPage: true });
  const sb = await p.locator("body").innerText();
  ok(`${lang}: settings has an account section`, /Your account|آپ کا اکاؤنٹ/.test(sb));
  ok(`${lang}: password can be set or changed`, /password|پاس ورڈ/i.test(sb));
  ok(`${lang}: privacy is there`, /Who can see my profile|میری پروفائل کون/.test(sb));
  ok(`${lang}: sign out is reachable`, /Sign out|سائن آؤٹ/i.test(sb));

  ok(`${lang}: no page errors across the walk`, errors.length === 0, errors.join(" | ").slice(0, 120));
  await ctx.close();
}

await b.close();
console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
