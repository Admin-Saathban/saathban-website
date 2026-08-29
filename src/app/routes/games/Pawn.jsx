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
   ════════════════════════════════════════════════ */

import { SEAT_COLORS, SEAT_INK } from "./seatColors.js";

/* cx, cy: centre of the square the piece stands on.
   r: roughly the radius it should occupy. */
export default function Pawn({ seat = 0, cx, cy, r = 15, showSeat = true, dim = false, spin = 0 }) {
  const fill = SEAT_COLORS[seat % SEAT_COLORS.length];
  const ink = SEAT_INK[seat % SEAT_INK.length];
  const s = r / 15; // everything below is drawn for r = 15 and scaled

  return (
    /* A piece stands up whichever way the board is turned, so the
       POV rotation is undone here before anything is drawn. */
    <g
      transform={`translate(${cx} ${cy})${spin ? ` rotate(${-spin})` : ""} scale(${s})`}
      opacity={dim ? 0.45 : 1}
    >
      {/* the shadow it casts on the square */}
      <ellipse cx="0" cy="12.5" rx="12" ry="3.6" fill="#00000026" />
      {/* base */}
      <ellipse cx="0" cy="10.5" rx="11" ry="4.2" fill={fill} />
      <ellipse cx="0" cy="9.4" rx="11" ry="4.2" fill={fill} stroke="#00000022" strokeWidth="0.8" />
      {/* body: a waisted stem rising from the base to the collar */}
      <path
        d="M -7.4 9 C -6.2 3.6, -3.4 2.2, -3.1 -1.2 L 3.1 -1.2 C 3.4 2.2, 6.2 3.6, 7.4 9 Z"
        fill={fill}
        stroke="#00000022"
        strokeWidth="0.8"
      />
      {/* collar */}
      <ellipse cx="0" cy="-1.4" rx="4.6" ry="1.7" fill={fill} stroke="#00000022" strokeWidth="0.7" />
      {/* head */}
      <circle cx="0" cy="-6.2" r="5.6" fill={fill} stroke="#ffffff55" strokeWidth="0.9" />
      {/* one highlight, top-left, so the whole thing reads as rounded */}
      <ellipse cx="-1.9" cy="-7.8" rx="2.1" ry="1.5" fill="#ffffff70" transform="rotate(-25 -1.9 -7.8)" />
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
