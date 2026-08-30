/* ════════════════════════════════════════════════
   Ludo board geometry — the classic 15×15 layout, and the pure
   mapping from the server's progress model (0 yard, 1..51 track,
   52..56 home column, 57 home) onto it. Mirrors the math in
   0020_ludo.sql: absolute square = (seat*13 + progress - 1) % 52,
   starts at absolute 0/13/26/39. The SAFE squares are 1/9/14/22/27/
   35/40/48 — see SAFE_ABS below; they are not the start squares.

   THE CLASSIC BOARD, and why the cells are where they are:

   - 15×15 grid. Four 6×6 yards in the corners, each with a 2×2 court
     of four token spots.
   - A cross of four arms (3 cells wide, 6 long) between them. Each
     arm gives the track its two OUTER lines (6 cells each) plus the
     single cell at its tip: 4 × 13 = 52 track squares.
   - Each arm's MIDDLE line (5 cells) is one seat's home column,
     running from the tip inwards to the centre.
   - The centre 3×3 is the finish. 52 + 4×5 + 9 = 81 cross cells,
     and 81 + 4×36 yards = 225 = 15². Everything accounted for.

   The ring below is written in MOVEMENT order, so TRACK[0] is seat
   0's start square. That ordering is what makes the engine's lap
   land correctly: a token's 51st track step is
   (seat*13 + 50) % 52, which for every seat is exactly its own arm's
   TIP cell — the square its home column runs from. Seat 0 finishes
   its lap at (7,0) and turns down into (7,1)…(7,5); seat 1 at (0,7)
   and turns right; seat 2 at (7,14) turning up; seat 3 at (14,7)
   turning left. Get the ring's phase wrong and every token cuts the
   corner into its home column diagonally, which is what the previous
   layout did.
   ════════════════════════════════════════════════ */

import { COLORS as C } from "../../../../shared/tokens.js";

/* The 52 track cells in movement order. TRACK[a] = [col, row]. */
export const TRACK = (() => {
  const t = [];
  for (let r = 1; r <= 5; r++) t.push([6, r]);        // 0-4   down the top arm's left line
  for (let c = 5; c >= 0; c--) t.push([c, 6]);        // 5-10  left along the left arm's top line
  t.push([0, 7]);                                     // 11    left tip
  for (let c = 0; c <= 5; c++) t.push([c, 8]);        // 12-17 right along the left arm's lower line
  for (let r = 9; r <= 14; r++) t.push([6, r]);       // 18-23 down the bottom arm's left line
  t.push([7, 14]);                                    // 24    bottom tip
  for (let r = 14; r >= 9; r--) t.push([8, r]);       // 25-30 up the bottom arm's right line
  for (let c = 9; c <= 14; c++) t.push([c, 8]);       // 31-36 right along the right arm's lower line
  t.push([14, 7]);                                    // 37    right tip
  for (let c = 14; c >= 9; c--) t.push([c, 6]);       // 38-43 left along the right arm's top line
  for (let r = 5; r >= 1; r--) t.push([8, r]);        // 44-48 up the top arm's right line
  t.push([8, 0]);                                     // 49
  t.push([7, 0]);                                     // 50    top tip
  t.push([6, 0]);                                     // 51
  return t;
})();

/* Home column cells per seat, progress 52..56 → index 0..4, ordered
   from the arm tip inwards to the centre. */
export const HOME_COLUMNS = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],      // seat 0 — top arm, entered from (7,0)
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],      // seat 1 — left arm, from (0,7)
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],  // seat 2 — bottom arm, from (7,14)
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],  // seat 3 — right arm, from (14,7)
];

/* Yards: 6×6 blocks, each seat's beside its own start square. */
export const YARD_ORIGIN = [
  [0, 0],   // seat 0 top-left     → start (6,1)
  [0, 9],   // seat 1 bottom-left  → start (1,8)
  [9, 9],   // seat 2 bottom-right → start (8,13)
  [9, 0],   // seat 3 top-right    → start (13,6)
];

/* The 2×2 court inside a yard: four token spots, in yard-local cells. */
export const YARD_SPOTS = [
  [1.5, 1.5], [4.5, 1.5], [1.5, 4.5], [4.5, 4.5],
];

/* Finished tokens rest in the centre, each in ITS OWN seat's triangle
   and each in its own spot.

   This used to be ONE point per seat, which meant all four of a seat's
   finished tokens resolved to the same cell — and the board's
   shared-square spread then fanned them out diagonally, so a finished
   game showed a smear of tokens sliding across the middle instead of
   four sitting in their colour's wedge. With two seats home that read
   as eight tokens strewn through the centre, which is what the user's
   screenshot caught.

   Four distinct spots per seat fixes it at the source: nothing shares
   a cell, so nothing is spread, and each token rests in the triangle
   painted its own colour.

   The geometry: the centre is the 3×3 from (6,6) to (9,9) and each
   triangle runs from one outer edge to the middle at (7.5, 7.5), so a
   triangle is widest at its outer edge. The four spots therefore sit
   in a row just inside that edge, where there is room for them — and
   as far out as the wedge allows, because the dice tray sits over the
   middle of the board and a finished token should not be hiding
   underneath it. */
export const HOME_SPOTS = [
  [[6.55, 6.32], [7.18, 6.32], [7.82, 6.32], [8.45, 6.32]],  // seat 0 — top wedge
  [[6.32, 6.55], [6.32, 7.18], [6.32, 7.82], [6.32, 8.45]],  // seat 1 — left wedge
  [[6.55, 8.68], [7.18, 8.68], [7.82, 8.68], [8.45, 8.68]],  // seat 2 — bottom wedge
  [[8.68, 6.55], [8.68, 7.18], [8.68, 7.82], [8.68, 8.45]],  // seat 3 — right wedge
];

/* Where each seat's tokens enter the ring. Unchanged: the geometry
   depends on it (a token's 51st step must land on its own arm's tip),
   and the user's marks did not move these. */
export const START_ABS = [0, 13, 26, 39];

/* THE SAFE SQUARES — the stop positions, read from the user's marked
   board, which is the authority and overrides the earlier convention.

   They were [0, 13, 26, 39, 8, 21, 34, 47]: the start squares plus the
   square eight steps on. Every circled cell on the marked board is
   exactly ONE STEP FORWARD of one of those, and the set that gives is
   rotationally symmetric — 1, 14, 27, 40 and 9, 22, 35, 48, each pair
   thirteen apart — which a misreading would not be.

   So the safe squares are no longer the start squares. A token coming
   out of the yard lands on a capturable cell and reaches safety one
   step later. That is a real change to how the game plays, and it is
   recorded in GAMES_CONTRACT.md rather than left to be inferred here.

   The engine's list (ludo_is_safe, migration 0045) must match this
   EXACTLY — a board that draws a star where the engine will not
   protect you is worse than no star at all. tests/board-geometry.mjs
   asserts the two agree cell for cell. */
export const SAFE_ABS = [1, 9, 14, 22, 27, 35, 40, 48];

/* Kept as the old name so nothing that imported it breaks silently;
   it now means the same thing as SAFE_ABS. */
export const STAR_ABS = SAFE_ABS;

/* Re-exported so seat chips and the board can never disagree; the
   palette itself lives one level up, shared with the other boards. */
export { SEAT_COLORS, SEAT_INK, SEAT_TINTS } from "../seatColors.js";

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
  return HOME_SPOTS[seat][pieceIdx]; // 57 — its own spot in its own wedge
}

/* ── Per-player point of view ──────────────────────────────────────
   Everyone should look at the board the way they'd sit at it: their
   own yard nearest them, bottom-left. Seat 1 already sits there, so
   the board turns a quarter for each seat around from it. A watcher
   with no seat gets the neutral orientation.

   Returns degrees for a CSS/SVG rotation (positive = clockwise, as
   screen coordinates run y-down). Labels and numerals counter-rotate
   by the same amount so nothing ever reads upside down. */
export function povRotation(mySeat) {
  switch (mySeat) {
    case 0: return -90; // top-left  → bottom-left
    case 1: return 0;   // already bottom-left
    case 2: return 90;  // bottom-right → bottom-left
    case 3: return 180; // top-right → bottom-left
    default: return 0;  // spectators: neutral
  }
}
