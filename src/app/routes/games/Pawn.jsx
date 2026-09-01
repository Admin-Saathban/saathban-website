/* ════════════════════════════════════════════════
   A goti — the real playing piece, and the main object on its
   square.

   IT IS A PIN. A ball head over a cone that flares to a rounded
   base, which is what a ludo piece has been since before any of
   this was on a screen.

   It was a disc, and the argument for a disc was written down
   here and was a real one: a disc stacks legibly and a pin
   silhouette does not, so a jota — two of your gotis on one
   square — would read better as two chips than as two pins. The
   owner has ruled for the pin, and the jota is answered instead
   by the ring drawn round the pair on the board, which says the
   same thing in a way that does not cost every OTHER piece its
   shape. Three-dimensional-looking pieces are most of what makes
   a board look like a board rather than a diagram of one.

   ONE GRADIENT DOES THE WHOLE PIECE — white highlight at 35/30,
   the colour's light end, its own hue, its deep end — and the
   head and the cone share it. Two separate gradients would light
   them from two different places and the piece would come apart
   at the neck.

   IDENTITY IS THE SHAPE AND THE COLOUR, NEVER A NUMERAL. Colour
   is the seat and only the seat. A caller may still pass a mark —
   a player's chosen emoji — and it draws low on the flare, but
   there is no automatic number: four numbered pieces read as
   counters in a spreadsheet.

   A MOOD IS A BADGE AT THE SHOULDER, never the face of the piece.

   The gradient is defined inline with an id per SEAT rather than
   per instance. A document ends up with several identical
   definitions of the same id and the first wins — which is the
   correct answer here, because they ARE identical. The
   alternative is a shared defs block every caller must remember
   to render, and a goti that silently turns black when one
   forgets.
   ════════════════════════════════════════════════ */

import { SEAT_COLORS, SEAT_INK, SEAT_LIGHT, SEAT_DEEP } from "./seatColors.js";

/* Kept for callers that ask for a numeral explicitly — the seat
   sheet's goti-mark picker offers it as one choice among the
   emoji. Nothing on the board calls it: a goti wears nothing
   unless its owner has chosen something. */
export const defaultMark = (pieceIdx) => String((pieceIdx ?? 0) + 1);

/* A goti's face.

   Two eyes and a mouth, and only ever when there is something to feel:
   a piece that is neither in danger nor safe has no face at all, so
   the ones that DO carry meaning stand out instead of being lost in a
   board of expressions.

   WORRIED is an enemy within reach behind you. SMUG is standing on a
   stop where nothing can touch you. Both are things a player could
   work out by counting squares, which is exactly why they are worth
   drawing: the board doing the counting is the difference between a
   game you can follow and one you have to audit.

   Never a face for being BEHIND, or slow, or losing. Danger and safety
   only — the standing rule is cheeky, never cruel, and a goti that
   looked sad about its owner's position would be the cruel version. */
function Face({ mood }) {
  if (!mood) return null;
  const worried = mood === "worried";
  return (
    <g aria-hidden="true">
      <circle cx="-2.1" cy="-6.6" r="0.95" fill="#20180C" />
      <circle cx="2.1" cy="-6.6" r="0.95" fill="#20180C" />
      {worried ? (
        <>
          {/* brows tipped in, and a small flat mouth */}
          <path d="M -3.4 -8.6 L -1.1 -7.9" stroke="#20180C" strokeWidth="0.7" strokeLinecap="round" />
          <path d="M 3.4 -8.6 L 1.1 -7.9" stroke="#20180C" strokeWidth="0.7" strokeLinecap="round" />
          <path d="M -1.8 -4.1 Q 0 -5.1 1.8 -4.1" fill="none" stroke="#20180C" strokeWidth="0.75" strokeLinecap="round" />
        </>
      ) : (
        /* smug: one raised brow and a small crooked smile */
        <>
          <path d="M 1.0 -8.5 Q 2.2 -9.2 3.4 -8.6" fill="none" stroke="#20180C" strokeWidth="0.7" strokeLinecap="round" />
          <path d="M -1.9 -4.4 Q 0.2 -3.2 2.0 -4.9" fill="none" stroke="#20180C" strokeWidth="0.8" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

export default function Pawn({
  seat = 0,
  cx,
  cy,
  r = 15,
  /* WHICH of this seat's four this is. Drives the default mark and the
     accessible name. Null for a goti drawn outside a game — the setup
     screen's colour swatches — where there is no piece to name. */
  piece = null,
  /* What is written on it. A numeral by default, but any short string
     renders the same way, which is where a player's chosen emoji will
     arrive without this file changing. */
  mark = null,
  showSeat = true,
  dim = false,
  spin = 0,
  mood = null,
  /* Leaning into the run home. LUDO_MOTION_SPEC §3 asks for a slight
     inward tilt on the home column, and it is doing real work rather
     than decorating: the home column is the only place a goti travels
     that is not the ring, and the lean is how the board says so
     without a label. Small on purpose — a piece that looks like it is
     falling over is not a piece that looks like it is turning. */
  tilt = false,
  label = null,
}) {
  const idx = seat % SEAT_COLORS.length;
  const fill = SEAT_COLORS[idx];
  const ink = SEAT_INK[idx];
  const light = SEAT_LIGHT[idx];
  const deep = SEAT_DEEP[idx];
  const gid = `sb-goti-${idx}`;
  const s = r / 15; // everything below is drawn for r = 15 and scaled

  /* NO NUMERALS, and none by default.

     They were on the face once, and the argument for them was
     real: the owner could not tell which of their four gotis was
     which, and a numeral answers that directly.
     GAMES_IMMERSION_SPEC §5 overruled it — "numbers make the board
     a diagram" — and the original complaint was really that the
     pieces were TINY. They are very nearly the whole square now,
     which answers it without printing anything on them.

     A caller may still pass an explicit mark — a player's chosen
     emoji — and it draws low on the flare. What has gone is the
     automatic numeral. */
  const worn = mark ?? null;
  /* An emoji repainted in the ink colour becomes a silhouette; a digit
     left unpainted vanishes on a dark token. So the two are drawn
     differently, and which one this is decides itself. */
  const isGlyph = !!worn && !/^[0-9]+$/.test(worn);

  return (
    /* A piece stands up whichever way the board is turned, so the
       POV rotation is undone here before anything is drawn. */
    <g
      transform={`translate(${cx} ${cy})${spin ? ` rotate(${-spin})` : ""}${tilt ? " rotate(-7)" : ""} scale(${s})`}
      opacity={dim ? 0.45 : 1}
    >
      <defs>
        {/* THE BODY, lit from the upper left like everything else
            on this board: a white highlight at 35/30, then the
            colour's light end, its own hue, and its deep end at
            the foot. One gradient does the whole pin, so the head
            and the cone are unmistakably one moulded object
            rather than a ball sitting on a cone. */}
        <radialGradient id={`${gid}-pin`} cx="35%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="22%" stopColor={light} />
          <stop offset="62%" stopColor={fill} />
          <stop offset="100%" stopColor={deep} />
        </radialGradient>
      </defs>

      {/* THE SHADOW IT CASTS, blurred and offset down and to the
          right, because the light is up and to the left. In its
          own group: a lifting goti must leave its shadow on the
          board, and a shadow that rises with the thing casting it
          is the one cue that reads instantly as fake. */}
      <g className="sb-goti-shadow">
        <ellipse cx="2.2" cy="14.4" rx="12.6" ry="3.9" fill="#00000038" style={{ filter: "blur(1.8px)" }} />
      </g>

      <g className="sb-goti-body">
      {/* THE CONE, flaring from the neck to a rounded base. Drawn
          as one path so the rim stroke runs round the silhouette
          instead of showing a seam where two shapes meet. */}
      <path
        d={
          "M -4.6 -4.2 " +
          "C -6.2 2.0 -10.4 6.4 -13.6 9.4 " +
          "C -15.0 10.7 -14.4 13.2 -12.4 13.2 " +
          "L 12.4 13.2 " +
          "C 14.4 13.2 15.0 10.7 13.6 9.4 " +
          "C 10.4 6.4 6.2 2.0 4.6 -4.2 " +
          "Z"
        }
        fill={`url(#${gid}-pin)`}
        stroke={deep}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* THE BALL HEAD. */}
      <circle cx="0" cy="-7.6" r="8.2" fill={`url(#${gid}-pin)`} stroke={deep} strokeWidth="1.3" />
      {/* the small white highlight on the head — the one thing
          that says the head is round rather than a disc */}
      <ellipse cx="-2.7" cy="-10.2" rx="3.0" ry="2.0" fill="#FFFFFF" opacity="0.78" transform="rotate(-24 -2.7 -10.2)" />
      {/* a soft light along the top of the flare, so the cone is
          not a flat triangle under a lit ball */}
      <ellipse cx="-4.4" cy="4.6" rx="3.4" ry="5.6" fill="#FFFFFF" opacity="0.16" transform="rotate(-18 -4.4 4.6)" />

      {/* WHAT IS WRITTEN ON IT, when anything is. The pin's own
          shape and colour are the identity; a mark is a player's
          chosen emoji and sits low on the flare, where it does not
          fight the head for the eye. */}
      {showSeat && worn && (
        <text
          x="0"
          y="7.4"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={isGlyph ? 9.5 : 10.5}
          fontWeight="800"
          fontFamily="DM Sans, sans-serif"
          fill={isGlyph ? undefined : ink}
          style={{ userSelect: "none" }}
        >
          {worn}
        </text>
      )}

      {/* MOOD, as a badge at the shoulder. It never covers the
          head: knowing WHICH goti this is matters more than knowing
          how it feels about its situation. */}
      {mood && (
        <g transform="translate(9.8 -13.4) scale(0.6)">
          <circle cx="0" cy="0" r="7.6" fill="#FFFDF7" stroke="#00000038" strokeWidth="1.2" />
          <g transform="translate(0 6.4)">
            <Face mood={mood} />
          </g>
        </g>
      )}
      </g>
      {label && <title>{label}</title>}
    </g>
  );
}
