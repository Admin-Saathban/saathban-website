/* ════════════════════════════════════════════════
   How a piece MOVES on this board.

   The old board put the token on its new square and that was the
   move. Everything a player needs to understand — that they rolled a
   five, that the fifth square had a snake on it, that the snake took
   them down to twenty-two — happened between two frames.

   So nothing here teleports. A move is played out in three acts:

     1. THE WALK. Square by square, one tick per square, so you can
        count the roll off the board with your eyes. Passing a
        snake's head without landing on it gets a short quiet hiss —
        the near miss is part of the game and it should be audible.
     2. THE FALL, or THE CLIMB. A snake bite slides the token DOWN
        THE SNAKE'S OWN BODY, following its coils — read from the
        very samples the body was filled from, so the piece rides the
        curve it can see rather than cutting across it. A ladder is
        climbed rung by rung.
     3. THE SETTLE. The piece is on its square and the board is quiet.

   THE PATH IS SHARED, NOT COPIED. serpent.spine() is called once per
   snake and both the fill and this hook read the result. Two
   approximations of one curve would drift by a pixel or two and the
   piece would swim beside the body instead of inside it.

   TIMING IS REAL TIME, not frame counts — a slow phone must play the
   same move over the same number of seconds as a fast one, or the
   sound and the picture come apart.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { cellCenter } from "./board.js";
import { spine, wavesFor, pointAt, ladderGeometry } from "./serpent.js";
import { playSound } from "../../../lib/sound.js";

/* Owner: "every move walks square by square with a step tick — never
   a jump." A step is slow enough to count and fast enough that a six
   does not become a journey. */
const STEP_MS = 165;
const SLIDE_MS_PER_SQUARE = 26;    // a long snake takes longer to fall
const SLIDE_MIN_MS = 620;
const CLIMB_MS_PER_RUNG = 105;
const SETTLE_MS = 260;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/* Build the animation script for one move. Pure — it decides the
   whole journey up front so the frame loop only has to interpolate,
   and so a move can be reasoned about without a clock. */
export function scriptFor(move, board) {
  if (!move || move.stuck) return null;
  const from = move.from ?? 0;
  const landed = move.landed ?? from;
  const to = move.to ?? landed;
  const legs = [];

  /* ── the walk ── */
  if (landed > from) {
    const heads = new Set(board.snakes.map((s) => s.from));
    for (let n = from + 1; n <= landed; n++) {
      legs.push({
        kind: "step",
        cell: n,
        ms: STEP_MS,
        /* A head you pass over but do not stop on. The last square of
           the walk is where you DID stop, so it is never a near miss
           — it is either the bite itself or a safe landing. */
        brush: n !== landed && heads.has(n),
      });
    }
  }

  /* ── the fall, or the climb ── */
  if (to < landed) {
    const s = board.snakes.find((x) => x.from === landed);
    if (s) {
      const a = cellCenter(s.from);
      const b = cellCenter(s.to);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      legs.push({
        kind: "slide",
        pts: spine(a, b, { waves: wavesFor(len), amp: s.boss ? 0.13 : 0.17, phase: board.snakes.indexOf(s) % 2 === 0 ? 1 : -1 }),
        ms: Math.max(SLIDE_MIN_MS, (landed - to) * SLIDE_MS_PER_SQUARE),
        cell: to,
        boss: !!s.boss,
      });
    }
  } else if (to > landed) {
    const l = board.ladders.find((x) => x.from === landed);
    if (l) {
      const g = ladderGeometry(cellCenter(l.from), cellCenter(l.to));
      legs.push({
        kind: "climb",
        geo: g,
        ms: Math.max(420, g.stops * CLIMB_MS_PER_RUNG),
        cell: to,
      });
    }
  }

  if (!legs.length) return null;
  legs.push({ kind: "settle", cell: to, ms: SETTLE_MS });
  return legs;
}

/* Runs a script and reports, every frame, where the piece is and
   which square is lit under it. Returns null when nothing is moving,
   which is the signal to the board to draw the piece on its square
   like any other. */
export default function useTokenWalk(board, onDone) {
  const [frame, setFrame] = useState(null);
  const raf = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  /* The script currently playing, so a second move arriving mid-walk
     cannot leave two loops fighting over one piece. */
  const runRef = useRef(null);

  const cancel = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
    runRef.current = null;
  };

  useEffect(() => cancel, []);

  /* STABLE, and that is load-bearing rather than tidy.

     play() used to be rebuilt on every render, and the caller had it
     in an effect's dependency array — so the effect re-ran on every
     render and its cleanup cancelled the move fetch that was still in
     flight. Nothing errored. Moves simply never played: the board
     drew every piece on its square, correctly, for ever. Two hours of
     an animation that was written, wired, and never once run.

     The board only changes when the host changes the table, so the
     identity of this function should change then and at no other
     time. */
  const play = useCallback((seat, move) => {
    const legs = scriptFor(move, board);
    if (!legs) {
      setFrame(null);
      doneRef.current?.();
      return;
    }
    cancel();
    const run = { seat, legs, i: 0, started: now(), spent: 0 };
    runRef.current = run;

    /* Sound fires on ENTERING a leg, not on a timer beside it, so a
       dropped frame delays the hiss with the picture instead of
       playing it over the wrong part of the move. */
    const enter = (leg) => {
      if (leg.kind === "step") {
        playSound("hop");
        if (leg.brush) playSound("snake", { gain: 0.28 });
      } else if (leg.kind === "slide") {
        playSound("snake");
      } else if (leg.kind === "climb") {
        playSound("ladder");
      }
    };
    enter(legs[0]);

    const tick = () => {
      const r = runRef.current;
      if (!r) return;
      const leg = r.legs[r.i];
      const t = Math.min(1, (now() - r.started - r.spent) / leg.ms);

      if (leg.kind === "step" || leg.kind === "settle") {
        setFrame({ seat: r.seat, cell: leg.cell, at: null });
      } else if (leg.kind === "slide") {
        setFrame({ seat: r.seat, cell: leg.cell, at: pointAt(leg.pts, t) });
      } else if (leg.kind === "climb") {
        /* Rung by rung rather than smoothly: the piece rests a beat
           on each rung, which is what makes it read as climbing
           rather than as being dragged up a line. */
        const stop = Math.min(leg.geo.stops, Math.floor(t * leg.geo.stops) + (t >= 1 ? 0 : 0));
        const u = leg.geo.stops ? stop / leg.geo.stops : t;
        setFrame({ seat: r.seat, cell: leg.cell, at: leg.geo.at(t >= 1 ? 1 : u) });
      }

      if (t >= 1) {
        r.i += 1;
        r.spent += leg.ms;
        if (r.i >= r.legs.length) {
          runRef.current = null;
          raf.current = 0;
          setFrame(null);
          doneRef.current?.();
          return;
        }
        enter(r.legs[r.i]);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [board]);

  return { frame, play, busy: !!frame };
}
