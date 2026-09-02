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
import { useEffect, useState } from "react";
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
import { useSignedAvatar, AvatarPhoto } from "../gameAvatar.jsx";
import SampleAvatar, { sampleFor } from "../sampleAvatars.jsx";

/* Seconds left until `deadline`, ticking once a second — and only
   while there is a deadline to count to. */
function useCountdown(deadline) {
  const [left, setLeft] = useState(() => secondsTo(deadline));
  useEffect(() => {
    setLeft(secondsTo(deadline));
    if (!deadline) return undefined;
    const h = setInterval(() => setLeft(secondsTo(deadline)), 1000);
    return () => clearInterval(h);
  }, [deadline]);
  return left;
}

function secondsTo(deadline) {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
}

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
function Avatar({ name, photo, sample, colour, ink, isTurn, remaining, seconds, label, size = 52 }) {
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
          {/* The groove the clock runs in. Darker than the table
              rather than lighter: a pale ring around every plate
              was four grey circles on a midnight board, and the
              one that mattered had to compete with them. */}
          <circle
            cx={box / 2}
            cy={box / 2}
            r={arcR}
            fill="none"
            stroke="rgba(0,0,0,0.42)"
            strokeWidth={3.5}
          />
          {/* THE CLOCK IS THIS SEAT'S OWN COLOUR.

              It was gold — the one colour on this board that
              belongs to nobody — so every seat's clock looked
              the same and the ring said only "a clock is
              running", never whose. In this player's colour it
              says both at once, and it matches the gotis the
              person is being asked to move.

              Colour is not carrying it alone: the ring's LENGTH
              is the time left, the last fifth turns red, and the
              seconds are spoken in the label and printed under
              the plate. */}
          <circle
            cx={box / 2}
            cy={box / 2}
            r={arcR}
            fill="none"
            stroke={urgent ? "#E85141" : colour}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - left)}
          />
        </svg>
      )}
      <span
        aria-hidden="true"
        style={{
          position: "relative",
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
          overflow: "hidden",
          /* MATTE, and deep. No border, no gloss, no gradient. */
          boxShadow: "0 6px 14px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.4)",
        }}
      >
        {/* THREE LAYERS, IN ORDER OF TRUTH: a real photo if there
            is one, an illustrated face if there is not, and the
            initial underneath both — which now shows only for a
            bot or an empty chair, because those are the two things
            at this table that are not a person.

            Stacked rather than switched, so nothing moves when the
            signed URL arrives a moment after the render. */}
        {initialOf(name)}
        {sample != null && (
          <span style={{ position: "absolute", inset: 0 }}>
            <SampleAvatar index={sample} size={size} />
          </span>
        )}
        <AvatarPhoto src={photo} />
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
            /* The same midnight as every other surface in the
               game, rather than a plate of flat black. */
            background: GAME.panel,
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 3px 10px rgba(0,0,0,0.5)",
            borderRadius: 9,
            padding: "0 6px",
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
  /* The faces churning WHILE a throw is in the air — two of them,
     changing every few frames. Without these a tumbling die spins
     a fixed number, which is the one thing a thrown die never
     does. */
  tumbleFaces,
  /* The last number this seat actually threw. An idle die keeps
     its face, the way a real one lies on the table showing what it
     came up as — so the board is full of dice rather than of
     placeholders, and only the very first throw of a table shows a
     blank one. */
  lastValue,
}) {
  const { t } = useI18n();
  /* ONE PAIR ON THE TABLE, AND IT BELONGS TO WHOEVER IS PLAYING.

     Every seat drew dice, so a four-handed game had four pairs on
     screen at once and nothing about them said whose throw it was
     — the owner's screenshot has his pair at the bottom and the
     bot's at the top, both sitting there. Dice are not a badge a
     player wears; they are the thing in somebody's hand.

     So: nothing at all unless it is this seat's turn, or this seat
     is mid-throw. Yours appear when the turn comes round to you
     and go when it leaves. */
  if (!isTurn && !rolling) return null;
  const rolled = dice && dice.length > 0;
  const empties = rolled ? 0 : Math.max(1, Math.min(2, diceCount));
  const live = isTurn && isMe && canRoll && !rolled;
  /* EVERY die in the throw, not the first one. Two dice meant one
     tumbling beside one sitting perfectly still, which reads as a
     bug rather than as a throw. */
  const throwing = !!rolling && !rolled;

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
          value={throwing ? tumbleFaces?.[i] ?? null : lastValue ?? null}
          size={38}
          state={throwing ? "rolling" : "ready"}
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
      {/* THE + IS GONE. One die or two is settled in the setup room
          and frozen with the rest of the house rules; a badge on
          the board offering to change it was a control that had
          outlived the window it belonged to — and it sat on the
          roll button, so the only thing it reliably did on a live
          table was catch a thumb aiming at the dice. */}
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
  /* This seat is on a team, and that team's numbers are now one
     pool: both partners have taken somebody. The spec asks for it
     to be visible on the circles, because until it shows there is
     no way to know that your roll can move your partner's goti
     other than noticing their gotis have become tappable. */
  sharing,
  partnerColour,
  align,
  dice,
  onRoll,
  canRoll,
  onPickDie,
  remaining,
  seconds,
  rolling,
  compact,
  tumbleFaces,
  lastValue,
  /* The host's seat management, offered on bot and empty chairs. */
  onTapSeat,
  /* A person's card, offered on anybody who is a person. */
  onOpenProfile,
  /* Your own chat, on your own shoulder. */
  onOpenChat,
  unread,
  pending,
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
  /* Signed here rather than in Avatar so the hook runs on every
     plate whether or not that seat has a face — a hook behind a
     condition is a hook that changes count between renders. */
  const photo = useSignedAvatar(row?.avatar || null);
  /* A drawn face for anybody real who has not uploaded one. Bots
     and empty chairs keep the letter: they are not people, and
     giving them a face would be the table pretending. */
  const sample =
    isPerson && !photo
      ? row?.avatar_sample ?? sampleFor(row?.profile_id, seat)
      : null;
  /* A FIFTH BIGGER, all round. 44/42/38 were sized against a
     board that has since grown and a plate that has since lost
     its name chip, its turn line and its badges — the circles were
     the only thing left and they were still sized as one element
     among seven. */
  const size = isMe ? 52 : compact ? 46 : 50;

  const circle = (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <Avatar
        name={row?.is_bot ? t("ludo.seat.bot") : row?.name}
        photo={photo}
        sample={sample}
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

  /* ONE SHAPE FOR EVERY PLAYER.

     There were two: yours was a circle and dice with nothing under
     them, on the reasoning that you know who you are and the sixty
     pixels a name costs are pixels the board wants more. Standing
     at the table it reads as the one seat that has not been dealt
     in — three people with names and a nameless disc in the corner.

     So it is one branch. The differences that remain are the ones
     that mean something: the particle is on your own shoulder, only
     your dice are a button, and your label says you.

     It also stops the two from drifting: they were meant to look
     alike and the only thing keeping them alike was me remembering
     to change both. */
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
          gap: isMe ? 12 : 8,
          minWidth: 0,
        }}
      >
        {tapped}
        <SeatDice
          dice={dice}
          diceCount={diceCount}
          isTurn={isTurn}
          isMe={isMe}
          canRoll={isMe ? canRoll : false}
          onRoll={isMe ? onRoll : undefined}
          onPickDie={isMe ? onPickDie : undefined}
          rolling={rolling}
          tumbleFaces={tumbleFaces}
          lastValue={lastValue}
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
        {/* Your own name if the table knows it, and "you" if it does
            not — never an empty label, because an empty one is the
            gap this item is about. A seat kept for somebody carries
            THEIR name, not the name of the bot minding it. */}
        {isMe ? row?.name || t("ludo.seat.you") : pending || name}
      </span>
      {/* One short line, and only when there is one to say. */}
      {!isMe && (pending || takenOver) && (
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
      {/* NUMBERS SHARED. A short bar in the PARTNER'S colour under
          this seat's own name — two colours touching, which is
          what the rule is. Not a badge or an icon: at 26px an icon
          is a smudge, and this has to read at a glance from across
          a phone. Colour is not carrying it alone, the line under
          it says so in words. */}
      {sharing && (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginTop: 3,
            fontSize: ts(12),
            fontWeight: 700,
            color: GAME.inkMuted,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 18,
              height: 4,
              borderRadius: 2,
              background: partnerColour,
            }}
          />
          {t("ludo.teams.sharing")}
        </span>
      )}
      {/* Said to a screen reader, never drawn: the arrow at the dice
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
        {isMe && isTurn ? t("ludo.seat.yourTurn") : ""}
      </span>
    </div>
  );
}

/* `where` is "top" or "bottom": the row of plates above or below the
   board. On a phone the board is the full width, so the corners live
   in a row of their own rather than floating over it. */
export default function SeatPlates({
  where,
  /* Seats whose team has unlocked shared numbers. Worked out on
     the session from captured_by, so the board and the engine
     cannot disagree about it. */
  sharingSeats = null,
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
  /* Which seat is mid-throw, and the faces churning in it. */
  rollingSeat,
  tumbleFaces,
  /* lastDieBySeat[seat] → the number that seat last threw. */
  lastDieBySeat,
  /* Short screens (roughly <720px tall): the plate gives its height
     back to the board without giving up anything it says. */
  compact,
  /* THE CLOCK TICKS HERE, NOT IN THE SESSION.

     The session used to hold `now` and setNow it once a second,
     which re-rendered the whole play screen — board, three hundred
     SVG nodes and all — every second of every game, to move an arc
     round one circle. Nothing else on that screen changes on a
     one-second clock.

     So it is given the deadline and does its own counting. When
     nobody is on the clock there is no interval at all.

     `turnSeconds` is the whole turn, so the arc can show a share
     rather than a number. */
  turnDeadline,
  turnSeconds,
  onTapSeat,
  onOpenProfile,
  onOpenChat,
  unread,
  pendingBySeat,
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

  const secondsLeft = useCountdown(turnDeadline);
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
              sharing={!!sharingSeats?.includes(seat)}
              partnerColour={SEAT_COLORS[(seat + 2) % 4]}
              isMe={seats.find((s) => s.seat === seat)?.profile_id === myId}
              align={i === 0 ? "start" : "end"}
              dice={diceFor ? diceFor(seat) : null}
              onRoll={onRoll}
              canRoll={!!canRoll && seat === currentSeat}
              onPickDie={onPickDie}
              rolling={rollingSeat === seat}
              tumbleFaces={tumbleFaces}
              lastValue={lastDieBySeat ? lastDieBySeat[seat] : null}
              compact={compact}
              remaining={seat === currentSeat ? remaining : null}
              seconds={seat === currentSeat ? secondsLeft : null}
              onTapSeat={onTapSeat}
              onOpenProfile={onOpenProfile}
              onOpenChat={onOpenChat}
              unread={unread}
              diceCount={diceCount}
              pending={pendingBySeat ? pendingBySeat[seat] : null}
            />
          )}
        </div>
      ))}
    </div>
  );
}
