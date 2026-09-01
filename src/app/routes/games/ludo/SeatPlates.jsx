/* ════════════════════════════════════════════════
   The players, sitting at the table.

   A PLAYER IS A CIRCLE. That is the whole of it, and it is a
   deliberate demolition: what stood here was a lozenge holding an
   avatar, a name chip, a turn line, a "thinking…" line, a bot badge, a
   waiting badge and a dice tray, and at 390px those seven things
   fought each other for about a hundred and sixty pixels. Two of the
   owner's live bugs came straight out of that crowding — a name chip
   reading "BOT" over a seat its owner was sitting in, and "thinking…"
   laid across an opponent's face.

   So: YOUR OWN circle at the bottom-left, teal, with the chat particle
   on its shoulder and your dice beside it. Everyone else's circle in
   their seat colour at their corner, their name in small text
   underneath. Nothing else.

   Each plate still goes OUTSIDE the board at the corner of the yard
   that belongs to that seat, so once the board rotates to your point
   of view your own circle follows it down to the bottom-left. You
   always sit in the same place.

   THE TURN IS SAID BY THE DICE, NOT BY THE PERSON. A small arrow
   breathes at the dice of whoever is to play, and there is no glow, no
   frame and no coloured box round anybody's plate — the owner's other
   live bug was a red frame round the red seat, which read as an error
   state rather than as a turn. The countdown still sweeps as a thin
   arc outside the active circle: a turn that runs out is played by a
   bot, and taking away the only warning that it is about to happen
   would be removing a clock, not a decoration.

   A player's OWN dice sit beside them, never in the board's middle,
   and they ARE the roll control. There is no roll bar anywhere.
   ════════════════════════════════════════════════ */

import { A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { SEAT_COLORS, SEAT_INK } from "../seatColors.js";
import { GAME, NO_SELECT } from "../gameSurface.js";
/* The seat→corner geometry lives in a plain module so a test can
     import it without a browser — see seatCorners.js for why it needs
     one. screenCorner is re-exported here because callers have always
     imported it from this file. */
export { screenCorner } from "./seatCorners.js";
import { screenCorner as cornerFor } from "./seatCorners.js";
import Die from "./Dice.jsx";

function initialOf(name) {
  const s = (name || "").trim();
  if (!s) return "•";
  return [...s][0].toUpperCase();
}

/* ── THE CHAT PARTICLE ─────────────────────────────────────────────
   A frosted chip on the upper-right edge of your own circle, carrying
   a speech bubble with three dots in it.

   It was a solid white circle with an emoji in it, sitting in a row
   of pills under the board beside an Emoji button. Both are gone: a
   solid disc on a dark table reads as a notification badge, and emoji
   now live inside the chat's own keyboard where they belong. Frosted
   glass is what the rest of this table is made of. */
function ChatParticle({ onOpen, label, unread }) {
  if (!onOpen) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        /* The circle underneath opens a profile card. Without this,
           asking to chat would also ask who you are. */
        e.stopPropagation();
        onOpen();
      }}
      aria-label={label}
      style={{
        ...NO_SELECT,
        position: "absolute",
        top: -7,
        insetInlineEnd: -9,
        width: 26,
        height: 26,
        borderRadius: 9,
        border: `1px solid ${GAME.glassEdge}`,
        background: GAME.glassStrong,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      }}
    >
      {/* ONE SHAPE, ONE FILL, THREE HOLES.

          This was a white bubble with three dark dots painted on
          top of it — and the dark was #111A2E, the panel colour,
          which is a NAVY. On the frosted chip it read as a black
          patch inside a white one: two fills arguing at 15 pixels
          across. The owner's word for it was half-tinted.

          So the dots are knocked OUT of the bubble instead, as
          subpaths under evenodd, and the frosted glass shows
          through them. There is exactly one fill on this glyph and
          it is white. Nothing can be tinted, because nothing else
          is painted.

          The tail is part of the same outline rather than a second
          shape: two overlapping white subpaths under evenodd cancel
          each other where they meet, which is the other way this
          glyph could have grown a hole nobody asked for.

          DRAWN, NOT TYPED — 💬 is a different object on every
          platform and a blank box on some of them. */}
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fillRule="evenodd"
          fill="#FFFFFF"
          d={
            "M4.6 2 H11.4 A2.6 2.6 0 0 1 14 4.6 V9 A2.6 2.6 0 0 1 11.4 11.6 " +
            "H7.9 L4.7 14.6 V11.6 H4.6 A2.6 2.6 0 0 1 2 9 V4.6 A2.6 2.6 0 0 1 4.6 2 Z " +
            "M4.1 6.8 a1.05 1.05 0 1 0 2.1 0 a1.05 1.05 0 1 0 -2.1 0 Z " +
            "M6.95 6.8 a1.05 1.05 0 1 0 2.1 0 a1.05 1.05 0 1 0 -2.1 0 Z " +
            "M9.8 6.8 a1.05 1.05 0 1 0 2.1 0 a1.05 1.05 0 1 0 -2.1 0 Z"
          }
        />
      </svg>
      {unread > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -4,
            insetInlineStart: -4,
            minWidth: 14,
            height: 14,
            borderRadius: 7,
            background: "#1FA83C",
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: 800,
            lineHeight: "14px",
            padding: "0 3px",
          }}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

/* ── The circle ────────────────────────────────────────────────────
   44px, flat colour, dark ink, a deep drop shadow and no border. It
   used to carry a 2px white ring and a gloss; both are gone — a matte
   disc with a shadow under it reads as a counter laid on the table,
   which a ringed glossy one does not.

   `remaining` is 0..1, the share of the turn still left. The arc
   EMPTIES clockwise, and it only exists while it is that player's
   turn: an arc drawn on everyone would be four clocks, three of them
   lying. It sits OUTSIDE the circle so the circle itself stays a
   circle only. */
function Avatar({ name, colour, ink, isTurn, remaining, seconds, label, size = 44 }) {
  const { ts } = useI18n();
  const arcR = size / 2 + 4;
  const box = arcR * 2 + 6;
  const circumference = 2 * Math.PI * arcR;
  const left = Math.max(0, Math.min(1, remaining ?? 1));
  /* Under about a fifth of the turn the arc changes COLOUR and the
     seconds are said out loud in the label — never colour alone. */
  const urgent = isTurn && left <= 0.2;

  return (
    <span
      style={{
        ...NO_SELECT,
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
          width={box}
          height={box}
          viewBox={`0 0 ${box} ${box}`}
          role="timer"
          aria-label={label}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            marginLeft: -box / 2,
            marginTop: -box / 2,
            transform: "rotate(-90deg)",
            pointerEvents: "none",
          }}
        >
          <circle
            cx={box / 2}
            cy={box / 2}
            r={arcR}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={3}
          />
          <circle
            cx={box / 2}
            cy={box / 2}
            r={arcR}
            fill="none"
            stroke={urgent ? "#E85141" : GAME.gold}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - left)}
          />
        </svg>
      )}
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: colour,
          color: ink,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: ts(Math.round(size * 0.45)),
          /* MATTE, and deep. No border, no gloss, no gradient. */
          boxShadow: "0 6px 14px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.4)",
        }}
      >
        {initialOf(name)}
      </span>
      {isTurn && urgent && (
        <span
          aria-hidden="true"
          style={{
            /* The last-seconds numeral is an ACCESSIBILITY CUE, not a
               decoration: it exists so the arc turning colour is never
               the only warning that a turn is running out. A 12px
               warning helps nobody who needed warning. */
            position: "absolute",
            bottom: -10,
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 800,
            color: GAME.ink,
            background: "rgba(0,0,0,0.55)",
            borderRadius: 8,
            padding: "0 5px",
            lineHeight: 1.3,
          }}
        >
          {seconds}
        </span>
      )}
    </span>
  );
}

/* ── The dice beside a player ──────────────────────────────────────
   Ivory, matte, with a soft square corner and classic round dark
   pips. Only your own are a button: tapping somebody else's does
   nothing at all, which is the point.

   The breathing arrow points at the dice of whoever is to play. It is
   the ONLY turn signal on this table — no glow, no frame, no coloured
   box round a plate. Under reduced motion it stops breathing and stays
   put: the arrow is the instruction, the breath is only emphasis. */
function SeatDice({
  dice,
  diceCount,
  isTurn,
  isMe,
  canRoll,
  onRoll,
  onPickDie,
  rolling,
  onToggleSpare,
}) {
  const { t } = useI18n();
  const rolled = dice && dice.length > 0;
  const empties = rolled ? 0 : Math.max(1, Math.min(2, diceCount));
  const live = isTurn && isMe && canRoll && !rolled;

  const faces = rolled
    ? dice.map((d, i) => (
        <Die
          key={i}
          value={d.v}
          size={38}
          state={d.state}
          dim={!isTurn}
          label={
            d.state === "used"
              ? t("ludo.dice.used", { n: d.v })
              : d.state === "wasted"
              ? t("ludo.dice.wasted", { n: d.v })
              : t("ludo.dice.pick", { n: d.v })
          }
          onClick={isMe && onPickDie && d.state === "ready" ? () => onPickDie(i) : undefined}
        />
      ))
    : Array.from({ length: empties }).map((_, i) => (
        <Die
          key={`e${i}`}
          value={null}
          size={38}
          state={rolling && isMe && i === 0 ? "rolling" : "ready"}
          dim={!isTurn}
          label={live ? t("ludo.turn.rollCta") : undefined}
          onClick={live ? onRoll : undefined}
        />
      ));

  return (
    <span
      style={{
        ...NO_SELECT,
        position: "relative",
        display: "inline-flex",
        gap: 4,
        flexShrink: 0,
        alignItems: "center",
      }}
    >
      {faces}
      {/* One die or two, while the table can still be changed. The
          badge sits on the LAST die and stops the tap there, because
          the die under it is the roll button. */}
      {onToggleSpare && !rolled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSpare();
          }}
          aria-label={t(diceCount === 2 ? "ludo.table.oneDie" : "ludo.table.twoDice")}
          style={{
            position: "absolute",
            insetInlineEnd: -6,
            bottom: -6,
            width: 22,
            height: 22,
            borderRadius: 11,
            border: "none",
            padding: 0,
            background: GAME.accentFlat,
            color: GAME.accentInk,
            fontSize: 14,
            fontWeight: 900,
            lineHeight: "22px",
            cursor: "pointer",
          }}
        >
          {diceCount === 2 ? "−" : "+"}
        </button>
      )}
      {isTurn && (
        <span
          className="sb-die-arrow"
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -17,
            left: "50%",
            marginLeft: -8,
            width: 16,
            height: 14,
            lineHeight: 0,
            filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
          }}
        >
          <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
            <path d="M8 14 L0.6 1.2 A1 1 0 0 1 1.6 0 h12.8 a1 1 0 0 1 1 1.2 Z" fill={GAME.gold} />
          </svg>
        </span>
      )}
    </span>
  );
}

/* Tapping a person opens their card; tapping a bot or an empty chair
   opens the seat, which is the host's to manage. A bot has no profile
   and a profile is not a chair. */
function SeatTap({ onTap, label, children }) {
  if (!onTap) return children;
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={label}
      style={{
        ...NO_SELECT,
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        display: "inline-flex",
        cursor: "pointer",
        borderRadius: "50%",
      }}
    >
      {children}
    </button>
  );
}

function Plate({
  seat,
  row,
  isTurn,
  isMe,
  align,
  dice,
  onRoll,
  canRoll,
  onPickDie,
  remaining,
  seconds,
  rolling,
  compact,
  /* The host's seat management, offered on bot and empty chairs. */
  onTapSeat,
  /* A person's card, offered on anybody who is a person. */
  onOpenProfile,
  /* Your own chat, on your own shoulder. */
  onOpenChat,
  unread,
  pending,
  onToggleSpare,
  diceCount = 1,
}) {
  const { t, ts } = useI18n();
  const name = row?.is_bot ? t("ludo.seat.bot") : row?.name || t("ludo.seat.someone");
  const isPerson = !!row && !row.is_bot;
  /* A SEAT THE BOT HAS TAKEN OVER. Presence is only 'active' or
     'away', and a seat goes 'away' both when somebody deliberately
     leaves and when they miss three turns — a dead battery, a train
     tunnel, a grandchild wanting the phone. So the line says the thing
     that is true in both cases and accuses nobody of walking out. */
  const takenOver = isPerson && row?.presence === "away";
  const size = isMe ? 46 : compact ? 38 : 42;

  const circle = (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <Avatar
        name={row?.is_bot ? t("ludo.seat.bot") : row?.name}
        colour={isMe ? GAME.you : SEAT_COLORS[seat]}
        ink={isMe ? GAME.youInk : SEAT_INK[seat]}
        isTurn={isTurn}
        remaining={remaining}
        seconds={seconds}
        size={size}
        label={
          seconds == null
            ? t("ludo.seat.turn")
            : isMe
            ? t("ludo.ring.yours", { n: seconds })
            : t("ludo.ring.theirs", { name, n: seconds })
        }
      />
      {isMe && (
        <ChatParticle
          onOpen={onOpenChat}
          unread={unread}
          label={t("ludo.chat.open")}
        />
      )}
    </span>
  );

  const tapped = (
    <SeatTap
      onTap={
        isPerson && onOpenProfile
          ? () => onOpenProfile(seat)
          : onTapSeat
          ? () => onTapSeat(seat)
          : null
      }
      label={
        isMe
          ? t("ludo.card.mine")
          : isPerson
          ? t("ludo.seat.profileTap", { who: name })
          : t("ludo.table.seatTap", { who: name })
      }
    >
      {circle}
    </SeatTap>
  );

  /* YOU: circle and dice, side by side, nothing written. You know who
     you are, and the sixty pixels a name chip costs are pixels the
     dice and the board want more. */
  if (isMe) {
    return (
      <div
        style={{
          ...NO_SELECT,
          display: "flex",
          flexDirection: align === "end" ? "row-reverse" : "row",
          alignItems: "center",
          gap: 12,
          minWidth: 0,
        }}
      >
        {tapped}
        <SeatDice
          dice={dice}
          diceCount={diceCount}
          isTurn={isTurn}
          isMe
          canRoll={canRoll}
          onRoll={onRoll}
          onPickDie={onPickDie}
          rolling={rolling}
          onToggleSpare={onToggleSpare}
        />
        {/* Said to a screen reader, never drawn. The arrow at the dice
            is the visible half of this. */}
        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
          }}
        >
          {isTurn ? t("ludo.seat.yourTurn") : ""}
        </span>
      </div>
    );
  }

  /* EVERYONE ELSE: circle, dice beside it, name underneath. */
  return (
    <div
      style={{
        ...NO_SELECT,
        display: "flex",
        flexDirection: "column",
        alignItems: align === "end" ? "flex-end" : "flex-start",
        gap: 3,
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: align === "end" ? "row-reverse" : "row",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
        }}
      >
        {tapped}
        <SeatDice
          dice={dice}
          diceCount={diceCount}
          isTurn={isTurn}
          isMe={false}
          canRoll={false}
          rolling={false}
        />
      </div>
      <span
        dir="auto"
        style={{
          fontSize: ts(13),
          fontWeight: 700,
          color: GAME.ink,
          maxWidth: 118,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textShadow: "0 1px 3px rgba(0,0,0,0.7)",
        }}
      >
        {/* A seat kept for somebody carries THEIR name, not the name
            of the bot minding it. */}
        {pending || name}
      </span>
      {/* One short line, and only when there is one to say. */}
      {(pending || takenOver) && (
        <span
          style={{
            fontSize: ts(12),
            fontWeight: 700,
            color: GAME.inkMuted,
            maxWidth: 118,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          aria-label={pending ? t("ludo.table.waitingFor", { name: pending }) : undefined}
        >
          {pending ? t("ludo.table.waiting") : t("ludo.seat.botHasSeat")}
        </span>
      )}
    </div>
  );
}

/* `where` is "top" or "bottom": the row of plates above or below the
   board. On a phone the board is the full width, so the corners live
   in a row of their own rather than floating over it. */
export default function SeatPlates({
  where,
  seats,
  seatsInPlay,
  spin,
  currentSeat,
  myId,
  /* diceFor(seat) → [{ v, state }] | [] */
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
  /* The turn clock, for the arc. `secondsLeft` counts down and
     `turnSeconds` is the whole turn, so the arc can show a share
     rather than a number. Omit both and no arc is drawn. */
  secondsLeft,
  turnSeconds,
  onTapSeat,
  onOpenProfile,
  onOpenChat,
  unread,
  pendingBySeat,
  onToggleSpare,
  diceCount = 1,
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
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "space-between",
        alignItems: where === "top" ? "flex-start" : "flex-end",
        gap: 8,
        width: "100%",
        maxWidth: "min(560px, 100%)",
        /* Tight to the board: the reference puts the players within a
           few pixels of its edge, and that closeness is what makes
           them read as sitting AT it. */
        margin: where === "top" ? "0 auto 6px" : "6px auto 0",
        paddingInline: 6,
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
              onTapSeat={onTapSeat}
              onOpenProfile={onOpenProfile}
              onOpenChat={onOpenChat}
              unread={unread}
              diceCount={diceCount}
              pending={pendingBySeat ? pendingBySeat[seat] : null}
              onToggleSpare={
                onToggleSpare && seats.find((s) => s.seat === seat)?.profile_id === myId
                  ? onToggleSpare
                  : undefined
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
