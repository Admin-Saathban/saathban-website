/* ════════════════════════════════════════════════
   The arrows printed on the board — pure maths, no browser.

   Run:  node tests/ludo-arrows.mjs

   A board that teaches is only worth having if what it teaches is
   TRUE. An arrow is a promise about which way a goti travels, and the
   one failure mode that matters is an arrow that points the wrong way
   — a first-time player will believe it over the rules.

   So none of these angles are typed out by hand. Every one is derived
   from TRACK in board.js, and this file exists to prove the derivation
   still holds after anybody edits the geometry: the safe-square
   rephasing in 0046 moves the arrows on its own, and if it ever moved
   them somewhere wrong, this goes red rather than the board quietly
   lying to somebody's grandmother.
   ════════════════════════════════════════════════ */

import {
  TRACK,
  HOME_COLUMNS,
  START_ABS,
  SAFE_ABS,
} from "../src/app/routes/games/ludo/board.js";
import {
  trackStep,
  trackAngle,
  entryArrows,
  flowArrows,
  homeArrows,
  allArrows,
} from "../src/app/routes/games/ludo/boardArrows.js";

let failures = 0;
const check = (name, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(66), note);
};

const key = ([c, r]) => `${c},${r}`;
const cellAt = new Map(TRACK.map((cell, a) => [key(cell), a]));
/* An angle in degrees turned back into the unit step it describes.
   Rounding is safe because every step on this board is one of four. */
const stepOf = (angle) => {
  const rad = (angle * Math.PI) / 180;
  return { dc: Math.round(Math.cos(rad)), dr: Math.round(Math.sin(rad)) };
};

console.log("\n── every arrow points where a goti actually goes ──\n");

{
  /* The whole claim, in one assertion: take the square an arrow sits
     on, step one cell the way the arrow points, and you must land on
     the square the track goes to next. If this holds for all of them,
     no arrow on this board can be lying. */
  let wrong = [];
  for (const a of [...entryArrows(), ...flowArrows()]) {
    const abs = cellAt.get(key(a.cell));
    const { dc, dr } = stepOf(a.angle);
    const [c0, r0] = a.cell;
    const next = TRACK[(abs + 1) % TRACK.length];
    if (c0 + dc !== next[0] || r0 + dr !== next[1]) wrong.push(`abs ${abs}`);
  }
  check("a track arrow points at the very next square of the track",
    wrong.length === 0, wrong.length ? wrong.join(" ") : `${entryArrows().length + flowArrows().length} arrows`);
}

{
  /* A home arrow makes a different promise — it points OFF the track,
     into that seat's own home column — so it is checked against that
     column's first cell rather than against the track. */
  let wrong = [];
  for (const a of homeArrows()) {
    const { dc, dr } = stepOf(a.angle);
    const [c0, r0] = a.cell;
    const [hc, hr] = HOME_COLUMNS[a.seat][0];
    if (c0 + dc !== hc || r0 + dr !== hr) wrong.push(`seat ${a.seat}`);
  }
  check("a home arrow points into ITS OWN seat's home column",
    wrong.length === 0, wrong.length ? wrong.join(" ") : "4 arrows, 4 seats");
}

console.log("\n── the arrows sit where a board prints them ──\n");

{
  const e = entryArrows();
  check("there is one entry arrow per seat, on that seat's start square",
    e.length === 4 && e.every((a) => TRACK[START_ABS[a.seat]][0] === a.cell[0] &&
                                     TRACK[START_ABS[a.seat]][1] === a.cell[1]),
    e.map((a) => `s${a.seat}@${key(a.cell)}`).join(" "));
}

{
  const h = homeArrows();
  const tips = h.map((a) => cellAt.get(key(a.cell)));
  check("there is one home arrow per seat, on that seat's arm TIP",
    h.length === 4 && tips.every((t, seat) => t === (seat * 13 + 50) % TRACK.length),
    tips.join(","));
}

{
  /* Three ways a flow arrow becomes clutter rather than instruction,
     each a real bug that shipped in the first pass:
       · on a start square, which already carries a curved doorway;
       · on an arm tip, which already carries the coloured turn;
       · on a safe square, whose ★ it would then be drawn on top of. */
  const flow = flowArrows({ every: 2 });
  const abs = flow.map((a) => cellAt.get(key(a.cell)));
  const tips = START_ABS.map((_, seat) => (seat * 13 + 50) % TRACK.length);
  check("no flow arrow lands on a start square",
    !abs.some((a) => START_ABS.includes(a)), START_ABS.join(","));
  check("no flow arrow lands on an arm tip",
    !abs.some((a) => tips.includes(a)), tips.join(","));
  check("no flow arrow is drawn over a safe square's star",
    !abs.some((a) => SAFE_ABS.includes(a)), SAFE_ABS.join(","));
}

{
  /* A corner square is where the track turns. An arrow drawn there
     points into the turn and reads as an instruction to walk off the
     board, so corners are skipped by construction — this proves the
     construction, not the intent. */
  const flow = flowArrows({ every: 2 });
  const bad = flow.filter((a) => {
    const abs = cellAt.get(key(a.cell));
    const before = trackStep((abs - 1 + TRACK.length) % TRACK.length);
    const now = trackStep(abs);
    return before.dc !== now.dc || before.dr !== now.dr;
  });
  check("no flow arrow sits on a corner, where it would point off the board",
    bad.length === 0, bad.length ? bad.map((a) => key(a.cell)).join(" ") : "straights only");
}

console.log("\n── the same board for everybody ──\n");

{
  /* The board is one SVG rotated per seat, so the arrows must be
     rotationally symmetric or three players out of four are reading a
     differently-taught board from the first. */
  const abs = new Set(flowArrows({ every: 2 }).map((a) => cellAt.get(key(a.cell))));
  check("the flow arrows are the same set from every seat",
    [...abs].every((a) => abs.has((a + 13) % TRACK.length)),
    [...abs].sort((x, y) => x - y).join(","));
}

{
  const all = allArrows({ every: 2 });
  const seen = new Map();
  for (const a of all) {
    const k = key(a.cell);
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  const doubled = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  check("no square carries two arrows at once",
    doubled.length === 0, doubled.length ? doubled.join(" ") : `${all.length} arrows on ${seen.size} squares`);
  check("the arrows are enough to read the flow, and few enough to ignore",
    all.length >= 12 && all.length <= 28, `${all.length} on a 52-square track`);
}

{
  /* The ring wraps round the centre block with a DIAGONAL step at
     each of the four inner corners — that is the board, documented in
     board-geometry.mjs, and it is why a token does not cut through the
     middle. What must never happen is an ARROW on one of those four
     steps, which would point a goti straight at the centre. */
  let diagonals = [];
  for (let a = 0; a < TRACK.length; a++) {
    const { dc, dr } = trackStep(a);
    if (Math.abs(dc) + Math.abs(dr) !== 1) diagonals.push(a);
  }
  check("the ring turns the centre block on four diagonal steps",
    diagonals.length === 4, diagonals.join(","));
  const drawn = new Set(allArrows({ every: 2 }).map((a) => cellAt.get(key(a.cell))));
  check("no arrow is drawn on one of them",
    !diagonals.some((a) => drawn.has(a)), diagonals.join(","));
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
