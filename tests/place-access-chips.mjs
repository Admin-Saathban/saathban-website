/* OUT_AND_ABOUT_SPEC §4 — the chips, on the screen, as a person meets
   them. Not "the query returns rows": the rows are worthless if the
   place row does not render them, and a green build proves neither.
   Both languages, because §4's words ARE the feature and an English
   chip on an Urdu screen is a broken chip. */
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(/\/$/, "");
const raw = readFileSync("./.env.local", "utf8");
const g = (n) => { const l = raw.split(/\r?\n/).find((x) => x.startsWith(n)); return l.slice(l.indexOf("=") + 1).trim(); };
const SUPA = g("VITE_SUPABASE_URL"), ANON = g("VITE_SUPABASE_ANON_KEY");
const K = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.AS || "test-icon@saathban.dev", password: "SaathTest!2026" }),
});
const s = await r.json();
if (!s.access_token) { console.log("login failed"); process.exit(2); }

let fails = 0;
const check = (n, ok, note = "") => { if (!ok) fails++; console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(58), String(note).slice(0, 40)); };

const b = await chromium.launch({ channel: "msedge", headless: true });

for (const lang of ["en", "ur"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([k, v, l]) => {
    localStorage.setItem(k, v); localStorage.setItem("saathban.app.lang", l);
  }, [K, JSON.stringify(s), lang]);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 140)));

  const go = async (path, settle = 2600) => {
    await p.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    await p.waitForTimeout(settle);
    return (await p.evaluate(() => document.body.innerText)).trim();
  };

  const want = lang === "en"
    ? { shade: "Shade", benches: "Benches", noShade: "No shade", steps: "Steps at gate", wrong: "Something wrong here?" }
    : { shade: "سایہ", benches: "بینچ", noShade: "سایہ نہیں", steps: "دروازے پر سیڑھیاں", wrong: "یہاں کچھ ٹھیک نہیں؟" };

  /* The list. NOTE the path: /app/outdoor is What's on (happenings);
     the place ROWS live at /app/outdoor/places, reached by the quiet
     "Places near you" link at the foot of it. Seeded: Hill Park has
     shade + benches + toilet + steps at gate. */
  const home = await go("/app/outdoor/places");
  check(`[${lang}] the list renders with no page error`, errs.length === 0, errs[0] || "");
  check(`[${lang}] a green chip is on the place row`, home.includes(want.shade), want.shade);
  check(`[${lang}] a grey chip is on the place row`,
    home.includes(want.steps) || home.includes(want.noShade), want.steps);

  /* Grey must not be dressed as a hazard. §4: "not red, not a
     warning". Checked as pixels, because the whole instruction is
     about how it LOOKS. */
  const greyStyle = await p.evaluate((label) => {
    const el = [...document.querySelectorAll("span")].find(
      (x) => x.children.length <= 1 && x.textContent.replace(/[·✓\s]/g, "") === label.replace(/\s/g, "")
    );
    if (!el) return null;
    const c = getComputedStyle(el);
    return { color: c.color, background: c.backgroundColor, weight: c.fontWeight, size: c.fontSize };
  }, want.steps);
  if (greyStyle) {
    const rgb = (greyStyle.color.match(/\d+/g) || []).map(Number);
    const reddish = rgb.length >= 3 && rgb[0] > 150 && rgb[0] > rgb[1] * 1.6 && rgb[0] > rgb[2] * 1.6;
    check(`[${lang}] the grey chip is NOT red`, !reddish, greyStyle.color);
  } else {
    check(`[${lang}] the grey chip is NOT red`, false, "chip element not found");
  }

  /* NEVER COLOUR ALONE (CLAUDE.md, hard requirement). Every chip
     must carry a mark that survives colour-blindness and a greyscale
     screen: green ones a check, grey ones a dot. Asked of the DOM,
     not asserted from what I believe I wrote. */
  const marks = await p.evaluate((labels) => {
    const out = [];
    for (const label of labels) {
      const el = [...document.querySelectorAll("span")].find(
        (x) => x.children.length <= 1 && x.textContent.replace(/[·✓s]/g, "") === label.replace(/s/g, "")
      );
      out.push(el ? /[✓·]/.test(el.textContent) : null);
    }
    return out;
  }, [want.shade, want.steps]);
  check(`[${lang}] every chip carries a mark, not colour alone`,
    marks.every((m) => m === true), JSON.stringify(marks));

  /* The place screen: chips, and the report link on EVERY place. */
  const placeText = await go("/app/outdoor/945a2b9b-42c5-483e-8919-8433a748ad12");
  check(`[${lang}] the place screen renders with no page error`, errs.length === 0, errs[0] || "");
  check(`[${lang}] the place screen shows its chips`, placeText.includes(want.benches), want.benches);
  check(`[${lang}] "something wrong here?" is on the place`, placeText.includes(want.wrong), want.wrong);

  /* And on a place with NO notes at all — the case that matters most,
     because that is where a person knows what the app does not. */
  const bare = await go("/app/outdoor/61fa9c0d-bf43-4470-999c-403b16a5b487");
  check(`[${lang}] a place with NO notes still offers the link`, bare.includes(want.wrong), want.wrong);
  check(`[${lang}] a place with no notes shows no empty chip rail`,
    !bare.includes(want.shade) && !bare.includes(want.benches), "clean");

  await p.screenshot({ path: `tests/_shots/access-${lang}.png`, fullPage: false });
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failed.`);
process.exit(fails ? 1 : 0);
