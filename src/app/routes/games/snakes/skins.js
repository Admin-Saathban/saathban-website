/* ════════════════════════════════════════════════
   Colours for a snakes table: the player pieces, and the snakes.

   TWO PALETTES, AND THEY ARE NOT THE SAME KIND OF THING.

   PLAYER colours belong to people. This table seats up to eight, and
   ludo's four are not enough — so the four classic hues come first,
   unchanged and in their usual order, and four more follow. A person
   who has played ludo here recognises the first four; nobody has to
   learn a new set to play with three friends.

   They are chosen to survive the two hard cases: told apart at a
   glance on a 340px board, and told apart by someone whose colour
   vision differs from the designer's. So no two adjacent entries are
   close in hue, and all eight differ in LIGHTNESS as well as hue —
   which is also why every piece is announced by name to a screen
   reader and never by colour alone.

   SNAKE colours belong to the board. The owner's default is a green
   and a red, alternating, with the dragon opting out entirely — it
   keeps its own dark red whatever set the table chooses, because it
   is a boss and not a member of a colour scheme.
   ════════════════════════════════════════════════ */

/* ── The eight ─────────────────────────────────────────────────── */
export const PLAYER_COLORS = [
  { key: "yellow", body: "#D18F00", light: "#F5C93E", deep: "#8F6100", ink: "#3B2E12" },
  { key: "blue",   body: "#1857B0", light: "#4C8FE8", deep: "#0E3A7A", ink: "#FFFFFF" },
  { key: "red",    body: "#B01709", light: "#E85141", deep: "#7A0E04", ink: "#FFFFFF" },
  { key: "green",  body: "#0E8A2C", light: "#3FBF63", deep: "#075A1B", ink: "#FFFFFF" },
  { key: "purple", body: "#7A2E9E", light: "#AE63CE", deep: "#4E1668", ink: "#FFFFFF" },
  { key: "orange", body: "#D2600E", light: "#F5964A", deep: "#8E3D02", ink: "#FFFFFF" },
  { key: "teal",   body: "#0E7F86", light: "#41B4BA", deep: "#06545A", ink: "#FFFFFF" },
  { key: "pink",   body: "#C0246E", light: "#EC6AA6", deep: "#82103F", ink: "#FFFFFF" },
];

export const colorOf = (i) => PLAYER_COLORS[((i % 8) + 8) % 8];

/* ── The snakes ────────────────────────────────────────────────── */
const GREEN = { body: "#2F8F3C", light: "#63C271", deep: "#17561F" };
const RED   = { body: "#B23127", light: "#E06A56", deep: "#6E1710" };
const TEAL  = { body: "#1B7E86", light: "#4FB6BC", deep: "#0B4C52" };
const PLUM  = { body: "#7A3080", light: "#B267B8", deep: "#4A1650" };
const OCHRE = { body: "#B4832A", light: "#E0B75E", deep: "#75500F" };
const SLATE = { body: "#4A5A78", light: "#8496B4", deep: "#2A3446" };

export const SNAKE_SETS = {
  /* The owner's default. */
  classic: { key: "classic", snakes: [GREEN, RED] },
  jungle:  { key: "jungle",  snakes: [GREEN, TEAL, OCHRE] },
  dusk:    { key: "dusk",    snakes: [PLUM, SLATE, TEAL] },
};

export const SNAKE_SET_KEYS = Object.keys(SNAKE_SETS);
