/* ════════════════════════════════════════════════
   Board geometry — pure maths, no database, no browser.

   Run:  node tests/board-geometry.mjs

   Proves the ludo board really is the classic one: 52-square cross
   track, four 6×6 yards with 2×2 courts, each seat's start beside its
   own yard, each seat's lap ending on its own arm's TIP so the home
   column is entered head-on rather than cut into diagonally, the 8
   standard safe squares, and a point of view per seat that always
   brings that seat's yard to the bottom-left.
   ════════════════════════════════════════════════ */

import {
  TRACK,
  HOME_COLUMNS,
  YARD_ORIGIN,
  YARD_SPOTS,
  START_ABS,
  STAR_ABS,
  absOf,
  cellFor,
  povRotation,
} from "../src/app/routes/games/ludo/board.js";

let failures = 0;
const check = (name, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(62), note);
};
const key = ([c, r]) => `${c},${r}`;
const inGrid = ([c, r]) => c >= 0 && c <= 14 && r >= 0 && r <= 14;

/* ─── The ring ─── */
check("track has 52 squares", TRACK.length === 52, `${TRACK.length}`);
check("every track square is on the 15×15 grid", TRACK.every(inGrid));
check("no track square repeats", new Set(TRACK.map(key)).size === 52);
{
  // Consecutive squares touch (orthogonally, or diagonally at the four
  // inner corners where the ring wraps around the centre block).
  let worst = 0;
  for (let i = 0; i < 52; i++) {
    const [c1, r1] = TRACK[i];
    const [c2, r2] = TRACK[(i + 1) % 52];
    worst = Math.max(worst, Math.abs(c1 - c2), Math.abs(r1 - r2));
  }
  check("the ring is continuous (never jumps a gap)", worst === 1, `largest step ${worst}`);
}

/* ─── Cross shape: everything is in an arm, nothing in a yard ─── */
{
  const inCross = ([c, r]) => (c >= 6 && c <= 8) || (r >= 6 && r <= 8);
  const inCentre = ([c, r]) => c >= 6 && c <= 8 && r >= 6 && r <= 8;
  check("track stays inside the cross", TRACK.every(inCross));
  check("track never enters the centre 3×3", !TRACK.some(inCentre));
  const homes = HOME_COLUMNS.flat();
  check("each home column is 5 cells", HOME_COLUMNS.every((h) => h.length === 5));
  check("home columns never touch the track", !homes.some((h) => TRACK.some((t) => key(t) === key(h))));
  check("home columns never enter the centre", !homes.some(inCentre));
  check(
    "cross accounts for exactly 81 cells (52 + 20 + 9)",
    TRACK.length + homes.length + 9 === 81
  );
}

/* ─── Yards ─── */
{
  const corners = ["0,0", "0,9", "9,9", "9,0"];
  check("four 6×6 yards, one per corner", YARD_ORIGIN.map(key).sort().join("|") === corners.slice().sort().join("|"));
  check("each yard holds a 2×2 court of four spots", YARD_SPOTS.length === 4);
  const xs = new Set(YARD_SPOTS.map(([x]) => x));
  const ys = new Set(YARD_SPOTS.map(([, y]) => y));
  check("the court really is 2×2 (two columns, two rows)", xs.size === 2 && ys.size === 2);
  // Every court spot sits inside its 6×6 yard.
  check(
    "court spots sit inside their yard",
    YARD_ORIGIN.every(([oc, or]) =>
      YARD_SPOTS.every(([sc, sr]) => sc > 0 && sc < 6 && sr > 0 && sr < 6 && inGrid([oc + sc, or + sr]))
    )
  );
}

/* ─── Starts, laps, home columns ─── */
{
  check("starts are 13 apart", START_ABS.join(",") === "0,13,26,39");
  check("stars are 8 past each start", STAR_ABS.join(",") === "8,21,34,47");
  check("the 8 safe squares are all distinct", new Set([...START_ABS, ...STAR_ABS]).size === 8);

  for (let seat = 0; seat < 4; seat++) {
    const [yc, yr] = YARD_ORIGIN[seat];
    const start = TRACK[START_ABS[seat]];
    // The start square touches its own yard block.
    const touchesYard =
      start[0] >= yc - 1 && start[0] <= yc + 6 && start[1] >= yr - 1 && start[1] <= yr + 6;
    check(`seat ${seat}: start ${key(start)} is beside its own yard`, touchesYard);

    // The lap: progress 51 is the last track square before the column.
    const lastAbs = absOf(seat, 51);
    const last = TRACK[lastAbs];
    const firstHome = HOME_COLUMNS[seat][0];
    const adjacent =
      Math.abs(last[0] - firstHome[0]) + Math.abs(last[1] - firstHome[1]) === 1;
    check(
      `seat ${seat}: lap ends at ${key(last)}, head-on into its column at ${key(firstHome)}`,
      adjacent,
      adjacent ? "" : "the token would cut the corner diagonally"
    );

    // The column runs inwards, finishing next to the centre.
    const lastHome = HOME_COLUMNS[seat][4];
    const nearCentre =
      lastHome[0] >= 5 && lastHome[0] <= 9 && lastHome[1] >= 5 && lastHome[1] <= 9;
    check(`seat ${seat}: its column ends at the centre`, nearCentre, key(lastHome));

    // Progress 57 rests in the centre 3×3.
    const [hc, hr] = cellFor(seat, 57, 0);
    check(`seat ${seat}: finished tokens rest in the centre`, hc >= 6 && hc <= 9 && hr >= 6 && hr <= 9);
  }
}

/* ─── Point of view ─── */
{
  // Rotating the board by povRotation(seat) must bring that seat's
  // yard to the bottom-left. Yard centres, relative to the board
  // centre (7.5, 7.5), rotated by the given angle.
  for (let seat = 0; seat < 4; seat++) {
    const deg = povRotation(seat);
    const rad = (deg * Math.PI) / 180;
    const [oc, or] = YARD_ORIGIN[seat];
    const x = oc + 3 - 7.5;
    const y = or + 3 - 7.5;
    // Screen coordinates run y-down, so a positive angle turns clockwise.
    const rx = x * Math.cos(rad) - y * Math.sin(rad);
    const ry = x * Math.sin(rad) + y * Math.cos(rad);
    check(
      `seat ${seat}: a ${deg}° turn brings its yard bottom-left`,
      rx < -0.5 && ry > 0.5,
      `→ (${rx.toFixed(1)}, ${ry.toFixed(1)})`
    );
  }
  check("a watcher with no seat gets the neutral view", povRotation(null) === 0);
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
