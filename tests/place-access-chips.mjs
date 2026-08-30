/* OUT_AND_ABOUT_SPEC §4 — the chips, on the screen, as a person meets
   them. Not "the query returns rows": the rows are worthless if the
   place row does not render them, and a green build proves neither.
   Both languages, because §4's words ARE the feature and an English
   chip on an Urdu screen is a broken chip.

   ── Why this file now confirms notes before it looks ──

   0065 made an unverified note invisible to everyone, and the notes
   seeded in 0064 are guesses. So the honest state of the app is that
   NO chips render until an admin has actually checked something,
   which is correct and which broke this test — it was asserting a
   contract that no longer exists.

   The fixture therefore confirms two notes through the real admin
   path, looks, and then puts them BACK to unverified. That last step
   matters: leaving them confirmed would mean this test had quietly
   published my own guesses to every person using the app, which is
   the exact harm §4 is about. A test that has to lie about the world
   to pass should change the world back. */
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

const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.AS || "test-icon@saathban.dev", password: "SaathTest!2026" }),
});
const s = await r.json();
if (!s.access_token) { console.log("login failed"); process.exit(2); }

let fails = 0;
const check = (n, ok, note = "") => { if (!ok) fails++; console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(58), String(note).slice(0, 40)); };

/* ── Confirm two notes, as an admin, through the same columns the
      admin screen writes. Hill Park is the seeded place these
      assertions read. ── */
/* THREE places, not one, and the reason is a trap worth writing
   down: Hill Park is in KARACHI, and the places list opens on the
   person's own city — Lahore for the test account. Confirming only
   Hill Park made the place-screen assertions pass and every
   list-row assertion fail, which reads exactly like the list being
   broken. It was the fixture looking at the wrong city.

   So: Hill Park for the place screen, and two Lahore places for the
   list — one carrying greens and one carrying only greys, since the
   grey assertions need a grey chip actually on screen. */
const PLACE = "945a2b9b-42c5-483e-8919-8433a748ad12"; // Hill Park, Karachi
const SEEDED = [
  [PLACE, ["shade", "benches", "toilet", "steps_at_gate"]],
  ["2949ea63-57dd-460b-887e-cd08aa92cf8c", ["shade", "benches", "toilet", "flat_walk"]], // Bagh-e-Jinnah, Lahore
  ["23f33a2d-4b2a-4526-b780-bbc14b07bfcd", ["steps_at_gate", "no_shade"]],               // Badshahi, Lahore
];

const admin = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "test-admin@saathban.dev", password: "SaathTest!2026" }),
})).json();
if (!admin.access_token) { console.log("admin login failed"); process.exit(2); }

const setVerified = async (on) => {
  for (const [place, features] of SEEDED) {
    for (const f of features) {
      await fetch(`${SUPA}/rest/v1/outdoor_place_access?place_id=eq.${place}&feature=eq.${f}`, {
        method: "PATCH",
        headers: { apikey: ANON, Authorization: `Bearer ${admin.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ verified: on, verified_at: on ? new Date().toISOString() : null }),
      });
    }
  }
};
await setVerified(true);

/* Whatever happens below, the guesses go back to being guesses. */
const restore = async () => { await setVerified(false); };
process.on("exit", () => { /* best effort; the explicit call below is the real one */ });

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
await restore();

/* Prove the restore actually happened, rather than trusting it. A
   test that silently left my guesses published would be worse than a
   test that failed. */
const left = await (await fetch(
  `${SUPA}/rest/v1/outdoor_place_access?select=feature&verified=is.true`,
  { headers: { apikey: ANON, Authorization: `Bearer ${admin.access_token}` } })).json();
check("CLEANUP: the seeded guesses are unverified again",
  Array.isArray(left) && left.length === 0, `${left?.length ?? "?"} left confirmed`);

console.log(`\n${fails} failed.`);
process.exit(fails ? 1 : 0);
