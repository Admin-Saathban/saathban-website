/* ════════════════════════════════════════════════
   The players, sitting at the table — LUDO_UI_SPEC.md §1–§3.

   Each plate goes OUTSIDE the board, at the corner of the yard that
   belongs to that seat — so once the board rotates to your point of
   view (your yard nearest you, bottom-left), your own plate follows it
   down to the bottom-left too. You always sit in the same place.

   THE COUNTDOWN LIVES ON THE PERSON. A ring sweeps round the active
   player's avatar as their turn runs out, and there is no separate
   timer bar anywhere on the page (§2). Three reasons, all from the
   spec: you always know whose turn it is because the clock is drawn on
   them, it costs no vertical space on a phone, and it reads at a
   glance for somebody who cannot parse a number quickly.

   The ring is driven by a prop that changes once a second, NOT by a
   CSS animation. That is why §10's "reduced-motion: rings still show
   progress" costs nothing here — there is no animation to suppress,
   so a person who asked for less motion still gets the whole clock.

   Whose turn it is is said five ways: the ring, a heavy border, the
   plate's raised weight, the word under the name, and a quiet
   "thinking…" while the table waits. Never the glow alone (§10).

   A plate carries that player's OWN DIE, beside their face — the
   spec settles this: dice sit next to their owner, never in the
   board's middle (§3). The active player's die is bright and carries
   a BOUNCING ARROW so a first-time player is never left wondering
   what to do next (§4); everyone else's is dimmed and inert. Only
   your own die is a button, so the table never invites a tap it will
   refuse.
   ════════════════════════════════════════════════ */

import { COLORS as C, A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { SEAT_COLORS, SEAT_INK } from "../seatColors.js";
/* The seat→corner geometry lives in a plain module so a test can
     import it without a browser — see seatCorners.js for why it needs
     one. screenCorner is re-exported here because callers have always
     imported it from this file. */
export { screenCorner } from "./seatCorners.js";
import { screenCorner as cornerFor } from "./seatCorners.js";
import Die, { DieFace } from "./Dice.jsx";

function initialOf(name) {
  const s = (name || "").trim();
  if (!s) return "•";
  return [...s][0].toUpperCase();
}

/* ── The avatar, wrapped in its turn ring ──────────────────────────
   `remaining` is 0..1 — the share of the turn still left. The ring
   EMPTIES clockwise as the turn runs down, so a full ring means a
   whole turn in hand and a bare one means seconds.

   The ring only exists while it is that player's turn: a ring drawn
   on everyone would be four clocks, three of them lying. */
function Avatar({ name, colour, ink, isTurn, remaining, seconds, label, compact }) {
  const { t, ts } = useI18n();
  const size = compact ? (isTurn ? 48 : 38) : isTurn ? 60 : 44;
  const r = size / 2 - 3;
  const circumference = 2 * Math.PI * r;
  const left = Math.max(0, Math.min(1, remaining ?? 1));
  /* Under about a fifth of the turn the ring changes COLOUR and the
     seconds are said out loud in the label — never colour alone. */
  const urgent = isTurn && left <= 0.2;

  return (
    <span
      style={{
        position: "relative",
        flexShrink: 0,
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {isTurn && remaining != null && (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="timer"
          aria-label={label}
          style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#DCD2C2"
            strokeWidth={5}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={urgent ? C.brown : C.green}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - left)}
          />
        </svg>
      )}
      <span
        aria-hidden="true"
        style={{
          width: size - 20,
          height: size - 20,
          borderRadius: "50%",
          background: colour,
          color: ink,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: ts(isTurn ? 21 : 18),
          border: `2px solid ${C.white}`,
          /* The active player is brighter and larger; everyone else
             recedes (§2). Dimming is never the ONLY signal. */
          opacity: isTurn ? 1 : 0.72,
        }}
      >
        {initialOf(name)}
      </span>
      {isTurn && urgent && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: -6,
            /* The last-seconds numeral is an ACCESSIBILITY CUE, not a
               decoration: it exists so the ring turning colour is never
               the only warning that a turn is running out. A 12px
               warning helps nobody who needed warning (§10). */
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 800,
            color: C.brown,
            background: C.white,
            borderRadius: 8,
            padding: "0 4px",
            lineHeight: 1.3,
          }}
        >
          {seconds}
        </span>
      )}
    </span>
  );
}

/* ── One die at a corner ───────────────────────────────────────────
   Bright and arrow-cued when it is that player's turn, dim and inert
   otherwise. Only your own die is a button — tapping someone else's
   does nothing at all, which is the point. */
function SeatDie({ value, spent, active, mine, canRoll, colour, onRoll, label, rolling }) {
  const { ts } = useI18n();
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
        <span
          style={{
            lineHeight: 0,
            animation: rolling ? "saath-tumble 0.42s linear infinite" : undefined,
          }}
        >
          <DieFace value={value} size={34} ink={spent ? C.textMuted : C.brown} />
        </span>
      ) : (
        <span aria-hidden="true" style={{ fontSize: ts(20) }}>🎲</span>
      )}
      {spent && (
        <span
          aria-hidden="true"
          style={{ position: "absolute", right: 1, bottom: 0, fontSize: ts(A11Y.minBodyPx), fontWeight: 800, color: C.green }}
        >
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
      {/* THE BOUNCING ARROW (§4). The spec is relentless about this
          and so are we: when it is your turn and you have not rolled,
          something on this screen is pointing at the thing to press.
          It stops bouncing under reduced motion but does not vanish —
          the arrow is the instruction, the bounce is only emphasis. */}
      <span
        className="sb-die-arrow"
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -18,
          fontSize: ts(19),
          color: colour,
          fontWeight: 900,
          lineHeight: 1,
          filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))",
        }}
      >
        ▼
      </span>
    </button>
  );
}

function Plate({ seat, row, isTurn, isMe, align, dice, onRoll, canRoll, onPickDie, remaining, seconds, rolling, compact }) {
  const { t, ts } = useI18n();
  const name = row?.is_bot ? t("ludo.seat.bot") : row?.name || t("ludo.seat.someone");
  const colour = SEAT_COLORS[seat];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: align === "end" ? "row-reverse" : "row",
        alignItems: "center",
        gap: compact ? 7 : 9,
        minWidth: 0,
        padding: compact ? "2px 8px" : "6px 10px",
        borderRadius: 16,
        background: isTurn ? "#fffdf5" : "transparent",
        border: isTurn ? `2px solid ${colour}` : "2px solid transparent",
        boxShadow: isTurn ? `0 2px 10px ${colour}2e` : "none",
      }}
    >
      <Avatar
        compact={compact}
        name={row?.is_bot ? t("ludo.seat.bot") : row?.name}
        colour={colour}
        ink={SEAT_INK[seat]}
        isTurn={isTurn}
        remaining={remaining}
        seconds={seconds}
        label={
          seconds == null
            ? t("ludo.seat.turn")
            : isMe
            ? t("ludo.ring.yours", { n: seconds })
            : t("ludo.ring.theirs", { name, n: seconds })
        }
      />

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
        {/* Only when it says something. "Seat 2" under a seat that is
            simply sitting there is a label nobody reads, and the room
            it costs is room the board needs (§1). Whose turn it is
            stays said by the ring, the border and the arrow (§10 —
            never colour alone), and here in words at the floor size. */}
        {isTurn && (
          <span
            style={
              compact
                ? {
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
              whiteSpace: "nowrap",
            }
                : {
                    display: "block",
                    fontSize: ts(A11Y.minBodyPx),
                    color: colour,
                    fontWeight: 700,
                  }
            }
          >
            {isMe ? t("ludo.seat.yourTurn") : t("ludo.seat.turn")}
          </span>
        )}
        {/* Someone is deciding. Three dots that settle, not a spinner:
            a spinner says "the app is busy", this says "they are
            thinking", which is a different and truer thing. */}
        {isTurn && !isMe && (
          <span
            className={compact ? undefined : "sb-think"}
            style={
              compact
                ? {
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
              whiteSpace: "nowrap",
            }
                : { display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted, letterSpacing: "0.06em" }
            }
          >
            {t("ludo.ceremony.thinking")}
          </span>
        )}
      </span>

      {/* This player's own dice, beside their face (§3). In two-dice
          mode both sit here together, and this is also where you
          CHOOSE which one to spend — the choice used to live in the
          board's middle tray, which the spec removed. */}
      {/* A seat with no dice in hand still shows a die — dim, at rest,
          nothing to tap (§3: "opponents' dice are visible but dim").
          Without this an opponent who has not rolled renders as an
          avatar and two lines of text, which is what made a bot seat
          read as a plain "Bot / Seat 2" row rather than a place at the
          table. It also matters for §10: with no die and no ring, the
          only thing saying "not your turn" was the words. */}
      {(!dice || dice.length === 0) && !isMe && (
        <span
          style={{ display: "flex", flexShrink: 0, alignItems: "center", opacity: 0.42 }}
          aria-hidden="true"
        >
          <Die value={row?.last_roll || 1} size={34} state="used" />
        </span>
      )}

      {dice && dice.length > 0 && (
        <span style={{ display: "flex", gap: 2, flexShrink: 0, alignItems: "center" }}>
          {dice.map((d, i) => (
            <Die
              key={i}
              value={d.v}
              size={40}
              state={d.state}
              label={
                d.state === "used"
                  ? t("ludo.dice.used", { n: d.v })
                  : d.state === "wasted"
                  ? t("ludo.dice.wasted", { n: d.v })
                  : t("ludo.dice.pick", { n: d.v })
              }
              onClick={isMe && onPickDie && d.state === "ready" ? () => onPickDie(i) : undefined}
            />
          ))}
        </span>
      )}
      {/* Nothing rolled yet: the empty die is the roll button, and only
          for the person whose turn it is. */}
      {dice && dice.length === 0 && isTurn && (
        <SeatDie
          value={null}
          active={isTurn}
          mine={isMe}
          canRoll={canRoll}
          colour={colour}
          onRoll={onRoll}
          rolling={rolling && isMe}
          label={t("ludo.turn.rollCta")}
        />
      )}
    </div>
  );
}

/* `where` is "top" or "bottom": the row of plates above or below the
   board. On a phone the board is the full width, so the corners live
   in a row of their own rather than floating over it — the spec's
   "opponent strip above, you below" (§1) is the same arrangement. */
export default function SeatPlates({
  where,
  seats,
  seatsInPlay,
  spin,
  currentSeat,
  myId,
  /* diceFor(seat) → [{ v, spent }] | [] */
  diceFor,
  onRoll,
  canRoll,
  /* Two-dice mode: tapping one of your own rolled dice chooses which
     to spend. Only ever offered on your own plate. */
  onPickDie,
  rolling,
  /* Short screens (roughly <720px tall): the plate gives its height
     back to the board without giving up anything it says. */
  compact,
  /* The turn clock, for the ring. `secondsLeft` counts down and
     `turnSeconds` is the whole turn, so the ring can show a share
     rather than a number. Omit both and no ring is drawn. */
  secondsLeft,
  turnSeconds,
}) {
  const wanted = where === "top" ? [0, 1] : [3, 2]; // TL,TR above · BL,BR below
  const plates = wanted.map((corner) => {
    for (let seat = 0; seat < seatsInPlay; seat++) {
      if (cornerFor(seat, spin) === corner) return seat;
    }
    return null;
  });
  if (plates.every((p) => p === null)) return null;

  const remaining =
    secondsLeft != null && turnSeconds
      ? Math.max(0, Math.min(1, secondsLeft / turnSeconds))
      : null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        maxWidth: 560,
        margin: compact
          ? where === "top"
            ? "0 auto 4px"
            : "4px auto 0"
          : where === "top"
          ? "0 auto 10px"
          : "10px auto 0",
      }}
    >
      {plates.map((seat, i) => (
        <div
          key={i}
          style={{
            flex: seat != null ? "1 1 0" : "0 0 0",
            minWidth: 0,
            display: "flex",
            justifyContent: i === 0 ? "flex-start" : "flex-end",
          }}
        >
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
              onPickDie={onPickDie}
              rolling={rolling}
              compact={compact}
              remaining={seat === currentSeat ? remaining : null}
              seconds={seat === currentSeat ? secondsLeft : null}
            />
          )}
        </div>
      ))}
    </div>
  );
}
