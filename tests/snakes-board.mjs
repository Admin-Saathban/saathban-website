/* ════════════════════════════════════════════════
   Snakes & Ladders board contract.

   Run:  node tests/snakes-board.mjs

   ─── WHAT THIS COVERS, AND WHAT IT STOPPED COVERING ───

   Sections 1-5 check the ONE FIXED BOARD: board.js draws it,
   snakes_board_jump() plays it, and they must agree. That was the
   whole game when this file was written.

   IT IS NOW THE FALLBACK. The snakes redesign gives every table its
   own generated map in house_rules.board, so a live table does not
   read either of the two things sections 1-5 compare. Those
   sections kept passing and quietly stopped describing the game —
   which is worse than a failing test, because a green suite is read
   as coverage. Flagged by the lane that did the redesign; the
   honest fix is to say so here and to cover the real path, which is
   section 6.

   SECTION 6 CHECKS THE BOARDS TABLES ACTUALLY PLAY, and only
   against the invariants that are true of ANY snakes board — no
   self-jumps, nothing on 1 or 100, nothing off the board, no square
   hosting two jumps (which is also what forbids chains). It
   deliberately does NOT apply verifyBoard() wholesale: that
   function also demands 8-10 snakes and 8-10 ladders, which is a
   property of the old fixed map and not of the generator, and
   asserting it would fail perfectly good boards.

   The generator itself is another lane's, mid-flight. Proving that
   it can never emit a bad board belongs in a test beside it, over
   many generated boards; this checks the ones that actually exist.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { JUMPS, verifyBoard, cellCenter, CELL } from "../src/app/routes/games/snakes/board.js";
import { drawnEndpoints, crossingCount } from "../src/app/routes/games/snakes/art.js";

function envLocal(name) {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(name));
  return line.slice(line.indexOf("=") + 1).replace(/\s/g, "");
}
const SUPA = envLocal("VITE_SUPABASE_URL");
const ANON = envLocal("VITE_SUPABASE_ANON_KEY");
const PASSWORD = "SaathTest!2026";

let failures = 0;
const check = (name, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(62), note);
};
/* A CHECK THAT COVERED NOTHING MUST NOT SAY PASS.

   This whole file is here because five green sections stopped
   describing the game and nobody noticed — a green suite is read as
   coverage. A check that ran over zero rows and printed PASS would
   be the same lie in miniature, so it says SKIP and says why.

   SKIP does not fail the run: the row it needs may legitimately not
   exist yet, and a suite that goes red because nobody opened a
   table today is a suite people learn to ignore. It is loud in the
   output instead, which is the point. */
let skipped = 0;
const skip = (name, why) => {
  skipped++;
  console.log("SKIP".padEnd(5), name.padEnd(62), why);
};

const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "smoke-icon@saathban.dev", password: PASSWORD }),
});
const auth = await r.json();
if (!auth.access_token) throw new Error("login failed");

/* ─── 1. The drawn map obeys the rules ─── */
{
  const problems = verifyBoard(JUMPS);
  check("board.js satisfies every board rule", problems.length === 0, problems.join("; "));
}

/* ─── 2. Read the LIVE function, square by square ─── */
const live = {};
{
  const cells = Array.from({ length: 100 }, (_, i) => i + 1);
  for (let i = 0; i < cells.length; i += 20) {
    const batch = cells.slice(i, i + 20);
    const results = await Promise.all(
      batch.map(async (cell) => {
        const res = await fetch(`${SUPA}/rest/v1/rpc/snakes_board_jump`, {
          method: "POST",
          headers: {
            apikey: ANON,
            Authorization: `Bearer ${auth.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_cell: cell }),
        });
        return [cell, Number(await res.text())];
      })
    );
    for (const [cell, to] of results) if (to !== cell) live[cell] = to;
  }
  check("live snakes_board_jump() readable", Object.keys(live).length > 0, `${Object.keys(live).length} jumps`);
}

/* ─── 3. The live map obeys the same rules ─── */
{
  const problems = verifyBoard(live);
  check("the LIVE board satisfies every board rule", problems.length === 0, problems.join("; "));
}

/* ─── 4. …and the two are identical ─── */
{
  const drawn = Object.entries(JUMPS)
    .map(([f, t]) => `${f}→${t}`)
    .sort()
    .join(",");
  const played = Object.entries(live)
    .map(([f, t]) => `${f}→${t}`)
    .sort()
    .join(",");
  check("drawn board === played board", drawn === played, drawn === played ? "" : `\n  drawn:  ${drawn}\n  played: ${played}`);
}

/* ─── 5. The specifics the brief named ─── */
{
  const squares = Object.entries(live).flatMap(([f, t]) => [Number(f), Number(t)]);
  check("nothing starts or lands on square 1", !squares.includes(1));
  check("nothing starts or lands on square 100", !squares.includes(100));
  const snakes = Object.entries(live).filter(([f, t]) => t < Number(f));
  const drops = snakes.map(([f, t]) => Number(f) - t).sort((a, b) => a - b);
  const longOnes = drops.filter((d) => d > 15);
  check("snakes are mostly short", longOnes.length <= 2 && drops.filter((d) => d >= 5 && d <= 15).length >= 6, `drops ${drops.join(",")}`);
  const ladders = Object.entries(live).filter(([f, t]) => t > Number(f));
  check("8-10 of each", ladders.length >= 8 && ladders.length <= 10 && snakes.length >= 8 && snakes.length <= 10, `${ladders.length} ladders, ${snakes.length} snakes`);
}


/* ─── 5. The board that is DRAWN is the board that is PLAYED ───

   The map can be right while the picture is wrong. A player traces a
   snake with a finger to work out where they will land, so a head
   drawn a third of a square off its landing cell is a board that
   lies — and it lies in the most expensive way, by looking fine.

   These assert the rendered coordinates, not the data: every drawn
   path's head must sit on the exact centre of its own square, and the
   set of drawn paths must be exactly the engine's jumps.              */
{
  const drawn = drawnEndpoints();

  check("one drawn path per jump, no more and no fewer",
    drawn.length === Object.keys(JUMPS).length,
    `${drawn.length} drawn, ${Object.keys(JUMPS).length} in the map`);

  const off = drawn.filter((e) => {
    const h = cellCenter(e.from);
    const t = cellCenter(e.to);
    return e.head.x !== h.x || e.head.y !== h.y || e.tail.x !== t.x || e.tail.y !== t.y;
  });
  check("every head and tail sits exactly on its square's centre",
    off.length === 0,
    off.map((e) => `${e.from}->${e.to}`).join(" ") || "");

  const wrong = drawn.filter((e) => JUMPS[e.from] !== e.to);
  check("every drawn path connects the squares the engine connects",
    wrong.length === 0,
    wrong.map((e) => `drawn ${e.from}->${e.to}, engine ${e.from}->${JUMPS[e.from]}`).join("; "));

  check("ladders climb and snakes drop, as drawn",
    drawn.every((e) => (e.kind === "ladder" ? e.to > e.from : e.to < e.from)));

  /* Endpoints must also be far enough inside their square to READ as
     being in it — within a quarter cell of centre is the whole point
     of "exactly", but state the tolerance rather than implying it. */
  const stray = drawn.filter((e) => {
    const h = cellCenter(e.from);
    return Math.abs(e.head.x - h.x) > CELL / 4 || Math.abs(e.head.y - h.y) > CELL / 4;
  });
  check("no endpoint strays toward a neighbouring square", stray.length === 0);

  /* Some crossing is unavoidable with nineteen paths on a 10x10 grid.
     A ceiling stops it creeping up unnoticed when the map or the
     routing changes — art.js bends the curves to minimise it, and the
     game logic is never touched to help. */
  const crossings = crossingCount();
  check("drawn paths cross no more than six times", crossings <= 6, `${crossings} crossings`);
}


/* ─── 6. The boards LIVE TABLES actually play ───

   Every generated map on a real session, against the invariants
   that hold for any snakes board at all. See the header for why
   this is not verifyBoard(). ── */
{
  const res = await fetch(
    `${SUPA}/rest/v1/game_sessions?select=id,house_rules&game_key=eq.snakes&order=created_at.desc&limit=200`,
    { headers: { apikey: ANON, Authorization: `Bearer ${auth.access_token}` } }
  );
  const rows = res.ok ? await res.json() : [];
  const boards = rows
    .map((r) => [r.id, r.house_rules && r.house_rules.board])
    .filter(([, b]) => b && typeof b === "object" && Object.keys(b).length);


  const structural = (jumps) => {
    const problems = [];
    const entries = Object.entries(jumps).map(([f, t]) => [Number(f), Number(t)]);
    const seen = new Map();
    for (const [from, to] of entries) {
      if (!Number.isInteger(from) || !Number.isInteger(to)) problems.push(`${from}->${to} is not a pair of squares`);
      if (from === to) problems.push(`${from} jumps to itself`);
      for (const square of [from, to]) {
        if (square === 1) problems.push(`square 1 is part of ${from}->${to}`);
        if (square === 100) problems.push(`square 100 is part of ${from}->${to}`);
        if (square < 1 || square > 100) problems.push(`${square} is off the board`);
        /* One square, one jump. This is also what forbids chains:
           a landing square that is another jump's start would send
           a token twice in one throw. */
        if (seen.has(square)) problems.push(`square ${square} used twice (${seen.get(square)} and ${from}->${to})`);
        else seen.set(square, `${from}->${to}`);
      }
    }
    return problems;
  };

  const NAME = "every live generated board satisfies the structural invariants";
  if (!boards.length) {
    /* Expected as things stand: RLS shows a session only to the
       people at it, and the generated boards belong to whoever was
       testing the redesign. This account will see boards the day
       the smoke suite opens a snakes table of its own. */
    skip(NAME, "no generated board visible to this account");
  } else {
    const bad = boards
      .map(([id, b]) => [id, structural(b)])
      .filter(([, p]) => p.length);
    check(
      `${NAME} (${boards.length})`,
      bad.length === 0,
      bad.map(([id, p]) => `${id.slice(0, 8)}: ${p.join("; ")}`).join(" | ")
    );
  }
}

console.log(
  failures
    ? `\n${failures} FAILURE(S)`
    : skipped
    ? `\nall green, ${skipped} skipped — see the SKIP lines above`
    : "\nall green"
);
process.exit(failures ? 1 : 0);
