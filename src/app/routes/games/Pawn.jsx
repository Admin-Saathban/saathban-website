/* ════════════════════════════════════════════════
   A goti — the real playing piece, and the main object on its
   square.

   IT IS A PIN. A ball head over a cone that flares to a rounded
   base, which is what a ludo piece has been since before any of this
   was on a screen.

   It was a disc, and the argument for a disc was written down here
   and was a real one: a disc stacks legibly and a pin silhouette
   does not, so a jota — two of your gotis on one square — would read
   better as two chips than as two pins. The owner ruled for the pin,
   and the jota is answered instead by the ring drawn round the pair
   on the board, which says the same thing in a way that does not
   cost every OTHER piece its shape.

   ONE GRADIENT DOES THE WHOLE PIECE — white highlight at 35/30, the
   colour's light end, its own hue, its deep end — and the head and
   the cone share it. Two separate gradients would light them from
   two different places and the piece would come apart at the neck.

   NOTHING IS DRAWN ON TOP OF IT. A numeral, then a crown, then a
   player's chosen emoji, then a mood badge at the shoulder — four
   things have been printed on this piece and all four are gone now.
   The complaint each of them answered was that you could not tell
   your four gotis apart, and what actually answered it was SIZE: a
   pin that fills its square is unmistakable, and a small glyph on
   top of one reads as debris from an older design. Which is what it
   had become.

   The gradient is defined inline with an id per SEAT rather than per
   instance. A document ends up with several identical definitions of
   the same id and the first wins — which is the correct answer here,
   because they ARE identical. The alternative is a shared defs block
   every caller must remember to render, and a goti that silently
   turns black when one forgets.
   ════════════════════════════════════════════════ */

import { SEAT_COLORS, SEAT_LIGHT, SEAT_DEEP } from "./seatColors.js";

export default function Pawn({
  seat = 0,
  cx,
  cy,
  r = 15,
  /* WHICH of this seat's four this is. Kept for the accessible name
     the caller builds; nothing is drawn from it. Null for a goti
     drawn outside a game — the setup room's colour swatches — where
     there is no piece to name. */
  piece = null,
  dim = false,
  spin = 0,
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
  const light = SEAT_LIGHT[idx];
  const deep = SEAT_DEEP[idx];
  const gid = `sb-goti-${idx}`;
  const s = r / 15; // everything below is drawn for r = 15 and scaled

  return (
    /* A piece stands up whichever way the board is turned, so the
       POV rotation is undone here before anything is drawn. */
    <g
      transform={`translate(${cx} ${cy})${spin ? ` rotate(${-spin})` : ""}${tilt ? " rotate(-7)" : ""} scale(${s})`}
      opacity={dim ? 0.45 : 1}
    >
      <defs>
        {/* THE BODY, lit from the upper left like everything else on
            this board: a white highlight at 35/30, then the colour's
            light end, its own hue, and its deep end at the foot. One
            gradient does the whole pin, so the head and the cone are
            unmistakably one moulded object rather than a ball sitting
            on a cone. */}
        <radialGradient id={`${gid}-pin`} cx="35%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="22%" stopColor={light} />
          <stop offset="62%" stopColor={fill} />
          <stop offset="100%" stopColor={deep} />
        </radialGradient>
      </defs>

      {/* THE SHADOW IT CASTS, blurred and offset down and to the
          right, because the light is up and to the left. In its own
          group: a lifting goti must leave its shadow on the board,
          and a shadow that rises with the thing casting it is the one
          cue that reads instantly as fake. */}
      <g className="sb-goti-shadow">
        <ellipse cx="2.2" cy="14.4" rx="12.6" ry="3.9" fill="#00000038" style={{ filter: "blur(1.8px)" }} />
      </g>

      <g className="sb-goti-body">
        {/* THE CONE, flaring from the neck to a rounded base. Drawn as
            one path so the rim stroke runs round the silhouette
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
        {/* the small white highlight on the head — the one thing that
            says the head is round rather than a disc */}
        <ellipse cx="-2.7" cy="-10.2" rx="3.0" ry="2.0" fill="#FFFFFF" opacity="0.78" transform="rotate(-24 -2.7 -10.2)" />
        {/* a soft light along the top of the flare, so the cone is not
            a flat triangle under a lit ball */}
        <ellipse cx="-4.4" cy="4.6" rx="3.4" ry="5.6" fill="#FFFFFF" opacity="0.16" transform="rotate(-18 -4.4 4.6)" />
      </g>
      {label && <title>{label}</title>}
    </g>
  );
}
