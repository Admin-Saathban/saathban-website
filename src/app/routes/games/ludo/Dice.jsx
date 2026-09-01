/* ════════════════════════════════════════════════
   The dice — beside their owner, never in the board's middle, and
   they ARE the roll control. There is no roll bar anywhere.

   IVORY AND MATTE. Body #F8F2E4, edge #D8CCAE, a soft square corner
   and classic round dark pips at #2B2B2B. The white highlight bar
   across the top is gone: it was there to say "this is a cube, not a
   card", and on a midnight table a gloss on a small white object
   reads as a screen element rather than as a die you could pick up.
   The edge does that job instead.

   A die is a real object here, and a whole die is a tap target — so
   "roll" never asks for a precise finger.

   STATE IS NEVER COLOUR ALONE. A die that has been used carries a ✓,
   a die forfeited for want of a legal move carries a ✕, and the one
   you have picked up carries a heavy ring. Dim-versus-bright is only
   ever the second signal.
   ════════════════════════════════════════════════ */

const IVORY = "#F8F2E4";
const EDGE = "#D8CCAE";
const PIP = "#2B2B2B";

/* Pip layout per face, on a 3×3 grid of ninths. */
const PIPS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

export function DieFace({ value = 1, size = 38, ink = PIP, faint = false }) {
  const v = PIPS[value] ? value : 1;
  const pip = size * 0.115;
  const at = (i) => size * 0.26 + i * size * 0.24;
  /* Radius 9 at the size the table draws them, scaling with anything
     drawn larger or smaller. */
  const rx = (9 / 38) * size;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <rect
        x={1}
        y={1}
        width={size - 2}
        height={size - 2}
        rx={rx}
        fill={IVORY}
        stroke={EDGE}
        strokeWidth={2}
      />
      {PIPS[v].map(([cx, cy], i) => (
        <circle key={i} cx={at(cx)} cy={at(cy)} r={pip} fill={ink} opacity={faint ? 0.22 : 1} />
      ))}
    </svg>
  );
}

/* One die beside its player, with everything a person needs to know
   about it. */
export default function Die({
  value,
  size = 38,
  state = "ready", // ready | selected | used | wasted | rolling
  /* Somebody else's turn: their dice are visible but recede. Never
     the only signal — the arrow at the active player's dice is. */
  dim = false,
  label,
  onClick,
  disabled,
}) {
  const spent = state === "used" || state === "wasted";
  const clickable = !!onClick && !disabled && (state === "ready" || state === "selected");
  const inner = (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: (11 / 38) * size,
        padding: 2,
        border: state === "selected" ? "3px solid #F3CE5E" : "3px solid transparent",
        opacity: spent ? 0.42 : dim ? 0.74 : 1,
        animation: state === "rolling" ? "saath-tumble 0.42s linear infinite" : undefined,
        /* Matte, and it sits on the table rather than glowing on it. */
        filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.45))",
      }}
    >
      {value ? (
        <DieFace value={value} size={size} ink={spent ? "#8A8378" : PIP} />
      ) : (
        /* GHOSTED, not blank, and not a guess either. A hardcoded
           `|| 1` claimed a number nobody rolled; a truly empty face
           fixed the lie and produced a plain ivory square that read as
           an empty card. Faint pips are unmistakably a die and claim
           nothing — the eye reads them as the texture of an object. */
        <DieFace value={5} size={size} ink={PIP} faint />
      )}
      {spent && (
        /* Outside the face, on the corner, so it never sits on top of
           the pips it is describing. */
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            insetInlineEnd: -5,
            bottom: -5,
            width: 18,
            height: 18,
            borderRadius: 9,
            background: state === "used" ? "#1FA83C" : "#5E3C1B",
            color: "#FFFFFF",
            fontSize: 12,
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          }}
        >
          {state === "used" ? "✓" : "✕"}
        </span>
      )}
    </span>
  );

  if (!clickable) {
    return (
      <span
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        style={{ display: "inline-flex" }}
      >
        {inner}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="sb-pressable"
      onClick={onClick}
      aria-label={label}
      aria-pressed={state === "selected"}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        lineHeight: 0,
        /* A whole die is the target, and it clears 48px with the
           padding the wrapper already carries. */
        minWidth: 48,
        minHeight: 48,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {inner}
    </button>
  );
}
