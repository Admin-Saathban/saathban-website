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

/* THE DEEP RICH SET. These were the bright toy hues — #FFC21A,
   #1E7BE8, #F2402F, #16BE5C — and against a white track they
   glared: four fluorescent zones round a sheet of paper, with
   nothing left over for a token to be brighter than. Deepening
   all four by roughly a third gives the board its hierarchy back.
   The GOTIS are the saturated things on it now, which is right —
   they are what you look at.

   The owner's values, one per hue, chosen in the designer. */
export const SEAT_COLORS = [
  "#D18F00", // seat 0 — top-right     YELLOW
  "#1857B0", // seat 1 — bottom-right  BLUE
  "#B01709", // seat 2 — bottom-left   RED
  "#0E8A2C", // seat 3 — top-left      GREEN
];

/* The lit and shadowed ends of each colour, for the zone gradients.
   Kept beside the base so a hue can never be brightened here and left
   flat there. */
export const SEAT_LIGHT = ["#F5C93E", "#4C8FE8", "#E85141", "#3FBF63"];
export const SEAT_DEEP = ["#8F6100", "#0E3A7A", "#7A0E04", "#075A1B"];

/* Ink that stays legible on each seat colour. */
export const SEAT_INK = ["#3B2E12", "#FFFFFF", "#FFFFFF", "#FFFFFF"];

/* A soft tint of each seat colour, for yard courts, start squares and
   resting spots — bright enough to name the zone, pale enough that a
   star or a token drawn on top of it still reads. */
export const SEAT_TINTS = ["#F6E4BC", "#D3DFF1", "#F0D2CE", "#CDE8D3"];

/* The i18n key suffix for each seat colour, in the same order as
   SEAT_COLORS. It lives here, beside the hexes, because the order has
   now changed twice — and a screen reader announcing "green" while the
   goti is yellow is worse than announcing nothing. One array moves,
   both stay true. */
export const SEAT_COLOR_NAMES = ["yellow", "blue", "red", "green"];
