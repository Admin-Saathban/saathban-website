/* ════════════════════════════════════════════════
   Setting the table — the tactile version.

   The old setup screen was a form: a "Players" label over a row of
   number chips, three stacked text rows for who to play with, a
   paragraph about dice. It read like a settings page for something
   you were about to configure. This is a game.

   So: no labels that a picture already says. Seat rows you add and
   remove with a big + and −, four gotis per row to pick your colour
   from, two dice you tap, three faces for who fills each empty chair,
   and one round Start. Total words on the screen: the title, one
   caption, and Start.

   WHY GOTIS AND NOT SWATCHES. The colour you pick here is the piece
   you will spend the next twenty minutes looking at. Picking it as
   the actual goti — the same drawing, the same size, from the same
   component the board uses — means the choice and the consequence are
   the same object. A coloured square would be a form control standing
   in for a game piece.

   EVERY ANIMATION HERE IS DECORATION over something that already
   happened, and every one is disabled under prefers-reduced-motion.
   A new row pops because it arrived; a goti presses because you
   pressed it. Nothing moves to fill a wait, and nothing moves that a
   person has to wait for.

   Colour rides on house_rules.seat_colours — an array indexed by seat,
   each entry an index into the four ludo colours. That needed no
   schema change: create_game_session already stores house_rules
   verbatim and ludo_state_init already reads dice_count out of it, so
   the choice persists with the session and the board can render each
   seat in the colour its player chose.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { COLORS as C, A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { SEAT_COLORS, SEAT_COLOR_NAMES } from "../seatColors.js";
import Pawn from "../Pawn.jsx";

export const SETUP_MOTION_CSS = `
  @keyframes sb-seat-pop {
    0%   { transform: scale(0.82); opacity: 0; }
    60%  { transform: scale(1.04); opacity: 1; }
    100% { transform: scale(1);    opacity: 1; }
  }
  @keyframes sb-press {
    0%   { transform: scale(1); }
    45%  { transform: scale(0.9); }
    100% { transform: scale(1); }
  }
  @keyframes sb-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(18,161,80,0.45); }
    50%      { box-shadow: 0 0 0 7px rgba(18,161,80,0); }
  }
  .sb-pop   { animation: sb-seat-pop 260ms cubic-bezier(.2,.9,.3,1.2) both; }
  .sb-press { animation: sb-press 170ms ease-out; }
  .sb-glow  { animation: sb-glow 1900ms ease-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .sb-pop, .sb-press, .sb-glow { animation: none !important; }
  }
`;

/* One goti you can tap to take its colour. */
function ColourGoti({ colour, chosen, taken, onPick, label }) {
  const [pressed, setPressed] = useState(false);
  const size = chosen ? 54 : 44;
  return (
    <button
      type="button"
      onClick={() => {
        if (taken) return;
        setPressed(true);
        setTimeout(() => setPressed(false), 180);
        onPick();
      }}
      aria-label={label}
      aria-pressed={chosen}
      disabled={taken}
      className={pressed ? "sb-press" : undefined}
      style={{
        width: size,
        height: size,
        minWidth: 44,
        minHeight: 44,
        borderRadius: "50%",
        border: chosen ? `3px solid ${C.green}` : "3px solid transparent",
        background: chosen ? "#F1F7EE" : "transparent",
        padding: 0,
        cursor: taken ? "default" : "pointer",
        /* Taken elsewhere: faded AND struck through by the disabled
           state, never colour alone. */
        opacity: taken ? 0.28 : 1,
        display: "grid",
        placeItems: "center",
        transition: "width 140ms ease, height 140ms ease",
      }}
    >
      <svg width={size - 8} height={size - 8} viewBox="-20 -20 40 40" aria-hidden="true">
        <Pawn seat={colour} cx={0} cy={0} r={15} showSeat={false} />
      </svg>
    </button>
  );
}

/* The four gotis for one seat. */
function ColourRow({ mine, takenBy, seat, onPick, t }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {SEAT_COLORS.map((_, colour) => {
        const takenElsewhere = takenBy[colour] != null && takenBy[colour] !== seat;
        return (
          <ColourGoti
            key={colour}
            colour={colour}
            chosen={mine === colour}
            taken={takenElsewhere}
            onPick={() => onPick(colour)}
            label={t(`games.setup.colour.${SEAT_COLOR_NAMES[colour]}`)}
          />
        );
      })}
    </div>
  );
}

/* 👤 / 🤖 / 🪷 — who fills this chair. */
function FillChoice({ value, onChange, t, ts }) {
  const OPTIONS = [
    ["person", "👤", t("games.setup.fill.person")],
    ["bot", "🤖", t("games.setup.fill.bot")],
    ["open", "🪷", t("games.setup.fill.open")],
  ];
  return (
    <div role="radiogroup" style={{ display: "flex", gap: 6 }}>
      {OPTIONS.map(([key, emoji, label]) => {
        const on = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            onClick={() => onChange(key)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              border: on ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
              background: on ? "#EEF3E8" : C.white,
              fontSize: ts(22),
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <span aria-hidden="true">{emoji}</span>
          </button>
        );
      })}
    </div>
  );
}

/* One die toy, or two side by side. Tap to choose. */
function DiceToy({ count, chosen, onPick, t }) {
  const pips = count === 1 ? [[0, 0]] : [[-1, -1], [1, 1]];
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={chosen}
      aria-label={count === 2 ? t("ludo.rules.diceTwo") : t("ludo.rules.diceOne")}
      className={chosen ? "sb-glow" : undefined}
      style={{
        flex: 1,
        minHeight: 84,
        borderRadius: 20,
        border: chosen ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
        background: chosen ? "#F1F7EE" : C.white,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width={40} height={40} viewBox="0 0 40 40" aria-hidden="true">
          <rect x="2" y="2" width="36" height="36" rx="9" fill="#fffdf7" stroke={C.brown} strokeWidth="2.5" />
          <rect x="6" y="5" width="12" height="6" rx="3" fill="#ffffff" opacity="0.9" />
          {pips.map(([px, py], k) => (
            <circle key={k} cx={20 + px * 8} cy={20 + py * 8} r="4" fill={C.brown} />
          ))}
        </svg>
      ))}
    </button>
  );
}

/* ── The screen ────────────────────────────────────────────────── */
export default function SeatSetup({
  me,
  minSeats = 2,
  maxSeats = 4,
  onStart,
  busy,
  people = [],
  onPickPeople,
}) {
  const { t, ts } = useI18n();
  const [seats, setSeats] = useState(Math.max(2, minSeats));
  const [diceCount, setDiceCount] = useState(1);
  /* colours[seat] = index into SEAT_COLORS. You are seat 0 and start
     on green; the rest take what is left, in order, and can be
     changed. */
  const [colours, setColours] = useState([0, 1, 2, 3]);
  const [fill, setFill] = useState(["me", "bot", "bot", "bot"]);
  const [popped, setPopped] = useState(-1);

  const takenBy = {};
  colours.slice(0, seats).forEach((c, seat) => {
    takenBy[c] = seat;
  });

  const pick = (seat, colour) => {
    setColours((cur) => {
      const next = [...cur];
      const heldBy = next.findIndex((c, i) => c === colour && i < seats);
      if (heldBy >= 0 && heldBy !== seat) next[heldBy] = next[seat]; // swap, never strand
      next[seat] = colour;
      return next;
    });
  };

  const addSeat = () => {
    if (seats >= maxSeats) return;
    setPopped(seats);
    setSeats(seats + 1);
  };

  return (
    <>
      <style>{SETUP_MOTION_CSS}</style>

      {/* ── The seats ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {Array.from({ length: seats }).map((_, seat) => {
          const isMe = seat === 0;
          return (
            <div
              key={seat}
              className={popped === seat ? "sb-pop" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 18,
                background: C.white,
                border: `1.5px solid ${C.warmGray}`,
                flexWrap: "wrap",
              }}
            >
              {/* who */}
              <span
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: SEAT_COLORS[colours[seat]],
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: ts(17),
                }}
              >
                {isMe ? (me?.full_name || "•")[0].toUpperCase() : seat + 1}
              </span>

              <ColourRow
                mine={colours[seat]}
                takenBy={takenBy}
                seat={seat}
                onPick={(c) => pick(seat, c)}
                t={t}
              />

              {!isMe && (
                <FillChoice
                  value={fill[seat]}
                  onChange={(v) => {
                    setFill((cur) => {
                      const next = [...cur];
                      next[seat] = v;
                      return next;
                    });
                    if (v === "person") onPickPeople?.(seat);
                  }}
                  t={t}
                  ts={ts}
                />
              )}

              {!isMe && seat === seats - 1 && seats > minSeats && (
                <button
                  type="button"
                  onClick={() => setSeats(seats - 1)}
                  aria-label={t("games.setup.removeSeat")}
                  style={{
                    marginInlineStart: "auto",
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: `1.5px solid ${C.warmGray}`,
                    background: C.white,
                    fontSize: ts(24),
                    lineHeight: 1,
                    cursor: "pointer",
                    color: C.brown,
                  }}
                >
                  −
                </button>
              )}
            </div>
          );
        })}

        {seats < maxSeats && (
          <button
            type="button"
            onClick={addSeat}
            aria-label={t("games.setup.addSeat")}
            style={{
              alignSelf: "flex-start",
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: `3px solid ${C.green}`,
              background: "#EEF3E8",
              color: C.green,
              fontSize: ts(30),
              lineHeight: 1,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            +
          </button>
        )}
      </div>

      {/* ── The dice ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <DiceToy count={1} chosen={diceCount === 1} onPick={() => setDiceCount(1)} t={t} />
        <DiceToy count={2} chosen={diceCount === 2} onPick={() => setDiceCount(2)} t={t} />
      </div>
      {/* The one caption on the screen. */}
      <p style={{ margin: "0 0 20px", fontSize: ts(A11Y.minBodyPx), color: C.textMuted, textAlign: "center" }}>
        {diceCount === 2 ? t("games.setup.diceCaption") : t("games.setup.diceCaptionOne")}
      </p>

      {/* ── Start ── */}
      <button
        type="button"
        disabled={busy}
        onClick={() => onStart({ seats, diceCount, colours: colours.slice(0, seats), fill: fill.slice(0, seats) })}
        style={{
          display: "block",
          margin: "0 auto",
          width: 132,
          height: 132,
          borderRadius: "50%",
          border: "none",
          background: C.green,
          color: C.cream,
          fontFamily: "inherit",
          fontSize: ts(24),
          fontWeight: 800,
          cursor: busy ? "default" : "pointer",
          boxShadow: "0 6px 0 rgba(0,0,0,0.16)",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {t("games.new.start")}
      </button>
    </>
  );
}
