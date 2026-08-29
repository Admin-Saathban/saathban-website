/* ════════════════════════════════════════════════
   Seat colours — one palette for every board and the seat chips
   around them, so a token, its home zone and its chip always agree.

   The Saathban brand palette is deliberately soft (green, brown,
   olive, sage), which is right for reading and wrong for a game
   board: three of those four are greenish, and on a ludo board a
   player has to tell their tokens from three others at a glance,
   across a table, in whatever light the room has. So the boards use
   a saturated set instead — deep green, brick red, mustard, deep
   blue — chosen to stay distinct for the commonest colour-vision
   differences (they differ in lightness as well as hue) and to sit
   warmly on the cream ground.

   Colour still never carries meaning alone: every token also shows
   its seat number, which is what SEAT_INK is for — mustard needs
   dark text where the other three take cream.
   ════════════════════════════════════════════════ */

export const SEAT_COLORS = ["#206A42", "#B23A2E", "#D6A419", "#2A4E8C"];

/* Ink that stays legible on each seat colour. */
export const SEAT_INK = ["#FBF7F0", "#FBF7F0", "#3B2E12", "#FBF7F0"];

/* A soft tint of each seat colour, for yard courts and resting spots. */
export const SEAT_TINTS = ["#E4EFE7", "#F6E4E0", "#F7EDD4", "#E3E9F5"];
