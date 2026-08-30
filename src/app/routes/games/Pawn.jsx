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
export default function Pawn({ seat = 0, cx, cy, r = 15, showSeat = true, dim = false, spin = 0 }) {
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
