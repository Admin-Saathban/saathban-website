/* ════════════════════════════════════════════════
   The board — warm SVG in the Saathban palette, phone-width first,
   drawn to the classic 15×15 layout in board.js.

   POINT OF VIEW: every seated player looks at the board the way they
   would sit at it — their own yard nearest them, bottom-left — so the
   whole board rotates by a quarter turn per seat (povRotation). The
   rotation is presentation only: geometry, moves and the engine never
   change, and every glyph counter-rotates so nothing reads upside
   down. A watcher with no seat gets the neutral orientation.

   Pieces are gotis, not dots (Pawn.jsx), and each carries its seat
   number, because state is never colour alone.

   A JOTA — two of your pieces on one square — is drawn as what it is:
   two gotis leaning against each other inside a ring. The ring is
   DASHED while the pair is still virgin (it may split) and SOLID once
   it has moved as a pair (from then it travels only on even dice, at
   half speed). That is a rule you can see without being told.

   THE DICE ARE NOT HERE ANY MORE. They sat in the middle of the board
   for a while, on the reasoning that thrown dice land in the middle.
   LUDO_UI_SPEC settled it the other way — a die beside each player's
   own face, so the table reads as people rather than as a board with a
   tray on it — and the user confirmed. The children slot that held
   them is gone rather than left dangling; LudoSession stopped passing
   it in de520c0.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { APP_COLORS as C } from "../../../../shared/tokens.js";
import { SEAT_LIGHT, SEAT_DEEP, SEAT_COLOR_NAMES } from "../seatColors.js";
import { NO_SELECT } from "../gameSurface.js";
import Pawn from "../Pawn.jsx";
import { playSound } from "../../../lib/sound.js";
import {
  TRACK,
  HOME_COLUMNS,
  YARD_ORIGIN,
  YARD_SPOTS,
  START_ABS,
  SAFE_ABS,
  absOf,
  nearMissCells,
  SEAT_COLORS,
  PRE_HOME_ABS,
  START_ABS as STARTS,
  cellFor,
  povRotation,
} from "./board.js";
import { allArrows } from "./boardArrows.js";

/* ── The arrows that teach the board ──────────────────────────────
   A first-timer's first question is "which way do I go?", and on a
   real board the cloth answers it. So does this one.

   Three glyphs, one meaning each: a plain chevron for the flow of the
   track, a CURVED arrow where a seat's gotis step out of their yard
   (a doorway, drawn in that seat's colour), and a coloured arrow at
   each arm's tip turning into that seat's home column. Every angle is
   read off the track in boardArrows.js, so the arrows cannot drift out
   of step with the geometry.

   They are drawn UNDER the pieces and at low contrast: an instruction
   for the first game, wallpaper by the tenth, never a thing competing
   with a goti for your eye. */
function Arrow({ kind, cell, angle, seat }) {
  const [c, r] = cell;
  const x = c * CELL + CELL / 2;
  const y = r * CELL + CELL / 2;
  /* SMALL AND GREY, all three kinds. They were drawn in the seat's
     own colour at nearly full opacity — four bright chevrons on a
     board whose colours now mean something, and a coloured arrow
     beside a coloured star square was two glyphs arguing over
     which of them was the information. The reference draws every
     arrow the same quiet grey and lets the squares talk. */
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${angle})`}
      opacity={0.5}
      aria-hidden="true"
      fill="none"
      stroke="#9AA0A6"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "entry" && <path d="M -8 8 Q -8 0 -2 0" />}
      {kind === "flow" && <path d="M -8 0 L 0 0" />}
      {kind === "home" && <path d="M -7 0 L 0 0" />}
      <path d="M -3.6 -4.4 L 1.6 0 L -3.6 4.4" />
    </g>
  );
}

/* A FIVE-POINTED STAR, drawn rather than typed.

   The safe squares were marked with the ★ character, which is a
   different shape in every font on every platform — fat and round
   on one phone, thin and spiky on the next — and it carried a
   heavy stroke to survive being drawn on four saturated colours.
   A path is the same star everywhere and needs no outline to
   hold its edge, which is what lets it sit on a plain white cell
   without looking like a sticker. */
export function starPath(x, y, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.42 : r;
    const a = (-90 + i * 36) * (Math.PI / 180);
    pts.push((x + rad * Math.cos(a)).toFixed(2) + ' ' + (y + rad * Math.sin(a)).toFixed(2));
  }
  return 'M ' + pts.join(' L ') + ' Z';
}

/* THE CROWN AT THE CENTRE OF THE BOARD. Drawn around (0,0) at
   unit scale so the caller places and sizes it in one transform:
   five points, a flat band along the foot, the classic shape a
   ludo board has always finished with. */
const CROWN_D =
  "M -1 0.62 L -1 0.02 L -0.6 0.42 L -0.22 -0.34 L 0 -0.1 " +
  "L 0.22 -0.34 L 0.6 0.42 L 1 0.02 L 1 0.62 Z";

/* Six directions on a ring, deliberately not eight: an odd scatter
   reads as a burst, a regular one reads as a compass rose. */
const SPARKS = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 + 0.35;
  return [Math.cos(a), Math.sin(a)];
});

/* A four-pointed sparkle, drawn rather than typed.

   The second recording is nine seconds of a capture, and what it
   shows is a scatter of soft gold stars at the point of contact
   and along the path the taken piece travels home. No sentence
   anywhere: the board says what happened by what it does.

   Our capture threw straight shards, which reads as an impact
   rather than as the small piece of theatre a capture is. Same
   moment, better shape. */
function sparkPath(x, y, r) {
  const w = r * 0.20;
  return [
    `M ${x} ${y - r}`,
    `Q ${x + w} ${y - w} ${x + r} ${y}`,
    `Q ${x + w} ${y + w} ${x} ${y + r}`,
    `Q ${x - w} ${y + w} ${x - r} ${y}`,
    `Q ${x - w} ${y - w} ${x} ${y - r}`,
    "Z",
  ].join(" ");
}

export const BOARD_MOTION_CSS = `
  @keyframes sb-spark {
    0%   { opacity: 0;   transform: scale(0.2) rotate(-18deg); }
    25%  { opacity: 1;   transform: scale(1.15) rotate(0deg); }
    100% { opacity: 0;   transform: scale(0.75) rotate(12deg); }
  }
  .sb-spark {
    transform-box: fill-box;
    /* Its OWN centre. The shards pivoted on 0% 50% because they
       were lines starting at the capture square; a star is drawn
       around its own middle and has to grow from there. */
    transform-origin: 50% 50%;
    animation: sb-spark 760ms cubic-bezier(.2,.8,.3,1) both;
  }

  /* The ring round a goti you can move, breathing.

     NO SCALE, and not because it looks worse: these pieces are placed
     by cx/cy, so a scale pivots on the SVG origin and throws them off
     the board. Stroke width and opacity both animate safely and pivot
     on nothing. */
  /* THE GOLD HALO, breathing. The WIDTH no longer animates: the
     ring is specified at 3px and a ring that swells to 6.5 is not
     a 3px ring for most of its cycle. Opacity alone still reads as
     alive, and it keeps the halo the same weight as itself. */
  @keyframes sb-pulse {
    0%, 100% { stroke-opacity: 0.45; }
    50%      { stroke-opacity: 1; }
  }
  .sb-pulse { animation: sb-pulse 1200ms ease-in-out infinite; }

  /* The trail fades itself out. No JS timer decides when a cell stops
     glowing — the animation ends and the element is removed a beat
     later by the hook, so a dropped tick cannot leave the board lit. */
  @keyframes sb-trail {
    0%   { opacity: 0.55; }
    100% { opacity: 0;    }
  }
  .sb-trail { animation: sb-trail 900ms ease-out both; }

  /* A goti arriving home: a ring that opens and fades once. */
  @keyframes sb-home {
    0%   { r: 8;  opacity: 0;    stroke-width: 3.4; }
    35%  {        opacity: 0.95;                    }
    100% { r: 20; opacity: 0;    stroke-width: 1.2; }
  }
  .sb-home { animation: sb-home 900ms ease-out both; }

  /* Taken, and tumbling home. Rotation pivots on the piece's own box,
     never the viewport origin. */
  @keyframes sb-tumble-home {
    from { transform: rotate(0deg);   }
    to   { transform: rotate(360deg); }
  }
  .sb-tumble-home {
    transform-box: fill-box;
    transform-origin: 50% 50%;
    /* ONE turn over the arc, and the arc is 600ms. A spin on a
       different clock from the journey it rides reads as two things
       happening at once. */
    animation: sb-tumble-home 600ms linear both;
  }

  /* Three sixes. The board itself, not the page — translate only, so
     nothing pivots and nothing reflows. */
  @keyframes sb-shake {
    0%, 100% { transform: translate(0, 0); }
    15%  { transform: translate(-5px, 1px); }
    30%  { transform: translate(4px, -2px); }
    45%  { transform: translate(-3px, 2px); }
    60%  { transform: translate(3px, 1px); }
    80%  { transform: translate(-2px, 0); }
  }
  .sb-shake { animation: sb-shake 520ms ease-in-out both; }

  /* THE HOP — LUDO_MOTION_SPEC §3: 140ms, ease-out, a 10px lift with
     the shadow shrinking to 0.7. Ten units in a 40-unit cell is a
     quarter of a square, which is the height the reference lifts to.
     The token rises and lands inside the same 140ms the step takes,
     so the cadence the eye counts is unchanged — the lift is what
     makes each count VISIBLE rather than a slide. */
  @keyframes sb-hop-body {
    0%   { transform: translateY(0); }
    45%  { transform: translateY(-10px); }
    100% { transform: translateY(0); }
  }
  @keyframes sb-hop-shadow {
    0%   { transform: scale(1);   opacity: 1; }
    45%  { transform: scale(0.7); opacity: 0.72; }
    100% { transform: scale(1);   opacity: 1; }
  }
  .sb-hop .sb-goti-body {
    animation: sb-hop-body 140ms ease-out both;
  }
  .sb-hop .sb-goti-shadow {
    transform-box: fill-box;
    transform-origin: 50% 50%;
    animation: sb-hop-shadow 140ms ease-out both;
  }

  /* TAKEN. Two hundred milliseconds of not believing it, on the
     square where it happened, before the journey home. */
  @keyframes sb-flinch {
    0%, 100% { transform: translateX(0); }
    20%      { transform: translateX(-2.5px) rotate(-6deg); }
    45%      { transform: translateX(2.5px)  rotate(5deg); }
    70%      { transform: translateX(-1.5px) rotate(-3deg); }
  }
  .sb-flinch {
    transform-box: fill-box;
    transform-origin: 50% 50%;
    animation: sb-flinch 200ms ease-in-out both;
  }

  /* HOME: 1.0 -> 1.25 -> 1.0 over 400ms. The one unambiguously good
     thing that can happen to a piece, and it used to happen at the
     same size as everything else. */
  @keyframes sb-home-pop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.25); }
    100% { transform: scale(1); }
  }
  .sb-home-pop {
    transform-box: fill-box;
    transform-origin: 50% 50%;
    animation: sb-home-pop 400ms ease-out both;
  }

  /* A near miss: two quick pulses, then gone. Opacity and stroke only
     — the ring sits on a piece and must not move it. */
  @keyframes sb-closecall {
    0%, 100% { opacity: 0;    stroke-width: 2; }
    25%      { opacity: 0.95; stroke-width: 4; }
    50%      { opacity: 0.25; stroke-width: 2; }
    75%      { opacity: 0.9;  stroke-width: 3.6; }
  }
  .sb-closecall { animation: sb-closecall 1000ms ease-in-out both; }
  /* DISPLAY: NONE, NOT ANIMATION: NONE — and if this rule ever moves
     into gameFeel.jsx reduced-motion list, it must move as-is
     rather than being flattened into that list own animation:none rule.

     The difference is what the thing looks like at rest. The capture
     flash and the rest of gameFeel's classes decorate elements that
     have a resting state, so switching the animation off leaves them
     sitting there correctly. A burst has no resting state: with
     animation:none and fill-mode both, six shards would freeze mid-throw
     on the board and stay for the 620ms until React cleared them —
     worse than never drawing them, and worst for exactly the people
     who asked for less motion.

     Flattening it would look like tidying. (Found by the ludo-table
     lane, who argued for animation: none first and then talked
     themselves out of it.) */
  @media (prefers-reduced-motion: reduce) {
    .sb-spark { display: none; }
    /* animation:none here, NOT display:none — and the difference is the
       same one the spark's comment makes, pointing the other way. A
       burst has no resting state, so hiding it is right. This ring is
       an INSTRUCTION: it is the only thing on the board saying "these
       are the gotis you may move". The pulse is emphasis on top of it.
       Switch the motion off and the ring must still be there, or
       somebody who asked for less motion is left with no cue at all. */
    .sb-pulse { animation: none; stroke-opacity: 1; stroke-width: 3.6; }
    /* The trail is pure motion with nothing to say at rest, so it goes
       entirely — like the spark, unlike the ring. */
    .sb-trail { display: none; }

    /* THE CAPTURE FLASH, covered HERE even though its keyframe lives in
       gameFeel.jsx.

       Not duplication for its own sake. This board renders four sb-
       classes; three had their reduced-motion rule in this file and the
       fourth had it only in gameFeel.jsx — a file that does not render
       it. Anyone tidying that file would find .sb-cell-flash in a list,
       grep for a consumer, find none, and remove it. The flash would
       then animate for people who had asked for less motion, and it
       would GO QUIET rather than error: nothing breaks, no test fails,
       and the only person who finds out is the one it was meant to
       protect. (Found by the game-feel lane, pointing my own warning
       back at me.)

       animation:none rather than display:none, and for the pulse's
       reason rather than the spark's: this flash says WHERE a capture
       happened, which is the only way to know when it happened at the
       far end of a board you were not watching. Stopped rather than
       hidden, it holds the cell tinted until the hook unmounts it —
       the information without the motion. */
    .sb-cell-flash { animation: none; }
    /* The home ring and the tumble are pure flourish over something
       the board already states — the goti IS home, the goti IS
       travelling — so they stop rather than vanish, leaving the ring
       drawn and the piece upright. The shake has nothing to say at
       rest and is the one thing here most likely to be unpleasant for
       someone who asked for less motion, so it goes entirely. */
    .sb-home { animation: none; opacity: 0.9; }
    .sb-tumble-home { animation: none; }
    .sb-shake { animation: none; }
    /* The near miss says something the board does not otherwise say,
       so it stays drawn — stopped, at full strength, for as long as
       the hook keeps it. */
    .sb-closecall { animation: none; opacity: 0.9; }
    /* The hop, the flinch and the home pop are all motion over a
       board that already shows the truth — the goti IS on that
       square. They stop; nothing disappears and nothing is left
       mid-lift, because every one of them ends where it began. */
    .sb-hop .sb-goti-body { animation: none; }
    .sb-hop .sb-goti-shadow { animation: none; }
    .sb-flinch { animation: none; }
    .sb-home-pop { animation: none; }
  }
`;

const CELL = 40; // viewBox units per grid cell

/* HOW BIG A GOTI IS.

   Pawn draws its token to roughly 1.8x the r it is given, so these are
   not radii in the cell so much as the dial for "how much of its
   square does a piece own". The user's verdict on the old value was
   that the pieces were dots inside boxes; GOTI_R spans a whole cell
   and a shade over, so a goti reads as the object and the square reads
   as where it is standing.

   A JOTA is bigger again, because two gotis bound together really are
   a heavier thing on the board and the size is one more way of saying
   so besides the ring. A goti HOME is smaller: it is finished, and
   four finished pieces should not shout over a live board. */
/* FULL CELL. The owner's figure is a radius of about 11.5px on a
   24px cell — call it 48% of a cell — and our cells are 40 units,
   so a goti's radius is 19.2 and it spans 38 of the 40 units it
   stands on. It has been 11.5, then 12.6, then 15.2, and the
   verdict at every one of those was that the pieces were too
   small. They are now very nearly the square.

   A JOTA is bigger again, because two gotis bound together really
   are a heavier thing on the board. A goti HOME is smaller: it is
   finished, and four finished pieces should not shout over a live
   one. */
const GOTI_R = 19.2;
const JOTA_R = 20.8;
const HOME_R = 13.2;
const SIZE = 15 * CELL;

/* THE FRAME NEEDS SOMEWHERE TO STAND. The viewBox was exactly the
   15×15 grid, so the timber had to be a stroke drawn ON the board,
   lapping over the outermost row of track cells and eating about a
   sixth of each of them. A real board's frame is outside the
   printed area, so the viewBox grows by a margin on every side and
   the timber lives in it — all 225 cells stay whole.

   PAPER_R is the white surface's own corner, about 9px once the
   board is drawn at phone width. It is smaller than the frame's
   inner opening on purpose: no white can poke past the timber at
   a corner, because the timber is a filled shape underneath it
   rather than a line drawn around it.

   FRAME is regular width — a board edge, not a picture mount. */
const MARGIN = 14;
const PAPER_R = 15;
/* One square of travel. The user could not follow a move at all, so
   this is deliberately unhurried: a goti crossing eight squares takes
   about a second, which is slow enough to watch and short enough not
   to be waited on. */
/* Does this person want less motion?

   The three CSS animations on this board are already covered by a
   media query. The WALK IS NOT: it is a setInterval moving gotis a
   square at a time, and JavaScript does not care what the stylesheet
   was asked. So a person who had turned motion down still watched
   pieces hop across the board and a captured goti fly home — the
   backlog's standing rule is that animation degrades to a STATIC
   STATE, and this one degraded to nothing at all because it never
   knew to.

   Read live rather than cached: someone can change the setting while
   a game is open, and the next move should honour it. */
function wantsLessMotion() {
  try {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  } catch {
    return false;
  }
}

/* LUDO_MOTION_SPEC §3. These are the spec's numbers, not tuned ones —
   140ms a cell is the cadence the eye can count at, which is the whole
   reason the table is given per-hop timing rather than a duration for
   the move as a whole. */
const STEP_MS = 140;   // one cell
const HOP_MS = 140;    // the lift that goes with it
const SHAKE_MS = 200;  // a taken goti flinches before it travels
const ARC_MS = 600;    // and then goes home the long way
/* How long a captured goti takes to get home. It travels in a straight
   line rather than back along the track: it is not walking the board,
   it is being sent off it. */
const FLIGHT_MS = ARC_MS;



/* ── Pieces walk; they do not teleport ──────────────────────────────
   A goti that advances is shown crossing every square between where
   it was and where it is going, one square at a time, so you can see
   WHY it landed where it did — which square it counted onto, and what
   it passed. A piece sent home by a capture snaps instead: watching it
   trudge backwards would say something the rules do not.            */
/* A goti that was just sent home. Nothing in the move payload says
   WHICH one was captured — only that a capture happened — so we read
   it off the board: a piece that was somewhere and is now back at 0
   did not walk there. It shakes once, where it landed, so the person
   whose goti it was sees what happened rather than merely finding it
   missing later. */
function useCaptured(pieces) {
  const [hit, setHit] = useState(() => new Map());
  const prevRef = useRef(null);
  const key = JSON.stringify(pieces);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = pieces;
    if (!prev) return undefined;

    const sent = new Map();
    pieces.forEach((row, s) =>
      row.forEach((p, i) => {
        const was = Number(prev[s]?.[i] ?? 0);
        // Where it was standing when it was taken: the flash belongs
        // on that square, which only the previous board knows.
        if (p === 0 && was > 0) sent.set(`${s}:${i}`, cellFor(s, was, i));
      })
    );
    if (!sent.size) return undefined;
    setHit(sent);
    const id = window.setTimeout(() => setHit(new Map()), 700);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return hit;
}

function useWalk(pieces, isSilent) {
  const [shown, setShown] = useState(pieces);
  /* Pieces currently flying home, key "seat:index" → interpolated
     [col, row]. A captured goti is NOT on the track any more, so its
     position cannot be expressed as progress — it needs real
     coordinates, and that is why this is separate from `shown`. */
  const [flights, setFlights] = useState(() => new Map());
  /* Cells the walker has just crossed, so the eye can see the path it
     took rather than only where it ended up. */
  const [trail, setTrail] = useState([]);
  /* Gotis that reached home on THIS change, so the celebration fires
     once and on the right piece rather than on every piece already
     home. */
  const [arrivedHome, setArrivedHome] = useState(() => new Set());
  /* Cells where an opponent went past within a square of somebody —
     the near miss nobody notices until it is pointed out. */
  const [closeCalls, setCloseCalls] = useState([]);
  /* "seat:i" → the cell number it just hopped onto. The VALUE has to
     change every hop, because that is what restarts the lift. */
  const [hops, setHops] = useState(() => new Map());
  /* NO SEPARATE FLINCH STATE. It used to be a second Set describing
     the same gotis as `flights`, and two states describing one thing
     can disagree — which they did. The phase rides inside the flight
     entry now: flights is "seat:i" -> { at: [col, row], phase }. */
  const prevRef = useRef(pieces);
  const key = JSON.stringify(pieces);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = pieces;
    if (!prev || prev.length !== pieces.length) {
      setShown(pieces);
      return undefined;
    }

    /* Less motion: the board goes straight to the truth. That is the
       static state the rule asks for — the move still HAPPENED and the
       board still shows it, it simply is not acted out. It is not the
       animation disappearing and leaving a gap: there is no gap, the
       piece is where it should be, immediately. */
    if (wantsLessMotion()) {
      setShown(pieces);
      setFlights(new Map());
      setTrail([]);
      setArrivedHome(new Set());
      setCloseCalls([]);
      setHops(new Map());
      return undefined;
    }

    /* Arrivals: 57 now, not 57 before. */
    const home = new Set();
    pieces.forEach((row, s2) =>
      row.forEach((p, i) => {
        if (p === 57 && Number(prev[s2]?.[i] ?? 0) !== 57) home.add(`${s2}:${i}`);
      })
    );

    const walkers = [];
    const returners = [];
    let steps = 0;
    pieces.forEach((row, s2) =>
      row.forEach((p, i) => {
        const from = Number(prev[s2]?.[i] ?? p);
        if (p > from && from > 0 && p <= 57) {
          walkers.push([s2, i, from, p]);
          steps = Math.max(steps, p - from);
        } else if (p === 0 && from > 0) {
          /* Taken. It goes home the long way, visibly. */
          returners.push([s2, i, cellFor(s2, from, i), cellFor(s2, 0, i)]);
        }
      })
    );

    if (!walkers.length && !returners.length) {
      setShown(pieces);
      return undefined;
    }
    /* A jump too long to be one move — a rematch, a fresh load, a
       voided chain snapping back — is not a move and must not be
       animated as one. */
    if (steps > 12) {
      setShown(pieces);
      return undefined;
    }

    const base = prev.map((r) => [...r]);
    pieces.forEach((row, s2) =>
      row.forEach((p, i) => {
        const moving =
          walkers.some((w) => w[0] === s2 && w[1] === i) ||
          returners.some((w) => w[0] === s2 && w[1] === i);
        if (!moving) base[s2][i] = p;
      })
    );
    /* A returner is off the board for the whole flight: hold it at 0
       in `shown` and draw it from `flights` instead, or it would be
       painted twice. */
    returners.forEach(([s2, i]) => {
      base[s2][i] = 0;
    });
    setShown(base.map((r) => [...r]));
    setTrail([]);

    /* CLOSE CALLS — the arithmetic is in board.js and under test.
       Read off the committed boards, so a ring marks the square the
       near miss happened at rather than wherever the goti ended up. */
    const near = nearMissCells(prev, pieces);
    if (near.length) {
      setCloseCalls(near.slice(0, 4));
      window.setTimeout(() => setCloseCalls([]), 1100);
    }

    /* ONE CLOCK, NOT TWO.

       This used to be a 120ms setInterval doing both jobs: it advanced
       the walkers a cell per tick AND stepped a captured goti along a
       straight line toward its yard. That second job was the problem —
       a 600ms arc sampled on a 140ms interval is four positions, which
       is not an arc, it is a diagonal with corners. So the walk now
       runs off requestAnimationFrame and reads the clock: walkers
       advance at floor(elapsed / STEP_MS) and keep their exact
       per-cell cadence, while the flight gets every frame the display
       will give it.

       Both finish before the true board is committed, so a capture
       that happens on the same move as a walk cannot snap either one
       short. */
    const walkMs = steps * STEP_MS;
    const flightMs = returners.length ? SHAKE_MS + ARC_MS : 0;
    const totalMs = Math.max(walkMs, flightMs);

    /* Where a taken goti flies. A straight line home reads as a piece
       being dragged; a curve reads as one being thrown, which is what
       the moment deserves. The control point is the midpoint pushed
       out perpendicular to the line, so the bow always bends away
       from the board's middle rather than through it. */
    const arcs = returners.map(([s2, i, a, b]) => {
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      /* Perpendicular, pointing away from the centre of the board. */
      let px = -dy / len;
      let py = dx / len;
      if ((mx - 7) * px + (my - 7) * py < 0) { px = -px; py = -py; }
      const bow = Math.min(3.2, len * 0.34);
      return { key: `${s2}:${i}`, a, b, c: [mx + px * bow, my + py * bow] };
    });

    const started = performance.now();
    let raf = 0;
    let lastStep = -1;
    const crossed = [];

    const frame = (now) => {
      const elapsed = now - started;

      /* ── The walkers, one cell at a time ── */
      const stepNow = Math.min(steps, Math.floor(elapsed / STEP_MS));
      if (stepNow !== lastStep) {
        lastStep = stepNow;
        const next = base.map((r) => [...r]);
        const hopping = new Map();
        walkers.forEach(([s2, i, fromP, toP]) => {
          const at = Math.min(toP, fromP + stepNow);
          next[s2][i] = at;
          if (at > fromP) {
            crossed.push(cellFor(s2, at, i));
            /* The hop counter restarts the lift animation on each new
               cell. Without a value that CHANGES, the animation plays
               once on the first square and the rest of the move
               slides. */
            if (at < toP || stepNow <= steps) hopping.set(`${s2}:${i}`, at);
          }
        });
        setShown(next);
        setHops(hopping);
        if (crossed.length) setTrail([...crossed]);
        /* ONE TICK PER CELL, ON THE CELL. Played here rather than
           scheduled beside the move, because a scheduled run drifts
           away from a walk that is on a different clock — which is
           exactly what it was doing. Silent under reduced motion
           for free: the walk returns before this ever runs, so
           there are no hops to tick for. */
        if (stepNow > 0) {
          const mover = hopping.keys().next().value;
          const seat = mover != null ? Number(String(mover).split(":")[0]) : null;
          if (!(isSilent && seat != null && isSilent(seat))) {
            playSound("hop", { step: stepNow - 1, of: steps });
          }
        }
      }

      /* ── The taken goti: flinch, then fly ── */
      if (returners.length) {
        if (elapsed < SHAKE_MS) {
          /* It has not left yet. It is still on the square it was
             taken on, having a moment about it. */
          const m = new Map();
          arcs.forEach((g) => m.set(g.key, { at: g.a, phase: "flinch" }));
          setFlights(m);
        } else {
          const u = Math.min(1, (elapsed - SHAKE_MS) / ARC_MS);
          /* Ease out, then a small overshoot and settle at the very
             end — the bounce the spec asks for, done in position so
             it reads as weight rather than as a wobble. */
          const e =
            u < 0.86
              ? 1 - Math.pow(1 - u / 0.86, 2.2) * 1.0
              : 1 + Math.sin((u - 0.86) / 0.14 * Math.PI) * 0.06;
          const m = new Map();
          arcs.forEach((g) => {
            const t = Math.max(0, e);
            const it = 1 - t;
            /* Quadratic Bézier: start, control, end. */
            const x = it * it * g.a[0] + 2 * it * t * g.c[0] + t * t * g.b[0];
            const y = it * it * g.a[1] + 2 * it * t * g.c[1] + t * t * g.b[1];
            m.set(g.key, { at: [x, y], phase: "arc" });
          });
          setFlights(m);
        }
      }

      if (elapsed >= totalMs) {
        setShown(pieces);
        setFlights(new Map());
        setHops(new Map());
        /* The celebration starts when the goti ARRIVES, not when the
           move began — it has to be on the square to be cheered. */
        if (home.size) {
          setArrivedHome(home);
          /* The one unambiguously good thing that can happen to a
             goti, and until now it happened in silence. */
          const who = [...home][0];
          const seat = who != null ? Number(String(who).split(":")[0]) : null;
          if (!(isSilent && seat != null && isSilent(seat))) playSound("home");
          window.setTimeout(() => setArrivedHome(new Set()), 1500);
        }
        /* Let the trail linger a beat past the move, then clear it —
           the point is to be readable after the goti has stopped. */
        window.setTimeout(() => setTrail([]), 420);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { shown, flights, trail, arrivedHome, closeCalls, hops };
}

/* THE MOOD OF EVERY GOTI ON THE TRACK.

   Smug: standing on one of the eight stops, where nothing can take it.
   Worried: an enemy sits one to six squares BEHIND it — the range a
   single die can cross — and it is neither on a stop nor doubled up
   into a jota, because a lone goti is the only kind a single can take.

   This is arithmetic the player could do themselves by counting
   backwards round the ring from each of their pieces. The board doing
   it is the whole point: it turns a thing you must audit into a thing
   you can see.

   Deliberately NOT a face for being behind, losing, or slow. Danger
   and safety only. */
function moodsOf(pieces) {
  const mood = new Map();
  const at = [];
  pieces.forEach((row, seat) =>
    row.forEach((p) => {
      if (p >= 1 && p <= 51) at.push({ seat, abs: absOf(seat, p), p });
    })
  );
  pieces.forEach((row, seat) =>
    row.forEach((p, i) => {
      if (!(p >= 1 && p <= 51)) return;
      const abs = absOf(seat, p);
      if (SAFE_ABS.includes(abs)) {
        mood.set(`${seat}:${i}`, "smug");
        return;
      }
      /* A pair cannot be taken by a single, so it does not fret. */
      const mine = row.filter((q) => q === p).length;
      if (mine >= 2) return;
      const hunted = at.some(
        (o) => o.seat !== seat && ((abs - o.abs + 52) % 52) >= 1 && ((abs - o.abs + 52) % 52) <= 6
      );
      if (hunted) mood.set(`${seat}:${i}`, "worried");
    })
  );
  return mood;
}

/* "Blue 3" — the name of one goti, for the screen reader and for the
   tooltip. Colour AND number, because either alone is ambiguous: four
   gotis share a colour, and four numbers are shared across the seats. */
function pieceLabel(seat, i, mark) {
  const name = SEAT_COLOR_NAMES[seat % SEAT_COLOR_NAMES.length] || "";
  const who = name ? name[0].toUpperCase() + name.slice(1) : "Seat " + (seat + 1);
  /* A chosen mark is said out loud too. The point of a mark is to
     tell one of your four from the others, and that job does not
     stop mattering for somebody using a screen reader. */
  return mark ? `${who} ${i + 1} ${mark}` : `${who} ${i + 1}`;
}

export default function LudoBoard({
  state,
  /* The options for the die the player has picked up, straight from
     ludo_desi_legal: [{piece, split, to, kind}]. Empty when it is not
     your move or you have not chosen a die. */
  options = [],
  currentSeat = -1,
  onPieceTap,
  /* DRAG, the second path to the same move. Given (piece, option) —
     the exact destination the goti was dropped on — rather than just
     the piece, because a drop names its target and must not re-ask
     which one was meant. Absent, the board is tap-only and behaves
     exactly as it always has. */
  onPieceDrop,
  /* The jota question is open: a real choice is on screen and dragging
     underneath it would answer it by accident. */
  dragDisabled = false,
  mySeat = null,
  /* WHAT EACH PLAYER WEARS ON THEIR OWN FOUR (0095), keyed by
     seat: { 0: ["\u2618", "", "\u2600", ""] }. Absent or empty
     and a goti falls back to the mark it has always drawn, so a
     table where nobody has chosen looks exactly as it did. */
  marksBySeat = null,
  /* isSilent(seat) → that player's sounds are muted for this
     viewer, at this table. */
  isSilent,
}) {
  const rules = state?.rules || {};
  const showStars = (rules.safe_squares || "standard") === "standard";
  const live = state?.prov || state?.pieces || [];
  const { shown: pieces, flights, trail, arrivedHome, closeCalls, hops } = useWalk(live, isSilent);
  /* THE TABLE SHAKES ON THE EDGE OF A RUN.

     Not a celebration — the opposite. ludo_chain_stands is
     `p_len not in (3, 6, 9)`, so at three sixes every move of the run
     is provisional: one non-six and the whole thing is wiped back.
     Six and nine are the same cliff, which is why this is % 3 and not
     === 3; the session's own copy already says "on the edge" at all
     three.

     It cannot collide with the void message. ludo_resolve_chain sets
     chain to 0 in the same statement that sets chain_void, so a board
     showing chain 3 is a run still standing, and a board showing the
     void has chain 0 and does not shake. Nobody gets a flourish and a
     penalty in one beat.

     state.chain is the engine's count, so this is not a client guess,
     and it shakes for everyone at the table rather than the roller
     alone — the tension is the room's. */
  const chainLen = Number(state?.chain) || 0;
  const shake = chainLen > 0 && chainLen % 3 === 0;
  /* Fed the WALKED positions, not the truth — deliberately, and the
     opposite of useCaptured on the next line. A face belongs where the
     eye currently sees the goti: if it read the server's board, a
     piece would look worried about a threat that is two squares from
     where it is being drawn, or look smug on a stop it has not
     visibly reached yet. useCaptured wants the truth because a capture
     is an event, not a position. */
  const moods = moodsOf(pieces);
  /* Fed the TRUTH, not the walked positions: a captured goti snaps
     home rather than strolling back, so the shake has to key off the
     real board or it would fire a beat late. */
  const captured = useCaptured(live);
  const pairsMoved = state?.pairs_moved || {};
  const spin = povRotation(mySeat);

  const movable = new Set(options.map((o) => o.piece));

  /* ── PICK A GOTI UP AND PUT IT DOWN ──────────────────────────────
     Tap is the primary path and is untouched: a drag only begins once
     the pointer has travelled past DRAG_SLOP, so a tap is still a tap
     even from a hand that moves a little. When a drag does begin, the
     click that would follow it is swallowed, or releasing on a
     destination would both move the piece and re-open the tap path.

     Everything is in board units, not pixels: getScreenCTM() maps the
     pointer through the viewBox AND through the point-of-view
     rotation, which is the only reason a drag lands on the right
     square for a player whose board is turned 90 or 180 degrees. */
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  dragRef.current = drag;
  /* Set the moment a drag passes the slop, read and cleared by the
     click that the browser fires afterwards. A ref, not state,
     because it must be true DURING that click rather than after the
     next render. */
  const draggedRef = useRef(false);
  const DRAG_SLOP = 8; // board units, about a fifth of a cell
  const SNAP = 1.15;   // cells: how near a destination counts as "on" it

  const toBoard = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg || !svg.getScreenCTM) return null;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };

  /* Which destination is the goti nearest, if any. */
  const nearestFor = (opts, x, y) => {
    let best = null;
    let bestD = Infinity;
    opts.forEach((o) => {
      const [cc, rr] = cellFor(currentSeat, o.to, 0);
      const d = Math.hypot(cc * CELL - x, rr * CELL - y);
      if (d < bestD) { bestD = d; best = o; }
    });
    return bestD <= SNAP * CELL ? best : null;
  };

  const beginDrag = (e, seat, i, at) => {
    if (dragDisabled || !onPieceDrop) return;
    if (seat !== currentSeat || !movable.has(i)) return;
    const start = toBoard(e.clientX, e.clientY);
    if (!start) return;
    const opts = options.filter((o) => o.piece === i);
    if (!opts.length) return;
    setDrag({
      piece: i,
      seat,
      opts,
      origin: [at[0] * CELL, at[1] * CELL],
      at: [at[0] * CELL, at[1] * CELL],
      start,
      live: false,      // past the slop yet?
      target: null,
      releasing: false,
    });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
  };

  const moveDrag = (e) => {
    const d = dragRef.current;
    if (!d || d.releasing) return;
    const at = toBoard(e.clientX, e.clientY);
    if (!at) return;
    const travelled = Math.hypot(at[0] - d.start[0], at[1] - d.start[1]);
    const live = d.live || travelled > DRAG_SLOP;
    if (!live) return;
    draggedRef.current = true;
    e.preventDefault();
    setDrag({ ...d, live: true, at, target: nearestFor(d.opts, at[0], at[1]) });
  };

  const endDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.live) { setDrag(null); return; }   // it was a tap after all
    if (d.target) {
      setDrag(null);
      onPieceDrop(d.piece, d.target);
      return;
    }
    /* Dropped nowhere legal. It goes back, and nothing is spent —
       no move, no die, no penalty. Under reduced motion it is simply
       back, with no journey. */
    if (wantsLessMotion()) { setDrag(null); return; }
    setDrag({ ...d, at: d.origin, target: null, releasing: true });
    window.setTimeout(() => setDrag(null), 280);
  };

  /* Everything standing on one square, whoever it belongs to.

     Two of your own gotis share a square as a jota; an enemy single
     may be RESTING on that same square, having landed on it exactly.
     Both cases have to stay legible, so pieces are grouped by the cell
     they actually occupy and leaned apart within it — otherwise the
     last one drawn simply hides the rest, and a player cannot see the
     jota they are standing on. */
  const groups = new Map();
  pieces.forEach((row, seat) =>
    row.forEach((p, i) => {
      const [cc, rr] = cellFor(seat, p, i);
      const key = `${cc},${rr}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ seat, i, p });
    })
  );

  return (
    <div style={{ position: "relative", maxWidth: 560, margin: "0 auto" }}>
      <style>{BOARD_MOTION_CSS}</style>
      <svg
        ref={svgRef}
        onPointerMove={drag ? moveDrag : undefined}
        onPointerUp={drag ? endDrag : undefined}
        onPointerCancel={drag ? endDrag : undefined}
        className={shake ? "sb-shake" : undefined}
        viewBox={`${-MARGIN} ${-MARGIN} ${SIZE + 2 * MARGIN} ${SIZE + 2 * MARGIN}`}
        role="img"
        aria-label="Ludo board"
        style={{
          /* A LONG PRESS ON THE BOARD MUST NOT RAISE THE BROWSER'S
             SELECTION RIBBON. Every label on this board is SVG
             text, which selects like any other text — so holding a
             goti to think about it put Copy / Search / Translate
             across the game. Nothing is more app-like than the
             browser's own furniture appearing over a board. */
          ...NO_SELECT,
          width: "100%",
          height: "auto",
          display: "block",
          background: "transparent",
          borderRadius: 0,
          filter: "drop-shadow(0 12px 26px rgba(0,0,0,0.62)) drop-shadow(0 3px 6px rgba(0,0,0,0.45))",
          transform: spin ? `rotate(${spin}deg)` : undefined,
        }}
      >
        {/* ── The material ──────────────────────────────────────────
             A ludo board is a physical object: printed card with a
             sheen, cells pressed slightly into it, zones that catch
             the light at their edge. None of that is decoration for
             its own sake — depth is what tells you a cell is a place a
             goti can stand and a yard is a container it sits inside.
             All gradients and filters, no assets. ── */}
        <defs>
          {/* THE TIMBER. Body #9A6A33, edge #5E3C1B, lit from above
              because every other light on this board comes from the
              upper left. It is the board's ONLY edge: the gold trim
              ring that used to run inside it is gone, and gold is
              now rationed to the crown and the movable halo. */}
          <linearGradient id="sb-timber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B98244" />
            <stop offset="42%" stopColor="#9A6A33" />
            <stop offset="100%" stopColor="#7A5224" />
          </linearGradient>
          {/* a track cell: light from above, pressed in at the top */}
          {/* A track cell: light from above, pressed in at the top.

              THE STOPS ARE THE THEME'S. Painted from --sb-table-cell
              and --sb-table-cell-alt when a themed wrapper supplies
              them, and from these literals when nothing does, so a
              board outside a theme is unchanged. The variables are set
              on a div around the board (LudoSession, 38b07df) and
              inherit, so nothing is plumbed through props. Table
              themes own the surface; seats own their own colours. */}
          {/* BRIGHT WHITE, and flat. The warm off-white with a bevel
              was the right answer for a cream table; on a midnight
              one the board has to be the light in the room, and the
              track's job is to be the brightest thing on it so four
              deep zones and four saturated gotis all read against
              it. The grid is carried by a visible #CFCFCF line
              instead of by a value change in the fill, which is what
              lets the fill go all the way to white.

              The theme variables stay: a themed table still repaints
              this, and both stops default to white so an unthemed
              board is the specified one. */}
          <linearGradient id="sb-cell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sb-table-cell, #FFFFFF)" />
            <stop offset="100%" stopColor="var(--sb-table-cell-alt, #FFFFFF)" />
          </linearGradient>
          {/* The recess itself: dark along the top and left inside
              edges, the way a pressed groove catches light. */}
          <linearGradient id="sb-recess" x1="0.1" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#6B5A3E" stopOpacity="0.20" />
            <stop offset="38%" stopColor="#6B5A3E" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.55" />
          </linearGradient>
          {/* the gentle press: a soft dark line inside the top edge */}
          <filter id="sb-inset" x="-20%" y="-20%" width="140%" height="140%">
            <feOffset dx="0" dy="0.7" in="SourceAlpha" result="o" />
            <feGaussianBlur in="o" stdDeviation="0.7" result="b" />
            <feComposite in="b" in2="SourceAlpha" operator="arithmetic"
              k2="-1" k3="1" result="sh" />
            <feColorMatrix in="sh" type="matrix"
              values="0 0 0 0 0.36  0 0 0 0 0.29  0 0 0 0 0.18  0 0 0 0.30 0" result="tint" />
            <feComposite in="tint" in2="SourceGraphic" operator="over" />
          </filter>
          {/* the whole board lifted a little off the page */}
          <filter id="sb-lift" x="-8%" y="-8%" width="116%" height="116%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#4a3a22" floodOpacity="0.22" />
          </filter>
          {/* (The gold chips are gone. A stop is now the coloured cell
              itself — see the track below. Nothing on this board is
              goti-shaped except a goti.) */}
          {/* Each zone as a lit surface: a real gradient from the
              colour's own light end to its own deep end, rather than
              white-over-colour-over-black. Mixing toward black greys a
              hue out; mixing toward a deeper version of itself keeps
              it saturated, which is the whole point of the brief. */}
          {SEAT_COLORS.map((hex, seat) => (
            <linearGradient key={seat} id={`sb-zone-${seat}`} x1="0.1" y1="0" x2="0.9" y2="1">
              <stop offset="0%" stopColor={SEAT_LIGHT[seat]} />
              <stop offset="45%" stopColor={hex} />
              <stop offset="100%" stopColor={SEAT_DEEP[seat]} />
            </linearGradient>
          ))}
          {/* The same again for a single STOP cell, steeper so one
              40-unit square still reads as domed. */}
          {/* NEARLY FLAT. This ramped from light to deep across one
              40-unit square, so a home column read as six separate
              domes fading into each other rather than as one painted
              lane. The reference paints its home columns in solid
              colour and lets the frame and the tokens carry the
              depth. A whisper of a ramp is left so the lane is not
              perfectly dead, and the sheen above still crosses it. */}
          {SEAT_COLORS.map((hex, seat) => (
            <linearGradient key={`a${seat}`} id={`sb-arm-${seat}`} x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0%" stopColor={hex} />
              <stop offset="100%" stopColor={SEAT_DEEP[seat]} stopOpacity="0.55" />
            </linearGradient>
          ))}
          {/* A SHEEN. One soft white pass over the top of a surface,
              falling off before the middle — the single cheapest thing
              that turns flat colour into moulded plastic, because it
              is what a curved lit surface actually does. */}
          <linearGradient id="sb-gloss" x1="0" y1="0" x2="0.15" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.30" />
            <stop offset="38%" stopColor="#FFFFFF" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          {/* The same idea at a fraction of the strength, for the
              eight stops. A 40-unit square takes far less white than a
              240-unit yard before it stops looking like a red cell and
              starts looking like a pink one — and the stops are the
              cells that most need to keep their colour, because the
              colour IS the information. */}
          <linearGradient id="sb-gloss-cell" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.20" />
            <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.10" />
          </linearGradient>
          {/* The centre is the high point of the board — a pedestal
              the four columns climb to — so it gets a dome of its own
              rather than being four flat triangles. */}
          <radialGradient id="sb-dome" cx="38%" cy="30%" r="78%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
          </radialGradient>
          {/* Something raised casts a shadow. Used under the centre
              and the yards, which are the two things on this board
              that should read as sitting ON it. */}
          <filter id="sb-raise" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="2.4" stdDeviation="3.2" floodColor="#3A2C16" floodOpacity="0.30" />
          </filter>
          {/* THE GOLD CROWN at the centre. The one place on the
              board that keeps gold, with the halo on a movable
              goti. */}
          <linearGradient id="sb-crown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F3CE5E" />
            <stop offset="100%" stopColor="#B98A1E" />
          </linearGradient>
          {/* A cell bevel: light along the top edge, shadow along the
              bottom, so a track square is pressed into the board
              rather than painted on it. */}
          <linearGradient id="sb-bevel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0" />
            {/* lighter than it was: on a white cell the old 0.28 brown
                shadow put the tint back that §1 just took out */}
            <stop offset="100%" stopColor="#7A6238" stopOpacity="0.13" />
          </linearGradient>
        </defs>

        {/* THE TIMBER, as a FILLED shape under everything rather
            than a line drawn around it. That is the whole reason no
            white can poke past a corner: the wood is a solid
            rounded rectangle and the paper is a smaller rounded
            rectangle laid on top of it, so at every corner there is
            wood behind the paper by construction. Drawn again at
            the very end as a band, so it also laps over the outer
            cells' edges. */}
        <rect
          x={-MARGIN}
          y={-MARGIN}
          width={SIZE + 2 * MARGIN}
          height={SIZE + 2 * MARGIN}
          rx={MARGIN + PAPER_R}
          fill="url(#sb-timber)"
        />
        {/* the board's paper: bright white, corners rounded so the
            timber closes round it */}
        <rect
          x={-1}
          y={-1}
          width={SIZE + 2}
          height={SIZE + 2}
          rx={PAPER_R}
          fill="#FFFFFF"
        />

        {/* ── Yards: a 6×6 block of FLAT colour, a white plate,
               and four sunk sockets for the gotis to stand in.

               FLAT is the instruction and it is the right one. The
               zone used to be a gradient with a gloss pass and a
               bright rim — three layers of moulded-plastic
               shorthand — and on the deep rich set they turned a
               #B01709 red into something closer to a beach ball.
               Flat colour with one dark outline reads as printed
               card, which is what a ludo board is.

               The DEPTH moved to where depth belongs: the four
               sockets. A goti standing in a rimmed well on a white
               plate is unmistakably an object sitting in a place
               made for it, and it costs one circle each. ── */}
        {YARD_ORIGIN.map(([c, r], seat) => (
          <g key={`yard-${seat}`}>
            <rect
              x={c * CELL}
              y={r * CELL}
              width={6 * CELL}
              height={6 * CELL}
              rx={8}
              fill={SEAT_COLORS[seat]}
              stroke={SEAT_DEEP[seat]}
              strokeWidth={2.5}
            />
            {/* the white plate the four gotis stand on */}
            <rect
              x={(c + 1) * CELL}
              y={(r + 1) * CELL}
              width={4 * CELL}
              height={4 * CELL}
              rx={10}
              fill="rgba(255,255,255,0.9)"
            />
            {YARD_SPOTS.map(([sc, sr], i) => {
              const x = (c + sc) * CELL;
              const y = (r + sr) * CELL;
              return (
                <g key={i}>
                  {/* THE WELL. Wider than the goti standing in it,
                      on purpose. At CELL*0.42 the rim sat entirely
                      under a full-cell piece and not one pixel of
                      it was ever visible — a socket you would have
                      to read the source to know about. */}
                  <circle
                    cx={x}
                    cy={y}
                    r={CELL * 0.56}
                    fill="rgba(0,0,0,0.18)"
                    stroke={SEAT_DEEP[seat]}
                    strokeWidth={2}
                  />
                  {/* the inner shadow ring: a well is darkest just
                      inside its rim, and one more circle is the
                      whole difference between a socket and a dot */}
                  <circle
                    cx={x}
                    cy={y}
                    r={CELL * 0.56 - 2.6}
                    fill="none"
                    stroke="#000000"
                    strokeOpacity={0.16}
                    strokeWidth={3}
                  />
                </g>
              );
            })}
          </g>
        ))}
        {/* ── The 52-square track ──

               Three kinds of cell, and the difference between them
               is the difference between two things a player must
               never confuse:

               THE OPENING CELL is where your gotis come out. It
               wears your colour at a third — enough to say whose
               door it is, pale enough that the star on it still
               reads — and carries a star in that colour.

               THE PRE-HOME CELL is the last star before you turn
               off the ring into your own column. PLAIN WHITE, with
               only the coloured star to name it: it is not your
               door, it is a stop that happens to be yours, and
               tinting it too would have made two cells on the same
               arm look like the same kind of place.

               ANY OTHER SAFE CELL gets a grey star. Our marked
               board yields none — its eight stops are exactly four
               openings and four pre-homes — so this branch draws
               nothing today. It is here because the alternative is
               a board that would silently stop marking a safe
               square if the geometry ever gained one, and an
               unmarked safe square is a promise nobody can see.

               Positions come from board.js, which came from the
               owner's marked board. Nothing here invents one. ── */}
        {TRACK.map(([c, r], abs) => {
          const isStart = STARTS.includes(abs);
          const isSafe = SAFE_ABS.includes(abs);
          const badgeSeat = isStart
            ? STARTS.indexOf(abs)
            : PRE_HOME_ABS.indexOf(abs);
          const x = c * CELL;
          const y = r * CELL;
          return (
            <g key={`t-${abs}`}>
              <rect
                x={x + 0.5}
                y={y + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                rx={3}
                fill="url(#sb-cell)"
                stroke="var(--sb-table-line, #CFCFCF)"
                strokeWidth={1}
              />
              {isStart && (
                <rect
                  x={x + 0.5}
                  y={y + 0.5}
                  width={CELL - 1}
                  height={CELL - 1}
                  rx={3}
                  fill={SEAT_COLORS[badgeSeat]}
                  opacity={0.33}
                  pointerEvents="none"
                />
              )}
              {isSafe && (
                /* Counter-rotated, so a five-pointed star is still
                   point-up at every point of view. A star is not
                   four-fold symmetric: left alone it would lie on
                   its side for three players out of four. */
                <g
                  transform={
                    spin
                      ? `rotate(${-spin} ${x + CELL / 2} ${y + CELL / 2})`
                      : undefined
                  }
                  aria-hidden="true"
                  pointerEvents="none"
                >
                  <path
                    d={starPath(x + CELL / 2, y + CELL / 2, CELL * 0.3)}
                    fill={badgeSeat >= 0 ? SEAT_COLORS[badgeSeat] : "#B0B0B0"}
                    stroke={badgeSeat >= 0 ? SEAT_DEEP[badgeSeat] : "#8A8A8A"}
                    strokeWidth={1.2}
                    strokeLinejoin="round"
                  />
                </g>
              )}
            </g>
          );
        })}
        {/* ── Which way you go ──
               Printed on the track like a real board's cloth, derived
               from the track itself so it can never point the wrong
               way after a geometry change. */}
        {allArrows({ every: 3 }).map((a, i) => (
          <Arrow key={`arw-${i}`} {...a} />
        ))}

        {/* ── Home columns: each arm's middle line, in the seat's
               MID tone — the same flat colour as its zone, so the
               run home and the yard it leads from are visibly one
               player's territory.

               Each cell keeps its own outline. A solid bar of
               colour hides how many squares are left, which is the
               one thing a player climbing it is counting. ── */}
        {HOME_COLUMNS.map((cells, seat) =>
          cells.map(([c, r], i) => (
            <rect
              key={`h-${seat}-${i}`}
              x={c * CELL + 0.5}
              y={r * CELL + 0.5}
              width={CELL - 1}
              height={CELL - 1}
              rx={3}
              fill={SEAT_COLORS[seat]}
              stroke={SEAT_DEEP[seat]}
              strokeWidth={1.6}
            />
          ))
        )}
        {/* ── The centre: the classic four triangles in the four
               MID tones, and a gold crown standing on them.

               The Saathban monogram used to sit here at half
               opacity. It was ours and it was quiet, but the
               centre of a ludo board is the one square every
               player is walking towards for the whole game, and
               what belongs at the end of that walk is the thing
               you are walking towards — not a maker's mark. A
               crown is what a board has always put there.

               Drawn LAST inside the group, so a goti that finishes
               on the middle sits over the crown rather than
               behind it. ── */}
        <g>
          {[
            /* Wedge order follows the ring: top, right, bottom, left. */
            [`${6 * CELL},${6 * CELL} ${9 * CELL},${6 * CELL} ${7.5 * CELL},${7.5 * CELL}`, 0],
            [`${9 * CELL},${6 * CELL} ${9 * CELL},${9 * CELL} ${7.5 * CELL},${7.5 * CELL}`, 1],
            [`${6 * CELL},${9 * CELL} ${9 * CELL},${9 * CELL} ${7.5 * CELL},${7.5 * CELL}`, 2],
            [`${6 * CELL},${6 * CELL} ${6 * CELL},${9 * CELL} ${7.5 * CELL},${7.5 * CELL}`, 3],
          ].map(([points, seat]) => (
            <polygon
              key={`c-${seat}`}
              points={points}
              fill={SEAT_COLORS[seat]}
              stroke={SEAT_DEEP[seat]}
              strokeWidth={1.4}
            />
          ))}
          {/* the dark outline round the whole finish */}
          <rect
            x={6 * CELL}
            y={6 * CELL}
            width={3 * CELL}
            height={3 * CELL}
            rx={4}
            fill="none"
            stroke="#3A2A12"
            strokeWidth={2.5}
            pointerEvents="none"
          />
          {/* THE CROWN. Counter-rotated with the board so it is
              upright for whoever is looking at it. */}
          <g
            transform={
              `translate(${7.5 * CELL} ${7.5 * CELL})` +
              (spin ? ` rotate(${-spin})` : "") +
              ` scale(${CELL * 0.66}) translate(0 -0.14)`
            }
            aria-hidden="true"
            pointerEvents="none"
          >
            {/* Its own shadow first, so the crown is standing on
                the wedges rather than printed across them. */}
            <path
              d={CROWN_D}
              fill="#000000"
              opacity={0.22}
              transform="translate(0.05 0.07)"
            />
            <path
              d={CROWN_D}
              fill="url(#sb-crown)"
              stroke="#9A7420"
              strokeWidth={0.075}
              strokeLinejoin="round"
            />
          </g>
        </g>
        {/* ── A capture flashes the square ──
               The goti that was taken shakes as it lands back home,
               but the thing that HAPPENED happened here, and a player
               watching the other end of the board would otherwise
               never see it. */}
        {/* ── The sparkle ────────────────────────────────────────
             The flash below tints the square; this throws a few
             shards off it. Two different jobs: the flash says WHERE,
             and there is no other way to know when the capture
             happened at the far end of a board you were not watching.
             The sparkle says the moment mattered.

             Purely additive and purely brief — it plays once and
             leaves nothing behind, and prefers-reduced-motion removes
             it entirely (the flash stays, because that one carries
             information rather than delight). ── */}
        {[...captured.values()].map(([cc, rr], i) =>
          SPARKS.map(([dx, dy], k) => {
            /* Scattered rather than evenly spoked: a ring of
               identical stars reads as a diagram of an explosion.
               The sizes and distances vary with the index, which
               is enough irregularity to look thrown. */
            const dist = CELL * (0.32 + ((k * 7) % 5) * 0.09);
            const size = CELL * (0.11 + ((k * 3) % 4) * 0.035);
            return (
              <path
                key={`spark-${i}-${k}`}
                className="sb-spark"
                d={sparkPath(cc * CELL + dx * dist, rr * CELL + dy * dist, size)}
                fill={k % 3 === 0 ? "#FFFFFF" : "#F7D07A"}
                style={{ animationDelay: `${k * 26}ms` }}
                pointerEvents="none"
                aria-hidden="true"
              />
            );
          })
        )}
        {[...captured.values()].map(([cc, rr], i) => (
          <rect
            key={`flash-${i}`}
            className="sb-cell-flash"
            x={cc * CELL - CELL / 2 + 1}
            y={rr * CELL - CELL / 2 + 1}
            width={CELL - 2}
            height={CELL - 2}
            rx={6}
            fill={C.brown}
            pointerEvents="none"
            aria-hidden="true"
          />
        ))}

        {/* ── Where the die you are holding could take you ── */}
        {options.map((o, i) => {
          const [cc, rr] = cellFor(currentSeat, o.to, 0);
          /* While a goti is in the air the board narrows down: the
             squares THIS piece could reach stay lit, everything else
             steps back, and the one it would land on right now is
             filled in. Picking a piece up should answer "where can
             this go?" — not repeat "where can anything go?". */
          const mine = !drag || !drag.live || drag.opts.includes(o);
          const snapped = drag && drag.live && drag.target === o;
          return (
            <g key={`dest-${i}`} opacity={mine ? 1 : 0.18}>
              <circle
                cx={cc * CELL}
                cy={rr * CELL}
                r={snapped ? 17 : 13}
                fill={snapped ? "#1FA83C" : "none"}
                fillOpacity={snapped ? 0.18 : 0}
                stroke="#1FA83C"
                strokeWidth={snapped ? 4.5 : 3.5}
                strokeDasharray={snapped ? undefined : "5 4"}
                opacity={0.9}
              />
              <circle cx={cc * CELL} cy={rr * CELL} r={snapped ? 6 : 4} fill="#1FA83C" opacity={0.9} />
            </g>
          );
        })}

        {/* ── The trail ────────────────────────────────────────────
             The cells a goti has just crossed, glowing briefly behind
             it. Without this a move is a piece appearing somewhere
             else; with it you can see the road it took, which is the
             difference between watching a game and being told its
             result. Fades on its own and is drawn UNDER the pieces so
             it never competes with one. ── */}
        {trail.map(([cc, rr], i) => (
          <rect
            key={`tr-${i}-${cc}-${rr}`}
            className="sb-trail"
            x={cc * CELL - CELL / 2 + 2}
            y={rr * CELL - CELL / 2 + 2}
            width={CELL - 4}
            height={CELL - 4}
            rx={7}
            fill="#FFD23F"
            pointerEvents="none"
            aria-hidden="true"
          />
        ))}

        {/* ── Close calls: they went right past you ── */}
        {closeCalls.map(([cc, rr], i) => (
          <circle
            key={`cc-${i}-${cc}-${rr}`}
            className="sb-closecall"
            cx={cc * CELL}
            cy={rr * CELL}
            r={CELL * 0.46}
            fill="none"
            stroke="#FF7A1A"
            strokeWidth={3}
            pointerEvents="none"
            aria-hidden="true"
          />
        ))}

        {/* ── Pieces ── */}
        {pieces.map((seatPieces, seat) =>
          seatPieces.map((p, i) => {
            const [cc, rr] = cellFor(seat, p, i);
            const group = groups.get(`${cc},${rr}`) || [{ seat, i, p }];
            const k = group.findIndex((g) => g.seat === seat && g.i === i);
            // Two of MY gotis here is a jota; anyone else here is a
            // guest resting on the square.
            const mine = group.filter((g) => g.seat === seat).length;
            const isJota = mine >= 2 && p >= 1 && p <= 56;
            const firstOfSeat = group.findIndex((g) => g.seat === seat) === k;

            /* ── A JOTA IS A TOWER ──
               Two of your gotis on one square is a different kind of
               thing from two gotis near each other, and it has to read
               that way from arm's length. So the pair is STACKED —
               one goti standing on the other, a taller silhouette than
               anything else on the board — rather than leaned side by
               side, where at phone width it looks like two singles
               that happen to be close.

               Guests from other seats still lean apart horizontally;
               they are separate pieces and must stay separately
               tappable. Only your own pair climbs. */
            const seatsHere = [...new Set(group.map((g) => g.seat))];
            const slot = seatsHere.indexOf(seat);
            const mineIdx = group.filter((g, gi) => g.seat === seat && gi <= k).length - 1;
            const towerHere = group.some((g) => {
              const same = group.filter((x) => x.seat === g.seat).length;
              return same >= 2 && g.p >= 1 && g.p <= 56;
            });
            const spread = seatsHere.length > 1 ? (towerHere ? 26 : 15) : 0;
            const climb = isJota ? 13 : 0;
            const stackX = cc * CELL + (slot - (seatsHere.length - 1) / 2) * spread;
            const cx = stackX;
            /* The upper goti is drawn FIRST and the lower one over it,
               so the near piece occludes the far one and the pair
               reads as depth rather than as two flat discs. Map order
               is piece index, and mineIdx follows it, so this falls out
               of the ordering for free. */
            const cy = rr * CELL - (mine - 1 - mineIdx) * climb + (isJota ? climb / 2 : 0);
            // The tower is centred on its square: a goti's centre sits
            // half a climb above and below, so the pair grows upward
            // AND downward rather than drifting off the cell.
            const canTap = seat === currentSeat && movable.has(i);
            const moved = !!pairsMoved[`${seat}:${p}`];

            return (
              <g
                key={`p-${seat}-${i}`}
                className={`${canTap ? "sb-press-svg" : ""}${
                  captured.has(`${seat}:${i}`) ? " sb-nudge" : ""
                }${arrivedHome.has(`${seat}:${i}`) ? " sb-home-pop" : ""}`}
                onPointerDown={canTap ? (e) => beginDrag(e, seat, i, [cx / CELL, cy / CELL]) : undefined}
                onClick={
                  canTap
                    ? () => {
                        /* A drag that actually travelled has already
                           done the move, or already sprung back. Its
                           trailing click must not also open the tap
                           path — that is how a drop onto a square
                           would ALSO pop the jota chooser. */
                        if (draggedRef.current) { draggedRef.current = false; return; }
                        onPieceTap(i);
                      }
                    : undefined
                }
                style={{ cursor: canTap ? (drag && drag.live ? "grabbing" : "grab") : "default", touchAction: "none" }}
              >
                {/* One ring per stack, drawn by its first goti: dashed
                    while the pair may still split, solid once it has
                    moved together and is bound to even dice. */}
                {isJota && firstOfSeat && (
                  <g data-jota={`${seat}:${moved ? "moved" : "virgin"}`}>
                    {/* The ring is drawn round the whole tower, not
                        round one goti, and it is TALL — the shape
                        itself says "these two are one piece now". */}
                    <ellipse
                      cx={stackX}
                      cy={rr * CELL}
                      rx={23}
                      ry={29}
                      fill="none"
                      stroke={SEAT_COLORS[seat]}
                      strokeWidth={3}
                      strokeDasharray={moved ? undefined : "5 4"}
                      opacity={0.9}
                    />
                    {/* A shadow on the square it actually occupies,
                        so a tall piece still reads as standing HERE. */}
                    <ellipse
                      cx={stackX}
                      cy={rr * CELL + 22}
                      rx={15}
                      ry={4.5}
                      fill="#2F2A24"
                      opacity={0.18}
                    />
                  </g>
                )}
                {canTap && (
                  <circle
                    /* THE GOLD HALO — the ONE indicator that a goti
                       can be moved. It was white, which on a bright
                       white track is a ring you have to look for;
                       gold is the only colour on this board that
                       belongs to nobody's seat, so it can mean
                       "this one" without also meaning "this
                       player".

                       AND IT HAS TO CLEAR THE PIECE. At r=23 it
                       was a 46-unit ring around a 38-unit goti
                       standing in a 44.8-unit socket — so on the
                       track it showed as a hairline and in the
                       YARD it was hidden underneath the socket's
                       own rim entirely. Four gotis were haloed in
                       the DOM, stroke rgb(243,206,94), and not one
                       pixel of gold was on the screen. A halo you
                       cannot see is the same as no halo, and the
                       spec makes this the ONLY thing telling you
                       which pieces can move. */
                    className="sb-pulse"
                    cx={cx}
                    cy={cy - 1}
                    r={26.5}
                    fill="none"
                    stroke="#F3CE5E"
                    strokeWidth={3}
                  />
                )}
                {/* THE HOP. A key that changes every cell is what
                    restarts the lift — a CSS animation on an element
                    React merely re-positions plays once and then the
                    rest of the move slides. Wrapped rather than
                    applied to the Pawn itself so the class has
                    somewhere to live that nothing else owns.

                    The home column gets a slight inward tilt, per
                    §3: the goti leans into the turn it is making. */}
                <g
                  key={`hop-${hops.get(`${seat}:${i}`) ?? "still"}`}
                  className={hops.has(`${seat}:${i}`) ? "sb-hop" : undefined}
                  style={p >= 52 && p < 57 ? { transformBox: "fill-box", transformOrigin: "50% 100%" } : undefined}
                >
                <Pawn
                  seat={seat}
                  cx={cx}
                  cy={cy}
                  /* THE GOTI DOMINATES ITS SQUARE. A token is drawn
                     about 1.8x its r, so GOTI_R = 11.5 spans roughly
                     41 of the 40 units in a cell: it fills the square
                     edge to edge and slightly over, which is what
                     makes it the object you look at rather than a dot
                     inside a box. A jota's pair is bigger still, and
                     a goti already home shrinks — it is finished, and
                     four finished pieces should not crowd out the
                     live board. */
                  r={p >= 57 ? HOME_R : isJota ? JOTA_R : GOTI_R}
                  piece={i}
                  mark={marksBySeat?.[seat]?.[i] || null}
                  spin={spin}
                  mood={moods.get(`${seat}:${i}`) || null}
                  label={pieceLabel(seat, i, marksBySeat?.[seat]?.[i])}
                  tilt={p >= 52 && p < 57}
                />
                </g>
                {/* HOME. A goti that has just finished takes a moment
                    about it — the one unambiguously good thing that
                    can happen to a piece, and it used to happen in
                    total silence. */}
                {arrivedHome.has(`${seat}:${i}`) && (
                  <>
                    <circle
                      className="sb-home"
                      cx={cx}
                      cy={cy}
                      r={13}
                      fill="none"
                      stroke="#F3CE5E"
                      strokeWidth={2.6}
                      pointerEvents="none"
                      aria-hidden="true"
                    />
                    {/* A PUFF OF CONFETTI. The ring alone said
                        "something happened here"; six little stars
                        thrown off it say what kind of something. It
                        is the capture's own sparkle at half the
                        reach and in gold rather than white, because
                        this is the good version of the same
                        moment. Reduced motion removes it with every
                        other .sb-spark. */}
                    {SPARKS.map(([dx, dy], k) => (
                      <path
                        key={`hs-${seat}-${i}-${k}`}
                        className="sb-spark"
                        d={sparkPath(
                          cx + dx * CELL * (0.24 + ((k * 7) % 5) * 0.05),
                          cy + dy * CELL * (0.24 + ((k * 7) % 5) * 0.05),
                          CELL * (0.07 + ((k * 3) % 4) * 0.02)
                        )}
                        fill={k % 3 === 0 ? "#FFFFFF" : "#F3CE5E"}
                        style={{ animationDelay: `${k * 30}ms` }}
                        pointerEvents="none"
                        aria-hidden="true"
                      />
                    ))}
                  </>
                )}
                {/* THE HIT TARGET, and it is not decoration. With the
                    move list gone the goti IS the only way to move, so
                    this has to clear 48 CSS px on a phone. The board is
                    600 viewBox units shown at ~360px, so one unit is
                    0.6px and r=42 is an 84-unit target ≈ 50px across.
                    Bigger than the token on purpose. */}
                {canTap && <circle cx={cx} cy={cy} r={42} fill="transparent" />}
              </g>
            );
          })
        )}
        {/* ── Sent home ───────────────────────────────────────────
             A captured goti travels back to its yard where everyone
             can see it go. It is drawn here, after the pieces, because
             for the length of the flight it is the most important
             thing on the board: it is the answer to "what just
             happened to me". ── */}
        {[...flights.entries()].map(([k, fl]) => {
          const [cc, rr] = fl.at;
          const [seat] = k.split(":").map(Number);
          return (
            <g key={`fly-${k}`}>
              <ellipse cx={cc * CELL} cy={rr * CELL + 15} rx={13} ry={4} fill="#00000030" />
              {/* It spins on the way home. Rotation about the piece's
                  OWN centre — transform-box fill-box — because a bare
                  rotate on an SVG child pivots on the viewport origin
                  and would fling it off the board. */}
              {/* Two beats, not one. It FLINCHES where it was taken
                  for 200ms — the person whose goti it was needs a
                  moment to see it happen on the square it happened on
                  — and only then travels, spinning once over the
                  600ms arc. Going straight into the flight read as
                  the piece simply vanishing from the fight. */}
              <g className={fl.phase === "flinch" ? "sb-flinch" : "sb-tumble-home"}>
                <Pawn
                  seat={seat}
                  cx={cc * CELL}
                  cy={rr * CELL}
                  r={GOTI_R}
                  piece={Number(k.split(":")[1])}
                  mark={marksBySeat?.[seat]?.[Number(k.split(":")[1])] || null}
                  spin={spin}
                  label={pieceLabel(seat, Number(k.split(":")[1]), marksBySeat?.[seat]?.[Number(k.split(":")[1])])}
                />
              </g>
            </g>
          );
        })}

        {/* ── The goti in your hand ──────────────────────────────
             Drawn above everything, because for as long as it is in
             the air it IS the board. The piece it came from stays
             where it was, faded, so the square it would return to is
             never in doubt. ── */}
        {drag && drag.live && (
          <g
            style={{
              transform: `translate(${drag.at[0] - drag.origin[0]}px, ${drag.at[1] - drag.origin[1]}px)`,
              transition: drag.releasing ? "transform 260ms cubic-bezier(0.34, 1.3, 0.64, 1)" : "none",
            }}
            pointerEvents="none"
          >
            <Pawn
              seat={drag.seat}
              cx={drag.origin[0]}
              cy={drag.origin[1]}
              r={GOTI_R * 1.08}
              piece={drag.piece}
              spin={spin}
              label={pieceLabel(drag.seat, drag.piece, marksBySeat?.[drag.seat]?.[drag.piece])}
            />
          </g>
        )}

        {/* THE FRAME, drawn last so it laps over every cell edge
            and the board ends somewhere definite.

            NO GOLD TRIM RING. There was a white-at-32% line running
            inside the timber, which at phone width read as exactly
            the bright inner ring the owner has removed. The timber
            is the only edge; its own darker line at the outside and
            at the opening is what gives it thickness.

            The band sits in the margin, so it covers no cell — the
            wood filled under the board already put timber behind
            every corner, and this is the same wood drawn over the
            outer half-pixel of the outermost squares. */}
        <rect
          x={-MARGIN / 2}
          y={-MARGIN / 2}
          width={SIZE + MARGIN}
          height={SIZE + MARGIN}
          rx={MARGIN / 2 + PAPER_R}
          fill="none"
          stroke="url(#sb-timber)"
          strokeWidth={MARGIN}
          pointerEvents="none"
        />
        {/* the outside edge of the timber */}
        <rect
          x={-MARGIN + 1}
          y={-MARGIN + 1}
          width={SIZE + 2 * MARGIN - 2}
          height={SIZE + 2 * MARGIN - 2}
          rx={MARGIN + PAPER_R - 1}
          fill="none"
          stroke="#5E3C1B"
          strokeWidth={2}
          pointerEvents="none"
        />
        {/* and the edge where it meets the board */}
        <rect
          x={-1}
          y={-1}
          width={SIZE + 2}
          height={SIZE + 2}
          rx={PAPER_R}
          fill="none"
          stroke="#5E3C1B"
          strokeWidth={2}
          pointerEvents="none"
        />
      </svg>

    </div>
  );
}
