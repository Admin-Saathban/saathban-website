/* ════════════════════════════════════════════════
   Snakes & Ladders board contract.

   Run:  node tests/snakes-board.mjs

   The board map exists in two places that must agree: board.js draws
   it, snakes_board_jump() plays it. This checks BOTH against the one
   shared contract in verifyBoard(), and then against each other —
   reading the LIVE function square by square rather than the
   migration file, so a create-or-replace that silently failed to
   apply can never leave the drawing and the game disagreeing.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { JUMPS, verifyBoard } from "../src/app/routes/games/snakes/board.js";

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

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
