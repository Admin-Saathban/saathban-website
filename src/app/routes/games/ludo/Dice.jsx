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

   A SPENT DIE IS DIM, AND CARRIES NOTHING. It used to wear a ✓ for
   used and a ✕ for a die with nowhere to go, and the ✕ reads as an
   error — the owner saw one on his own board and took it for a
   fault. Nothing went wrong: a five with no legal move is an
   ordinary turn of ludo.

   So a spent die simply drops to 45% and the message strip says
   what happened in words, which it already did. Dim is not the
   only signal — the sentence is.
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
        <circle key={i} cx={at(cx)} cy={at(cy)} r={pip} fill={ink} opacity={faint ? 0.26 : 1} />
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
  /* Somebody else's turn. It used to fade the WHOLE die to 74%,
     which on a midnight table turned an ivory object into a grey
     one with slightly darker circles on it — the owner read that
     as hollow, ring-style pips, and he was describing exactly what
     was on the screen.

     An idle die is a die. It keeps its ivory body and its solid
     #2B2B2B pips at full strength; what recedes is the shadow it
     casts, because an object nobody is about to pick up does not
     lift off the table. Whose turn it is was never this control's
     job — the breathing arrow says it. */
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
        opacity: spent ? 0.45 : 1,
        /* 600ms a turn, eased so it leaves fast and settles —
           linear at 420ms was what made it read as a shake. */
        animation:
          state === "rolling"
            ? "saath-tumble 0.6s cubic-bezier(.22,.7,.36,1) infinite"
            : undefined,
        /* Matte, and it sits on the table rather than glowing on it. */
        filter: dim
          ? "drop-shadow(0 1px 3px rgba(0,0,0,0.35))"
          : "drop-shadow(0 3px 6px rgba(0,0,0,0.45))",
      }}
    >
      {value ? (
        <DieFace value={value} size={size} ink={PIP} />
      ) : (
        /* NOTHING ROLLED YET, AND NOTHING TO CLAIM. A hardcoded
           `|| 1` claimed a number nobody threw; a truly empty face
           fixed the lie and produced a plain ivory square that read
           as an empty card. Faint pips are unmistakably a die and
           claim nothing.

           This is now the ONLY faint thing on a die, and it is the
           first roll of a table only — every seat that has thrown
           keeps its last face, so the board fills with real dice
           within a turn. */
        <DieFace value={5} size={size} ink={PIP} faint />
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
      /* ON TOUCH-DOWN, NOT TOUCH-UP. A die that answers when your
         finger LIFTS feels like a delay even when nothing is slow,
         because the gap between pressing and releasing is a tenth
         of a second you did not know you were spending. The
         browser's own click follows and is suppressed. */
      onPointerDown={(e) => {
        e.preventDefault();
        onClick?.();
      }}
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
