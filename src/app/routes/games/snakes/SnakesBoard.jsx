/* ════════════════════════════════════════════════
   Snakes & Ladders — the board art.

   One SVG, 100 warm cells, ladders in wood brown, snakes in green,
   one token per seat. Everything is drawn from board.js geometry and
   the seats' positions (game_seats.score); the rails own every rule.

   A snake LOOKS like what it costs you: its body thickens and its
   curve deepens with the drop, so the two long ones read as real
   hazards while the short ones stay gentle — a player can see the
   difference before landing on one. Numerals are large and dark on a
   warm ground; colour never carries meaning alone (each token shows
   its seat number, and the move line under the board says in words
   what the last roll did).
   ════════════════════════════════════════════════ */

import { COLORS as C } from "../../../../shared/tokens.js";
import { SIZE, CELL, LADDERS, SNAKES, cellCenter } from "./board.js";
import { SEAT_COLORS, SEAT_INK } from "../seatColors.js";

const TOKEN_FILLS = SEAT_COLORS;

function Ladder({ from, to }) {
  const a = cellCenter(from);
  const b = cellCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Longer climbs get slightly wider rails, like a bigger ladder.
  const half = 1.3 + Math.min(0.7, (to - from) / 60);
  const nx = (-dy / len) * half;
  const ny = (dx / len) * half;
  const rungs = Math.max(3, Math.round(len / 3.4));
  return (
    <g stroke="#a97f4e" strokeWidth="0.85" strokeLinecap="round">
      <line x1={a.x + nx} y1={a.y + ny} x2={b.x + nx} y2={b.y + ny} />
      <line x1={a.x - nx} y1={a.y - ny} x2={b.x - nx} y2={b.y - ny} />
      {Array.from({ length: rungs - 1 }, (_, i) => {
        const t = (i + 1) / rungs;
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        return <line key={i} x1={x + nx} y1={y + ny} x2={x - nx} y2={y - ny} strokeWidth="0.6" />;
      })}
    </g>
  );
}

function Snake({ from, to }) {
  const h = cellCenter(from); // head
  const t = cellCenter(to); // tail
  const drop = from - to;
  const long = drop > 15;
  // Body weight and waviness both grow with the drop: a 6-square
  // snake is a thin gentle curve, a 35-square one is thick and coils.
  const width = 1.5 + Math.min(2.4, drop / 14);
  const dx = t.x - h.x;
  const dy = t.y - h.y;
  const len = Math.hypot(dx, dy) || 1;
  const amp = long ? 7 : 2.6 + drop / 6;
  const ox = (-dy / len) * amp;
  const oy = (dx / len) * amp;
  // One gentle S for short snakes; a deeper double bend for long ones.
  const d = long
    ? `M ${h.x} ${h.y} C ${h.x + ox} ${h.y + oy}, ${h.x + dx * 0.45 - ox} ${h.y + dy * 0.45 - oy}, ${h.x + dx * 0.55} ${h.y + dy * 0.55} S ${t.x - ox * 0.6} ${t.y - oy * 0.6}, ${t.x} ${t.y}`
    : `M ${h.x} ${h.y} Q ${h.x + dx * 0.35 + ox} ${h.y + dy * 0.35 + oy}, ${h.x + dx * 0.6} ${h.y + dy * 0.6} T ${t.x} ${t.y}`;
  const headR = 1.6 + width * 0.35;
  return (
    <g>
      <path d={d} fill="none" stroke="#5c7a4a" strokeWidth={width} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={C.sage}
        strokeWidth={Math.max(0.4, width * 0.28)}
        strokeDasharray="1.2 1.8"
        strokeLinecap="round"
        opacity={0.9}
      />
      {/* tail tapers away */}
      <circle cx={t.x} cy={t.y} r={width * 0.3} fill="#5c7a4a" />
      {/* head, sized with the body */}
      <circle cx={h.x} cy={h.y} r={headR} fill="#4d6b3e" />
      <circle cx={h.x - headR * 0.35} cy={h.y - headR * 0.3} r={headR * 0.22} fill={C.cream} />
      <circle cx={h.x + headR * 0.35} cy={h.y - headR * 0.3} r={headR * 0.22} fill={C.cream} />
    </g>
  );
}

export default function SnakesBoard({ seats = [], currentSeat = null, label = "", mySeat = null }) {
  const cells = [];
  const numerals = [];
  for (let n = 1; n <= SIZE * SIZE; n++) {
    const { x, y } = cellCenter(n);
    const row = Math.floor((n - 1) / SIZE);
    const dark = (n + row) % 2 === 0;
    const isFinish = n === 100;
    cells.push(
      <g key={n}>
        <rect
          x={x - CELL / 2}
          y={y - CELL / 2}
          width={CELL}
          height={CELL}
          fill={isFinish ? "#e9d3a3" : dark ? "#f3e9db" : C.white}
          stroke={C.warmGray}
          strokeWidth="0.25"
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
        y={y - CELL / 2 + 4}
        fontSize="3.8"
        fontWeight="800"
        fontFamily="DM Sans, sans-serif"
        fill={isFinish ? C.brown : C.textMain}
        stroke={C.cream}
        strokeWidth="1.1"
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {n}
      </text>
    );
  }

  // tokens: seats sharing a cell fan out slightly so none hides another
  const byCell = {};
  for (const s of seats) (byCell[s.score || 0] ||= []).push(s);

  return (
    <svg
      viewBox={`-1 -1 ${SIZE * CELL + 2} ${SIZE * CELL + CELL + 2}`}
      role="img"
      aria-label={label}
      style={{ width: "100%", height: "auto", display: "block", borderRadius: 14, background: C.cream }}
    >
      {cells}
      {LADDERS.map(([f, t]) => (
        <Ladder key={`l${f}`} from={f} to={t} />
      ))}
      {SNAKES.map(([f, t]) => (
        <Snake key={`s${f}`} from={f} to={t} />
      ))}
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
            <g key={s.seat_no} transform={`translate(${x + spread} ${y + 1.2})`}>
              {mine && <circle r={4.1} fill="none" stroke={C.brown} strokeWidth="0.5" strokeDasharray="1 1" />}
              <circle
                r={turn ? 3.1 : 2.7}
                fill={TOKEN_FILLS[(s.seat_no - 1) % TOKEN_FILLS.length]}
                stroke={turn ? C.cream : C.white}
                strokeWidth={turn ? 0.9 : 0.5}
              />
              <text
                y="1.1"
                textAnchor="middle"
                fontSize="3"
                fontWeight="800"
                fontFamily="DM Sans, sans-serif"
                fill={SEAT_INK[(s.seat_no - 1) % SEAT_INK.length]}
              >
                {s.seat_no}
              </text>
            </g>
          );
        })
      )}
    </svg>
  );
}
