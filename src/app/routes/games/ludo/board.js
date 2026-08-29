/* ════════════════════════════════════════════════
   Ludo board geometry — pure client-side mapping from the server's
   progress model (0 yard, 1..51 track, 52..56 column, 57 home) onto
   the classic 15×15 grid. Must mirror the math in 0020_ludo.sql:
   absolute square = (seat*13 + progress - 1) % 52; starts at absolute
   0/13/26/39; stars at 8/21/34/47.
   ════════════════════════════════════════════════ */

import { COLORS as C } from "../../../../shared/tokens.js";

/* The 52 track cells, walked clockwise. TRACK[a] = [col, row]. */
export const TRACK = (() => {
  const t = [];
  for (let c = 0; c <= 5; c++) t.push([c, 6]);        // 0-5   left arm, top row →
  for (let r = 5; r >= 0; r--) t.push([6, r]);        // 6-11  up the left of the top arm
  t.push([7, 0]);                                     // 12    top middle
  for (let r = 0; r <= 5; r++) t.push([8, r]);        // 13-18 down the right of the top arm
  for (let c = 9; c <= 14; c++) t.push([c, 6]);       // 19-24 right arm, top row →
  t.push([14, 7]);                                    // 25    right middle
  for (let c = 14; c >= 9; c--) t.push([c, 8]);       // 26-31 right arm, bottom row ←
  for (let r = 9; r <= 14; r++) t.push([8, r]);       // 32-37 down the right of the bottom arm
  t.push([7, 14]);                                    // 38    bottom middle
  for (let r = 14; r >= 9; r--) t.push([6, r]);       // 39-44 up the left of the bottom arm
  for (let c = 5; c >= 0; c--) t.push([c, 8]);        // 45-50 left arm, bottom row ←
  t.push([0, 7]);                                     // 51    left middle
  return t;
})();

/* Home-column cells per seat, progress 52..56 → index 0..4. */
export const HOME_COLUMNS = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],      // seat 0 (enters from the left)
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],      // seat 1 (from the top)
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],  // seat 2 (from the right)
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],  // seat 3 (from the bottom)
];

/* Yard blocks (6×6) and the four piece spots inside each. */
export const YARD_ORIGIN = [
  [0, 0],   // seat 0 top-left
  [9, 0],   // seat 1 top-right
  [9, 9],   // seat 2 bottom-right
  [0, 9],   // seat 3 bottom-left
];
export const YARD_SPOTS = [
  [1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5],
];

/* Home (finished) display spots: around the centre, per seat. */
export const HOME_SPOTS = [
  [6.1, 7], [7, 6.1], [7.9, 7], [7, 7.9],
];

export const START_ABS = [0, 13, 26, 39];
export const STAR_ABS = [8, 21, 34, 47];

export const SEAT_COLORS = [C.green, C.brown, C.olive, C.sage];

export function absOf(seat, p) {
  return p >= 1 && p <= 51 ? (seat * 13 + p - 1) % 52 : null;
}

/* progress → [col, row] board cell (fractional allowed) for a piece. */
export function cellFor(seat, p, pieceIdx) {
  if (p === 0) {
    const [oc, or] = YARD_ORIGIN[seat];
    const [sc, sr] = YARD_SPOTS[pieceIdx];
    return [oc + sc, or + sr];
  }
  if (p >= 1 && p <= 51) {
    const [c, r] = TRACK[absOf(seat, p)];
    return [c + 0.5, r + 0.5];
  }
  if (p >= 52 && p <= 56) {
    const [c, r] = HOME_COLUMNS[seat][p - 52];
    return [c + 0.5, r + 0.5];
  }
  return HOME_SPOTS[seat]; // 57
}
