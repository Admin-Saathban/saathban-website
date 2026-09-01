/* ════════════════════════════════════════════════
   The shape of a snake.

   The old bodies were single-bow Bézier arcs: a head, a tail, and one
   gentle lean between them. Drawn small on a phone that is not a
   snake, it is a bent pipe — and the owner said so. A snake reads as
   a snake because it COILS: the body crosses its own axis, swells
   behind the head, and thins to a point.

   So a body is sampled here rather than described as a curve. Walk
   the straight line from head to tail, push each sample sideways by a
   sine of how far along it is, and the line becomes an S. Two lobes
   is an S; three is a coil.

   TWO PROPERTIES THIS FILE EXISTS TO GUARANTEE.

   1. THE ENDS DO NOT MOVE. sin(kπt) is zero at t=0 and t=1 for whole
      k, so however hard the middle coils, the head still sits exactly
      on the centre of its landing square and the tail exactly on its
      destination. This is not a nicety. A player traces a snake with
      a finger to see where they will end up, and a tail drawn a third
      of a square off is a board that lies — the same rule art.js was
      written under, kept.

   2. THE PATH IS THE ANIMATION. The token slides DOWN the snake, so
      the drawn body and the travelled route have to be the same
      points, not two approximations of one idea. Everything here
      returns samples, and both the fill and the slide read them.
   ════════════════════════════════════════════════ */

/* The board is 100×100 viewBox units, 10 per cell. A body may lean
   off its axis but never off the paper — a coil that swings under the
   wooden frame is clipped away and reads as a snake cut in half. */
const EDGE = 3.2;
const clamp = (v) => Math.max(EDGE, Math.min(100 - EDGE, v));

/* How many half-waves a body makes between its two squares. A short
   drop has no room to coil three times without looking like a spring,
   so the count comes from the length. */
export function wavesFor(len) {
  if (len < 22) return 2;
  if (len < 46) return 3;
  return 4;
}

/* THE SPINE.

   `phase` flips which way the first lobe leans, so two snakes that
   happen to run alongside each other coil in opposite directions
   instead of lying in parallel like cables.

   The amplitude carries its own envelope, sin(πt): without it every
   lobe is the same width and the body reads as machined. With it the
   coils are widest across the middle and tighten towards both ends,
   which is how a real snake lies. */
export function spine(a, b, { waves = 3, amp = 0.16, phase = 1, n = 96 } = {}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  /* The perpendicular. */
  const nx = -uy;
  const ny = ux;
  const A = amp * len * phase;

  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const env = Math.sin(Math.PI * t) ** 0.65;
    const off = A * env * Math.sin(waves * Math.PI * t);
    pts.push({
      x: clamp(a.x + ux * len * t + nx * off),
      y: clamp(a.y + uy * len * t + ny * off),
      t,
    });
  }
  /* Clamping can only ever have moved an interior point — the ends
     have zero offset — but say so out loud, because "the head is
     exactly on its square" is the whole contract. */
  pts[0] = { ...a, t: 0 };
  pts[n] = { ...b, t: 1 };
  return pts;
}

/* THE THICKNESS ALONG THE BODY.

   Not a straight taper from head to tail. A snake is thickest a
   little way behind the head and thins from there, so the profile
   swells to its belly at about a third of the way down and runs out
   to a point. A body that tapers linearly from the head looks like a
   carrot. */
export function widthAt(t, { neck, belly, tail }) {
  if (t < 0.32) return neck + (belly - neck) * (t / 0.32);
  const u = (t - 0.32) / 0.68;
  return belly + (tail - belly) * u ** 0.85;
}

/* The filled outline: down one side of the spine and back up the
   other. SVG cannot vary a stroke's width along its length, which is
   the whole reason a body is a filled shape rather than a fat line.

   `shrink` pulls the outline in by a constant, which is how the ridge
   highlight is drawn — the same shape, thinner, so the two can never
   disagree about where the back of the snake is. */
export function outline(pts, profile, shrink = 0) {
  const left = [];
  const right = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[Math.min(i + 1, pts.length - 1)];
    const o = pts[Math.max(i - 1, 0)];
    const dx = q.x - o.x;
    const dy = q.y - o.y;
    const len = Math.hypot(dx, dy) || 1;
    const w = Math.max(0.05, widthAt(p.t, profile) / 2 - shrink);
    const nx = (-dy / len) * w;
    const ny = (dx / len) * w;
    left.push(`${(p.x + nx).toFixed(2)},${(p.y + ny).toFixed(2)}`);
    right.push(`${(p.x - nx).toFixed(2)},${(p.y - ny).toFixed(2)}`);
  }
  return `M ${left.join(" L ")} L ${right.reverse().join(" L ")} Z`;
}

/* The ridge that runs along the back. Drawn as a path rather than as
   a second outline so it can be stroked with a round cap and fade
   out before the tail, the way a highlight actually falls. */
export function ridge(pts) {
  const keep = pts.filter((p) => p.t > 0.06 && p.t < 0.82);
  return `M ${keep.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" L ")}`;
}

/* Where the head is pointing, in degrees — so eyes, horns and tongue
   sit on the front of the face rather than wherever the head happens
   to have been drawn. Read from a little way in: the very first
   segment of a coiling body is short and its direction is noisy. */
export function headAngle(pts) {
  const a = pts[0];
  const b = pts[Math.min(6, pts.length - 1)];
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/* THE POINT A SLIDING TOKEN IS AT.

   `u` runs 0 (head) to 1 (tail). Sampled from the same spine the body
   was filled from, so the token rides the coils it can see rather
   than cutting the corner. Linear between samples — at 96 samples
   over a drop of a few squares the gap is far under a pixel. */
export function pointAt(pts, u) {
  const c = Math.max(0, Math.min(1, u)) * (pts.length - 1);
  const i = Math.floor(c);
  const j = Math.min(i + 1, pts.length - 1);
  const f = c - i;
  return {
    x: pts[i].x + (pts[j].x - pts[i].x) * f,
    y: pts[i].y + (pts[j].y - pts[i].y) * f,
  };
}

/* A ladder is two rails and the rungs between them, and unlike a
   snake it is rigid — a bent ladder is not a ladder. Returned as
   geometry rather than as paths so the climb animation can put the
   token on each rung in turn. */
export function ladderGeometry(a, b, { width = 5.2 } = {}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);

  /* Rungs about every 6 units — roughly two to a cell, which is the
     spacing that still reads as a ladder when the board is 340px
     wide. Never fewer than three, or it is a letter H. */
  const count = Math.max(3, Math.round(len / 6));
  const rungs = [];
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    rungs.push({ x1: x + nx, y1: y + ny, x2: x - nx, y2: y - ny, t });
  }
  return {
    rails: [
      { x1: a.x + nx, y1: a.y + ny, x2: b.x + nx, y2: b.y + ny },
      { x1: a.x - nx, y1: a.y - ny, x2: b.x - nx, y2: b.y - ny },
    ],
    rungs,
    /* Where a climbing token stands at u — up the middle of the
       ladder, between the rails, not on one of them. */
    at: (u) => ({ x: a.x + dx * u, y: a.y + dy * u }),
    stops: count,
  };
}
