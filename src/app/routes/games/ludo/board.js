/* ════════════════════════════════════════════════
   Ludo board geometry — the classic 15×15 layout, and the pure
   mapping from the server's progress model (0 yard, 1..51 track,
   52..56 home column, 57 home) onto it. The engine's arithmetic is
   unchanged: absolute square = (seat*13 + progress - 1) % 52.

   ── THE RING RUNS CLOCKWISE, AND ITS PHASE IS SET BY THE STARTS ──

   This was wrong twice, and the way it was wrong is worth keeping.

   A goti leaves its yard onto its own arm's START square, and 51 steps
   later it must arrive at that same arm's TIP — the one cell its home
   column runs from — so it turns in head-on instead of cutting the
   corner. Those two facts fix everything else: since 52 - 50 = 2, a
   seat's start is exactly TWO steps past its own tip, and once you
   know the direction there is only one ring that satisfies it.

   The user's marked board settled the direction and the starts
   together. The four cells they marked green — (8,1), (13,8), (6,13),
   (1,6) — are two steps past the top, right, bottom and left tips
   respectively when the ring is walked CLOCKWISE, and they are not
   two steps past anything when it is walked the other way. So the
   board turns clockwise: TOP → RIGHT → BOTTOM → LEFT.

   The earlier layout ran counter-clockwise from (6,1), which put every
   seat's exit one arm out of step. It still played — tokens moved a
   legal number of squares, entered a home column and finished — which
   is exactly why nothing caught it: a ring that is out of phase is
   still a ring.

   SEAT ORDER FOLLOWS THE RING, because the engine requires it: seat s
   starts at absolute 13·s, so seats must be numbered the way a token
   meets them.

   AND THE YARDS FOLLOW THE STARTS, which is the step that caught me
   out. A start square is the cell you set a goti down on when you lift
   it out, so it must be beside its OWN yard. (8,1) sits against column
   9, which is the top-RIGHT yard — not the top-left, where I first put
   it. The geometry test refused it, correctly. So seats 0..3 have
   yards top-right, bottom-right, bottom-left, top-left, and the
   colours in seatColors.js run yellow, blue, red, green to land each
   zone where the marked board puts it.

   THE EIGHT SAFE SQUARES fall out of the corrected phase rather than
   being a rule of their own: they are each seat's start and the square
   eight steps on — the classic set. When the ring was mis-phased they
   read as an odd off-by-one list; corrected, they are what every
   physical board has always had, and the start squares are safe again.

   Layout, unchanged:
   - 15×15 grid. Four 6×6 yards in the corners, each with a 2×2 court.
   - A cross of four arms (3 wide, 6 long). Each arm gives the track its
     two OUTER lines plus the cell at its tip: 4 × 13 = 52.
   - Each arm's MIDDLE line (5 cells) is one seat's home column.
   - The centre 3×3 is the finish. 52 + 4×5 + 9 + 4×36 = 225 = 15².
   ════════════════════════════════════════════════ */

/* The 52 track cells in MOVEMENT order, clockwise. TRACK[0] is seat
   0's start, two steps past the top arm's tip. */
export const TRACK = (() => {
  const t = [];
  for (let r = 1; r <= 5; r++) t.push([8, r]);        // 0-4   down the top arm's right line
  for (let c = 9; c <= 14; c++) t.push([c, 6]);       // 5-10  right along the right arm's top line
  t.push([14, 7]);                                    // 11    right tip
  for (let c = 14; c >= 9; c--) t.push([c, 8]);       // 12-17 left along the right arm's lower line
  for (let r = 9; r <= 14; r++) t.push([8, r]);       // 18-23 down the bottom arm's right line
  t.push([7, 14]);                                    // 24    bottom tip
  for (let r = 14; r >= 9; r--) t.push([6, r]);       // 25-30 up the bottom arm's left line
  for (let c = 5; c >= 0; c--) t.push([c, 8]);        // 31-36 left along the left arm's lower line
  t.push([0, 7]);                                     // 37    left tip
  for (let c = 0; c <= 5; c++) t.push([c, 6]);        // 38-43 right along the left arm's top line
  for (let r = 5; r >= 1; r--) t.push([6, r]);        // 44-48 up the top arm's left line
  t.push([6, 0]);                                     // 49
  t.push([7, 0]);                                     // 50    top tip
  t.push([8, 0]);                                     // 51
  return t;
})();

/* Home column cells per seat, progress 52..56 → index 0..4, ordered
   from the arm tip inwards to the centre. Seat order follows the ring:
   top, right, bottom, left. */
export const HOME_COLUMNS = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],      // seat 0 — top arm, entered from (7,0)
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],  // seat 1 — right arm, from (14,7)
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],  // seat 2 — bottom arm, from (7,14)
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],      // seat 3 — left arm, from (0,7)
];

/* Yards: 6x6 blocks. Each seat sits at the corner its START square is
   against — you lift a goti out and set it on the cell just outside. */
export const YARD_ORIGIN = [
  [9, 0],   // seat 0 top-right    YELLOW → start (8,1),  home column top
  [9, 9],   // seat 1 bottom-right BLUE   → start (13,8), home column right
  [0, 9],   // seat 2 bottom-left  RED    → start (6,13), home column bottom
  [0, 0],   // seat 3 top-left     GREEN  → start (1,6),  home column left
];

/* The 2×2 court inside a yard: four token spots, in yard-local cells. */
export const YARD_SPOTS = [
  [1.5, 1.5], [4.5, 1.5], [1.5, 4.5], [4.5, 4.5],
];

/* Finished tokens rest in the centre, each in ITS OWN seat's triangle
   and each in its own spot.

   This used to be ONE point per seat, so all four of a seat's finished
   tokens resolved to the same cell and the board's shared-square
   spread fanned them diagonally — a finished game showed a smear of
   tokens sliding across the middle instead of four sitting in their
   colour's wedge. Four distinct spots fixes it at the source: nothing
   shares a cell, so nothing is spread.

   Each triangle runs from one outer edge of the centre to the middle,
   so it is widest at that edge. The spots sit in a row just inside it,
   and as far out as the wedge allows, because the dice tray sits over
   the middle and a finished token should not hide under it.

   Wedges follow the ring: top, right, bottom, left. */
export const HOME_SPOTS = [
  [[6.55, 6.32], [7.18, 6.32], [7.82, 6.32], [8.45, 6.32]],  // seat 0 — top wedge
  [[8.68, 6.55], [8.68, 7.18], [8.68, 7.82], [8.68, 8.45]],  // seat 1 — right wedge
  [[6.55, 8.68], [7.18, 8.68], [7.82, 8.68], [8.45, 8.68]],  // seat 2 — bottom wedge
  [[6.32, 6.55], [6.32, 7.18], [6.32, 7.82], [6.32, 8.45]],  // seat 3 — left wedge
];

/* Where each seat's tokens enter the ring — the cells marked green on
   the user's board. Two steps past that seat's own arm tip. */
export const START_ABS = [0, 13, 26, 39];

/* THE EIGHT SAFE SQUARES — the stop positions, and the same eight a
   jota may rest on regardless of colour.

   Each seat's start, and the square eight steps on. Safe for everyone,
   always. The start squares ARE among them: a goti stepping out of the
   yard lands somewhere it cannot be taken.

   The engine's list (ludo_is_safe) must match this EXACTLY — a board
   that draws a star where the engine will not protect you is worse
   than no star, because the person trusted it. board-geometry.mjs
   reads the LIVE function square by square and asserts they agree. */
export const SAFE_ABS = [0, 8, 13, 21, 26, 34, 39, 47];

/* Kept as the old name so nothing that imported it breaks silently. */
export const STAR_ABS = SAFE_ABS;

/* Which seat's ARM a track square physically sits on — not whose safe
   square it is. Those differ: absolute 8 is seat 0's "eight past the
   start", but it lies on the RIGHT arm, which is seat 1's.

   The board colours a stop by the arm it is ON, because that is what
   a player sees. A stop on the yellow arm is a yellow square. Each arm
   ends up with exactly two: its own start, and another seat's star. */
export function armSeatOf(abs) {
  const [c, r] = TRACK[abs];
  if (r <= 5 && c >= 6 && c <= 8) return 0; // top
  if (c >= 9 && r >= 6 && r <= 8) return 1; // right
  if (r >= 9 && c >= 6 && c <= 8) return 2; // bottom
  return 3; // left
}

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
   own yard nearest them, bottom-left. Seat 3 already sits there, so
   the board turns a quarter for each seat around from it.

   Returns degrees for a CSS/SVG rotation (positive = clockwise, as
   screen coordinates run y-down). Labels and numerals counter-rotate
   by the same amount so nothing ever reads upside down. A watcher with
   no seat gets the neutral orientation. */
export function povRotation(mySeat) {
  switch (mySeat) {
    case 0: return 180; // top-right    → bottom-left
    case 1: return 90;  // bottom-right → bottom-left
    case 2: return 0;   // already bottom-left
    case 3: return -90; // top-left     → bottom-left
    default: return 0;  // spectators: neutral
  }
}
