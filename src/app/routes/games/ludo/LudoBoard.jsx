/* ════════════════════════════════════════════════
   The board — warm SVG in the Saathban palette, phone-width first,
   drawn to the classic 15×15 layout in board.js.

   POINT OF VIEW: every seated player looks at the board the way they
   would sit at it — their own yard nearest them, bottom-left — so the
   whole board rotates by a quarter turn per seat (povRotation). The
   rotation is presentation only: geometry, moves and the engine never
   change, and every numeral counter-rotates so nothing reads upside
   down. A watcher with no seat gets the neutral orientation.

   Pieces carry their seat number (state never by colour alone); when
   it's your move, legal pieces get a dashed halo AND the big piece
   buttons under the board (LudoSession) mirror them, so the true
   ≥48px tap targets never depend on board pixel size.
   ════════════════════════════════════════════════ */

import { COLORS as C } from "../../../../shared/tokens.js";
import Pawn from "../Pawn.jsx";
import {
  TRACK,
  HOME_COLUMNS,
  YARD_ORIGIN,
  YARD_SPOTS,
  START_ABS,
  STAR_ABS,
  SEAT_COLORS,
  SEAT_INK,
  SEAT_TINTS,
  cellFor,
  povRotation,
} from "./board.js";

const CELL = 40; // viewBox units per grid cell
const SIZE = 15 * CELL;


/* A label that stays upright however the board is turned. */
function Upright({ x, y, spin, children, ...props }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      transform={spin ? `rotate(${-spin} ${x} ${y})` : undefined}
      {...props}
    >
      {children}
    </text>
  );
}

export default function LudoBoard({
  state,
  seatsInPlay,
  legal,
  myTurnToMove,
  onPieceTap,
  mySeat = null,
}) {
  const rules = state?.rules || {};
  const showStars = (rules.safe_squares || "standard") === "standard";
  const pieces = state?.pieces || [];
  const spin = povRotation(mySeat);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="Ludo board"
      style={{
        width: "100%",
        maxWidth: 560,
        height: "auto",
        display: "block",
        margin: "0 auto",
        background: C.cream,
        borderRadius: 18,
        border: `2px solid ${C.warmGray}`,
        transform: spin ? `rotate(${spin}deg)` : undefined,
      }}
    >
      {/* ── Yards: a 6×6 block with a 2×2 court of four spots ── */}
      {YARD_ORIGIN.map(([c, r], seat) => (
        <g key={`yard-${seat}`} opacity={seat < seatsInPlay ? 1 : 0.25}>
          <rect
            x={c * CELL + 4}
            y={r * CELL + 4}
            width={6 * CELL - 8}
            height={6 * CELL - 8}
            rx={16}
            fill={SEAT_COLORS[seat]}
            opacity={0.9}
          />
          <rect
            x={(c + 1) * CELL}
            y={(r + 1) * CELL}
            width={4 * CELL}
            height={4 * CELL}
            rx={12}
            fill={C.white}
            stroke={SEAT_COLORS[seat]}
            strokeWidth={2}
          />
          {YARD_SPOTS.map(([sc, sr], i) => (
            <circle
              key={i}
              cx={(c + sc) * CELL}
              cy={(r + sr) * CELL}
              r={CELL * 0.38}
              fill={SEAT_TINTS[seat]}
              stroke={SEAT_COLORS[seat]}
              strokeWidth={1.5}
            />
          ))}
        </g>
      ))}

      {/* ── The 52-square track ── */}
      {TRACK.map(([c, r], abs) => {
        const startSeat = START_ABS.indexOf(abs);
        const isStar = STAR_ABS.includes(abs);
        return (
          <g key={`t-${abs}`}>
            <rect
              x={c * CELL + 1}
              y={r * CELL + 1}
              width={CELL - 2}
              height={CELL - 2}
              rx={6}
              fill={startSeat >= 0 ? SEAT_TINTS[startSeat] : C.white}
              stroke={startSeat >= 0 ? SEAT_COLORS[startSeat] : C.warmGray}
              strokeWidth={startSeat >= 0 ? 2.5 : 1}
              opacity={startSeat >= 0 && startSeat >= seatsInPlay ? 0.3 : 1}
            />
            {isStar && showStars && (
              <Upright
                x={c * CELL + CELL / 2}
                y={r * CELL + CELL / 2 + 7}
                spin={spin}
                fontSize={23}
                fill={C.olive}
                aria-hidden="true"
              >
                ★
              </Upright>
            )}
            {startSeat >= 0 && (
              <Upright
                x={c * CELL + CELL / 2}
                y={r * CELL + CELL / 2 + 7}
                spin={spin}
                fontSize={19}
                fontWeight="700"
                fill={SEAT_COLORS[startSeat]}
                aria-hidden="true"
              >
                ★
              </Upright>
            )}
          </g>
        );
      })}

      {/* ── Home columns: each arm's middle line, in the seat's colour ── */}
      {HOME_COLUMNS.map((cells, seat) =>
        cells.map(([c, r], i) => (
          <rect
            key={`h-${seat}-${i}`}
            x={c * CELL + 1}
            y={r * CELL + 1}
            width={CELL - 2}
            height={CELL - 2}
            rx={6}
            fill={SEAT_COLORS[seat]}
            opacity={seat < seatsInPlay ? 0.75 : 0.15}
          />
        ))
      )}

      {/* ── The centre: four triangles, one per arm, meeting at home ── */}
      <g>
        {[
          [`${6 * CELL},${6 * CELL} ${9 * CELL},${6 * CELL} ${7.5 * CELL},${7.5 * CELL}`, 0],
          [`${6 * CELL},${6 * CELL} ${6 * CELL},${9 * CELL} ${7.5 * CELL},${7.5 * CELL}`, 1],
          [`${6 * CELL},${9 * CELL} ${9 * CELL},${9 * CELL} ${7.5 * CELL},${7.5 * CELL}`, 2],
          [`${9 * CELL},${6 * CELL} ${9 * CELL},${9 * CELL} ${7.5 * CELL},${7.5 * CELL}`, 3],
        ].map(([points, seat]) => (
          <polygon
            key={`c-${seat}`}
            points={points}
            fill={SEAT_COLORS[seat]}
            opacity={seat < seatsInPlay ? 0.9 : 0.15}
            stroke={C.white}
            strokeWidth={2}
          />
        ))}
        <rect
          x={6 * CELL + 2}
          y={6 * CELL + 2}
          width={3 * CELL - 4}
          height={3 * CELL - 4}
          rx={14}
          fill="none"
          stroke={C.brown}
          strokeWidth={2.5}
        />
      </g>

      {/* ── Pieces ── */}
      {pieces.map((seatPieces, seat) =>
        seatPieces.map((p, i) => {
          const [cc, rr] = cellFor(seat, p, i);
          const isLegal = myTurnToMove && legal.includes(i) && seat === state.turnSeat;
          // Stack offset: nudge same-cell pieces apart slightly
          const stackShift =
            seatPieces.filter((q, j) => j < i && q === p && p >= 1 && p <= 56).length * 6;
          const cx = cc * CELL + stackShift;
          const cy = rr * CELL - stackShift;
          return (
            <g
              key={`p-${seat}-${i}`}
              onClick={isLegal ? () => onPieceTap(i) : undefined}
              style={{ cursor: isLegal ? "pointer" : "default" }}
            >
              {isLegal && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={22}
                  fill="none"
                  stroke={C.brown}
                  strokeWidth={3}
                  strokeDasharray="6 5"
                />
              )}
              <Pawn seat={seat} cx={cx} cy={cy} r={15} spin={spin} />
              {isLegal && <circle cx={cx} cy={cy} r={26} fill="transparent" />}
            </g>
          );
        })
      )}
    </svg>
  );
}
