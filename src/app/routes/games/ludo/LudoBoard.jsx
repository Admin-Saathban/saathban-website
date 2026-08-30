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

const CELL = 40; // viewBox units per grid cell
const SIZE = 15 * CELL;
const STEP_MS = 110; // one square of travel

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
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Ludo board"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          background: C.cream,
          borderRadius: 18,
          border: `2px solid ${C.warmGray}`,
          transform: spin ? `rotate(${spin}deg)` : undefined,
        }}
      >
        {/* ── Yards: a 6×6 block with a 2×2 court of four spots ── */}
        {YARD_ORIGIN.map(([c, r], seat) => (
          <g key={`yard-${seat}`} opacity={seat < seatsInPlay ? 1 : 0.25}>
            <rect
              x={c * CELL + 4}
              y={r * CELL + 4}
              width={6 * CELL - 8}
              height={6 * CELL - 8}
              rx={16}
              fill={SEAT_COLORS[seat]}
              opacity={0.9}
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
                fill={startSeat >= 0 ? SEAT_TINTS[startSeat] : C.white}
                stroke={startSeat >= 0 ? SEAT_COLORS[startSeat] : C.warmGray}
                strokeWidth={startSeat >= 0 ? 3 : 1}
                opacity={startSeat >= 0 && startSeat >= seatsInPlay ? 0.3 : 1}
              />
              {/* A STAR MEANS SAFE — one glyph, one meaning, on all
                  eight stop squares alike. It is deliberately not a
                  seat colour: safety belongs to whoever is standing
                  there, not to the seat whose arm it sits on. The
                  start squares carry their zone's tint and no star,
                  because on this board they are not safe. */}
              {isSafe && showStars && (
                <Upright
                  x={c * CELL + CELL / 2}
                  y={r * CELL + CELL / 2 + 9}
                  spin={spin}
                  fontSize={26}
                  fill="#2F2A24"
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
              opacity={seat < seatsInPlay ? 1 : 0.15}
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
              opacity={seat < seatsInPlay ? 0.9 : 0.15}
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
            const spread = seatsHere.length > 1 ? 15 : 0;
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
