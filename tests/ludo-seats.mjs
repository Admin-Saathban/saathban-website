/* ════════════════════════════════════════════════
   The table around the board — pure maths, no browser.

   Run:  node tests/ludo-seats.mjs

   One promise, and it is the one that broke silently: A PLAYER'S
   PLATE SITS AT THE SAME SCREEN CORNER AS THEIR OWN YARD, from every
   point of view. Your face beside your gotis; their face beside
   theirs.

   This existed as a written-down constant — [0, 3, 2, 1] — that was
   true of the board on the day it was typed. The ring was re-phased
   and reversed later the same day and the seats moved with it. The
   constant did not, so every seat plate and every chat bubble sat at
   the wrong corner, and nothing failed, because a constant cannot
   notice that the thing it describes has moved. It took a screenshot
   and a squint to catch.

   These checks are cheap and would have caught it in a second.
   ════════════════════════════════════════════════ */

import { YARD_ORIGIN, povRotation } from "../src/app/routes/games/ludo/board.js";
import {
  CORNER_OF_SEAT,
  cornerOfCell,
  screenCorner,
} from "../src/app/routes/games/ludo/seatCorners.js";

let failures = 0;
const check = (name, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(64), note);
};
const NAMES = ["top-left", "top-right", "bottom-right", "bottom-left"];

console.log("\n── a seat sits where its yard is ──\n");

{
  check("every seat maps to exactly one corner, and all four are used",
    CORNER_OF_SEAT.length === 4 && new Set(CORNER_OF_SEAT).size === 4,
    CORNER_OF_SEAT.map((c, s) => `seat ${s}→${NAMES[c]}`).join(", "));
}

{
  /* The derivation itself: a yard's corner is decided by which side of
     the middle line its origin falls on. A 6×6 yard cannot straddle
     the middle of a 15×15 board, so this is total. */
  const wrong = YARD_ORIGIN.filter(([c, r]) => c === 7 || r === 7);
  check("no yard straddles the middle line, so the corner is never a guess",
    wrong.length === 0, YARD_ORIGIN.map((y) => y.join(",")).join(" · "));
}

console.log("\n── and stays there from every point of view ──\n");

{
  /* THE LOAD-BEARING ONE. The board is a single CSS rotation, so a
     seat's yard and its plate must turn together. Whoever is looking,
     seat S's plate is at the same corner as seat S's yard. */
  let wrong = [];
  for (let viewer = 0; viewer < 4; viewer++) {
    const spin = povRotation(viewer);
    for (let seat = 0; seat < 4; seat++) {
      const yardCorner = (CORNER_OF_SEAT[seat] + Math.round(spin / 90) + 8) % 4;
      if (screenCorner(seat, spin) !== yardCorner) wrong.push(`viewer ${viewer}/seat ${seat}`);
    }
  }
  check("a seat's plate lands on its own yard's corner, for every viewer",
    wrong.length === 0, wrong.length ? wrong.join(" ") : "16 viewer/seat pairs");
}

{
  /* The point of the rotation, stated as the player experiences it:
     wherever you sit, you sit at the bottom-left. */
  const seatedAt = [0, 1, 2, 3].map((seat) => screenCorner(seat, povRotation(seat)));
  check("whoever you are, YOUR plate is bottom-left",
    seatedAt.every((c) => c === 3), seatedAt.map((c) => NAMES[c]).join(", "));
}

{
  /* A watcher with no seat gets the neutral orientation, and the
     plates must still be somewhere sensible rather than stacked. */
  const spin = povRotation(null);
  const corners = [0, 1, 2, 3].map((s) => screenCorner(s, spin));
  check("a watcher with no seat still sees four distinct corners",
    new Set(corners).size === 4, `spin ${spin}° → ${corners.map((c) => NAMES[c]).join(", ")}`);
}

{
  /* Four seats, four corners, no two players ever drawn on top of one
     another — from any of the five points of view. */
  let clashes = [];
  for (const viewer of [null, 0, 1, 2, 3]) {
    const spin = povRotation(viewer);
    const corners = [0, 1, 2, 3].map((s) => screenCorner(s, spin));
    if (new Set(corners).size !== 4) clashes.push(String(viewer));
  }
  check("no two seats ever share a corner",
    clashes.length === 0, clashes.length ? `viewers ${clashes.join(",")}` : "5 points of view");
}

console.log("\n── the corner rule itself ──\n");

{
  const cases = [
    [[0, 0], 0], [[9, 0], 1], [[9, 9], 2], [[0, 9], 3],
    [[6, 6], 0], [[8, 6], 1], [[8, 8], 2], [[6, 8], 3],
  ];
  const bad = cases.filter(([cell, want]) => cornerOfCell(cell) !== want);
  check("cornerOfCell puts each quadrant where it belongs",
    bad.length === 0, bad.length ? JSON.stringify(bad) : `${cases.length} cells`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
