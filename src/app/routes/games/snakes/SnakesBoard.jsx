/* ════════════════════════════════════════════════
   The Snakes & Ladders board — table, frame, paper and everything
   living on it. Owner-specified in the live designers, and every
   colour below is one of the values given there.

   THE BOARD IS AN OBJECT ON A TABLE, not a diagram on a page. That is
   the whole design and it is why there are three surfaces here rather
   than one: a dark lacquered table with damask on it, a WOODEN FRAME
   with a lit face and a dark edge, and inside that a sheet of warm
   PARCHMENT. The shadow under the frame is what tells you the board
   is sitting on the table rather than printed on it.

   EVERYTHING IS CLIPPED TO THE PAPER. A coiling body that swings past
   the edge and over the frame stops reading as a board and starts
   reading as a bug — so the whole cast is drawn inside one clip path
   and nothing can bleed over the wood. Belt and braces: serpent.js
   also clamps its samples away from the edge, because a body pressed
   flat against a clip line looks cut off even when it is contained.

   DRAWING ORDER IS DELIBERATE. Paper, squares, grid, the two special
   tiles, then the NUMBERS, then ladders, then snakes, then tokens.
   Numbers go under the cast because a number is reference and a snake
   is the thing you are looking at; a 63 printed on top of the dragon
   would be neither.
   ════════════════════════════════════════════════ */

import { cellCenter, SIZE } from "./board.js";
import {
  spine, outline, ridge, headAngle, wavesFor, ladderGeometry,
} from "./serpent.js";
import { SNAKE_SETS } from "./skins.js";
import Pin from "./Pin.jsx";

/* ── The owner's palette, verbatim ──────────────────────────────── */
export const TABLE = {
  from: "#17203A",
  to: "#060A14",
  damask: "rgba(255,255,255,.045)",
};
export const WOOD = { body: "#9A6A33", edge: "#5E3C1B" };
export const PAPER = {
  base: "#F5E8CC",
  alt: "#EBD9B4",
  grid: "#C6AE82",
  ink: "#6B5E48",
};
/* The two tiles that are not squares but places. */
const START_TILE = "#D8E8C8";
const FINISH_TILE = "#F2E0A0";

/* The damask, as a data URI so the table needs no network and no
   second element. Two dots per tile on a 24px repeat — the owner's
   spacing — offset from each other so the field reads as a weave
   rather than as a grid of pinpricks. */
export const DAMASK_CSS =
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="6" cy="6" r="1.6" fill="rgba(255,255,255,.045)"/><circle cx="18" cy="18" r="1.6" fill="rgba(255,255,255,.045)"/></svg>`
  )}")`;

export const tableStyle = {
  background: `${DAMASK_CSS}, radial-gradient(120% 100% at 50% 18%, ${TABLE.from} 0%, ${TABLE.to} 100%)`,
  backgroundColor: TABLE.to,
};

/* ── A cell's rectangle, for the two special tiles ─────────────── */
function cellRect(n) {
  const c = cellCenter(n);
  return { x: c.x - 5, y: c.y - 5, w: 10, h: 10 };
}

/* ══ SNAKE ═══════════════════════════════════════════════════════
   One snake, drawn from its own sampled spine. The body, the ridge
   along its back, and a head with eyes on the front of it.

   The dragon is the same function with more of everything: a thicker
   belly, its own dark-red gradient whatever colour set the table is
   using, spikes down the spine, horns, slit eyes and a forked tongue.
   It is not a separate component because then there would be two
   places that know how a body is filled, and they would drift.
   ══════════════════════════════════════════════════════════════ */
function Snake({ from, to, boss, tone, phase, id }) {
  const a = cellCenter(from);
  const b = cellCenter(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const pts = spine(a, b, {
    waves: wavesFor(len),
    amp: boss ? 0.13 : 0.17,
    phase,
  });

  const profile = boss
    ? { neck: 6.4, belly: 7.6, tail: 1.1 }
    : { neck: 4.2, belly: 5.0, tail: 0.8 };

  const ang = headAngle(pts);
  const headR = boss ? 4.6 : 3.2;

  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {boss ? (
            <>
              <stop offset="0%" stopColor="#8E1414" />
              <stop offset="55%" stopColor="#4A0A10" />
              <stop offset="100%" stopColor="#140609" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor={tone.light} />
              <stop offset="60%" stopColor={tone.body} />
              <stop offset="100%" stopColor={tone.deep} />
            </>
          )}
        </linearGradient>
      </defs>

      {/* SPIKES FIRST, so the body covers their roots and only the
          points show — a spine of triangles laid on top of the fill
          reads as scales stuck on rather than as growing out. */}
      {boss && pts.filter((p) => p.t > 0.08 && p.t < 0.86).filter((_, i) => i % 7 === 0).map((p, i, arr) => {
        const j = pts.indexOf(p);
        const q = pts[Math.min(j + 1, pts.length - 1)];
        const o = pts[Math.max(j - 1, 0)];
        const dx = q.x - o.x, dy = q.y - o.y;
        const L = Math.hypot(dx, dy) || 1;
        /* Shrinking towards the tail, like the body they sit on. */
        const h = 3.4 * (1 - p.t * 0.7);
        const nx = (-dy / L), ny = (dx / L);
        const tipX = p.x + nx * h, tipY = p.y + ny * h;
        const bx = (dx / L) * 1.7, by = (dy / L) * 1.7;
        return (
          <path
            key={i}
            d={`M ${p.x - bx},${p.y - by} L ${tipX},${tipY} L ${p.x + bx},${p.y + by} Z`}
            fill="#2A0A0E"
          />
        );
      })}

      {/* THE BODY. A filled outline, not a stroke — SVG cannot taper
          a stroke, and a snake that is the same width at the tail as
          behind the head is a hose. */}
      <path d={outline(pts, profile)} fill={`url(#${id})`} />

      {/* THE RIDGE. Drawn from the same samples, pulled in, so the
          highlight can never sit off the back it belongs to. Fades
          out before the tail because that is where a real highlight
          runs out of body to catch light on. */}
      <path
        d={ridge(pts)}
        fill="none"
        stroke={boss ? "rgba(255,150,120,.28)" : "rgba(255,255,255,.34)"}
        strokeWidth={boss ? 1.5 : 1.0}
        strokeLinecap="round"
      />

      {/* THE HEAD, turned to face the way the body leaves it. */}
      <g transform={`translate(${a.x} ${a.y}) rotate(${ang})`}>
        {boss && (
          <>
            {/* Horns, swept back off the skull. */}
            <path d="M -1.2,-3.2 L -4.6,-6.2 L -1.0,-4.6 Z" fill="#E8C87A" />
            <path d="M -1.2,3.2 L -4.6,6.2 L -1.0,4.6 Z" fill="#E8C87A" />
            {/* The forked tongue, out in front. */}
            <path
              d="M 5.4,0 L 9.4,0 M 9.4,0 L 11.2,-1.5 M 9.4,0 L 11.2,1.5"
              stroke="#D81B36" strokeWidth="0.85" fill="none" strokeLinecap="round"
            />
          </>
        )}
        <ellipse
          rx={headR * 1.15} ry={headR}
          fill={boss ? "#5E0C12" : tone.body}
          stroke={boss ? "#1A0508" : tone.deep}
          strokeWidth={boss ? 0.6 : 0.4}
        />
        {/* EYES. Cartoon on the snakes — a white ball with a black
            pupil, because a snake a child can read is the brief.
            The dragon gets yellow slits instead, which is the one
            place this board is allowed to be a little frightening. */}
        {boss ? (
          <>
            <ellipse cx={1.5} cy={-1.9} rx={1.5} ry={1.1} fill="#F5D020" transform="rotate(-18 1.5 -1.9)" />
            <ellipse cx={1.5} cy={1.9} rx={1.5} ry={1.1} fill="#F5D020" transform="rotate(18 1.5 1.9)" />
            <path d={`M 1.5,-2.9 L 1.5,-0.9`} stroke="#180406" strokeWidth="0.62" strokeLinecap="round" />
            <path d={`M 1.5,0.9 L 1.5,2.9`} stroke="#180406" strokeWidth="0.62" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx={1.0} cy={-1.45} r={1.15} fill="#FFFFFF" />
            <circle cx={1.0} cy={1.45} r={1.15} fill="#FFFFFF" />
            <circle cx={1.45} cy={-1.45} r={0.58} fill="#14100A" />
            <circle cx={1.45} cy={1.45} r={0.58} fill="#14100A" />
          </>
        )}
      </g>
    </g>
  );
}

/* ══ LADDER ══════════════════════════════════════════════════════
   Two rails and the rungs between them, in wood. Rails are drawn
   with a dark stroke under a lighter one so each rail has an edge —
   the same trick the frame uses, at a smaller size.
   ══════════════════════════════════════════════════════════════ */
function Ladder({ from, to }) {
  const g = ladderGeometry(cellCenter(from), cellCenter(to));
  return (
    <g>
      {g.rungs.map((r, i) => (
        <g key={i}>
          <line x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={WOOD.edge} strokeWidth="1.5" strokeLinecap="round" />
          <line x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="#C08B4A" strokeWidth="0.85" strokeLinecap="round" />
        </g>
      ))}
      {g.rails.map((r, i) => (
        <g key={i}>
          <line x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={WOOD.edge} strokeWidth="2.1" strokeLinecap="round" />
          <line x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={WOOD.body} strokeWidth="1.25" strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}

/* ══ THE BOARD ═══════════════════════════════════════════════════ */
export default function SnakesBoard({
  board,
  /* [{ key, cell, colorIdx, name }] — where every token stands. A
     token being animated passes an explicit {x, y} instead of a cell,
     which is how the slide down a snake and the climb up a ladder
     put it between squares. */
  tokens = [],
  colorSet = "classic",
  /* The square under a token that is mid-move, lit so the eye can
     follow it. */
  highlight = null,
  size = 340,
}) {
  const tone = SNAKE_SETS[colorSet] || SNAKE_SETS.classic;
  const clipId = "sb-snakes-paper";

  return (
    <div
      style={{
        width: size,
        maxWidth: "100%",
        /* THE FRAME. Padding is the wood; the gradient across it is
           the light falling on a bevel, top face lit and bottom face
           in shadow. The dark 1px outer edge is what stops it looking
           like a coloured margin. */
        padding: Math.max(9, size * 0.033),
        borderRadius: 16,
        background: `linear-gradient(160deg, #B98244 0%, ${WOOD.body} 42%, #7E5327 100%)`,
        border: `1.5px solid ${WOOD.edge}`,
        /* The board sits ON the table. */
        boxShadow: "0 18px 38px rgba(0,0,0,.55), 0 4px 10px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.22)",
        boxSizing: "border-box",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          borderRadius: 6,
          border: `1px solid ${WOOD.edge}`,
          background: PAPER.base,
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width="100" height="100" rx="1.5" />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {/* ── the paper ── */}
          <rect x="0" y="0" width="100" height="100" fill={PAPER.base} />

          {/* ── alternating squares, checkerboard over the serpentine
                 numbering rather than over the grid, so the pattern
                 runs with the path a player's eye takes ── */}
          {Array.from({ length: 100 }, (_, i) => {
            const n = i + 1;
            const r = cellRect(n);
            const row = Math.floor((n - 1) / SIZE);
            const col = (n - 1) % SIZE;
            if ((row + col) % 2 === 0) return null;
            return <rect key={n} x={r.x} y={r.y} width={r.w} height={r.h} fill={PAPER.alt} />;
          })}

          {/* ── the two places ── */}
          {(() => {
            const s = cellRect(1);
            const f = cellRect(100);
            return (
              <>
                <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={START_TILE} />
                <rect x={f.x} y={f.y} width={f.w} height={f.h} fill={FINISH_TILE} />
              </>
            );
          })()}

          {/* ── the grid ── */}
          {Array.from({ length: SIZE + 1 }, (_, i) => (
            <g key={i}>
              <line x1={i * 10} y1="0" x2={i * 10} y2="100" stroke={PAPER.grid} strokeWidth="0.35" />
              <line x1="0" y1={i * 10} x2="100" y2={i * 10} stroke={PAPER.grid} strokeWidth="0.35" />
            </g>
          ))}

          {/* ── the numbers, 1–100, bold and centred ── */}
          {Array.from({ length: 100 }, (_, i) => {
            const n = i + 1;
            const c = cellCenter(n);
            if (n === 1 || n === 100) return null;   // those two carry a mark instead
            return (
              <text
                key={n}
                x={c.x}
                y={c.y}
                fill={PAPER.ink}
                fontSize="3.5"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontFamily: "inherit" }}
              >
                {n}
              </text>
            );
          })}

          {/* ── square 1: the red flag ── */}
          {(() => {
            const c = cellCenter(1);
            return (
              <g transform={`translate(${c.x - 2.4} ${c.y - 3.6})`}>
                <line x1="0" y1="0" x2="0" y2="7.4" stroke="#5E4A2C" strokeWidth="0.7" strokeLinecap="round" />
                <path d="M 0.35,0.3 L 4.9,1.9 L 0.35,3.5 Z" fill="#C8202C" />
              </g>
            );
          })()}

          {/* ── square 100: the gold crown ── */}
          {(() => {
            const c = cellCenter(100);
            return (
              <g transform={`translate(${c.x} ${c.y})`}>
                <path
                  d="M -3.6,1.7 L -3.6,-1.6 L -1.8,0.1 L 0,-2.3 L 1.8,0.1 L 3.6,-1.6 L 3.6,1.7 Z"
                  fill="#E0A81E" stroke="#8A5F08" strokeWidth="0.32" strokeLinejoin="round"
                />
                <rect x="-3.6" y="2.1" width="7.2" height="1.15" rx="0.4" fill="#E0A81E" stroke="#8A5F08" strokeWidth="0.28" />
              </g>
            );
          })()}

          {/* ── the square a moving token is on ── */}
          {highlight != null && highlight >= 1 && highlight <= 100 && (() => {
            const r = cellRect(highlight);
            return (
              <rect
                x={r.x + 0.4} y={r.y + 0.4} width={r.w - 0.8} height={r.h - 0.8}
                fill="none" stroke="#E0A81E" strokeWidth="0.8" rx="1"
              />
            );
          })()}

          {/* ── ladders, then snakes over them ── */}
          {board.ladders.map((l) => <Ladder key={`l${l.from}`} from={l.from} to={l.to} />)}
          {board.snakes.map((s, i) => (
            <Snake
              key={`s${s.from}`}
              from={s.from}
              to={s.to}
              boss={s.boss}
              /* Alternating through the chosen set, so two snakes
                 that meet are never the same colour. */
              tone={tone.snakes[i % tone.snakes.length]}
              phase={i % 2 === 0 ? 1 : -1}
              id={`sb-snk-${s.from}`}
            />
          ))}

          {/* ── the players ── */}
          {tokens.map((tk) => {
            const p = tk.at || cellCenter(tk.cell);
            return (
              <Pin
                key={tk.key}
                cx={p.x}
                cy={p.y}
                r={3.6}
                colorIdx={tk.colorIdx}
                label={tk.name}
                lifted={!!tk.at}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
