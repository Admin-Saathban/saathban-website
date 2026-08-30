/* ════════════════════════════════════════════════
   Which corner of the screen a seat sits at.

   Pure geometry, in a plain module rather than inside the component
   that draws the plates, so a test can import it without a browser —
   and this one needs a test. The mapping used to be a written-down
   constant, [0, 3, 2, 1], true of the board on the day it was typed.
   The ring was re-phased and reversed later and the seats moved with
   it; the constant did not. Every seat plate and every chat bubble
   then sat at the wrong corner — your own face across the table from
   your own yard — and nothing failed, because a constant cannot
   notice that the thing it describes has moved.

   So it is read off YARD_ORIGIN instead. A seat sits where its yard
   is, by definition, and now by construction.
   ════════════════════════════════════════════════ */

import { YARD_ORIGIN } from "./board.js";

/* Screen corners, clockwise from top-left: 0 TL · 1 TR · 2 BR · 3 BL.
   The board is 15×15, so column/row 7 is the middle line. */
export function cornerOfCell([c, r]) {
  return c < 7 ? (r < 7 ? 0 : 3) : r < 7 ? 1 : 2;
}

/* Where each seat's yard is before the board is rotated. */
export const CORNER_OF_SEAT = YARD_ORIGIN.map(cornerOfCell);

/* After the board turns by `spin` degrees, a corner moves round by
   spin/90 places. The board is one CSS rotation, so a seat's yard and
   its plate turn together — which is the whole promise this makes. */
export function screenCorner(seat, spin) {
  return (CORNER_OF_SEAT[seat] + Math.round(spin / 90) + 8) % 4;
}
