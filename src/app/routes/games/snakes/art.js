/* ════════════════════════════════════════════════
   Snakes & Ladders — where every snake and ladder is DRAWN.

   Split out of the component for one reason: a test has to be able to
   ask "does the drawn head of the 88 snake sit in the middle of square
   88?" without rendering React. The board map (board.js) says which
   squares a jump connects; this says where on the page those squares
   are and what curve runs between them. tests/snakes-board.mjs checks
   both against the live SQL.

   TWO THINGS THIS FILE IS RESPONSIBLE FOR.

   1. ENDPOINTS ARE EXACT. A snake's head sits at the centre of its
      landing square and its tail at the centre of its destination, to
      the pixel — no artistic licence, no "close enough". A player
      traces a snake with their finger to work out where they will end
      up, and a tail drawn a third of a square off is a board that
      lies. Same for a ladder's foot and top.

   2. CROSSINGS ARE CAPPED, BY MOVING THE CURVE AND NEVER THE GAME.
      Nineteen paths over a 10×10 grid will tangle if every one is a
      straight line between its ends. Each snake may bow left or right
      by one of a few amounts, and `routeAll` picks the bow that leaves
      the fewest crossings — a small greedy pass over a fixed set of
      options, run once at module load. The JUMPS never move; only the
      line between them bends.
   ════════════════════════════════════════════════ */

import { LADDERS, SNAKES, cellCenter } from "./board.js";

/* Bows a snake may take, as a fraction of its own length. Zero first,
   so a snake only bends if bending actually buys something. */
const BOWS = [0, 0.16, -0.16, 0.3, -0.3, 0.46, -0.46];

/* Sample a quadratic Bézier. */
function bez(a, ctrl, b, t) {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y,
  };
}

/* The control point for a given bow: the midpoint pushed sideways. */
function control(a, b, bow) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  /* Clamped to the board. A bow steep enough to swing a body outside
     the frame reads as a snake that has left the game — and on a
     phone it is simply clipped away. */
  const clamp = (v) => Math.max(4, Math.min(96, v));
  return {
    x: clamp(mx + (-dy / len) * bow * len),
    y: clamp(my + (dx / len) * bow * len),
  };
}

/* A path as a run of sample points, for crossing tests and for the
   tapered body outline. */
export function samples(a, b, bow, n = 24) {
  const c = control(a, b, bow);
  return Array.from({ length: n + 1 }, (_, i) => bez(a, c, b, i / n));
}

function segsCross(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98;
}

export function pathsCross(A, B) {
  for (let i = 0; i < A.length - 1; i++) {
    for (let j = 0; j < B.length - 1; j++) {
      if (segsCross(A[i], A[i + 1], B[j], B[j + 1])) return true;
    }
  }
  return false;
}

/* Every drawn path on the board, with its bow chosen to keep the
   tangle down. Ladders stay straight — a bent ladder is not a ladder. */
export function routeAll() {
  const ladders = LADDERS.map(([from, to]) => ({
    kind: "ladder",
    from,
    to,
    a: cellCenter(from),
    b: cellCenter(to),
    bow: 0,
  }));
  ladders.forEach((l) => {
    l.pts = samples(l.a, l.b, 0, 2);
  });

  /* Longest snakes first: they have the least room to move, so they
     should choose before the short ones fill the space. */
  const order = [...SNAKES].sort((x, y) => y[0] - y[1] - (x[0] - x[1]));
  const placed = ladders.map((l) => l.pts);
  const snakes = [];

  for (const [from, to] of order) {
    const a = cellCenter(from);
    const b = cellCenter(to);
    let best = null;
    for (const bow of BOWS) {
      const pts = samples(a, b, bow);
      const hits = placed.reduce((n, p) => n + (pathsCross(pts, p) ? 1 : 0), 0);
      /* A tie goes to the earlier (straighter) bow, so the board only
         bends as much as it has to. */
      if (!best || hits < best.hits) best = { bow, pts, hits };
      if (hits === 0) break;
    }
    placed.push(best.pts);
    snakes.push({ kind: "snake", from, to, a, b, bow: best.bow, pts: best.pts });
  }

  /* Back into board order so the drawing is stable between renders. */
  snakes.sort((x, y) => x.from - y.from);
  return [...ladders, ...snakes];
}

export const ROUTES = routeAll();

/* What the test asks for: the drawn endpoints of every path, so they
   can be compared with the engine's map square by square. */
export function drawnEndpoints() {
  return ROUTES.map((r) => ({
    kind: r.kind,
    from: r.from,
    to: r.to,
    head: { x: r.a.x, y: r.a.y },
    tail: { x: r.b.x, y: r.b.y },
  }));
}

/* How many pairs of drawn paths cross. Used as a ceiling in the test:
   some crossing is unavoidable on a 10×10 board with nineteen jumps,
   but it must not creep up unnoticed. */
export function crossingCount(routes = ROUTES) {
  let n = 0;
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      if (pathsCross(routes[i].pts, routes[j].pts)) n++;
    }
  }
  return n;
}

/* A tapered outline for a snake body: thick behind the head, thin at
   the tail. SVG cannot vary a stroke's width along its length, so the
   body is a filled shape — down one side and back up the other. */
export function bodyOutline(pts, headW, tailW) {
  const left = [];
  const right = [];
  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1);
    const w = (headW + (tailW - headW) * t) / 2;
    const p = pts[i];
    const q = pts[Math.min(i + 1, pts.length - 1)];
    const o = pts[Math.max(i - 1, 0)];
    const dx = q.x - o.x;
    const dy = q.y - o.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * w;
    const ny = (dx / len) * w;
    left.push(`${(p.x + nx).toFixed(2)},${(p.y + ny).toFixed(2)}`);
    right.push(`${(p.x - nx).toFixed(2)},${(p.y - ny).toFixed(2)}`);
  }
  return `M ${left.join(" L ")} L ${right.reverse().join(" L ")} Z`;
}
