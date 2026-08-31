/* ════════════════════════════════════════════════
   Snakes & Ladders — the board art.

   One SVG, 100 cells, and the two things on it must not be mistaken
   for one another. The old board drew both in muted sage and tan, at
   the same weight, and at arm's length a ladder and a snake were the
   same beige tangle. They are opposites — one is the best thing that
   can happen to you and one is the worst — so they are now drawn as
   opposites:

   LADDERS are straight, wooden, and built. Two rails that converge
   slightly with height, rungs with a shadow under each, warm timber
   colour. Nothing about a ladder curves.

   SNAKES are vivid, curved and alive. A tapered body from a thick
   neck to a fine tail, scales along its back, a head with eyes and a
   forked tongue at the square that swallows you. Three colourways
   (green, red, brown) assigned so no two neighbours share one.

   A snake still LOOKS like what it costs: body weight grows with the
   drop, so the two long ones read as real hazards and the short ones
   stay gentle.

   NUMERALS WIN. The art is drawn UNDER the numbers, and every numeral
   carries a paper-coloured halo, because the number is the thing a
   player actually needs and a snake crossing a square must never cost
   them it. Colour never carries meaning alone: 1 and 100 are marked
   with a flag and a crown as well as a tint, and every token shows its
   seat number.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { APP_COLORS as C } from "../../../../shared/tokens.js";
import { SIZE, CELL, cellCenter } from "./board.js";
import { ROUTES, bodyOutline } from "./art.js";
import { SEAT_COLORS, SEAT_INK } from "../seatColors.js";
import Pawn from "../Pawn.jsx";

const TOKEN_FILLS = SEAT_COLORS;

/* A real ladder: two timber rails and rungs between them.

   The rails CONVERGE slightly toward the top — a little forced
   perspective, so the thing reads as leaning away from you rather
   than lying flat on the paper. Each rung gets a darker line beneath
   it, which is what makes it look like a bar you could stand on
   instead of a stripe. */
function Ladder({ from, to }) {
  const a = cellCenter(from);
  const b = cellCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const footHalf = 1.75;
  const topHalf = 1.25;                        // the perspective
  const rungs = Math.max(3, Math.round(len / 3.2));

  const rail = (side) =>
    `M ${a.x + nx * footHalf * side} ${a.y + ny * footHalf * side}` +
    ` L ${b.x + nx * topHalf * side} ${b.y + ny * topHalf * side}`;

  return (
    <g>
      {/* the shadow the whole ladder casts */}
      <g transform="translate(0.35 0.35)" opacity="0.18">
        <path d={rail(1)} stroke="#000" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        <path d={rail(-1)} stroke="#000" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      </g>
      {Array.from({ length: rungs - 1 }, (_, i) => {
        const t = (i + 1) / rungs;
        const half = footHalf + (topHalf - footHalf) * t;
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        const x1 = x + nx * half;
        const y1 = y + ny * half;
        const x2 = x - nx * half;
        const y2 = y - ny * half;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8a5a2b" strokeWidth="1.15" strokeLinecap="round" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d8a05c" strokeWidth="0.62" strokeLinecap="round" />
          </g>
        );
      })}
      <path d={rail(1)} stroke="#8a5a2b" strokeWidth="1.35" fill="none" strokeLinecap="round" />
      <path d={rail(-1)} stroke="#8a5a2b" strokeWidth="1.35" fill="none" strokeLinecap="round" />
      <path d={rail(1)} stroke="#c98a4b" strokeWidth="0.7" fill="none" strokeLinecap="round" />
      <path d={rail(-1)} stroke="#c98a4b" strokeWidth="0.7" fill="none" strokeLinecap="round" />
    </g>
  );
}

/* Three colourways, so two snakes meeting on the board are never
   the same animal. Assigned by position in the map rather than at
   random: the board looks the same every time you open it. */
const SKINS = [
  { back: "#1E7A3C", belly: "#8FD6A2", scale: "#0F5A2A", eye: "#FFF6DC" },
  { back: "#B8342C", belly: "#F0A79C", scale: "#8C1F1A", eye: "#FFF6DC" },
  { back: "#7A4A22", belly: "#D6A878", scale: "#553113", eye: "#FFF6DC" },
];

/* A snake, drawn as a body rather than a line.

   SVG cannot taper a stroke, so the body is a filled outline that
   narrows from a thick neck to a fine tail (bodyOutline in art.js).
   On top of it: a paler belly stripe down the middle, scale marks
   along the back, and a head at the square that swallows you — eyes,
   a highlight, and a forked tongue.

   The head is at `from` and the tail at `to`, both exactly on their
   square's centre, because a player traces this with a finger to work
   out where they will land. */
function Snake({ route, index }) {
  const { from, to, a: h, b: t, pts } = route;
  const drop = from - to;
  const skin = SKINS[index % SKINS.length];
  const neck = 2.9 + Math.min(1.9, drop / 14);
  const tip = 0.7;

  // Heading at the head, for the eyes and tongue.
  const hx = pts[1].x - pts[0].x;
  const hy = pts[1].y - pts[0].y;
  const hl = Math.hypot(hx, hy) || 1;
  const ux = hx / hl;
  const uy = hy / hl;      // points down the body, away from the head
  const nx = -uy;
  const ny = ux;
  /* Capped in ABSOLUTE terms, not just relative to the body. A short
     snake has a thick neck for its length, and an unclamped head on
     one of those filled a third of a square and read as an owl. */
  const headR = Math.min(neck * 0.8, 2.15);

  return (
    <g>
      <path d={bodyOutline(pts, neck, tip)} fill={skin.back} />
      {/* belly: a paler line down the middle, thinner than the body */}
      <path d={bodyOutline(pts, neck * 0.42, tip * 0.5)} fill={skin.belly} opacity="0.75" />
      {/* scales along the back */}
      {pts.map((p, i) => {
        if (i % 2 || i === 0 || i > pts.length - 3) return null;
        const w = (neck + (tip - neck) * (i / (pts.length - 1))) * 0.5;
        return (
          <circle key={i} cx={p.x} cy={p.y} r={Math.max(0.16, w * 0.4)} fill={skin.scale} opacity="0.55" />
        );
      })}
      {/* head */}
      <ellipse
        cx={h.x + ux * headR * 0.15}
        cy={h.y + uy * headR * 0.15}
        rx={headR * 1.15}
        ry={headR * 0.92}
        fill={skin.back}
        transform={`rotate(${(Math.atan2(uy, ux) * 180) / Math.PI} ${h.x} ${h.y})`}
      />
      <ellipse
        cx={h.x - ux * headR * 0.35}
        cy={h.y - uy * headR * 0.35}
        rx={headR * 0.5}
        ry={headR * 0.34}
        fill="#ffffff"
        opacity="0.22"
        transform={`rotate(${(Math.atan2(uy, ux) * 180) / Math.PI} ${h.x} ${h.y})`}
      />
      {/* eyes, one either side of the spine */}
      {[1, -1].map((side) => (
        <g key={side}>
          <circle cx={h.x + nx * headR * 0.42 * side} cy={h.y + ny * headR * 0.42 * side} r={headR * 0.3} fill={skin.eye} />
          <circle cx={h.x + nx * headR * 0.42 * side} cy={h.y + ny * headR * 0.42 * side} r={headR * 0.14} fill="#1a1a1a" />
        </g>
      ))}
      {/* forked tongue, flicking away from the body */}
      <path
        d={`M ${h.x - ux * headR * 0.9} ${h.y - uy * headR * 0.9}
            L ${h.x - ux * headR * 1.9} ${h.y - uy * headR * 1.9}
            M ${h.x - ux * headR * 1.9} ${h.y - uy * headR * 1.9}
            L ${h.x - ux * headR * 2.5 + nx * headR * 0.4} ${h.y - uy * headR * 2.5 + ny * headR * 0.4}
            M ${h.x - ux * headR * 1.9} ${h.y - uy * headR * 1.9}
            L ${h.x - ux * headR * 2.5 - nx * headR * 0.4} ${h.y - uy * headR * 2.5 - ny * headR * 0.4}`}
        stroke="#D6202A"
        strokeWidth="0.3"
        fill="none"
        strokeLinecap="round"
      />
      {/* the tail comes to a point */}
      <circle cx={t.x} cy={t.y} r={tip * 0.6} fill={skin.back} />
    </g>
  );
}

/* ── the walk ──────────────────────────────────
   A token travels; it does not teleport. Same idea as the ludo
   board's useWalk, with one difference the game demands: a move here
   has TWO LEGS. You roll to a square, and only then does a ladder
   carry you up or a snake take you down. Collapsing that into one
   slide loses the reason you ended up where you did — and the whole
   drama of snakes and ladders is in the second leg.

   So: hop square by square to where the dice put you, pause long
   enough for it to register, then travel the jump.

   It snaps rather than walks when the move can't be a single roll —
   a fresh load, a rematch, someone else's table arriving mid-game —
   because a token strolling forty squares on page load is a lie
   about what just happened. */
const STEP_MS = 150;
const JUMP_PAUSE_MS = 320;

function useWalk(seats, lastMove) {
  const target = {};
  for (const s of seats) target[s.seat_no] = Number(s.score) || 0;
  const key = seats.map((s) => `${s.seat_no}:${Number(s.score) || 0}`).join(",");

  const [shown, setShown] = useState(target);
  const prevRef = useRef(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = target;

    // First paint of this board: show the truth, walk nothing.
    if (!prev) {
      setShown(target);
      return undefined;
    }

    const seat = Number(lastMove?.seat_no);
    const m = lastMove?.move || {};
    const from = Number(m.from);
    const landed = Number(m.landed);
    const to = Number(m.to);

    const changed = Object.keys(target).filter((k) => target[k] !== prev[k]);
    const walkable =
      changed.length === 1 &&
      Number(changed[0]) === seat &&
      isFinite(from) && isFinite(landed) && isFinite(to) &&
      target[seat] === to &&
      prev[seat] === from &&
      landed > from &&
      landed - from <= 12;

    if (!walkable) {
      setShown(target);
      return undefined;
    }

    const timers = [];
    const steps = landed - from;
    setShown({ ...target, [seat]: from });

    // leg one: the dice
    for (let i = 1; i <= steps; i++) {
      timers.push(
        window.setTimeout(() => setShown({ ...target, [seat]: from + i }), i * STEP_MS)
      );
    }
    // leg two: the ladder or the snake, after a beat on the landing square
    if (to !== landed) {
      timers.push(
        window.setTimeout(() => setShown(target), steps * STEP_MS + JUMP_PAUSE_MS)
      );
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lastMove?.id]);

  return shown;
}

export default function SnakesBoard({ seats = [], currentSeat = null, label = "", mySeat = null, lastMove = null }) {
  const walked = useWalk(seats, lastMove);
  const cells = [];
  const numerals = [];
  for (let n = 1; n <= SIZE * SIZE; n++) {
    const { x, y } = cellCenter(n);
    const row = Math.floor((n - 1) / SIZE);
    const isFinish = n === 100;
    const isStart = n === 1;
    /* Tint by ROW, not by cell. The numbers run boustrophedon — left
       to right, then right to left — and a chequerboard fights that,
       while a banded row makes the turn at the end of each line
       obvious. A player following 19, 20, 21 needs to see that the
       count doubles back. */
    const band = row % 2 === 0;
    cells.push(
      <g key={n}>
        <rect
          x={x - CELL / 2}
          y={y - CELL / 2}
          width={CELL}
          height={CELL}
          fill={isFinish ? "#F6DFA8" : isStart ? "#DCEFD6" : band ? "#FBF4E8" : "#F3E7D2"}
          stroke="#E0CBA8"
          strokeWidth="0.28"
        />
      </g>
    );
    /* Numerals ride ABOVE the art, each on its own paper-coloured
       halo — a snake crossing a square must never cost you the
       number. Big and dark: this is the thing a player reads. */
    numerals.push(
      <text
        key={`n${n}`}
        x={x - CELL / 2 + 1.1}
        y={y - CELL / 2 + 4.2}
        fontSize="4.3"
        fontWeight="800"
        fontFamily="DM Sans, sans-serif"
        fill="#2A2118"
        stroke="#FFFBF2"
        strokeWidth="1.35"
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {n}
      </text>
    );
  }

  // tokens: seats sharing a cell fan out slightly so none hides another
  const byCell = {};
  for (const s of seats) (byCell[walked[s.seat_no] ?? s.score ?? 0] ||= []).push(s);

  return (
    <svg
      viewBox={`-1 -1 ${SIZE * CELL + 2} ${SIZE * CELL + CELL + 2}`}
      role="img"
      aria-label={label}
      style={{ width: "100%", height: "auto", display: "block", borderRadius: 14, background: C.cream }}
    >
      {/* The board sits on a timber frame rather than floating on the
          page — it reads as an object you could put on a table. */}
      <rect
        x={-0.9}
        y={-0.9}
        width={SIZE * CELL + 1.8}
        height={SIZE * CELL + 1.8}
        rx={1.6}
        fill="none"
        stroke="#B98A50"
        strokeWidth="1.8"
      />
      {cells}
      {ROUTES.filter((r) => r.kind === "ladder").map((r) => (
        <Ladder key={`l${r.from}`} from={r.from} to={r.to} />
      ))}
      {ROUTES.filter((r) => r.kind === "snake").map((r, i) => (
        <Snake key={`s${r.from}`} route={r} index={i} />
      ))}
      {/* 1 and 100 say what they are with a SHAPE, not only a tint —
          a flag where you begin and a crown where you finish. */}
      <text
        x={cellCenter(1).x + 1.9}
        y={cellCenter(1).y + 3.2}
        fontSize="4.6"
        textAnchor="middle"
        aria-hidden="true"
      >
        🚩
      </text>
      <text
        x={cellCenter(100).x + 1.9}
        y={cellCenter(100).y + 3.2}
        fontSize="4.6"
        textAnchor="middle"
        aria-hidden="true"
      >
        👑
      </text>
      {numerals}
      {/* the waiting row, below cell 1 */}
      <text
        x={CELL * 1.2}
        y={SIZE * CELL + CELL * 0.65}
        fontSize="2.6"
        fontFamily="DM Sans, sans-serif"
        fill={C.textMuted}
      >
        ▶
      </text>
      {Object.entries(byCell).flatMap(([cell, group]) =>
        group.map((s, i) => {
          const { x, y } = cellCenter(Number(cell));
          const spread = group.length > 1 ? (i - (group.length - 1) / 2) * 2.6 : 0;
          const turn = currentSeat != null && s.seat_no === currentSeat;
          const mine = mySeat != null && s.seat_no === mySeat;
          return (
            <g key={s.seat_no} transform={`translate(${x + spread} ${y})`}>
              {mine && <circle r={4.4} fill="none" stroke={C.brown} strokeWidth="0.5" strokeDasharray="1 1" />}
              {turn && <circle r={4.4} fill="none" stroke={C.green} strokeWidth="0.7" />}
              {/* Keyed by the square so each hop restarts the little
                  lift — a token that slides flat reads as a cursor,
                  one that rises reads as a piece being picked up. */}
              <g key={`hop-${cell}`} className="sb-hop">
                <Pawn seat={s.seat_no - 1} cx={0} cy={0} r={3.4} />
              </g>
            </g>
          );
        })
      )}
    </svg>
  );
}
