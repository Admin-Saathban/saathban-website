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

import { GAME } from "../gameSurface.js";

/* THE ROOM'S GREEN, and the grey it is not.

   This is the owner's #1FA83C — the same green as your own chat
   bubbles and the Send beside them — and inside the setup room it
   is the ONLY bright colour: what is chosen wears it, Start wears
   it, nothing else does. That is why the room reads at a glance
   even though it is six choices deep.

   Every control in here was brass a commit ago, which was right
   when the room was plum and the board had a gold trim ring. Both
   of those are gone. */
const GREEN = "#1FA83C";
const OFF = "#4A5058";
/* Frosted, at two weights: a row you read through, and a chip that
   sits on one. */
const GLASS = "rgba(255,255,255,0.07)";
const CHIP = "rgba(255,255,255,0.10)";
const EDGE = "rgba(255,255,255,0.18)";
import { useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../../shared/tokens.js";
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
        border: chosen ? `3px solid ${GREEN}` : "3px solid transparent",
        background: chosen ? "rgba(31,168,60,0.16)" : "transparent",
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
        <Pawn seat={colour} cx={0} cy={0} r={15} />
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

/* 👤 / 🤖 / 🪷 — who fills this chair.

   Not every game offers all three. Carrom passes turns rather than
   playing itself, so a bot seat there is an empty chair with a clock
   — start_with_bots refuses it server-side (0043), and a face you can
   tap that the server will reject is worse than one that isn't
   offered. Posting a table to the community is an Icon's to give, so
   that face only appears for someone who may. */
function FillChoice({ value, onChange, t, ts, botsAllowed = true, canPostOpen = true }) {
  const OPTIONS = [
    ["person", "👤", t("games.setup.fill.person")],
    ...(botsAllowed ? [["bot", "🤖", t("games.setup.fill.bot")]] : []),
    ...(canPostOpen ? [["open", "🪷", t("games.setup.fill.open")]] : []),
    /* §17 — send a link. Offered to everyone, because it is the option
       for the person who is NOT on Saathban yet: a daughter on
       WhatsApp who will sign up and land in the seat. It needs no
       community rights, unlike an open table, because it reaches
       exactly one person and dies when they take the chair. */
    ["link", "🔗", t("games.setup.fill.link")],
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
              /* Two pixels of green, and the chip underneath does not
                 change colour: a selected chip that also fills in
                 makes the four of them read as four different kinds
                 of thing rather than one choice with one answer. */
              border: on ? `2px solid ${GREEN}` : `1px solid ${EDGE}`,
              background: CHIP,
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

/* ONE DIE OR TWO, as two cards side by side.

   The dice drawn on them are the table's own — ivory body, ivory
   edge, round dark pips — because the whole point of choosing here
   is that you are choosing the object you will be tapping for the
   next twenty minutes, and a differently-drawn die would be a
   picture of the choice rather than the choice.

   Each card says what it is. There used to be ONE caption under
   both, which meant the screen described whichever card you had
   already picked and said nothing about the other one — the
   information was on the wrong side of the decision. */
function DiceToy({ count, chosen, onPick, t, ts }) {
  const pips = count === 1 ? [[0, 0]] : [[-1, -1], [1, 1]];
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={chosen}
      aria-label={t(count === 2 ? "games.setup.diceTwoCard" : "games.setup.diceOneCard")}
      style={{
        flex: 1,
        minHeight: 110,
        borderRadius: 16,
        border: chosen ? `2.5px solid ${GREEN}` : `1px solid ${EDGE}`,
        background: GLASS,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 8px",
      }}
    >
      <span style={{ display: "flex", gap: 6 }} aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <svg key={i} width={36} height={36} viewBox="0 0 36 36">
            <rect x="1" y="1" width="34" height="34" rx="8.5" fill="#F8F2E4" stroke="#D8CCAE" strokeWidth="2" />
            {pips.map(([px, py], k) => (
              <circle key={k} cx={18 + px * 7} cy={18 + py * 7} r="3.6" fill="#2B2B2B" />
            ))}
          </svg>
        ))}
      </span>
      <span
        style={{
          fontSize: ts(14),
          fontWeight: 700,
          color: chosen ? GAME.ink : GAME.inkMuted,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {t(count === 2 ? "games.setup.diceTwoCard" : "games.setup.diceOneCard")}
      </span>
    </button>
  );
}

/* ── The screen ────────────────────────────────────────────────── */
/* One switch, drawn once. It was inline below for the auto-move
   rule; §8 needs a second, and two hand-drawn switches drift apart
   the moment one of them is tweaked. */
/* Exported so each game can build its OWN rule rows with it (§8.1)
   without a second hand-drawn switch drifting away from this one. */
export function Switch({ on, onToggle, label, hint, ts }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        minHeight: A11Y.minTapTargetPx,
        padding: "12px 14px",
        marginBottom: 10,
        borderRadius: 14,
        /* The row does not change colour with the switch. A row
           that fills in when it is on turns a list of settings
           into a list of highlights, and the knob has already
           said it. */
        border: `1px solid ${EDGE}`,
        background: GLASS,
        cursor: "pointer",
        textAlign: "start",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: "0 0 auto",
          width: 52,
          height: 30,
          borderRadius: 15,
          background: on ? GREEN : OFF,
          position: "relative",
          transition: "background 160ms",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            insetInlineStart: on ? 25 : 3,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
            transition: "inset-inline-start 160ms",
          }}
        />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: GAME.ink }}>
          {label}
        </span>
        {/* Only when there is something a person could not work out
            from the label. Most rules have no hint at all. */}
        {hint && (
          <span style={{ fontSize: ts(14), color: GAME.inkMuted, lineHeight: 1.35 }}>{hint}</span>
        )}
      </span>
    </button>
  );
}

export default function SeatSetup({
  me,
  minSeats = 2,
  maxSeats = 4,
  onStart,
  busy,
  people = [],
  onPickPeople,
  /* seat number → the person the host has chosen for that chair, so a
     row can show a face and a name instead of the word "person". The
     parent owns the sheet they were chosen from. */
  seated = {},
  botsAllowed = true,
  canPostOpen = true,
  /* Only ludo has a dice rule worth choosing: one die or the two-dice
     Desi table. Snakes rolls its own single die and carrom has none,
     so offering the toys there asks a question the game cannot answer
     — and the caption underneath would be describing nothing. */
  showDice = true,
  /* Anything the caller wants between the dice and Start — the table
     theme picker lives here. A slot rather than a prop per feature, so
     this screen does not grow a branch every time setup gains a
     choice. Defaulted to nothing, so existing callers are unchanged. */
  /* A game's own rule switches, supplied by that game. Same
     reasoning as extras below, and for a sharper reason: a third
     boolean — showDice, showAutoMove, showUndo — is the shape that
     produced the leak, because every new Ludo rule then appears in
     every other game until somebody notices. A rule cannot leak
     into a game that never passed it. */
  /* The room above needs the seat count to decide whether a rule
     that requires four players may be turned on at all. */
  onSeatsChanged = null,
  rules = null,
  extras = null,
}) {
  const { t, ts } = useI18n();
  const [seats, setSeats] = useState(Math.max(2, minSeats));
  useEffect(() => {
    onSeatsChanged?.(seats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats]);
  const [diceCount, setDiceCount] = useState(1);
  /* ON, because the alternative is asking a person to confirm the one
     thing the rules had already decided. Off is for anyone who would
     rather move every goti with their own hand, and that is a real
     preference rather than a fallback. */
  /* colours[seat] = index into SEAT_COLORS. You are seat 0 and start
     on green; the rest take what is left, in order, and can be
     changed. */
  /* You start on GREEN — looked up, never hardcoded. The ring has
     re-phased twice today and seat 0 is currently yellow, so an index
     literal here would quietly hand the host the wrong goti the next
     time the board turns. The others take what is left, in order. */
  const [colours, setColours] = useState(() => {
    const green = Math.max(0, (SEAT_COLOR_NAMES || []).indexOf("green"));
    return [green, ...SEAT_COLORS.map((_, i) => i).filter((i) => i !== green)];
  });
  /* Default fillings follow what the game can actually do: bots where
     bots can play, otherwise an open chair someone can claim. */
  const [fill, setFill] = useState(() => {
    const other = botsAllowed ? "bot" : canPostOpen ? "open" : "person";
    return ["me", other, other, other];
  });
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
                borderRadius: 14,
                background: GLASS,
                border: `1px solid ${EDGE}`,
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

              {/* A chosen person takes the chair's place in the row:
                  their face and their name, not the word "person".
                  Tapping it reopens the sheet, because the commonest
                  correction is picking someone else. */}
              {!isMe && fill[seat] === "person" && seated[seat] && (
                <button
                  type="button"
                  onClick={() => onPickPeople?.(seat)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minHeight: A11Y.minTapTargetPx,
                    padding: "0 12px 0 6px",
                    borderRadius: 50,
                    border: `2px solid ${GREEN}`,
                    background: CHIP,
                    fontFamily: "inherit",
                    fontSize: ts(17),
                    fontWeight: 700,
                    color: GAME.ink,
                    cursor: "pointer",
                    maxWidth: "100%",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: C.olive,
                      color: C.cream,
                      display: "grid",
                      placeItems: "center",
                      fontSize: ts(15),
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {(seated[seat].full_name || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {seated[seat].full_name}
                  </span>
                </button>
              )}

              {!isMe && !(fill[seat] === "person" && seated[seat]) && (
                <FillChoice
                  botsAllowed={botsAllowed}
                  canPostOpen={canPostOpen}
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
                    border: `1px solid ${EDGE}`,
                    background: CHIP,
                    fontSize: ts(24),
                    lineHeight: 1,
                    cursor: "pointer",
                    color: GAME.ink,
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
              border: `2px solid ${GREEN}`,
              background: CHIP,
              color: GAME.ink,
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
      {showDice && (
        <>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <DiceToy count={1} chosen={diceCount === 1} onPick={() => setDiceCount(1)} t={t} ts={ts} />
        <DiceToy count={2} chosen={diceCount === 2} onPick={() => setDiceCount(2)} t={t} ts={ts} />
      </div>

        </>
      )}

      {/* ── One less thing to tap ──────────────────────────────────
             A turn with exactly one legal move is not a decision. This
             is the switch for people who would rather make it anyway,
             and it is a switch rather than a checkbox because the rest
             of this screen is things you touch. ── */}
      {/* §8.1: a game's OWN rules, handed in by that game. These
          were two hard-coded Ludo switches, so Carrom asked its
          players whether to move for them when there was only one
          choice, and whether they could take a move back. Carrom
          has neither rule. */}
      {rules}

      {extras}

      {/* ── Start ── */}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          onStart({
            seats,
            diceCount,
            colours: colours.slice(0, seats),
            fill: fill.slice(0, seats),
          })
        }
        style={{
          display: "block",
          margin: "8px auto 0",
          width: 120,
          height: 120,
          borderRadius: "50%",
          /* GREEN, and it is the room's own green rather than the
             app's. It was brass, on the reasoning that nothing
             inside a game may wear Saathban's colour — still true,
             and #1FA83C is not Saathban's. It is the one thing you
             press in here and the only round thing on the screen. */
          border: "none",
          background: GREEN,
          color: "#FFFFFF",
          fontFamily: "inherit",
          fontSize: ts(24),
          fontWeight: 800,
          cursor: busy ? "default" : "pointer",
          boxShadow: "0 10px 24px rgba(0,0,0,0.45), 0 3px 8px rgba(0,0,0,0.35)",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {t("games.new.start")}
      </button>
    </>
  );
}
