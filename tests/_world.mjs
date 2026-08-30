import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(/\/$/, "");
const LANG = process.env.LANG_CODE || "en";
const raw = readFileSync("./.env.local", "utf8");
const g = (n) => { const l = raw.split(/\r?\n/).find((x) => x.startsWith(n)); return l.slice(l.indexOf("=") + 1).trim(); };
const SUPA = g("VITE_SUPABASE_URL"), ANON = g("VITE_SUPABASE_ANON_KEY");
const K = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.AS || "test-icon@saathban.dev", password: "SaathTest!2026" }),
});
const s = await r.json();
if (!s.access_token) { console.log("login failed", JSON.stringify(s).slice(0, 150)); process.exit(2); }

const b = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(([k, v, lang]) => {
  localStorage.setItem(k, v);
  localStorage.setItem("saathban.app.lang", lang);
}, [K, JSON.stringify(s), LANG]);
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
p.on("console", (m) => m.type() === "error" && errs.push("console: " + m.text().slice(0, 160)));

const go = async (path, settle = 2200) => {
  await p.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
  await p.waitForTimeout(settle);
  return (await p.evaluate(() => document.body.innerText)).trim();
};

const shot = process.env.SHOT_DIR || "tests/_shots";
let fails = 0;
const check = (n, ok, note = "") => { if (!ok) fails++; console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(50), note); };

for (const [name, path] of [
  ["chats", "/app/community/messages"],
  ["requests", "/app/community/messages/requests"],
  ["menu", "/app/community/messages/menu"],
  ["archived", "/app/community/messages/menu/archived"],
  ["blocked", "/app/community/messages/menu/blocked"],
]) {
  const t = await go(path);
  const lines = t.split("\n").map((x) => x.trim()).filter(Boolean);
  check(`${LANG} ${name} renders`, lines.length > 2, lines.slice(0, 5).join(" / ").slice(0, 90));
  if (name === "chats") {
    /* innerText sees the app bar even when it is painted behind an
       opaque layer, so the honest question is what a thumb actually
       hits at the bottom of the screen. */
    const atFoot = await p.evaluate(() => {
      const el = document.elementFromPoint(195, 820);
      const world = el && el.closest("[data-world=\"messages\"]");
      return { text: (el ? el.innerText || el.textContent : "").trim().slice(0, 40), inWorld: !!world };
    });
    check(`${LANG} the bottom of the screen belongs to the world`, atFoot.inWorld, JSON.stringify(atFoot));
  }
  await p.screenshot({ path: `${shot}/world-${LANG}-${name}.png` }).catch(() => {});
}

check(`${LANG}: no page errors in the world`, errs.length === 0, [...new Set(errs)].slice(0, 2).join(" | "));
console.log(fails ? `\n${fails} FAILED` : `\nWORLD OK (${LANG})`);
await b.close();
process.exit(fails ? 1 : 0);
