/* ════════════════════════════════════════════════
   A playing piece — the same pin ludo uses, in eight colours.

   IT IS DELIBERATELY THE SAME OBJECT. The silhouette, the single
   radial gradient that runs head-to-foot, the white catchlight on the
   ball, the soft light down the flare and the blurred shadow offset
   down-right are all lifted from Pawn.jsx to the number, because two
   games in one app that draw "a playing piece" two different ways
   have two different toys in them.

   It is a separate component only because Pawn takes a SEAT and looks
   its colour up in ludo's four; here the colour is a person's own
   choice out of eight, made when they sit down. Same drawing, one
   different question asked of it.

   ONE GRADIENT DOES THE WHOLE PIECE. Two — one for the ball, one for
   the cone — light the piece from two places and it comes apart at
   the neck. The id is per-COLOUR rather than per-instance: a document
   ends up holding several identical definitions of one id and the
   first wins, which is the right answer when they are identical, and
   avoids a shared defs block that every caller has to remember or the
   piece silently turns black.
   ════════════════════════════════════════════════ */

import { colorOf } from "./skins.js";

export default function Pin({
  cx,
  cy,
  r = 4,
  colorIdx = 0,
  label = null,
  /* Mid-slide or mid-climb: the piece is off the paper, so it throws
     a longer, softer shadow and rides a little higher. Nothing else
     about it changes — a piece that also grows or glows stops being
     the same object being moved. */
  lifted = false,
  dim = false,
}) {
  const c = colorOf(colorIdx);
  const gid = `sb-pin-${c.key}`;
  /* Drawn for r = 15, like Pawn, and scaled — so the two pieces stay
     literally the same shape at any size. */
  const s = r / 15;

  return (
    <g
      transform={`translate(${cx} ${cy}) scale(${s})`}
      opacity={dim ? 0.45 : 1}
      style={{ pointerEvents: "none" }}
    >
      <defs>
        <radialGradient id={`${gid}-pin`} cx="35%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="22%" stopColor={c.light} />
          <stop offset="62%" stopColor={c.body} />
          <stop offset="100%" stopColor={c.deep} />
        </radialGradient>
      </defs>

      {/* The shadow stays on the board while the piece rises. */}
      <ellipse
        cx={lifted ? 4.5 : 2.2}
        cy={lifted ? 17.5 : 14.4}
        rx={lifted ? 13.8 : 12.6}
        ry={lifted ? 4.2 : 3.9}
        fill={lifted ? "#00000030" : "#00000038"}
        style={{ filter: "blur(1.8px)" }}
      />

      <g transform={lifted ? "translate(0 -2.2)" : undefined}>
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
          stroke={c.deep}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <circle cx="0" cy="-7.6" r="8.2" fill={`url(#${gid}-pin)`} stroke={c.deep} strokeWidth="1.3" />
        <ellipse cx="-2.7" cy="-10.2" rx="3.0" ry="2.0" fill="#FFFFFF" opacity="0.78" transform="rotate(-24 -2.7 -10.2)" />
        <ellipse cx="-4.4" cy="4.6" rx="3.4" ry="5.6" fill="#FFFFFF" opacity="0.16" transform="rotate(-18 -4.4 4.6)" />
      </g>
      {label && <title>{label}</title>}
    </g>
  );
}
