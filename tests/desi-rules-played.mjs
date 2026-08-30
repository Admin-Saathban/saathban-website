/* ════════════════════════════════════════════════
   The desi rules, VERIFIED BY PLAYING — TONIGHT.md §3.

   Run:  node tests/desi-rules-played.mjs [--preview]

   The difference from tests/ludo-jota.mjs is the whole reason this
   file exists. That suite asks the ENGINE. This one puts a board in
   front of a real browser, signed in as a real player, and reads what
   the SCREEN offers — the destination markers the board draws, the
   words in the jota chooser, how many dice are on the table. A rule
   the engine enforces but the table never offers is a rule the player
   does not have, and only this kind of test can tell the difference.

   With --preview it drives the DEPLOYED url rather than a dev server,
   which is the bar TONIGHT.md sets: "A green test against a working
   tree is not evidence."

   FIXTURES ARE NOT CREATED HERE, and that is deliberate. Setting a
   board means writing game_sessions.state, which a seated player may
   not do — RLS refuses it, correctly. So the positions are made with
   service credentials and recorded in desi-fixtures.json, and this
   suite RE-READS each one from the database and checks it is the
   position the rule needs before judging anything against it.

   That check earned its place immediately: the first set of ids was
   mislabelled — mapped by a join that did not line up — so every tag
   pointed at somebody else's board. Judged blindly it would have
   reported four rules broken. Never trust the label on a fixture.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const PREVIEW = process.argv.includes("--preview");
const BASE = PREVIEW
  ? "https://saathban-website-git-feature-app-basil-farooqs-projects.vercel.app"
  : "http://[::1]:5173";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pick = (k) => {
  const l = env.split(/\r?\n/).find((x) => x.startsWith(k));
  return l.slice(l.indexOf("=") + 1).trim();
};
const SUPA = pick("VITE_SUPABASE_URL");
const ANON = pick("VITE_SUPABASE_ANON_KEY");
const REF = SUPA.match(/https:\/\/([a-z0-9]+)\./)[1];
const FIX = JSON.parse(readFileSync(new URL("./desi-fixtures.json", import.meta.url), "utf8"));

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(60)}${detail}`);
};

async function login(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "SaathTest!2026" }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`login failed: ${email}`);
  return j;
}

const readSession = async (token, id) => {
  const r = await fetch(`${SUPA}/rest/v1/game_sessions?id=eq.${id}&select=state,status,current_seat`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  const j = await r.json();
  return Array.isArray(j) ? j[0] : null;
};

/* What the SCREEN is offering right now. */
const readTable = (page) =>
  page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="Ludo board"]');
    const dashed = svg
      ? [...svg.querySelectorAll("circle")].filter((c) => c.getAttribute("stroke-dasharray") === "5 4")
      : [];
    const text = (document.body.innerText || "").replace(/\s+/g, " ");
    /* A die on a plate is a 44px rounded box holding an SVG face. */
    const dice = [...document.querySelectorAll("svg")].filter((s) => {
      const r = s.getBoundingClientRect();
      return r.width >= 24 && r.width <= 46 && Math.abs(r.width - r.height) < 6;
    }).length;
    return {
      board: !!svg,
      destinations: dashed.length,
      chooserOpen: /Two of your gotis|آپ کی دو گوٹیاں/.test(text),
      offersBoth: /Move both together|دونوں ساتھ چلائیں/.test(text),
      offersOne: /move just one|صرف ایک چلائیں/i.test(text),
      /* MATCHED AGAINST THE ACTUAL COPY, in both languages.
         The first version of this looked for "sixes" and found
         nothing — because the card says "Six number 2", singular,
         with the count after it. The card had been on the screen the
         whole time and the CHECKER was wrong, which is the third time
         tonight a red result has turned out to be the instrument
         rather than the app. */
      chainLine: /Six number \d|چھکا نمبر/.test(text),
      dice,
      text: text.slice(0, 260),
    };
  });

(async () => {
  const icon = await login("test-icon@saathban.dev");

  /* ── Every fixture is what it claims, before any rule is judged ── */
  const ok = {};
  for (const [tag, spec] of Object.entries(FIX)) {
    if (tag.startsWith("_")) continue;
    const row = await readSession(icon.access_token, spec.id);
    const st = row?.state || {};
    const want = spec.expect;
    const same =
      !!row &&
      row.status === "active" &&
      JSON.stringify(st.pieces) === JSON.stringify(want.pieces) &&
      (want.pairs_moved === undefined ||
        JSON.stringify(st.pairs_moved || {}) === JSON.stringify(want.pairs_moved)) &&
      (want.chain === undefined || Number(st.chain) === want.chain) &&
      (want.die === undefined || (st.dice || [])[0]?.v === want.die) &&
      (want.dice_count === undefined || (st.dice || []).length === want.dice_count);
    ok[tag] = same;
    check(`fixture "${tag}" holds the position it claims`, same,
      same ? "" : `pieces=${JSON.stringify(st.pieces)} pairs=${JSON.stringify(st.pairs_moved)} dice=${JSON.stringify(st.dice)}`);
  }

  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(icon)]);

  const open = async (tag) => {
    await page.goto(`${BASE}/app/games/ludo/${FIX[tag].id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2800);
    return readTable(page);
  };

  console.log(`\n── played against ${PREVIEW ? "THE DEPLOYED PREVIEW" : "a dev server"} ──\n`);

  /* ── A virgin jota asks which you meant ───────────────────────── */
  if (ok.virgin_jota) {
    await open("virgin_jota");
    const ring = await page.$(".sb-pulse");
    if (ring) {
      const b = await ring.boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(1000);
    }
    const t = await readTable(page);
    check("a virgin jota asks which you meant", t.chooserOpen, t.chooserOpen ? "" : t.text.slice(0, 110));
    check("  …offering BOTH intents, in words", t.offersBoth && t.offersOne);
  }

  /* ── A moved jota travels on evens only ───────────────────────── */
  if (ok.moved_jota_even && ok.moved_jota_odd) {
    const even = await open("moved_jota_even");
    const odd = await open("moved_jota_odd");
    check("a moved jota is offered a move on an EVEN die", even.destinations > 0, `${even.destinations} destinations`);
    check("a moved jota is offered nothing on an ODD die", odd.destinations === 0, `${odd.destinations} destinations`);
  }

  /* ── An open sixes chain is said out loud ─────────────────────── */
  if (ok.sixes_chain) {
    const t = await open("sixes_chain");
    check("an open sixes chain is on screen", t.chainLine, t.chainLine ? "" : t.text.slice(0, 110));
  }

  /* ── Two dice are both on the table ───────────────────────────── */
  if (ok.two_dice) {
    const t = await open("two_dice");
    check("a two-dice table shows two dice", t.dice >= 2, `${t.dice} die faces drawn`);
  }

  await browser.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("suite error:", e.message);
  process.exit(1);
});
