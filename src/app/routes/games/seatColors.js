/* ════════════════════════════════════════════════
   Seat colours — one palette for every board and the seat chips
   around them, so a token, its home zone and its chip always agree.

   THESE ARE THE CLASSIC LUDO COLOURS, on purpose, and they are not
   the Saathban palette. The user has released the board from the
   brand entirely — the chrome around it stays Saathban, the board is
   a toy and is allowed to look like one. So these are brighter than
   anything else in the app and that is deliberate, not drift. The brand set is deliberately soft (green,
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
  "#FFC21A", // seat 0 — top-right     YELLOW
  "#1E7BE8", // seat 1 — bottom-right  BLUE
  "#F2402F", // seat 2 — bottom-left   RED
  "#16BE5C", // seat 3 — top-left      GREEN
];

/* The lit and shadowed ends of each colour, for the zone gradients.
   Kept beside the base so a hue can never be brightened here and left
   flat there. */
export const SEAT_LIGHT = ["#FFE07A", "#7FB8F5", "#FF8C7E", "#7BE8A5"];
export const SEAT_DEEP = ["#C98A00", "#0E4E9C", "#B4201A", "#0A8340"];

/* Ink that stays legible on each seat colour. */
export const SEAT_INK = ["#3B2E12", "#FFFFFF", "#FFFFFF", "#FFFFFF"];

/* A soft tint of each seat colour, for yard courts, start squares and
   resting spots — bright enough to name the zone, pale enough that a
   star or a token drawn on top of it still reads. */
export const SEAT_TINTS = ["#FFF3D0", "#DCEAFB", "#FDE2DE", "#DCF6E6"];

/* The i18n key suffix for each seat colour, in the same order as
   SEAT_COLORS. It lives here, beside the hexes, because the order has
   now changed twice — and a screen reader announcing "green" while the
   goti is yellow is worse than announcing nothing. One array moves,
   both stay true. */
export const SEAT_COLOR_NAMES = ["yellow", "blue", "red", "green"];
