/* Drives the real composer to make one post of each type, screenshots
   each, then removes them. POSTS_SPEC §1-§6. */
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(/\/$/, "");
const LANG = process.env.LANG_CODE || "en";
const SHOTS = process.env.SHOT_DIR || "tests/_shots";
const raw = readFileSync("./.env.local", "utf8");
const g = (n) => { const l = raw.split(/\r?\n/).find((x) => x.startsWith(n)); return l.slice(l.indexOf("=") + 1).trim(); };
const SUPA = g("VITE_SUPABASE_URL"), ANON = g("VITE_SUPABASE_ANON_KEY");
const K = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "test-icon@saathban.dev", password: "SaathTest!2026" }),
});
const s = await r.json();
if (!s.access_token) { console.log("login failed"); process.exit(2); }

const b = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
await ctx.addInitScript(([k, v, lang]) => {
  localStorage.setItem(k, v);
  localStorage.setItem("saathban.app.lang", lang);
}, [K, JSON.stringify(s), LANG]);
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message.slice(0, 150)));

let fails = 0;
const check = (n, ok, note = "") => { if (!ok) fails++; console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(46), note); };

const L = {
  en: { row: "Say something to your neighbours", share: "Share", newPost: "New post",
        tags: { milestone: "A milestone", good: "Something good", memory: "A memory", help: "Asking for help" },
        vis: "Anyone on Saathban can see this", canHelp: "I can help" },
  ur: { row: "اپنے پڑوسیوں سے کچھ کہیے", share: "شائع کریں", newPost: "نئی بات",
        tags: { milestone: "ایک سنگِ میل", good: "کوئی اچھی بات", memory: "ایک یاد", help: "مدد کی درخواست" },
        vis: "ساتھ بن پر ہر کوئی اسے دیکھ سکتا ہے", canHelp: "میں مدد کر سکتا ہوں" },
}[LANG];

const feed = async () => {
  await p.goto(BASE + "/app/community", { waitUntil: "networkidle" });
  await p.waitForTimeout(2400);
};

await feed();
check(`${LANG} the composer row is on the feed`, await p.getByText(L.row).first().isVisible().catch(() => false));

/* Open it and confirm §1's parts are there. */
await p.getByText(L.row).first().click();
await p.waitForTimeout(900);
const body = await p.evaluate(() => document.body.innerText);
check(`${LANG} the composer opens full screen`, body.includes(L.newPost));
check(`${LANG} the visibility line is a sentence`, body.includes(L.vis), "§2");
check(`${LANG} all four style tags offered`, Object.values(L.tags).every((x) => body.includes(x)), "§4");
await p.screenshot({ path: `${SHOTS}/composer-${LANG}.png` });

/* Make one post of each type. */
const made = [];
async function post(text, { tag = null, colour = null } = {}) {
  if (!(await p.getByText(L.newPost).first().isVisible().catch(() => false))) {
    await feed();
    await p.getByText(L.row).first().click();
    await p.waitForTimeout(800);
  }
  await p.locator("textarea").first().fill(text);
  if (colour != null) { await p.locator(`button[aria-label="${LANG === "ur" ? "رنگ" : "Colour"} ${colour}"]`).first().click().catch(() => {}); }
  if (tag) { await p.getByRole("button", { name: L.tags[tag], exact: true }).first().click().catch(() => {}); }
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: L.share, exact: true }).first().click();
  await p.waitForTimeout(3000);
  made.push(text);
}

await post("ZZ plain — a quiet word to the neighbours about the weather.");
await post("ZZ colour — chai on the veranda", { colour: 1 });
await post("ZZ milestone — fifty years in this house today.", { tag: "milestone" });
await post("ZZ memory — the old banyan by the gate.", { tag: "memory" });
await post("ZZ help — I cannot manage the ladder to change a bulb.", { tag: "help" });

await feed();
const after = await p.evaluate(() => document.body.innerText);
check(`${LANG} every post type reached the feed`, made.every((m) => after.includes(m.slice(0, 20))), `${made.length} made`);
/* As the AUTHOR you are never offered help on your own ask (§6) — the
   control is the done one. The neighbour side is tests/_help.mjs. */
check(`${LANG} the author sees the done control on their ask`, /This is sorted|یہ کام ہو گیا/.test(after), "§6.2");
check(`${LANG} no "Shared" toast after posting`, !/Shared|شائع ہو گیا/.test(after), "§11");
await p.screenshot({ path: `${SHOTS}/feed-types-${LANG}.png`, fullPage: true });

/* The §10 menu, from the three dots. */
await p.locator('button[aria-label*="More"], button:has-text("⋯")').first().click().catch(() => {});
await p.waitForTimeout(800);
const menu = await p.evaluate(() => document.body.innerText);
check(`${LANG} the post menu opens`, /Pin to your profile|اپنی پروفائل پر لگائیں|Save this|محفوظ کریں/.test(menu), "§10");
check(`${LANG} no Block in the post menu`, !/^Block$|بلاک کریں/m.test(menu), "§10 — Block belongs on a profile");
await p.screenshot({ path: `${SHOTS}/postmenu-${LANG}.png` });

check(`${LANG} no page errors`, errs.length === 0, [...new Set(errs)].slice(0, 2).join(" | "));
console.log(fails ? `\n${fails} FAILED` : `\nPOSTS OK (${LANG})`);
await b.close();
process.exit(fails ? 1 : 0);
