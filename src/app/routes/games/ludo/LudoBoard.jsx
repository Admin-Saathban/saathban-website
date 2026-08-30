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
import { COLORS as C } from "../../../../shared/tokens.js";
import { SEAT_LIGHT, SEAT_DEEP } from "../seatColors.js";
import Pawn from "../Pawn.jsx";
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
  SEAT_TINTS,
  armSeatOf,
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
  const colored = kind !== "flow";
  const stroke = colored ? SEAT_COLORS[seat] : "#8A7B66";
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${angle})`}
      opacity={colored ? 0.95 : 0.55}
      aria-hidden="true"
      fill="none"
      stroke={stroke}
      strokeWidth={colored ? 4 : 3.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "entry" && <path d="M -11 11 Q -11 0 -2 0" />}
      {kind === "flow" && <path d="M -11 0 L 1 0" />}
      {kind === "home" && <path d="M -9 0 L 1 0" />}
      <path d="M -5 -6 L 3 0 L -5 6" />
    </g>
  );
}

/* Six directions on a ring, deliberately not eight: an odd scatter
   reads as a burst, a regular one reads as a compass rose. */
const SPARKS = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 + 0.35;
  return [Math.cos(a), Math.sin(a)];
});

export const BOARD_MOTION_CSS = `
  @keyframes sb-spark {
    0%   { opacity: 0;   transform: scale(0.25); }
    30%  { opacity: 0.95; }
    100% { opacity: 0;   transform: scale(1); }
  }
  .sb-spark {
    transform-box: fill-box;
    transform-origin: 0% 50%;
    animation: sb-spark 620ms ease-out both;
  }

  /* The ring round a goti you can move, breathing.

     NO SCALE, and not because it looks worse: these pieces are placed
     by cx/cy, so a scale pivots on the SVG origin and throws them off
     the board. Stroke width and opacity both animate safely and pivot
     on nothing. */
  @keyframes sb-pulse {
    0%, 100% { stroke-opacity: 0.55; stroke-width: 3;   }
    50%      { stroke-opacity: 1;    stroke-width: 4.6; }
  }
  .sb-pulse { animation: sb-pulse 1150ms ease-in-out infinite; }

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
    to   { transform: rotate(400deg); }
  }
  .sb-tumble-home {
    transform-box: fill-box;
    transform-origin: 50% 50%;
    animation: sb-tumble-home 480ms linear both;
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
  }
`;

const CELL = 40; // viewBox units per grid cell
const SIZE = 15 * CELL;
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

const STEP_MS = 120;
/* How long a captured goti takes to get home. It travels in a straight
   line rather than back along the track: it is not walking the board,
   it is being sent off it. */
const FLIGHT_MS = 480;


/* A label that stays upright however the board is turned. */
function Upright({ x, y, spin, children, ...props }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      transform={spin ? `rotate(${-spin} ${x} ${y})` : undefined}
      {...props}
    >
      {children}
    </text>
  );
}

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

function useWalk(pieces) {
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

    const flightTicks = Math.round(FLIGHT_MS / STEP_MS);
    const total = Math.max(steps, returners.length ? flightTicks : 0);
    let step = 0;
    const crossed = [];

    const id = setInterval(() => {
      step += 1;

      const next = base.map((r) => [...r]);
      walkers.forEach(([s2, i, from, to]) => {
        const at = Math.min(to, from + step);
        next[s2][i] = at;
        if (at > from) crossed.push(cellFor(s2, at, i));
      });
      setShown(next);
      if (crossed.length) setTrail([...crossed]);

      if (returners.length) {
        const t = Math.min(1, step / flightTicks);
        /* Ease out: a taken goti leaves fast and settles. */
        const e = 1 - (1 - t) * (1 - t);
        const m = new Map();
        returners.forEach(([s2, i, a, b]) => {
          m.set(`${s2}:${i}`, [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e]);
        });
        setFlights(t >= 1 ? new Map() : m);
      }

      if (step >= total) {
        clearInterval(id);
        setShown(pieces);
        setFlights(new Map());
        /* The celebration starts when the goti ARRIVES, not when the
           move began — it has to be on the square to be cheered. */
        if (home.size) {
          setArrivedHome(home);
          window.setTimeout(() => setArrivedHome(new Set()), 1500);
        }
        /* Let the trail linger a beat past the move, then clear it —
           the point is to be readable after the goti has stopped. */
        window.setTimeout(() => setTrail([]), 420);
      }
    }, STEP_MS);

    return () => {
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { shown, flights, trail, arrivedHome, closeCalls };
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

export default function LudoBoard({
  state,
  /* The options for the die the player has picked up, straight from
     ludo_desi_legal: [{piece, split, to, kind}]. Empty when it is not
     your move or you have not chosen a die. */
  options = [],
  currentSeat = -1,
  onPieceTap,
  mySeat = null,
}) {
  const rules = state?.rules || {};
  const showStars = (rules.safe_squares || "standard") === "standard";
  const live = state?.prov || state?.pieces || [];
  const { shown: pieces, flights, trail, arrivedHome, closeCalls } = useWalk(live);
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
        className={shake ? "sb-shake" : undefined}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Ludo board"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          background: "transparent",
          borderRadius: 18,
          filter: "drop-shadow(0 4px 10px rgba(74,58,34,0.20))",
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
          {/* the board's own paper, warmer at the edges than the middle */}
          <radialGradient id="sb-felt" cx="50%" cy="42%" r="72%">
            <stop offset="0%" stopColor="#FFFDF7" />
            <stop offset="70%" stopColor="#FAF3E6" />
            <stop offset="100%" stopColor="#EFE2CB" />
          </radialGradient>
          {/* a track cell: light from above, pressed in at the top */}
          <linearGradient id="sb-cell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#FDFAF3" />
            <stop offset="100%" stopColor="#F2E9D8" />
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
          {SEAT_COLORS.map((hex, seat) => (
            <linearGradient key={`a${seat}`} id={`sb-arm-${seat}`} x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0%" stopColor={SEAT_LIGHT[seat]} />
              <stop offset="55%" stopColor={hex} />
              <stop offset="100%" stopColor={SEAT_DEEP[seat]} />
            </linearGradient>
          ))}
          {/* The frame: timber, lit from above. */}
          <linearGradient id="sb-frame" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8963F" />
            <stop offset="35%" stopColor="#A2712A" />
            <stop offset="100%" stopColor="#6E4715" />
          </linearGradient>
          {/* A cell bevel: light along the top edge, shadow along the
              bottom, so a track square is pressed into the board
              rather than painted on it. */}
          <linearGradient id="sb-bevel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#7A6238" stopOpacity="0.28" />
          </linearGradient>
        </defs>

        {/* the board's paper, under everything */}
        <rect x={0} y={0} width={SIZE} height={SIZE} rx={14} fill="url(#sb-felt)" />

        {/* ── Yards: a 6×6 block with a 2×2 court of four spots ── */}
        {YARD_ORIGIN.map(([c, r], seat) => (
          <g key={`yard-${seat}`}>
            <rect
              x={c * CELL + 4}
              y={r * CELL + 4}
              width={6 * CELL - 8}
              height={6 * CELL - 8}
              rx={16}
              fill={SEAT_COLORS[seat]}
              opacity={0.9}
            />
            {/* the lit face over the flat colour */}
            <rect
              x={c * CELL + 4}
              y={r * CELL + 4}
              width={6 * CELL - 8}
              height={6 * CELL - 8}
              rx={16}
              fill={`url(#sb-zone-${seat})`}
              style={{ mixBlendMode: "multiply" }}
              opacity={0.55}
            />
            <rect
              x={(c + 1) * CELL}
              y={(r + 1) * CELL}
              width={4 * CELL}
              height={4 * CELL}
              rx={12}
              fill={C.white}
              stroke={SEAT_COLORS[seat]}
              strokeWidth={2}
            />
            {YARD_SPOTS.map(([sc, sr], i) => (
              <circle
                key={i}
                cx={(c + sc) * CELL}
                cy={(r + sr) * CELL}
                r={CELL * 0.38}
                fill={SEAT_TINTS[seat]}
                stroke={SEAT_COLORS[seat]}
                strokeWidth={1.5}
              />
            ))}
          </g>
        ))}

        {/* ── The 52-square track ── */}
        {TRACK.map(([c, r], abs) => {
          const isSafe = SAFE_ABS.includes(abs);
          const isStart = STARTS.includes(abs);
          const safeSeat = isSafe ? armSeatOf(abs) : -1;
          return (
            <g key={`t-${abs}`}>
              <rect
                x={c * CELL + 1}
                y={r * CELL + 1}
                width={CELL - 2}
                height={CELL - 2}
                rx={6}
                /* A STOP IS A COLOURED SQUARE. The eight safe cells are
                   painted the colour of the ARM they sit on — a stop on
                   the yellow arm is a yellow cell — so it reads at a
                   glance, from across a table, without a glyph to
                   decode. That is what the gold chips failed at: they
                   were small, they were goti-shaped, and a board should
                   have exactly one goti-shaped thing on it. */
                fill={safeSeat >= 0 ? `url(#sb-arm-${safeSeat})` : "url(#sb-cell)"}
                stroke={safeSeat >= 0 ? SEAT_DEEP[safeSeat] : "#E2D6BE"}
                strokeWidth={safeSeat >= 0 ? 1.6 : 1}
              />
              {/* The bevel, over every cell: a highlight along the top
                  edge and a shadow along the bottom. Drawn as an
                  overlay rather than a filter so it costs one rect and
                  survives whatever the cell underneath is painted. */}
              <rect
                x={c * CELL + 1}
                y={r * CELL + 1}
                width={CELL - 2}
                height={CELL - 2}
                rx={6}
                fill="url(#sb-bevel)"
                pointerEvents="none"
              />
              {/* A WHITE STAR marks the four cells where a goti ENTERS
                  play. All eight coloured cells are stops; only these
                  four are also a door, and the star is what separates
                  them. White, because it has to read on four different
                  saturated colours. */}
              {isStart && (
                <Upright
                  x={c * CELL + CELL / 2}
                  y={r * CELL + CELL / 2 + 7.5}
                  spin={spin}
                  fontSize={22}
                  fontWeight="700"
                  fill="#FFFFFF"
                  stroke={SEAT_DEEP[safeSeat]}
                  strokeWidth={0.9}
                  paintOrder="stroke"
                  aria-hidden="true"
                >
                  ★
                </Upright>
              )}
            </g>
          );
        })}

        {/* ── Which way you go ──
               Printed on the track like a real board's cloth, derived
               from the track itself so it can never point the wrong
               way after a geometry change. */}
        {allArrows({ every: 2 }).map((a, i) => (
          <Arrow key={`arw-${i}`} {...a} />
        ))}

        {/* ── Home columns: each arm's middle line, in the seat's colour ── */}
        {HOME_COLUMNS.map((cells, seat) =>
          cells.map(([c, r], i) => (
            <rect
              key={`h-${seat}-${i}`}
              x={c * CELL + 1}
              y={r * CELL + 1}
              width={CELL - 2}
              height={CELL - 2}
              rx={6}
              fill={SEAT_COLORS[seat]}
            />
          ))
        )}

        {/* ── The centre: four triangles, one per arm, meeting at home.
               Muted, because the dice sit on top of it. ── */}
        <g opacity={0.9}>
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
              fill={`url(#sb-zone-${seat})`}
              opacity={0.9}
              stroke={C.white}
              strokeWidth={2}
            />
          ))}
          <rect
            x={6 * CELL + 2}
            y={6 * CELL + 2}
            width={3 * CELL - 4}
            height={3 * CELL - 4}
            rx={14}
            fill="none"
            stroke={C.brown}
            strokeWidth={2.5}
          />
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
          SPARKS.map(([dx, dy], k) => (
            <line
              key={`spark-${i}-${k}`}
              className="sb-spark"
              x1={cc * CELL}
              y1={rr * CELL}
              x2={cc * CELL + dx * CELL * 0.62}
              y2={rr * CELL + dy * CELL * 0.62}
              stroke="#F2C044"
              strokeWidth={2.4}
              strokeLinecap="round"
              style={{ animationDelay: `${k * 22}ms` }}
              pointerEvents="none"
              aria-hidden="true"
            />
          ))
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
          return (
            <g key={`dest-${i}`}>
              <circle
                cx={cc * CELL}
                cy={rr * CELL}
                r={13}
                fill="none"
                stroke={C.green}
                strokeWidth={3.5}
                strokeDasharray="5 4"
                opacity={0.9}
              />
              <circle cx={cc * CELL} cy={rr * CELL} r={4} fill={C.green} opacity={0.9} />
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
                }`}
                onClick={canTap ? () => onPieceTap(i) : undefined}
                style={{ cursor: canTap ? "pointer" : "default" }}
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
                      rx={20}
                      ry={26}
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
                    className="sb-pulse"
                    cx={cx}
                    cy={cy}
                    r={21}
                    fill="none"
                    stroke={C.brown}
                    strokeWidth={3}
                    strokeDasharray="6 5"
                  />
                )}
                <Pawn
                  seat={seat}
                  cx={cx}
                  cy={cy}
                  r={p >= 57 ? 10 : 15}
                  spin={spin}
                  mood={moods.get(`${seat}:${i}`) || null}
                />
                {/* HOME. A goti that has just finished takes a moment
                    about it — the one unambiguously good thing that
                    can happen to a piece, and it used to happen in
                    total silence. */}
                {arrivedHome.has(`${seat}:${i}`) && (
                  <circle
                    className="sb-home"
                    cx={cx}
                    cy={cy}
                    r={13}
                    fill="none"
                    stroke="#FFD23F"
                    strokeWidth={2.6}
                    pointerEvents="none"
                    aria-hidden="true"
                  />
                )}
                {canTap && <circle cx={cx} cy={cy} r={26} fill="transparent" />}
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
        {[...flights.entries()].map(([k, [cc, rr]]) => {
          const [seat] = k.split(":").map(Number);
          return (
            <g key={`fly-${k}`}>
              <ellipse cx={cc * CELL} cy={rr * CELL + 13} rx={11} ry={3.4} fill="#00000030" />
              {/* It spins on the way home. Rotation about the piece's
                  OWN centre — transform-box fill-box — because a bare
                  rotate on an SVG child pivots on the viewport origin
                  and would fling it off the board. */}
              <g className="sb-tumble-home">
                <Pawn seat={seat} cx={cc * CELL} cy={rr * CELL} r={15} spin={spin} />
              </g>
            </g>
          );
        })}

        {/* THE FRAME, drawn last so it laps over every cell edge and
            the board ends somewhere definite. Two strokes: the timber
            itself, and a thin light line inside it for the lip. */}
        <rect
          x={2}
          y={2}
          width={SIZE - 4}
          height={SIZE - 4}
          rx={16}
          fill="none"
          stroke="url(#sb-frame)"
          strokeWidth={9}
          pointerEvents="none"
        />
        <rect
          x={7}
          y={7}
          width={SIZE - 14}
          height={SIZE - 14}
          rx={12}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.32}
          strokeWidth={1.4}
          pointerEvents="none"
        />
      </svg>

    </div>
  );
}
