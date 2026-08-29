/* ════════════════════════════════════════════════
   Snakes & Ladders — the board map and its geometry.

   The classic 10×10 layout: cell 1 at bottom-left, rows snake back and
   forth (boustrophedon), 100 at top-left. JUMPS must match
   snakes_board_jump() in supabase/migrations/0036_snakes_board.sql
   exactly — the server decides where a landing takes you; this file
   only draws it. verifyBoard() below is the shared contract, and
   tests/snakes-board.mjs runs it against BOTH this map and the live
   SQL so the two can never drift apart.

   THE RULES THE MAP OBEYS (and why):

   - Nothing starts or lands on 1 or 100. A ladder from 1 fires before
     the player has really begun; a ladder onto 100 wins the game by
     landing on the ladder rather than by rolling the exact number the
     finish asks for.
   - Ladders only ever climb, snakes only ever drop.
   - Every one of the 38 squares involved is DISTINCT. That single
     property gives three guarantees at once: no square hosts two
     jumps, no jump lands on another jump's mouth, and therefore no
     chains are possible at all.
   - Snakes are mostly SHORT — eight drops of 6 to 14 squares, the
     kind that sting but don't undo an afternoon — with exactly two
     long ones (30 and 35) to keep the board honest. Ladder climbs are
     varied the same way: eight of 11 to 21, one long one of 33.
   ════════════════════════════════════════════════ */

/* landing cell → destination. Up = ladder, down = snake. */
export const JUMPS = {
  // ladders (foot → top): nine climbs, one of them long
  4: 25, 13: 46, 27: 38, 33: 52, 42: 63, 50: 69, 62: 81, 74: 92, 85: 97,
  // snakes (head → tail): ten drops, eight of them short
  17: 8, 24: 15, 36: 22, 45: 32, 54: 19, 60: 51, 71: 65, 88: 58, 94: 87, 96: 90,
};

export const LADDERS = Object.entries(JUMPS)
  .filter(([from, to]) => to > Number(from))
  .map(([from, to]) => [Number(from), to]);

export const SNAKES = Object.entries(JUMPS)
  .filter(([from, to]) => to < Number(from))
  .map(([from, to]) => [Number(from), to]);

export const SIZE = 10; // cells per side
export const CELL = 10; // viewBox units per cell (viewBox is 0 0 100 100)

/* Centre of a cell in viewBox units. Cell 0 (not yet on the board) sits
   just below cell 1 so tokens have somewhere to wait. */
export function cellCenter(n) {
  if (n <= 0) return { x: CELL / 2, y: SIZE * CELL + CELL / 2 };
  const i = n - 1;
  const row = Math.floor(i / SIZE); // 0 = bottom row
  const col0 = i % SIZE;
  const col = row % 2 === 0 ? col0 : SIZE - 1 - col0;
  return { x: col * CELL + CELL / 2, y: (SIZE - 1 - row) * CELL + CELL / 2 };
}

/* Every rule the board must satisfy, in one place. Returns a list of
   complaints — empty means the map is sound. Takes any {from: to} map
   so the same checks can be run against the live SQL. */
export function verifyBoard(jumps = JUMPS) {
  const problems = [];
  const entries = Object.entries(jumps).map(([f, t]) => [Number(f), Number(t)]);
  const ladders = entries.filter(([f, t]) => t > f);
  const snakes = entries.filter(([f, t]) => t < f);

  for (const [from, to] of entries) {
    if (from === to) problems.push(`${from} jumps to itself`);
    for (const square of [from, to]) {
      if (square === 1) problems.push(`square 1 is part of the ${from}→${to} jump`);
      if (square === 100) problems.push(`square 100 is part of the ${from}→${to} jump`);
      if (square < 1 || square > 100) problems.push(`${square} is off the board`);
    }
  }

  // Distinct squares ⇒ no square hosts two jumps AND no chains.
  const seen = new Map();
  for (const [from, to] of entries) {
    for (const square of [from, to]) {
      if (seen.has(square)) problems.push(`square ${square} is used twice (${seen.get(square)} and ${from}→${to})`);
      else seen.set(square, `${from}→${to}`);
    }
  }

  if (ladders.length < 8 || ladders.length > 10) problems.push(`${ladders.length} ladders (want 8-10)`);
  if (snakes.length < 8 || snakes.length > 10) problems.push(`${snakes.length} snakes (want 8-10)`);

  const longSnakes = snakes.filter(([f, t]) => f - t > 15);
  if (longSnakes.length > 2) problems.push(`${longSnakes.length} long snakes (want at most 2)`);
  for (const [f, t] of snakes) {
    const drop = f - t;
    if (drop < 5) problems.push(`snake ${f}→${t} drops only ${drop} — too small to read as a snake`);
    if (drop > 15 && !longSnakes.some(([lf]) => lf === f)) problems.push(`snake ${f}→${t} unaccounted`);
  }
  for (const [f, t] of ladders) {
    if (t - f < 5) problems.push(`ladder ${f}→${t} climbs only ${t - f}`);
  }
  return problems;
}
