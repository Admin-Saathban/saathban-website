/* ════════════════════════════════════════════════
   Snakes & Ladders — the board art.

   One SVG, 100 warm cells, ladders in brown, snakes in green, one
   token per seat. Everything is drawn from board.js geometry and the
   seats' positions (game_seats.score); the rails own every rule.
   Colour never carries meaning alone: each token shows its seat
   number, and the move line under the board says in words what the
   last roll did.
   ════════════════════════════════════════════════ */

import { COLORS as C } from "../../../../shared/tokens.js";
import { SIZE, CELL, LADDERS, SNAKES, cellCenter } from "./board.js";

const TOKEN_FILLS = [C.green, C.brown, C.olive, C.sage];

function Ladder({ from, to }) {
  const a = cellCenter(from);
  const b = cellCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // unit normal for the two rails
  const nx = (-dy / len) * 1.4;
  const ny = (dx / len) * 1.4;
  const rungs = Math.max(2, Math.round(len / 4));
  return (
    <g stroke={C.brownLight} strokeWidth="0.9" strokeLinecap="round" opacity="0.95">
      <line x1={a.x + nx} y1={a.y + ny} x2={b.x + nx} y2={b.y + ny} />
      <line x1={a.x - nx} y1={a.y - ny} x2={b.x - nx} y2={b.y - ny} />
      {Array.from({ length: rungs - 1 }, (_, i) => {
        const t = (i + 1) / rungs;
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        return <line key={i} x1={x + nx} y1={y + ny} x2={x - nx} y2={y - ny} />;
      })}
    </g>
  );
}

function Snake({ from, to }) {
  const h = cellCenter(from); // head
  const t = cellCenter(to); // tail
  const mx = (h.x + t.x) / 2;
  const my = (h.y + t.y) / 2;
  // a gentle S: two control points offset to either side of the midline
  const dx = t.x - h.x;
  const dy = t.y - h.y;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * 5;
  const oy = (dx / len) * 5;
  const d = `M ${h.x} ${h.y} Q ${h.x + ox * 0.8 + dx * 0.15} ${h.y + oy * 0.8 + dy * 0.15}, ${mx} ${my} T ${t.x} ${t.y}`;
  return (
    <g>
      <path d={d} fill="none" stroke={C.greenMuted} strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      <path d={d} fill="none" stroke={C.sage} strokeWidth="0.7" strokeDasharray="1.4 1.6" strokeLinecap="round" />
      <circle cx={h.x} cy={h.y} r="1.9" fill={C.greenMuted} />
      <circle cx={h.x - 0.6} cy={h.y - 0.5} r="0.4" fill={C.cream} />
      <circle cx={h.x + 0.6} cy={h.y - 0.5} r="0.4" fill={C.cream} />
    </g>
  );
}

export default function SnakesBoard({ seats = [], currentSeat = null, label = "" }) {
  const cells = [];
  for (let n = 1; n <= SIZE * SIZE; n++) {
    const { x, y } = cellCenter(n);
    const row = Math.floor((n - 1) / SIZE);
    const dark = (n + row) % 2 === 0;
    cells.push(
      <g key={n}>
        <rect
          x={x - CELL / 2}
          y={y - CELL / 2}
          width={CELL}
          height={CELL}
          fill={n === 100 ? "#f1e2c6" : dark ? "#f3e9db" : C.white}
          stroke={C.warmGray}
          strokeWidth="0.25"
        />
        <text
          x={x - CELL / 2 + 0.9}
          y={y - CELL / 2 + 2.6}
          fontSize="2.2"
          fontFamily="DM Sans, sans-serif"
          fill={C.textMuted}
        >
          {n}
        </text>
      </g>
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
          return (
            <g key={s.seat_no} transform={`translate(${x + spread} ${y + 1.2})`}>
              <circle r={turn ? 3.1 : 2.7} fill={TOKEN_FILLS[(s.seat_no - 1) % TOKEN_FILLS.length]} stroke={turn ? C.cream : C.white} strokeWidth={turn ? 0.9 : 0.5} />
              <text
                y="1.1"
                textAnchor="middle"
                fontSize="3"
                fontWeight="800"
                fontFamily="DM Sans, sans-serif"
                fill={C.cream}
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
