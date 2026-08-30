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

   THE DICE LIVE IN THE MIDDLE, where thrown dice land. They are HTML
   over the SVG rather than inside it: a die is then a real button with
   a real tap target, upright however the board is turned, and the
   tumble is a plain CSS animation. Pass them in as children.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { COLORS as C } from "../../../../shared/tokens.js";
import Pawn from "../Pawn.jsx";
import {
  TRACK,
  HOME_COLUMNS,
  YARD_ORIGIN,
  YARD_SPOTS,
  START_ABS,
  SAFE_ABS,
  SEAT_COLORS,
  SEAT_TINTS,
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
function Arrow({ kind, cell, angle, seat, seatsInPlay }) {
  const [c, r] = cell;
  const x = c * CELL + CELL / 2;
  const y = r * CELL + CELL / 2;
  const colored = kind !== "flow";
  const stroke = colored ? SEAT_COLORS[seat] : "#8A7B66";
  // An arrow into a seat nobody is sitting at would be an instruction
  // to nowhere, so it fades with its yard.
  const dim = colored && seat >= seatsInPlay;
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${angle})`}
      opacity={dim ? 0.12 : colored ? 0.95 : 0.55}
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
  }
`;

const CELL = 40; // viewBox units per grid cell
const SIZE = 15 * CELL;
const STEP_MS = 110; // one square of travel

/* A shield, centred on (x, y) and about 2r across: flat shoulders,
   straight flanks, and a rounded point at the bottom. Wider than it
   is tall below the shoulder line, so it still reads as a shield at
   the size a phone actually draws it. */
function shieldPath(x, y, r) {
  const w = r * 1.06;
  const top = y - r * 0.92;
  const shoulder = y + r * 0.18;
  const point = y + r * 1.06;
  return (
    `M ${x - w} ${top} L ${x + w} ${top} L ${x + w} ${shoulder}` +
    ` Q ${x + w} ${y + r * 0.7} ${x} ${point}` +
    ` Q ${x - w} ${y + r * 0.7} ${x - w} ${shoulder} Z`
  );
}

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
  const prevRef = useRef(pieces);
  const key = JSON.stringify(pieces);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = pieces;
    if (!prev || prev.length !== pieces.length) {
      setShown(pieces);
      return undefined;
    }

    const walkers = [];
    let steps = 0;
    pieces.forEach((row, s) =>
      row.forEach((p, i) => {
        const from = Number(prev[s]?.[i] ?? p);
        if (p > from && from > 0 && p <= 57) {
          walkers.push([s, i, from, p]);
          steps = Math.max(steps, p - from);
        }
      })
    );
    // Nothing walked, or a jump too long to be one move (a rematch, a
    // fresh load, a voided chain snapping back): just show the truth.
    if (!walkers.length || steps > 12) {
      setShown(pieces);
      return undefined;
    }

    const base = prev.map((r) => [...r]);
    pieces.forEach((row, s) =>
      row.forEach((p, i) => {
        if (!walkers.some((w) => w[0] === s && w[1] === i)) base[s][i] = p;
      })
    );
    setShown(base.map((r) => [...r]));

    let step = 0;
    const id = setInterval(() => {
      step += 1;
      const next = base.map((r) => [...r]);
      walkers.forEach(([s, i, from, to]) => {
        next[s][i] = Math.min(to, from + step);
      });
      setShown(next);
      if (step >= steps) clearInterval(id);
    }, STEP_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return shown;
}

export default function LudoBoard({
  state,
  seatsInPlay,
  /* The options for the die the player has picked up, straight from
     ludo_desi_legal: [{piece, split, to, kind}]. Empty when it is not
     your move or you have not chosen a die. */
  options = [],
  currentSeat = -1,
  onPieceTap,
  mySeat = null,
  children,
}) {
  const rules = state?.rules || {};
  const showStars = (rules.safe_squares || "standard") === "standard";
  const live = state?.prov || state?.pieces || [];
  const pieces = useWalk(live);
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
          {/* a gold chip for the eight safe squares, domed and embossed */}
          <radialGradient id="sb-gold" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#FFF0B8" />
            <stop offset="45%" stopColor="#F2C044" />
            <stop offset="100%" stopColor="#C68A10" />
          </radialGradient>
          <filter id="sb-emboss" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0.8" stdDeviation="0.7" floodColor="#7a5406" floodOpacity="0.45" />
          </filter>
          {/* each zone's face: lit at the top-left, deepening away */}
          {SEAT_COLORS.map((hex, seat) => (
            <linearGradient key={seat} id={`sb-zone-${seat}`} x1="0" y1="0" x2="0.7" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
              <stop offset="40%" stopColor={hex} stopOpacity="1" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
            </linearGradient>
          ))}
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
          const startSeat = START_ABS.indexOf(abs);
          const isSafe = SAFE_ABS.includes(abs);
          return (
            <g key={`t-${abs}`}>
              <rect
                x={c * CELL + 1}
                y={r * CELL + 1}
                width={CELL - 2}
                height={CELL - 2}
                rx={6}
                fill={startSeat >= 0 ? SEAT_TINTS[startSeat] : "url(#sb-cell)"}
                filter="url(#sb-inset)"
                stroke={startSeat >= 0 ? SEAT_COLORS[startSeat] : C.warmGray}
                strokeWidth={startSeat >= 0 ? 3 : 1}
                opacity={1}
              />
              {/* A STAR MEANS SAFE — one glyph, one meaning, on all
                  eight stop squares alike. It is deliberately not a
                  seat colour: safety belongs to whoever is standing
                  there, not to the seat whose arm it sits on. The
                  start squares carry their zone's tint and no star,
                  because on this board they are not safe. */}
              {/* A GOLD CHIP, not an inked star. These eight squares
                  are the only place on the board a goti is safe, and
                  they should feel like something set INTO the card —
                  a domed brass counter with a shadow under it — rather
                  than something printed on top. The star sits on the
                  chip so the meaning survives at any size, and it is
                  still a shape rather than a colour: a person who
                  cannot tell gold from cream still sees a star. */}
              {isSafe && showStars && (
                <g filter="url(#sb-emboss)">
                  {/* THE CHIP IS THE SHIELD. The spec asks for a star
                      AND a shield so that safety is carried by two
                      shapes rather than one — right, because colour
                      alone never carries meaning here and a lone star
                      is a single point of failure for anyone who
                      cannot make it out.

                      But two glyphs crammed into a 40-unit cell fight
                      each other and beat the numerals underneath. So
                      the chip is SHAPED as a shield and the star sits
                      on it: one object, two readable shapes, and the
                      gold emboss my user asked for is untouched. */}
                  <path
                    d={shieldPath(c * CELL + CELL / 2, r * CELL + CELL / 2, CELL * 0.34)}
                    fill="url(#sb-gold)"
                    stroke="#9A6B08"
                    strokeWidth={0.9}
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={c * CELL + CELL / 2 - CELL * 0.09}
                    cy={r * CELL + CELL / 2 - CELL * 0.13}
                    r={CELL * 0.1}
                    fill="#FFFFFF"
                    opacity={0.4}
                  />
                  <Upright
                    x={c * CELL + CELL / 2}
                    y={r * CELL + CELL / 2 + 6.4}
                    spin={spin}
                    fontSize={21}
                    fontWeight="700"
                    fill="#4A3204"
                    aria-hidden="true"
                  >
                    ★
                  </Upright>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Which way you go ──
               Printed on the track like a real board's cloth, derived
               from the track itself so it can never point the wrong
               way after a geometry change. */}
        {allArrows({ every: 2 }).map((a, i) => (
          <Arrow key={`arw-${i}`} {...a} seatsInPlay={seatsInPlay} />
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
              fill={SEAT_COLORS[seat]}
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
                    cx={cx}
                    cy={cy}
                    r={21}
                    fill="none"
                    stroke={C.brown}
                    strokeWidth={3}
                    strokeDasharray="6 5"
                  />
                )}
                <Pawn seat={seat} cx={cx} cy={cy} r={p >= 57 ? 10 : 15} spin={spin} />
                {canTap && <circle cx={cx} cy={cy} r={26} fill="transparent" />}
              </g>
            );
          })
        )}
      </svg>

      {/* ── The dice tray: the middle 3×3 of the board, upright ── */}
      {children && (
        <div
          style={{
            position: "absolute",
            left: "42%",
            top: "42%",
            width: "16%",
            height: "16%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
