/* ════════════════════════════════════════════════
   Seat colours — one palette for every board and the seat chips
   around them, so a token, its home zone and its chip always agree.

   THESE ARE THE CLASSIC LUDO COLOURS, on purpose, and they are not
   the Saathban palette. The brand set is deliberately soft (green,
   brown, olive, sage), which is right for reading and wrong for a
   game board: three of those four are greenish, and a player has to
   tell their tokens from three others at a glance, across a table, in
   whatever light the room has. Every physical ludo board in the world
   uses the same four saturated hues, and a person who has played this
   game for fifty years knows the board by them. So the board is
   vivid; Saathban's warm styling stays on the chrome AROUND it — the
   page, the cards, the chips' frames, the cream ground the board sits
   on.

   ZONE LAYOUT, from the user's marked board (which is the authority):
   green top-left, yellow top-right, red bottom-left, blue
   bottom-right.

   SEAT ORDER FOLLOWS THE RING, not the corners of the screen. The
   board turns clockwise — top, right, bottom, left — and the engine
   starts seat s at absolute 13*s, so seats must be numbered the way a
   token meets them. Yards therefore run top-left, top-right,
   bottom-right, bottom-left, and the colours below run green, yellow,
   blue, red to land each zone where the marked board puts it.

   Colour still never carries meaning alone: every token also shows
   its seat number, which is what SEAT_INK is for — yellow needs dark
   text where the other three take white. The four also differ in
   lightness, not only hue, so they stay separable for the commonest
   colour-vision differences.
   ════════════════════════════════════════════════ */

export const SEAT_COLORS = [
  "#F6BE00", // seat 0 — top-right     YELLOW
  "#1565C0", // seat 1 — bottom-right  BLUE
  "#E0342A", // seat 2 — bottom-left   RED
  "#12A150", // seat 3 — top-left      GREEN
];

/* Ink that stays legible on each seat colour. */
export const SEAT_INK = ["#3B2E12", "#FFFFFF", "#FFFFFF", "#FFFFFF"];

/* A soft tint of each seat colour, for yard courts, start squares and
   resting spots — bright enough to name the zone, pale enough that a
   star or a token drawn on top of it still reads. */
export const SEAT_TINTS = ["#FDF0C8", "#DAE7F7", "#FBDDDA", "#D8F0E1"];
