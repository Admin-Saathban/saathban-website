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
   bottom-right. Yards run [top-left, bottom-left, bottom-right,
   top-right] for seats 0..3 (see YARD_ORIGIN), so the seat order
   below is green, red, blue, yellow.

   Colour still never carries meaning alone: every token also shows
   its seat number, which is what SEAT_INK is for — yellow needs dark
   text where the other three take white. The four also differ in
   lightness, not only hue, so they stay separable for the commonest
   colour-vision differences.
   ════════════════════════════════════════════════ */

export const SEAT_COLORS = [
  "#12A150", // seat 0 — top-left     GREEN
  "#E0342A", // seat 1 — bottom-left   RED
  "#1565C0", // seat 2 — bottom-right  BLUE
  "#F6BE00", // seat 3 — top-right     YELLOW
];

/* Ink that stays legible on each seat colour. */
export const SEAT_INK = ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#3B2E12"];

/* A soft tint of each seat colour, for yard courts, start squares and
   resting spots — bright enough to name the zone, pale enough that a
   star or a token drawn on top of it still reads. */
export const SEAT_TINTS = ["#D8F0E1", "#FBDDDA", "#DAE7F7", "#FDF0C8"];
