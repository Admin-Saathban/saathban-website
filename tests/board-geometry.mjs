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

import { readFileSync } from "node:fs";
import {
  TRACK,
  HOME_COLUMNS,
  YARD_ORIGIN,
  YARD_SPOTS,
  START_ABS,
  SAFE_ABS,
  absOf,
  cellFor,
  povRotation,
  nearMissCells,
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
  /* The marked board moved the safe squares one step on, so they are
     no longer the starts plus eight. They are the starts plus ONE and
     plus NINE — one pair per arm, thirteen apart like everything else
     on this board. The start squares are no longer among them. */
  /* With the ring correctly phased, the eight marked cells ARE the
     classic set: each seat start, and the square eight steps on. The
     start squares are safe, which is the whole point of a start. */
  check("safe squares are each start and eight past it",
    SAFE_ABS.join(",") === "0,8,13,21,26,34,39,47", SAFE_ABS.join(","));
  check("every seat gets exactly two of them",
    [0, 1, 2, 3].every((s) => SAFE_ABS.filter((a) => Math.floor(a / 13) === s).length === 2));
  check("the 8 safe squares are all distinct", new Set(SAFE_ABS).size === 8);
  check("every start square IS safe", START_ABS.every((a) => SAFE_ABS.includes(a)));

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


/* ════════════════════════════════════════════════════════════════
   ONE LAP, ARM BY ARM — the direction of travel.

   A token leaving any seat's start must go round the four arms in one
   consistent rotational order, beginning with its own. Get this wrong
   and every token still moves a legal number of squares, still enters
   a home column, still finishes — it simply goes the wrong way round,
   which no other assertion in this file would notice.

   The order below is the engine's, verified rather than assumed:
   TOP -> RIGHT -> BOTTOM -> LEFT, which is CLOCKWISE, as the arrows
   on the user marked board show. If that ever needs to be the other way round, this
   is the line to change, and reversing it is NOT a one-line edit to
   TRACK — see the note in the commit for why (a start square has to
   stay beside its own yard, so a true reversal mirrors the layout).
   ════════════════════════════════════════════════════════════════ */
{
  const RING = ["TOP", "RIGHT", "BOTTOM", "LEFT"];   // clockwise
  const armOf = ([c, r]) => {
    if (r <= 5 && c >= 6 && c <= 8) return "TOP";
    if (c <= 5 && r >= 6 && r <= 8) return "LEFT";
    if (r >= 9 && c >= 6 && c <= 8) return "BOTTOM";
    if (c >= 9 && r >= 6 && r <= 8) return "RIGHT";
    return `off-cross(${c},${r})`;
  };

  check("every track cell belongs to one of the four arms",
    TRACK.every((cell) => RING.includes(armOf(cell))),
    TRACK.filter((cell) => !RING.includes(armOf(cell))).map(String).join(" ") || "");

  for (let seat = 0; seat < 4; seat++) {
    /* Walk the whole lap the way the engine does: progress 1..52 maps
       to absolute (seat*13 + p - 1) % 52. */
    const walk = [];
    for (let p = 1; p <= 52; p++) walk.push(armOf(TRACK[(seat * 13 + p - 1) % 52]));

    const visited = walk.filter((a, i) => i === 0 || a !== walk[i - 1]);
    const startArm = armOf(TRACK[START_ABS[seat]]);
    const expected = [0, 1, 2, 3, 4].map((k) => RING[(RING.indexOf(startArm) + k) % 4]);

    check(`seat ${seat}: starts in its own arm (${startArm})`,
      visited[0] === startArm && armOf(TRACK[START_ABS[seat]]) === startArm);
    check(`seat ${seat}: one lap visits the arms ${expected.slice(0, 4).join(" -> ")}`,
      visited.length === 5 && visited.every((a, i) => a === expected[i]),
      visited.join(" -> "));
    check(`seat ${seat}: 52 steps returns to where it started`,
      TRACK[(seat * 13 + 52 - 1 + 1) % 52].join(",") === TRACK[START_ABS[seat]].join(","));
  }

  /* The four seats must go round the SAME way as each other. */
  const dirs = [0, 1, 2, 3].map((seat) => {
    const a0 = armOf(TRACK[(seat * 13) % 52]);
    const a1 = armOf(TRACK[(seat * 13 + 13) % 52]);
    return (RING.indexOf(a1) - RING.indexOf(a0) + 4) % 4;
  });
  check("all four seats travel the same way round", new Set(dirs).size === 1, `steps: ${dirs.join(",")}`);
}

/* ════════════════════════════════════════════════════════════════
   THE BOARD AND THE ENGINE MUST AGREE ON WHAT IS SAFE.

   The board draws a star; the engine decides whether a token standing
   there can be taken. Those are two lists in two languages, and a star
   drawn where the engine will not protect you is worse than no star at
   all — the person trusted it.

   Read from the LIVE function rather than the migration file, for the
   reason tests/snakes-board.mjs gives: a create-or-replace that
   silently failed to apply would otherwise leave this passing against
   a database that disagrees.
   ════════════════════════════════════════════════════════════════ */
{
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = (n) => {
    const l = raw.split(/\r?\n/).find((x) => x.startsWith(n));
    return l ? l.slice(l.indexOf("=") + 1).replace(/\s/g, "") : null;
  };
  const SUPA = env("VITE_SUPABASE_URL");
  const ANON = env("VITE_SUPABASE_ANON_KEY");
  const auth = await (
    await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "smoke-icon@saathban.dev", password: "SaathTest!2026" }),
    })
  ).json();

  if (!auth.access_token) {
    check("live engine reachable for the safe-square check", false, "login failed");
  } else {
    const H = { apikey: ANON, Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" };
    const engineSafe = [];
    for (let abs = 0; abs < 52; abs++) {
      const r = await fetch(`${SUPA}/rest/v1/rpc/ludo_is_safe`, {
        method: "POST",
        headers: H,
        body: JSON.stringify({ p_abs: abs, p_rules: { safe_squares: "standard" } }),
      });
      if (await r.json()) engineSafe.push(abs);
    }
    const drawn = [...SAFE_ABS].sort((a, b) => a - b).join(",");
    const engine = engineSafe.join(",");
    check("the stars the board draws ARE the engine's safe squares",
      drawn === engine, drawn === engine ? `${engineSafe.length} squares` : `\n  drawn:  ${drawn}\n  engine: ${engine}`);
    check("there are eight of them, two per arm",
      engineSafe.length === 8 &&
        [0, 1, 2, 3].every((k) => engineSafe.filter((a) => Math.floor(a / 13) === k).length === 2),
      engineSafe.join(","));
    check("the safe set is the same from every seat (rotationally symmetric)",
      engineSafe.every((a) => engineSafe.includes((a + 13) % 52)), engineSafe.join(","));
    check("every start square is safe in the engine too",
      START_ABS.every((a) => engineSafe.includes(a)), START_ABS.join(","));
  }
}

/* ── Near misses ─────────────────────────────
   The board draws a ring where an enemy was passed within one square
   and survived. It is the kind of arithmetic that looks obviously
   right and is off by one, so it is judged here square by square
   rather than by watching bots play and hoping one happens. */
{
  const empty = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const board = (fn) => { const b = empty.map((r) => [...r]); fn(b); return b; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* Seat 1 at p=44 stands on abs 4. Seat 0 walking 2 -> 8 covers abs
     1..7, so it is one square off at abs 3 and again at abs 5. */
  check("absOf(1,44) really is abs 4", absOf(1, 44) === 4, String(absOf(1, 44)));
  const prev = board((b) => { b[0][1] = 2; b[1][0] = 44; });
  const hits = nearMissCells(prev, board((b) => { b[0][1] = 8; b[1][0] = 44; }));
  check("passing an enemy at one square's distance is a near miss",
    hits.length === 1, JSON.stringify(hits));
  check("the ring is drawn on the ENEMY's square, not the mover's",
    hits.length === 1 && same(hits[0], cellFor(1, 44, 0)), JSON.stringify(hits[0]));
  check("one enemy passed once counts once, going in and coming out",
    new Set(hits.map(String)).size === hits.length, JSON.stringify(hits));

  /* Landing on it is a capture. Capture has its own flash, and calling
     the worst moment of somebody's game a near miss would be cruel. */
  check("absOf(0,5) is the enemy's own square", absOf(0, 5) === 4, String(absOf(0, 5)));
  const onto = nearMissCells(prev, board((b) => { b[0][1] = 5; b[1][0] = 44; }));
  check("landing ON an enemy is a capture, never a near miss",
    !onto.some((c) => same(c, cellFor(1, 44, 0))), JSON.stringify(onto));

  check("absOf(1,46) is abs 6", absOf(1, 46) === 6, String(absOf(1, 46)));
  check("two squares away is not a near miss",
    nearMissCells(board((b) => { b[0][1] = 2; b[1][0] = 46; }),
                  board((b) => { b[0][1] = 4; b[1][0] = 46; })).length === 0, "");

  check("your own goti is never a near miss",
    nearMissCells(board((b) => { b[0][1] = 2; b[0][2] = 8; }),
                  board((b) => { b[0][1] = 6; b[0][2] = 8; })).length === 0, "");

  /* Off the ring entirely: yard, home column, home. */
  [0, 52, 55, 57].forEach((p) => {
    check("an enemy at progress " + p + " is off the ring and cannot be passed",
      nearMissCells(board((b) => { b[0][1] = 2; b[1][0] = p; }),
                    board((b) => { b[0][1] = 8; b[1][0] = p; })).length === 0, "");
  });

  check("a captured goti travelling home passes nobody",
    nearMissCells(board((b) => { b[0][1] = 20; b[1][0] = 44; }),
                  board((b) => { b[0][1] = 0;  b[1][0] = 44; })).length === 0, "");

  /* THE SEAM. abs 51 and abs 0 are neighbours, and an implementation
     that subtracts without the modulus misses every near miss across
     it — the busiest stretch of the ring, since abs 0 is a start. */
  check("seat 2 at p=27 sits on abs 0", absOf(2, 27) === 0, String(absOf(2, 27)));
  /* Seat 0 can never be tested here: its lap runs abs 0..50 and ends
     on its own arm's tip, so abs 51 is a square it never stands on.
     Seat 1 is the one whose walk crosses the seam. */
  check("seat 0's lap never reaches abs 51", absOf(0, 51) === 50, String(absOf(0, 51)));
  check("seat 1 at p=39 sits on abs 51", absOf(1, 39) === 51, String(absOf(1, 39)));
  check("abs 51 and abs 0 are neighbours across the seam",
    nearMissCells(board((b) => { b[1][1] = 38; b[2][0] = 27; }),
                  board((b) => { b[1][1] = 39; b[2][0] = 27; })).length === 1, "");
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
