/* ════════════════════════════════════════════════
   The dice — beside their owner, never in the board's middle, and
   they ARE the roll control. There is no roll bar anywhere.

   A REAL CUBE, IN SPACE. This was a flat SVG square with a CSS
   `rotate()` on it, and the owner named exactly what that is: "it
   should revolve like a ball round, not like a book on your
   finger." A rotation in the plane of the screen has no way to
   show a second face, so the pips were the only thing moving and
   the die read as a token being spun rather than an object being
   thrown.

   So: six faces, `preserve-3d`, a perspective on the wrapper, and
   a throw that turns about two axes at once. The faces you see mid
   throw are the die's OWN other numbers — 1 opposite 6, 2 opposite
   5, 3 opposite 4, the way a die is actually made — which is why
   it reads as one object turning instead of a picture changing.

   IVORY AND MATTE. Body #F8F2E4, edge #D8CCAE, a soft square corner
   and classic round dark pips at #2B2B2B. The white highlight bar
   across the top is gone: it was there to say "this is a cube, not a
   card", and on a midnight table a gloss on a small white object
   reads as a screen element rather than as a die you could pick up.
   The cube's own shading does that job now, and it is honest about
   it — a face turned away from the light is darker because it is
   turned away.

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



import { useEffect, useRef } from "react";

const IVORY = "#F8F2E4";
/* The board's own "this one", the same gold as the halo on a goti
   you may move. Teal is the game's chrome colour and this is not
   chrome — it is a mark on an object lying on the table. */
const IN_PLAY = "#F3CE5E";
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

/* ── The six faces, laid out the way a die is actually made ───────
   Opposite faces sum to seven. That is not decoration: it is what
   makes a tumbling cube read as ONE object. If 1 and 6 were
   adjacent, a quarter turn would show you a pair no real die can
   show, and the eye — which has held a die — would know.

   `transform` places the face; `rest` is the cube rotation that
   brings that face back to the front. They are inverses, and they
   have to stay inverses or a die lands showing the wrong number.  */
const FACES = [
  { v: 1, transform: "" },
  { v: 6, transform: "rotateY(180deg)" },
  { v: 3, transform: "rotateY(90deg)" },
  { v: 4, transform: "rotateY(-90deg)" },
  { v: 2, transform: "rotateX(90deg)" },
  { v: 5, transform: "rotateX(-90deg)" },
];

const REST = {
  1: "rotateX(0deg) rotateY(0deg)",
  6: "rotateX(0deg) rotateY(-180deg)",
  3: "rotateX(0deg) rotateY(-90deg)",
  4: "rotateX(0deg) rotateY(90deg)",
  2: "rotateX(-90deg) rotateY(0deg)",
  5: "rotateX(90deg) rotateY(0deg)",
};

/* How much light each face keeps at rest. The front is lit, the
   sides fall away, the bottom is in shadow — so even a die sitting
   perfectly still reads as having depth rather than as a sticker.
   Applied as a dark wash over the face, never by changing the
   ivory, so every face is the same object under different light. */
const SHADE = {
  1: 0,
  2: 0.06,
  3: 0.14,
  4: 0.14,
  5: 0.22,
  6: 0.1,
};

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
  /* True for the ~1s after the throw resolved: the number is
     being held up to be read. Owned by the session. */
  landing = false,
  label,
  onClick,
  disabled,
}) {
  const spent = state === "used" || state === "wasted";
  const clickable = !!onClick && !disabled && (state === "ready" || state === "selected");
  const rolling = state === "rolling";

  /* ── THE DIE IS TOLD IT HAS LANDED; IT DOES NOT REMEMBER ───────

     This used to arm itself from the EDGE out of `rolling`: a ref
     holding the previous value, and an effect firing when the
     prop went true -> false. It never fired for a person's own
     roll, and the reason took a marked DOM node on the deployed
     build to find — this component is REPLACED twice during a
     single throw.

     Once at the start, because a die you may tap renders a
     <button> and a die that is tumbling renders a <span>: the
     element type changes, so React tears the DOM out. Once more
     at the end, when the answer arrives and the plate rebuilds
     the row from real dice instead of empty ones. Either one is
     enough to reset a ref, so a memory of "what I was a moment
     ago" cannot survive the very transition it exists to watch.

     So the hold is not the die's memory any more, it is the
     TURN'S state, handed down as a prop. The session knows
     exactly when a throw resolved — it is the thing that
     resolved it — and a prop survives any number of remounts
     because it is re-read on every render rather than
     remembered across them.

     The general lesson, which cost this round: never derive
     anything from a previous render in a component whose element
     type or key can change. The state belongs to whoever owns
     the event, not to whoever draws it. */

  /* A SEPARATE THROW EVERY TIME. Two dice thrown from one hand do
     not turn in lockstep — but a DELAY would not have given that,
     because a delayed copy of one path is still that path and the
     pair would show the same faces half a beat apart. They take
     genuinely different routes instead, one leading on X and one
     on Y, and both end square (see the keyframes) so whenever the
     server's answer stops the throw the cube is face-on and the
     turn into the rolled number starts from somewhere known. */
  const seed = useRef(Math.random());
  useEffect(() => {
    if (rolling) seed.current = Math.random();
  }, [rolling]);

  const shown = PIPS[value] ? value : null;

  const cube = (
    <span
      style={{
        position: "relative",
        display: "block",
        width: size,
        height: size,
        transformStyle: "preserve-3d",
        /* At rest it holds the orientation that puts its number at
           the front. Nothing rolled yet has no orientation to hold. */
        transform: rolling ? undefined : REST[shown || 1],
        /* Not instant: when the answer lands the cube turns INTO its
           face rather than cutting to it, which is the deceleration
           the throw has been promising for 700ms. */
        transition: rolling ? "none" : "transform 300ms cubic-bezier(.16,.84,.28,1)",
        animation: rolling
          ? `${seed.current < 0.5 ? "saath-throw" : "saath-throw-b"} 700ms linear infinite`
          : undefined,
      }}
    >
      {FACES.map((f) => (
        <span
          key={f.v}
          style={{
            position: "absolute",
            inset: 0,
            transform: `${f.transform} translateZ(${size / 2}px)`,
            backfaceVisibility: "hidden",
            lineHeight: 0,
          }}
        >
          <DieFace
            value={f.v}
            size={size}
            ink={PIP}
            faint={shown == null && !rolling && f.v === 5}
          />
          {/* The light. A wash rather than a different ivory, so
              the faces stay one object. */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: (9 / 38) * size,
              background: `rgba(24,18,8,${SHADE[f.v]})`,
              pointerEvents: "none",
            }}
          />
        </span>
      ))}
    </span>
  );

  const inner = (
    <span
      className={landing && !rolling ? "sb-die-land" : undefined}
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: (11 / 38) * size,
        /* THE DIE YOU ARE HOLDING. Teal, like every other
           "this one" in the game — gold here was chrome
           wearing the board's colour, and it read as the
           goti halo having escaped onto the controls. */
        /* ── NOTHING ON A TABLE IS HALF-DRAWN ──────────────────

             A spent die used to drop to 45%, and the owner reads a
             faded object as a rendering fault rather than as a
             state — which is the same thing that happened to the
             idle die two rounds ago, when dimming the whole die
             made its solid pips look hollow. Twice now, the same
             mechanism: a partly-transparent object on a dark
             ground does not read as "finished with", it reads as
             "not finished drawing".

             So both dice stay at full strength always, and the
             GOLD HALO marks the one in play. A mark that is added
             to the live thing cannot be mistaken for the display
             failing, and gold is the board's own "this one" —
             the same colour as the halo on a movable goti. ── */
        outline: state === "selected" ? `3px solid ${IN_PLAY}` : "none",
        outlineOffset: 2,
        boxShadow: state === "selected" ? `0 0 12px ${IN_PLAY}80` : "none",
        /* THE DEPTH THE CUBE IS TURNING IN. Small relative to the
           die — a shallow perspective on a 38px object is what makes
           a near face grow as it comes round, and that growth is the
           whole difference between a cube and a hexagon. */
        perspective: size * 4.5,
        /* Matte, and it sits on the table rather than glowing on it. */
        filter: dim
          ? "drop-shadow(0 1px 3px rgba(0,0,0,0.35))"
          : "drop-shadow(0 3px 6px rgba(0,0,0,0.45))",
      }}
    >
      {cube}
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
