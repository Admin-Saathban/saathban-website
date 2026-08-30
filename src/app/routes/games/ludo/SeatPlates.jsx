/* ════════════════════════════════════════════════
   The four players, sitting at the four corners.

   Each plate goes OUTSIDE the board, at the corner of the yard that
   belongs to that seat — so once the board rotates to your point of
   view (your yard nearest you, bottom-left), your own plate follows it
   down to the bottom-left too. You always sit in the same place.

   Whose turn it is is said four ways now: a heavy ring, the word
   "turn" under the name, the plate's own raised weight, and a quiet
   "thinking…" while the table waits on them. Never the glow alone.

   A plate can also carry that player's OWN DIE, beside their face —
   your die next to your name, theirs next to theirs, so the table
   reads as four people rather than one shared tray. The active
   player's die is bright and carries an arrow cue; everyone else's is
   dimmed and inert. Tapping your own die rolls it; tapping anyone
   else's does nothing, which is the point. In two-dice mode both of
   that player's dice sit together at their corner.

   Placement is a MODE, not a decision baked in here: passing no dice
   renders the plates exactly as before, for the centre-tray layout.
   ════════════════════════════════════════════════ */

import { COLORS as C, A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { SEAT_COLORS, SEAT_INK } from "../seatColors.js";
import { DieFace } from "./Dice.jsx";

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

/* One die at a corner. Bright and arrow-cued when it is that
   player's turn, dim and inert otherwise. Only your own die is a
   button — tapping someone else's does nothing at all, so the board
   never invites a tap it will refuse. */
function SeatDie({ value, spent, active, mine, canRoll, colour, onRoll, label }) {
  const { t, ts } = useI18n();
  const live = active && mine && canRoll;
  const body = (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: 12,
        background: active ? "#fffdf7" : "#f3eee4",
        border: `2px solid ${active ? colour : C.warmGray}`,
        boxShadow: active ? `0 2px 8px ${colour}33` : "none",
        opacity: active ? 1 : 0.55,
      }}
    >
      {value ? (
        <DieFace value={value} size={34} ink={spent ? C.textMuted : C.brown} />
      ) : (
        <span aria-hidden="true" style={{ fontSize: ts(20) }}>🎲</span>
      )}
      {spent && (
        <span aria-hidden="true" style={{ position: "absolute", right: 1, bottom: 0, fontSize: ts(13), fontWeight: 800, color: C.green }}>
          ✓
        </span>
      )}
    </span>
  );

  if (!live) {
    return (
      <span aria-hidden={!value} title={value ? String(value) : undefined} style={{ display: "inline-flex" }}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onRoll}
      aria-label={label}
      className="sb-die-cue"
      style={{
        position: "relative",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        minHeight: A11Y.minTapTargetPx,
        minWidth: A11Y.minTapTargetPx,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {body}
      {/* the arrow cue: "this one, now" */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -14,
          fontSize: ts(15),
          color: colour,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        ▾
      </span>
    </button>
  );
}

function Plate({ seat, row, isTurn, isMe, align, dice, onRoll, canRoll }) {
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
          dir="auto"
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
        {/* Someone is deciding. Three dots that settle, not a spinner:
            a spinner says "the app is busy", this says "they are
            thinking", which is a different and truer thing. */}
        {isTurn && !isMe && (
          <span
            className="sb-think"
            style={{ display: "block", fontSize: ts(13), color: C.textMuted, letterSpacing: "0.06em" }}
          >
            {t("ludo.ceremony.thinking")}
          </span>
        )}
      </span>

      {/* This player's own die (or dice), beside their face. */}
      {dice && dice.length > 0 && (
        <span style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
          {dice.map((d, i) => (
            <SeatDie
              key={i}
              value={d.v}
              spent={d.spent}
              active={isTurn}
              mine={isMe}
              canRoll={canRoll}
              colour={colour}
              onRoll={onRoll}
              label={
                canRoll
                  ? t("ludo.turn.yours")
                  : t("ludo.dice.pick", { n: d.v })
              }
            />
          ))}
        </span>
      )}
      {/* Nothing rolled yet: the empty die is the roll button, and only
          for the person whose turn it is. */}
      {dice && dice.length === 0 && (
        <SeatDie
          value={null}
          active={isTurn}
          mine={isMe}
          canRoll={canRoll}
          colour={colour}
          onRoll={onRoll}
          label={t("ludo.turn.yours")}
        />
      )}
    </div>
  );
}

/* `where` is "top" or "bottom": the row of two plates above or below
   the board. On a phone the board is the full width, so the corners
   live in a row of their own rather than floating over it. */
export default function SeatPlates({
  where,
  seats,
  seatsInPlay,
  spin,
  currentSeat,
  myId,
  /* Dice at the corners — omit entirely for the centre-tray layout.
     diceFor(seat) → [{ v, spent }] | [] | null */
  diceFor,
  onRoll,
  canRoll,
}) {
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
              dice={diceFor ? diceFor(seat) : null}
              onRoll={onRoll}
              canRoll={!!canRoll && seat === currentSeat}
            />
          )}
        </div>
      ))}
    </div>
  );
}
