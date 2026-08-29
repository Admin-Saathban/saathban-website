/* ════════════════════════════════════════════════
   The four players, sitting at the four corners.

   Each plate goes OUTSIDE the board, at the corner of the yard that
   belongs to that seat — so once the board rotates to your point of
   view (your yard nearest you, bottom-left), your own plate follows it
   down to the bottom-left too. You always sit in the same place.

   Whose turn it is is said three ways: a heavy ring, the word "turn"
   under the name, and the plate's own raised weight. Never the glow
   alone.
   ════════════════════════════════════════════════ */

import { COLORS as C } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { SEAT_COLORS, SEAT_INK } from "../seatColors.js";

/* The board's corners, clockwise from top-left. Seat 0's yard is at
   top-left, seat 1's at bottom-left, seat 2's bottom-right, seat 3's
   top-right — so this is where each seat sits before any rotation. */
const CORNER_OF_SEAT = [0, 3, 2, 1];

/* After the board turns by `spin` degrees, a corner moves round by
   spin/90 places. */
export function screenCorner(seat, spin) {
  return (CORNER_OF_SEAT[seat] + Math.round(spin / 90) + 8) % 4;
}

function initialOf(name) {
  const s = (name || "").trim();
  if (!s) return "•";
  return [...s][0].toUpperCase();
}

function Plate({ seat, row, isTurn, isMe, align }) {
  const { t, ts } = useI18n();
  const name = row?.is_bot ? t("ludo.seat.bot") : row?.name || t("ludo.seat.someone");
  const colour = SEAT_COLORS[seat];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: align === "end" ? "row-reverse" : "row",
        alignItems: "center",
        gap: 9,
        minWidth: 0,
        padding: "6px 10px",
        borderRadius: 14,
        background: isTurn ? "#fffdf5" : "transparent",
        border: isTurn ? `2px solid ${colour}` : "2px solid transparent",
        boxShadow: isTurn ? `0 0 0 4px ${colour}22` : "none",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: colour,
          color: SEAT_INK[seat],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: ts(19),
          border: `2px solid ${C.white}`,
        }}
      >
        {initialOf(row?.is_bot ? t("ludo.seat.bot") : row?.name)}
      </span>
      <span style={{ minWidth: 0, textAlign: align === "end" ? "end" : "start" }}>
        <span
          style={{
            display: "block",
            fontSize: ts(16),
            fontWeight: 700,
            color: C.textMain,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
          {isMe ? ` (${t("ludo.seat.you")})` : ""}
        </span>
        <span style={{ display: "block", fontSize: ts(14), color: isTurn ? colour : C.textMuted, fontWeight: isTurn ? 700 : 400 }}>
          {isTurn
            ? isMe
              ? t("ludo.seat.yourTurn")
              : t("ludo.seat.turn")
            : t("ludo.seat.seatN", { n: seat + 1 })}
        </span>
      </span>
    </div>
  );
}

/* `where` is "top" or "bottom": the row of two plates above or below
   the board. On a phone the board is the full width, so the corners
   live in a row of their own rather than floating over it. */
export default function SeatPlates({ where, seats, seatsInPlay, spin, currentSeat, myId }) {
  const wanted = where === "top" ? [0, 1] : [3, 2]; // TL,TR above · BL,BR below
  const plates = wanted.map((corner) => {
    for (let seat = 0; seat < seatsInPlay; seat++) {
      if (screenCorner(seat, spin) === corner) return seat;
    }
    return null;
  });
  if (plates.every((p) => p === null)) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        maxWidth: 560,
        margin: where === "top" ? "0 auto 8px" : "8px auto 0",
      }}
    >
      {plates.map((seat, i) => (
        <div key={i} style={{ flex: "1 1 0", minWidth: 0, display: "flex", justifyContent: i === 0 ? "flex-start" : "flex-end" }}>
          {seat != null && (
            <Plate
              seat={seat}
              row={seats.find((s) => s.seat === seat)}
              isTurn={seat === currentSeat}
              isMe={seats.find((s) => s.seat === seat)?.profile_id === myId}
              align={i === 0 ? "start" : "end"}
            />
          )}
        </div>
      ))}
    </div>
  );
}
