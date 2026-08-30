/* The screens this lane rebuilt, opened as a person meets them.
 *
 * A green build proves none of this: an undefined identifier in a
 * component body is a runtime ReferenceError that `npm run build`
 * never sees, and this lane has shipped that mistake before. So every
 * screen is opened, in BOTH languages, and any page error fails the
 * run.
 *
 * Covers OUT_AND_ABOUT_SPEC §2 (the explainer, the city, add-a-place,
 * the weather line, the event action), §3 (faces, "Quiet right now"),
 * §7 (one question per screen, and the deleted confirm wording), §8
 * (moments), and GROUPS_SPEC §3/§7 (member count, the manage screen,
 * and that a member is refused it).
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = await (async () => {
  const raw = process.env.BASE_URL;
  if (!raw) {
    console.error(
      "BASE_URL is required — there is no default on purpose.\n" +
      "  local:    BASE_URL=http://localhost:<the port vite ACTUALLY printed> node <this file>\n" +
      "  deployed: BASE_URL=https://<preview host> node <this file>"
    );
    process.exit(2);
  }
  let u;
  try { u = new URL(raw); } catch {
    console.error(`BASE_URL is not a usable URL: ${JSON.stringify(raw)}`);
    process.exit(2);
  }
  const base = raw.replace(/\/$/, "");
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";

  // new URL("http://localhost:") parses fine and has an empty port.
  // That string is what you get from grepping vite's output, because
  // it prints ANSI colour codes between the colon and the digits.
  if (local && !u.port) {
    console.error(`BASE_URL names no port: ${raw}\nvite preview does not serve on 80 — pass the port it printed.`);
    process.exit(2);
  }

  let html;
  try {
    const r = await fetch(base + "/app/", { redirect: "follow" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    html = await r.text();
  } catch (e) {
    console.error(`Nothing is answering at ${base} (${e.message}).`);
    process.exit(2);
  }

  /* Is it THIS build? Several lanes share this directory, so the
     thing on the port you guessed is very often somebody else's
     older preview, and it answers 200 to everything. */
  if (local) {
    const served = (html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0];
    let built = null;
    try {
      built = (readFileSync("dist/index.html", "utf8").match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0];
    } catch { /* no dist/ — nothing to compare against, so say nothing */ }
    if (built && served && built !== served) {
      console.error(
        `${base} is serving a DIFFERENT build than dist/.\n` +
        `  served: ${served}\n  dist:   ${built}\n` +
        "Another lane's preview is probably on that port — vite walks 4173→4178 in\n" +
        "silence when it is taken. Results from here would describe their build, not yours."
      );
      process.exit(2);
    }
    if (built && served) console.log(`(serving ${served}, matches dist/)`);
  }
  return base;
})();
const raw = readFileSync("./.env.local", "utf8");
const g = (n) => { const l = raw.split(/\r?\n/).find((x) => x.startsWith(n)); return l.slice(l.indexOf("=") + 1).trim(); };
const SUPA = g("VITE_SUPABASE_URL"), ANON = g("VITE_SUPABASE_ANON_KEY");
const K = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

let fails = 0;
const check = (n, ok, note = "") => {
  if (!ok) fails++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(62), String(note).slice(0, 36));
};

const b = await chromium.launch({ channel: "msedge", headless: true });

const session = async (email) =>
  (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "SaathTest!2026" }),
  })).json();

const open = async (email, lang) => {
  const s = await session(email);
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.addInitScript(([k, v, l]) => {
    localStorage.setItem(k, v); localStorage.setItem("saathban.app.lang", l);
  }, [K, JSON.stringify(s), lang]);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 130)));
  const go = async (path, settle = 2500) => {
    await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(settle);
    return (await page.evaluate(() => document.body.innerText)).trim();
  };
  return { page, ctx, errs, go };
};

for (const lang of ["en", "ur"]) {
  const w = { en: {
    explainer: "Good places to be out and about",
    tapHint: "Tap a place to see who",
    quiet: "Quiet right now",
    open: "Open",
    illCome: "I'll come",
    whosGoing: "Who's going",
    oldConfirm: "Ask them to confirm",
    newConfirm: "Do you need to know who",
    next: "Next",
    moments: "I'm out",
    manage: "Manage this group",
    notYours: "This part is for the people who run the group",
  }, ur: {
    explainer: "گھر سے باہر اچھی جگہیں",
    tapHint: "کسی جگہ پر ٹیپ کریں",
    quiet: "ابھی خاموشی ہے",
    open: "کھولیں",
    illCome: "میں آؤں گا",
    whosGoing: "کون جا رہا ہے",
    oldConfirm: "تصدیق",
    newConfirm: "کیا آپ کو معلوم ہونا چاہیے",
    next: "آگے",
    moments: "میں باہر ہوں",
    manage: "اس گروپ کا انتظام",
    notYours: "یہ حصہ ان لوگوں کے لیے ہے",
  } }[lang];

  const icon = await open("test-icon@saathban.dev", lang);

  /* ── §2: the places screen ── */
  const places = await icon.go("/app/outdoor/places");
  check(`[${lang}] places screen renders with no page error`, icon.errs.length === 0, icon.errs[0] || "");
  check(`[${lang}] §2 the four-line explainer is GONE`, !places.includes(w.explainer), "");
  check(`[${lang}] §2 the "Tap a place" hint is GONE`, !places.includes(w.tapHint), "");
  /* The city is stated, not offered as a toggle to answer: exactly
     one control, not one per city. */
  const cityBtns = await icon.page.evaluate(() =>
    [...document.querySelectorAll("button")].filter((x) => /^(Karachi|Lahore)/.test(x.textContent.trim())).length);
  check(`[${lang}] §2 the city is stated, not a toggle`, cityBtns <= 1, `${cityBtns} city buttons`);
  const addBtns = await icon.page.evaluate(() =>
    [...document.querySelectorAll("button,a")].filter((x) => /Add a place|جگہ شامل/.test(x.textContent)).length);
  check(`[${lang}] §2 "Add a place" appears once`, addBtns === 1, `${addBtns} found`);

  /* ── §3: faces / quiet ── */
  check(`[${lang}] §3 an empty place says "Quiet right now", not 0`,
    places.includes(w.quiet) && !/\b0 people|0 لوگ/.test(places), "");

  /* ── §2: What's on ── */
  const whatson = await icon.go("/app/outdoor");
  check(`[${lang}] What's on renders with no page error`, icon.errs.length === 0, icon.errs[0] || "");
  check(`[${lang}] §2 the event action is never "Open"`,
    !new RegExp(`(^|\\n)\\s*${w.open}\\s*(\\n|$)`).test(whatson), "");
  check(`[${lang}] §2 events offer "Who's going"`, whatson.includes(w.whosGoing), "");

  /* ── §7: one question per screen ── */
  await icon.page.goto(BASE + "/app/outdoor", { waitUntil: "networkidle" }).catch(() => {});
  await icon.page.waitForTimeout(1800);
  const askBtn = await icon.page.$(`button:has-text("${lang === "en" ? "Ask who" : "پوچھیں"}")`);
  if (askBtn) {
    await askBtn.click();
    await icon.page.waitForTimeout(900);
    const s1 = (await icon.page.evaluate(() => document.body.innerText)).trim();
    check(`[${lang}] §7 the form is one question at a time`,
      s1.includes(w.next) || s1.includes("…"), "");
    check(`[${lang}] §7 the old "Ask them to confirm?" wording is gone`,
      !s1.includes(w.oldConfirm), "");
  } else {
    check(`[${lang}] §7 the ask flow opens`, false, "no ask button");
  }

  /* ── §8: moments ── */
  const moments = await icon.go("/app/outdoor/moments");
  check(`[${lang}] §8 the moments screen renders`, icon.errs.length === 0, icon.errs[0] || "");
  check(`[${lang}] §8 moments names itself`, moments.includes(w.moments), "");

  /* ── GROUPS §3/§7 ── */
  const list = await icon.go("/app/groups");
  const firstGroup = await icon.page.$('a[href^="/app/groups/"]');
  if (firstGroup) {
    const href = await firstGroup.getAttribute("href");
    const gp = await icon.go(href);
    check(`[${lang}] group interior renders`, icon.errs.length === 0, icon.errs[0] || "");
    check(`[${lang}] §3 the group states its member count`,
      /\d+\s*(people|لوگ)|Just you so far|ابھی صرف آپ/.test(gp), "");
    check(`[${lang}] §7 the people who run it are offered the manage door`,
      gp.includes(w.manage), "");
  } else {
    check(`[${lang}] group interior renders`, false, "no group to open");
  }

  await icon.ctx.close();
}

/* ── §7: "Members see none of it" — said, not hidden ── */
const fam = await open("test-fam@saathban.dev", "en");
const gs = await fam.go("/app/groups");
const anyGroup = await fam.page.$('a[href^="/app/groups/"]');
if (anyGroup) {
  const href = await anyGroup.getAttribute("href");
  const manage = await fam.go(`${href}/manage`);
  check("§7 a member reaching /manage is TOLD, not shown an empty page",
    /This part is for the people who run the group/.test(manage), manage.slice(0, 30));
} else {
  console.log("SKIP  §7 member refusal (this account is in no groups)");
}
await fam.ctx.close();

await b.close();
console.log(`\n${fails} failed.`);
process.exit(fails ? 1 : 0);
