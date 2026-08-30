/* ════════════════════════════════════════════════
   A goti — the real playing piece, and the main object on its square.

   IT USED TO BE A DOT IN A BOX. A waisted pawn about half a cell wide,
   with the SEAT number set 6px tall against its foot. Two complaints
   from the user, both fair: the pieces are too small to be the thing
   you look at, and you cannot tell which of your four you are about to
   move. The second was worse than it sounds, because the numeral was
   the SEAT — the same digit on all four of your gotis — so it answered
   a question nobody was asking while the real one went unanswered.

   So: a round token, wide enough to dominate its cell, carrying a big
   numeral that says WHICH PIECE THIS IS. LUDO_UI_SPEC §6 asks for
   glossy round tokens with a highlight and a drop shadow, "pieces you
   could pick up", and is explicit that our stacks must read better
   than the reference's pin-shaped ones. A disc stacks legibly; a pawn
   silhouette does not.

   IDENTITY IS THE MARK, NEVER THE COLOUR. Colour is the seat and only
   the seat — the four hues are assigned at setup and a player keeps
   theirs — so the mark is what separates your four from each other. It
   defaults to the piece's number, drawn nearly the width of the token,
   and any short string can be passed instead: a player's own emoji,
   once there is somewhere to store that choice. The mark is a
   parameter here and nothing else. The picker and its storage belong
   to whoever owns player preferences, and this file does not care
   which string it is handed.

   DEPTH. A side wall in the seat's deep tone beneath a domed top, a
   bright specular up and left, an inset turned ring, and a two-part
   contact shadow — tight and dark where the token touches, soft and
   wide around it. Flat colour read as a sticker printed on the board.
   This reads as an object resting on it, which is the whole difference
   between a board you look at and a board you want to touch.

   A MOOD IS A BADGE, NOT THE FACE OF THE TOKEN. Identity outranks
   expression: the numeral holds the middle and a worried or smug face
   sits in a small badge at the shoulder, so a reaction can never cost
   you the ability to tell your gotis apart.

   The gradients are defined inline, with an id per SEAT rather than
   per instance. A document ends up with several identical definitions
   of the same id, and the first wins — which is the correct answer
   here, because they ARE identical. The alternative is a shared defs
   block every caller must remember to render, and a goti that
   silently turns black when one forgets.
   ════════════════════════════════════════════════ */

import { SEAT_COLORS, SEAT_INK, SEAT_LIGHT, SEAT_DEEP } from "./seatColors.js";

/* What a goti wears when nobody has chosen anything: its own number.
   Not the seat's — the seat is the colour. */
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

  const worn = mark ?? (piece === null ? null : defaultMark(piece));
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
        {/* the top face, lit from the upper left */}
        <radialGradient id={`${gid}-dome`} cx="33%" cy="27%" r="82%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
          <stop offset="26%" stopColor={light} />
          <stop offset="72%" stopColor={fill} />
          <stop offset="100%" stopColor={deep} />
        </radialGradient>
        {/* the side wall: darker at the foot, so it has real thickness */}
        <linearGradient id={`${gid}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* CONTACT SHADOW, two parts. The wide soft one is the shade a
          solid object gathers around itself; the tight dark one is
          where it actually touches down. Either alone reads as blur.

          IN ITS OWN GROUP, because a lifting goti must leave its
          shadow on the board. Animating the whole piece upward takes
          the shadow with it, and a shadow that rises with the object
          casting it is the one thing that reads instantly as fake.
          The hop shrinks this to 0.7 while the token climbs. */}
      <g className="sb-goti-shadow">
        <ellipse cx="0.8" cy="6.2" rx="14.4" ry="4.6" fill="#00000026" />
        <ellipse cx="0" cy="4.8" rx="10.6" ry="2.9" fill="#00000038" />
      </g>
      <g className="sb-goti-body">

      {/* the side wall — the same disc, dropped, so the token has a
          thickness you can see instead of being a printed circle */}
      <circle cx="0" cy="2.6" r="13.6" fill={`url(#${gid}-wall)`} />
      <circle cx="0" cy="2.6" r="13.6" fill="none" stroke="#00000033" strokeWidth="0.7" />

      {/* the top */}
      <circle cx="0" cy="0" r="13.6" fill={`url(#${gid}-dome)`} />
      <circle cx="0" cy="0" r="13.6" fill="none" stroke="#00000030" strokeWidth="0.9" />
      {/* an inset ring, the way a real token is turned on a lathe */}
      <circle cx="0" cy="0" r="10.9" fill="none" stroke="#FFFFFF" strokeOpacity="0.34" strokeWidth="1.1" />
      <circle cx="0" cy="0" r="10.2" fill="none" stroke="#00000022" strokeWidth="0.7" />

      {/* THE MARK, nearly the width of the token, because the entire
          point is that it is readable without leaning in. Haloed
          against its own gloss — dark halo on a light token, light on
          a dark one — so it holds whichever seat it belongs to. */}
      {showSeat && worn && (
        <text
          x="0"
          y="0"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={isGlyph ? 15 : 17}
          fontWeight="800"
          fontFamily="DM Sans, sans-serif"
          fill={isGlyph ? undefined : ink}
          stroke={isGlyph ? undefined : ink === "#FFFFFF" ? "#00000055" : "#FFFFFF66"}
          strokeWidth={isGlyph ? undefined : 2.4}
          paintOrder="stroke"
          style={{ userSelect: "none" }}
        >
          {worn}
        </text>
      )}

      {/* the specular — small, bright and off-centre, which is what
          the eye reads as "shiny" rather than "pale" */}
      <ellipse cx="-5.2" cy="-7.4" rx="4.3" ry="2.5" fill="#ffffff" opacity="0.72" transform="rotate(-28 -5.2 -7.4)" />
      <ellipse cx="5.6" cy="6.4" rx="3.2" ry="1.5" fill="#ffffff" opacity="0.16" transform="rotate(-20 5.6 6.4)" />

      {/* MOOD, as a badge at the shoulder. It never covers the mark:
          knowing WHICH goti this is matters more than knowing how it
          feels about its situation. */}
      {mood && (
        <g transform="translate(9.6 -9.6) scale(0.66)">
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
