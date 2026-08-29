/* ════════════════════════════════════════════════
   Snakes & Ladders — the board map and its geometry.

   The classic 10×10 layout: cell 1 at bottom-left, rows snake back and
   forth (boustrophedon), 100 at top-left. JUMPS must match
   snakes_board_jump() in supabase/migrations/0035_snakes_ladders.sql
   exactly — the server decides where a landing takes you; this file
   only draws it.
   ════════════════════════════════════════════════ */

/* landing cell → destination. Up = ladder, down = snake. */
export const JUMPS = {
  // ladders (foot → top)
  1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100,
  // snakes (head → tail)
  16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78,
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
