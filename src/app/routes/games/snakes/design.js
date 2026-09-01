/* ════════════════════════════════════════════════
   Which snakes and which ladders are on THIS table.

   The board used to be one fixed map, written twice — here and in
   snakes_board_jump() — with a test holding the two together. The
   host can now choose how many snakes and how many ladders the table
   has, so a fixed map is no longer enough, and "written twice" would
   become "written twice and configurable", which is a board that
   lies waiting to happen.

   So: the map is BUILT here, from ordered pools, and the built map is
   STORED ON THE SESSION. The server reads that stored map when it
   moves a token (0105) and this file reads it when it draws one. One
   object, one source, no drift possible — the client cannot draw a
   snake the server does not honour, because they are reading the same
   rows.

   THE RULES A BUILT BOARD STILL OBEYS, unchanged from board.js, and
   they are what the pools are ordered to protect:

   - Nothing starts or lands on 1 or 100. A ladder off square 1 fires
     before the game has begun; a ladder onto 100 wins by landing on
     the ladder instead of by rolling the exact number the finish asks
     for.
   - Ladders only climb, snakes only drop.
   - Every square in the map is DISTINCT, which buys three guarantees
     at once: no square hosts two jumps, no jump lands on another's
     mouth, and therefore no chains exist at all.

   Because the pools are taken IN ORDER and every entry in both pools
   is square-distinct from every other, any count from any pool is
   automatically a legal board. That is the point of ordering them
   rather than choosing at random: a random four-of-ten would need
   checking every time, and something eventually ships unchecked.
   ════════════════════════════════════════════════ */

/* THE BOSS. Owner-specified: 97 down to 26, the longest fall on the
   board, and always present whatever else the host turns off. It is
   drawn as the dragon rather than as a snake, and it keeps its own
   colours whatever colour set the table is using. */
export const BOSS = { from: 97, to: 26 };

/* Ordered so that taking the first N gives a board that is spread
   over the paper rather than piled into one corner. Head → tail. */
export const SNAKE_POOL = [
  [88, 58],   // the long one, upper right — the drop that hurts
  [36, 22],   // lower middle
  [71, 65],   // short, upper left
  [54, 19],   // the other long one, crossing the middle
  [17, 8],    // short, near the start
  [60, 51],   // short, middle
  [45, 32],   // middle
  [24, 15],   // short, low
  [94, 87],   // short, near the top
  [79, 69],   // upper middle
];

/* Foot → top. 85→97 is deliberately NOT here: 97 is the dragon's
   head, and two jumps may never share a square. */
export const LADDER_POOL = [
  [4, 25],    // the opening climb, bottom left
  [42, 63],   // middle
  [13, 46],   // the long one
  [74, 92],   // near the top
  [27, 38],   // low middle
  [50, 70],   // middle right
  [62, 81],   // upper
  [33, 52],   // low right
  [85, 95],   // the last chance
];

/* Owner's defaults: four snakes plus the dragon, four ladders. The
   count INCLUDES the dragon, because "five snakes" is what a person
   sees on the board — a stepper that says four while five things are
   drawn is a stepper nobody trusts. */
export const DEFAULTS = { snakes: 5, ladders: 4 };
export const LIMITS = { snakes: [2, 10], ladders: [1, 9] };

export const PLAYERS = { min: 2, max: 8, default: 4 };

const clampTo = ([lo, hi], n) => Math.max(lo, Math.min(hi, Math.round(n) || lo));

/* Build the board for a table. Returns everything both the drawing
   and the engine need, including the flat {from: to} map that is what
   actually gets stored and what the server reads back. */
export function buildBoard({ snakes = DEFAULTS.snakes, ladders = DEFAULTS.ladders } = {}) {
  const nS = clampTo(LIMITS.snakes, snakes);
  const nL = clampTo(LIMITS.ladders, ladders);

  /* The dragon first, then as many of the pool as were asked for. */
  const snakeList = [
    { from: BOSS.from, to: BOSS.to, boss: true },
    ...SNAKE_POOL.slice(0, nS - 1).map(([from, to]) => ({ from, to, boss: false })),
  ];
  const ladderList = LADDER_POOL.slice(0, nL).map(([from, to]) => ({ from, to }));

  const jumps = {};
  for (const s of snakeList) jumps[s.from] = s.to;
  for (const l of ladderList) jumps[l.from] = l.to;

  const board = { snakes: snakeList, ladders: ladderList, jumps, counts: { snakes: nS, ladders: nL } };

  /* THROWN, NOT LOGGED. The pools are static, so a fault here is a
     typo in this file and every board the app can build is wrong —
     there is no partial failure to degrade into. A thrown error is
     seen the first time anyone opens the setup room; a console
     warning is seen by nobody, and the alternative to both is a board
     that quietly eats a player. */
  const problems = problemsWith(board);
  if (problems.length) {
    throw new Error(`snakes: the board pools are not legal — ${problems.join("; ")}`);
  }

  return board;
}

/* The same checks board.js runs, minus the fixed-count ones that a
   configurable board cannot satisfy. Kept because the pools are
   hand-written and a typo in one of them is a board that eats a
   player.

   This comment used to claim it was "called on every build rather
   than in a test". It was not called by anything at all — exported,
   correct, and never once run, which is the exact failure this lane
   has been finding in other people's code all week, written by me,
   about my own check, in a comment asserting the opposite. buildBoard
   calls it now, which is what makes the sentence true. */
export function problemsWith(board) {
  const out = [];
  const seen = new Map();
  const all = [
    ...board.snakes.map((s) => ({ ...s, kind: "snake" })),
    ...board.ladders.map((l) => ({ ...l, kind: "ladder" })),
  ];
  for (const j of all) {
    if (j.kind === "snake" && j.to >= j.from) out.push(`snake ${j.from}→${j.to} does not drop`);
    if (j.kind === "ladder" && j.to <= j.from) out.push(`ladder ${j.from}→${j.to} does not climb`);
    for (const sq of [j.from, j.to]) {
      if (sq === 1 || sq === 100) out.push(`square ${sq} is part of ${j.from}→${j.to}`);
      if (sq < 1 || sq > 100) out.push(`${sq} is off the board`);
      if (seen.has(sq)) out.push(`square ${sq} used twice (${seen.get(sq)} and ${j.from}→${j.to})`);
      else seen.set(sq, `${j.from}→${j.to}`);
    }
  }
  return out;
}

/* Read a board back off a session row. Sessions created before the
   board became per-table have no stored map; they get the defaults,
   which is also what the server falls back to, so an old table keeps
   drawing what it is actually playing. */
export function boardFor(session) {
  const hr = session?.house_rules || {};
  const counts = {
    snakes: hr.snakes ?? DEFAULTS.snakes,
    ladders: hr.ladders ?? DEFAULTS.ladders,
  };
  return buildBoard(counts);
}

/* WHICH COLOUR A SEAT IS PLAYING.

   Colour is a person's own choice, made when they sit down, so it is
   stored per seat rather than derived from the seat number. It lives
   in house_rules.colors as { "<seat_no>": index } because that is the
   one bag of table settings the session row already carries, and 0105
   writes it through an RPC rather than letting a client update
   another player's seat.

   The fallback is the seat number, which is always a distinct colour
   for the eight seats this table can hold — so a table created before
   colours were choosable, or one where nobody bothered, still shows
   eight different pieces rather than eight yellow ones. */
export function seatColorIdx(session, seatNo) {
  const picked = session?.house_rules?.colors?.[String(seatNo)];
  return Number.isInteger(picked) ? picked : seatNo;
}

/* The colours nobody at this table has taken yet. */
export function freeColors(session, seats, exceptSeat = null) {
  const taken = new Set(
    (seats || [])
      .filter((s) => s.seat_no !== exceptSeat)
      .map((s) => seatColorIdx(session, s.seat_no))
  );
  return Array.from({ length: PLAYERS.max }, (_, i) => i).filter((i) => !taken.has(i));
}
