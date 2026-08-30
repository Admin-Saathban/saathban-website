/* ════════════════════════════════════════════════
   A goti — the real playing piece, not a coloured dot.

   Drawn as a pawn seen slightly from above: a round head, a waisted
   body, a wide base, and one soft highlight so it reads as an object
   sitting ON the board rather than a mark printed on it. The shape
   alone tells you it's a piece; the colour tells you whose.

   Colour is never the only signal (a house rule everywhere in this
   app): each goti carries its seat's numeral on the base, small and
   quiet — enough to settle "which of these is mine?" for anyone who
   can't rely on the four hues.

   GLOSS. The piece is lit from the upper left: a gradient down the
   body from a paler crown to a deeper foot, a bright specular on the
   head, and a soft contact shadow on the square beneath. Flat colour
   read as a sticker printed on the board; this reads as an object
   resting on it, which is the difference between a board you look at
   and a board you play.

   The gradients are defined inline, with an id per SEAT rather than
   per instance. A document ends up with several identical definitions
   of the same id, and the first wins — which is the correct answer
   here, because they ARE identical. The alternative is a shared defs
   block every caller must remember to render, and a goti that
   silently turns black when one forgets.
   ════════════════════════════════════════════════ */

import { SEAT_COLORS, SEAT_INK } from "./seatColors.js";

/* cx, cy: centre of the square the piece stands on.
   r: roughly the radius it should occupy. */
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
  showSeat = true,
  dim = false,
  spin = 0,
  mood = null,
}) {
  const idx = seat % SEAT_COLORS.length;
  const fill = SEAT_COLORS[idx];
  const ink = SEAT_INK[idx];
  const gid = `sb-goti-${idx}`;
  const s = r / 15; // everything below is drawn for r = 15 and scaled

  return (
    /* A piece stands up whichever way the board is turned, so the
       POV rotation is undone here before anything is drawn. */
    <g
      transform={`translate(${cx} ${cy})${spin ? ` rotate(${-spin})` : ""} scale(${s})`}
      opacity={dim ? 0.45 : 1}
    >
      <defs>
        {/* lit from the upper left: pale crown, deep foot */}
        <linearGradient id={gid} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="38%" stopColor={fill} />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
        <radialGradient id={`${gid}-dome`} cx="34%" cy="28%" r="76%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="42%" stopColor={fill} />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.34" />
        </radialGradient>
      </defs>
      {/* the contact shadow: tighter and darker under the foot than a
          flat blob, so the piece looks like it is touching down */}
      <ellipse cx="0.6" cy="12.6" rx="11.2" ry="3.2" fill="#00000033" />
      <ellipse cx="0" cy="12.2" rx="7.6" ry="2.1" fill="#0000003d" />
      {/* base */}
      <ellipse cx="0" cy="10.5" rx="11" ry="4.2" fill={fill} />
      <ellipse cx="0" cy="9.4" rx="11" ry="4.2" fill={`url(#${gid})`} stroke="#00000030" strokeWidth="0.8" />
      {/* body: a waisted stem rising from the base to the collar */}
      <path
        d="M -7.4 9 C -6.2 3.6, -3.4 2.2, -3.1 -1.2 L 3.1 -1.2 C 3.4 2.2, 6.2 3.6, 7.4 9 Z"
        fill={`url(#${gid})`}
        stroke="#00000030"
        strokeWidth="0.8"
      />
      {/* collar */}
      <ellipse cx="0" cy="-1.4" rx="4.6" ry="1.7" fill={`url(#${gid})`} stroke="#00000030" strokeWidth="0.7" />
      {/* head: a dome rather than a disc */}
      <circle cx="0" cy="-6.2" r="5.6" fill={`url(#${gid}-dome)`} stroke="#ffffff4d" strokeWidth="0.9" />
      {/* the specular — small, bright and off-centre, which is what
          the eye reads as "shiny" rather than "pale" */}
      <ellipse cx="-1.9" cy="-8" rx="2.0" ry="1.35" fill="#ffffff" opacity="0.9" transform="rotate(-25 -1.9 -8)" />
      <ellipse cx="1.6" cy="-4.2" rx="1.5" ry="0.9" fill="#ffffff" opacity="0.28" transform="rotate(-20 1.6 -4.2)" />
      {/* The face rides above the gloss, or the specular sits on top of
          an eye and reads as a cataract. */}
      <Face mood={mood} />
      {showSeat && (
        <text
          x="0"
          y="11.4"
          textAnchor="middle"
          fontSize="6.2"
          fontWeight="800"
          fontFamily="DM Sans, sans-serif"
          fill={ink}
        >
          {seat + 1}
        </text>
      )}
    </g>
  );
}
