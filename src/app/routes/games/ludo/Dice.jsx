/* ════════════════════════════════════════════════
   The dice — large, in the middle of the board, where a real pair of
   dice would land.

   A die is a real object here: a rounded ivory cube with sunken pips,
   not a number in a box. Size is deliberate — a whole die is a tap
   target, and the tray that holds them is bigger still, so "roll"
   never asks for a precise finger.

   STATE IS NEVER COLOUR ALONE. A die that has been used carries a ✓,
   a die forfeited for want of a legal move carries a ✕ and says so in
   words underneath, and the die you have picked up carries a heavy
   ring. Dim-vs-bright is only ever the second signal.
   ════════════════════════════════════════════════ */

import { COLORS as C } from "../../../../shared/tokens.js";

/* Pip layout per face, on a 3×3 grid of ninths. */
const PIPS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

export function DieFace({ value = 1, size = 46, ink = C.brown }) {
  const v = PIPS[value] ? value : 1;
  const pip = size * 0.13;
  const at = (i) => size * 0.26 + i * size * 0.24;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <rect
        x={1.5}
        y={1.5}
        width={size - 3}
        height={size - 3}
        rx={size * 0.22}
        fill="#fffdf7"
        stroke={ink}
        strokeWidth={2}
      />
      {/* one soft highlight so the die reads as a cube, not a card */}
      <rect
        x={size * 0.13}
        y={size * 0.11}
        width={size * 0.34}
        height={size * 0.16}
        rx={size * 0.08}
        fill="#ffffff"
        opacity={0.85}
      />
      {PIPS[v].map(([cx, cy], i) => (
        <circle key={i} cx={at(cx)} cy={at(cy)} r={pip} fill={ink} />
      ))}
    </svg>
  );
}

/* One die in the tray, with everything a person needs to know about it. */
export default function Die({
  value,
  size = 46,
  state = "ready", // ready | selected | used | wasted | rolling
  label,
  onClick,
  disabled,
}) {
  const spent = state === "used" || state === "wasted";
  const clickable = !!onClick && !disabled && state === "ready";
  const inner = (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: size * 0.24,
        padding: 2,
        border:
          state === "selected"
            ? `3px solid ${C.green}`
            : `3px solid transparent`,
        opacity: spent ? 0.42 : 1,
        animation: state === "rolling" ? "saath-tumble 0.42s linear infinite" : undefined,
      }}
    >
      <DieFace value={value} size={size} />
      {spent && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            insetInlineEnd: -2,
            top: -4,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: state === "used" ? C.green : C.brown,
            color: C.cream,
            fontSize: 13,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {state === "used" ? "✓" : "✕"}
        </span>
      )}
    </span>
  );

  if (!clickable) {
    return (
      <span role="img" aria-label={label}>
        {inner}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={state === "selected"}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        lineHeight: 0,
      }}
    >
      {inner}
    </button>
  );
}
