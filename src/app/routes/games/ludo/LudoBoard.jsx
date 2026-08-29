/* ════════════════════════════════════════════════
   The board — warm SVG in the Saathban palette, phone-width first.
   Pieces carry their seat number (state never by colour alone); when
   it's your move, legal pieces get a dashed halo AND the big piece
   buttons under the board (LudoSession) mirror them, so the true
   ≥48px tap targets never depend on board pixel size.
   ════════════════════════════════════════════════ */

import { COLORS as C } from "../../../../shared/tokens.js";
import {
  TRACK,
  HOME_COLUMNS,
  YARD_ORIGIN,
  START_ABS,
  STAR_ABS,
  SEAT_COLORS,
  cellFor,
} from "./board.js";

const CELL = 40; // viewBox units per grid cell
const SIZE = 15 * CELL;

const YARD_TINTS = ["#e8f0e6", "#f3e9df", "#eef0e2", "#eaf2e7"];

export default function LudoBoard({ state, seatsInPlay, legal, myTurnToMove, onPieceTap }) {
  const rules = state?.rules || {};
  const showStars = (rules.safe_squares || "standard") === "standard";
  const pieces = state?.pieces || [];

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
      }}
    >
      {/* Yards */}
      {YARD_ORIGIN.map(([c, r], seat) => (
        <g key={`yard-${seat}`} opacity={seat < seatsInPlay ? 1 : 0.25}>
          <rect
            x={c * CELL + 4}
            y={r * CELL + 4}
            width={6 * CELL - 8}
            height={6 * CELL - 8}
            rx={16}
            fill={YARD_TINTS[seat]}
            stroke={SEAT_COLORS[seat]}
            strokeWidth={3}
          />
          <rect
            x={(c + 1) * CELL}
            y={(r + 1) * CELL}
            width={4 * CELL}
            height={4 * CELL}
            rx={12}
            fill={C.white}
            stroke={C.warmGray}
          />
        </g>
      ))}

      {/* Track cells */}
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
              fill={startSeat >= 0 ? YARD_TINTS[startSeat] : C.white}
              stroke={startSeat >= 0 ? SEAT_COLORS[startSeat] : C.warmGray}
              strokeWidth={startSeat >= 0 ? 2.5 : 1}
            />
            {isStar && showStars && (
              <text
                x={c * CELL + CELL / 2}
                y={r * CELL + CELL / 2 + 7}
                textAnchor="middle"
                fontSize={20}
                fill={C.warmGray}
                aria-hidden="true"
              >
                ✦
              </text>
            )}
            {startSeat >= 0 && (
              <text
                x={c * CELL + CELL / 2}
                y={r * CELL + CELL / 2 + 6}
                textAnchor="middle"
                fontSize={16}
                fontWeight="700"
                fill={SEAT_COLORS[startSeat]}
                aria-hidden="true"
              >
                ▸
              </text>
            )}
          </g>
        );
      })}

      {/* Home columns */}
      {HOME_COLUMNS.map((cells, seat) =>
        cells.map(([c, r], i) => (
          <rect
            key={`h-${seat}-${i}`}
            x={c * CELL + 1}
            y={r * CELL + 1}
            width={CELL - 2}
            height={CELL - 2}
            rx={6}
            fill={YARD_TINTS[seat]}
            stroke={SEAT_COLORS[seat]}
            strokeWidth={1.5}
            opacity={seat < seatsInPlay ? 1 : 0.2}
          />
        ))
      )}

      {/* Centre home */}
      <rect
        x={6 * CELL + 2}
        y={6 * CELL + 2}
        width={3 * CELL - 4}
        height={3 * CELL - 4}
        rx={14}
        fill={C.white}
        stroke={C.greenMuted}
        strokeWidth={2.5}
      />
      <text
        x={7.5 * CELL}
        y={7.5 * CELL + 8}
        textAnchor="middle"
        fontSize={26}
        aria-hidden="true"
      >
        🏡
      </text>

      {/* Pieces */}
      {pieces.map((seatPieces, seat) =>
        seatPieces.map((p, i) => {
          const [cc, rr] = cellFor(seat, p, i);
          const isLegal = myTurnToMove && legal.includes(i) && seat === state.turnSeat;
          // Stack offset: nudge same-cell pieces apart slightly
          const stackShift =
            seatPieces.filter((q, j) => j < i && q === p && p >= 1 && p <= 56).length * 6;
          return (
            <g
              key={`p-${seat}-${i}`}
              onClick={isLegal ? () => onPieceTap(i) : undefined}
              style={{ cursor: isLegal ? "pointer" : "default" }}
            >
              {isLegal && (
                <circle
                  cx={cc * CELL + stackShift}
                  cy={rr * CELL - stackShift}
                  r={22}
                  fill="none"
                  stroke={C.brown}
                  strokeWidth={3}
                  strokeDasharray="6 5"
                />
              )}
              <circle
                cx={cc * CELL + stackShift}
                cy={rr * CELL - stackShift}
                r={15}
                fill={SEAT_COLORS[seat]}
                stroke={C.white}
                strokeWidth={2.5}
              />
              <text
                x={cc * CELL + stackShift}
                y={rr * CELL - stackShift + 6}
                textAnchor="middle"
                fontSize={16}
                fontWeight="700"
                fill={C.cream}
                aria-hidden="true"
              >
                {seat + 1}
              </text>
              {isLegal && (
                <circle
                  cx={cc * CELL + stackShift}
                  cy={rr * CELL - stackShift}
                  r={26}
                  fill="transparent"
                />
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}
