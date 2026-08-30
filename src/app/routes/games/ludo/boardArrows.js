/* ════════════════════════════════════════════════
   A board that teaches: the direction of travel, printed on the track.

   A first-time player's first question is never the rules — it is
   "which way do I go?". On a real Ludo board that is answered by the
   arrows printed on the cloth, so it is answered here the same way,
   and the answer is derived from the track itself rather than typed
   out by hand: every arrow's angle comes from where the NEXT square
   is, so if the geometry in board.js ever changes, the arrows follow
   it instead of quietly lying.

   Three kinds, matching a classic board:
     · a curved arrow where each seat's tokens ENTER the track;
     · straight arrows along the arms, spaced so they read as a flow
       rather than a stripe of clutter at phone width;
     · a coloured arrow at each arm's tip, turning into that seat's
       own home column.

   All of it is drawn in BOARD space, so the per-seat POV rotation
   carries the arrows round with everything else — an arrow that
   pointed "up the screen" would be wrong for three seats out of four.
   ════════════════════════════════════════════════ */

import { TRACK, HOME_COLUMNS, START_ABS, SAFE_ABS } from "./board.js";

const deg = (dx, dy) => (Math.atan2(dy, dx) * 180) / Math.PI;

/* Where the track goes next, from square `a`. */
export function trackStep(a) {
  const [c0, r0] = TRACK[a];
  const [c1, r1] = TRACK[(a + 1) % TRACK.length];
  return { dc: c1 - c0, dr: r1 - r0 };
}

/* The angle a piece is travelling in as it leaves square `a`. */
export function trackAngle(a) {
  const { dc, dr } = trackStep(a);
  return deg(dc, dr);
}

/* ── 1. Entry arrows: the curve from a yard onto its start square ──
   Drawn ON the start square, pointing the way the piece will then
   travel, in that seat's colour — it is that seat's doorway. */
export function entryArrows() {
  return START_ABS.map((a, seat) => ({
    kind: "entry",
    seat,
    cell: TRACK[a],
    angle: trackAngle(a),
  }));
}

/* ── 2. Straight arrows along the arms ──
   Not on every square: an arrow per cell becomes a texture rather
   than an instruction. A few per arm read as flow and stay legible at
   360px wide.

   The spacing is counted WITHIN each 13-square arm, not along the
   whole 52-square ring, and this is the whole trick. The ring is four
   identical arms, so an absolute stride of 2 or 3 lands on different
   squares in each of them — the board would teach you a slightly
   different lesson on each arm, and since the board is one SVG rotated
   per seat, three players out of four would be looking at the odd one
   out. Counting per arm makes the four arms identical by construction,
   for any stride at all.

   Three kinds of square are skipped: starts (which carry their own
   curved doorway), arm tips (which carry the coloured turn home), and
   safe squares (whose ★ an arrow would be drawn on top of — two
   glyphs in one 40-unit cell is not twice the information, it is half
   the legibility). Corners are skipped too: the track turns there, and
   an arrow drawn on a turn points off the board. */
export function flowArrows({ every = 3 } = {}) {
  const starts = new Set(START_ABS);
  const tips = new Set(START_ABS.map((_, seat) => (seat * 13 + 50) % TRACK.length));
  const safe = new Set(SAFE_ABS);
  const ARM = TRACK.length / 4; // 13
  const out = [];
  for (let arm = 0; arm < 4; arm++) {
    for (let off = 1; off < ARM; off += every) {
      const a = arm * ARM + off;
      if (starts.has(a) || tips.has(a) || safe.has(a)) continue;
      const before = trackStep((a - 1 + TRACK.length) % TRACK.length);
      const now = trackStep(a);
      if (before.dc !== now.dc || before.dr !== now.dr) continue;
      out.push({ kind: "flow", cell: TRACK[a], angle: trackAngle(a) });
    }
  }
  return out;
}

/* ── 3. Home-column arrows: the turn inwards, in the seat's colour ──
   Each seat's lap ends on its own arm's TIP square; from there the
   home column runs to the centre. The arrow sits on the tip and
   points the way home. */
export function homeArrows() {
  return HOME_COLUMNS.map((col, seat) => {
    const tipAbs = (seat * 13 + 50) % TRACK.length;
    const [tc, tr] = TRACK[tipAbs];
    const [hc, hr] = col[0];
    return {
      kind: "home",
      seat,
      cell: [tc, tr],
      angle: deg(hc - tc, hr - tr),
    };
  });
}

/* Everything at once, in draw order (flow underneath, doorways and
   home turns on top). */
export function allArrows(opts) {
  return [...flowArrows(opts), ...entryArrows(), ...homeArrows()];
}
