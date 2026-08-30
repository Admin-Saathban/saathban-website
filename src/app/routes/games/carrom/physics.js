/* ════════════════════════════════════════════════
   Carrom — simplified, DETERMINISTIC client physics (rails-independent).

   Pure functions, no randomness, no time source: given a board state and
   a shot, `resolveShot` returns the exact end state and the move outcome
   (coins pocketed, fouls, queen status, whether the turn continues, a
   winner). The server re-runs the same function to validate the client's
   claimed outcome — the client can't cheat because the physics is fixed.

   Coordinates are normalized to a unit board [0,1]×[0,1]; the renderer
   scales to pixels. All pieces are circles. Two players own a colour each
   in 1v1: player 0 = 'w' (white), player 1 = 'b' (black); 'q' is the queen.

   Simplified rules (SPEC: "simplified queen rules"). Written out in
   full, with the reasoning, under "Rules of record" in
   GAMES_CONTRACT.md, and asserted by tests/carrom-rules.mjs:
   - Pocket one of YOUR coins with no foul → you shoot again.
   - Pocket the striker → foul (turn passes) and one of your pocketed
     coins returns to the centre band: a coin from an EARLIER shot by
     preference; failing that, this shot's coin goes back and does not
     score. Never a coin claimed as scored, because the server refuses
     a claim it cannot see on the board.
   - Pocket an OPPONENT coin → foul (it stays down; turn passes).
   - Queen: counts only if "covered" — you pocket one of your own coins
     in the SAME shot, or you have no coins left to cover her with.
     Otherwise the queen returns to centre.
   - Win: all your coins pocketed AND the queen has been covered.
   ════════════════════════════════════════════════ */

export const CARROM_GAME_KEY = "carrom"; // registry key on the games rails

export const BOARD = 1.0;
export const POCKET_R = 0.052;
export const COIN_R = 0.028;
export const STRIKER_R = 0.036;
export const QUEEN_R = 0.028;

const POCKETS = [
  { x: 0, y: 0 }, { x: BOARD, y: 0 }, { x: 0, y: BOARD }, { x: BOARD, y: BOARD },
];

// Simulation tuning (kept gentle — forgiving, readable motion).
const DT = 1 / 120;
const MAX_STEPS = 3000;
const FRICTION = 0.986; // per step velocity retention
const STOP_V = 0.0009; // below this speed a piece is at rest
const WALL_REST = 0.6;
const COIN_REST = 0.92;
export const MAX_LAUNCH_SPEED = 2.2; // power 1.0 → this speed (board units/sec)

/* The opening layout: queen at centre, six of each colour ringed around it. */
export function initialLayout() {
  const cx = 0.5, cy = 0.5;
  const pieces = [{ id: "q", owner: "queen", r: QUEEN_R, x: cx, y: cy, vx: 0, vy: 0, pocketed: false }];
  const ring = COIN_R * 2.15;
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI / 6) * i;
    const owner = i % 2 === 0 ? "w" : "b";
    pieces.push({
      id: `${owner}${i}`,
      owner,
      r: COIN_R,
      x: cx + Math.cos(a) * ring,
      y: cy + Math.sin(a) * ring,
      vx: 0,
      vy: 0,
      pocketed: false,
    });
  }
  return {
    pieces,
    queenCovered: false, // becomes true once the queen is legally covered
    queenPocketed: false,
  };
}

export const OWNER_OF = { 0: "w", 1: "b" };
export function coinsLeft(state, owner) {
  return state.pieces.filter((p) => p.owner === owner && !p.pocketed).length;
}

/* One physics tick over a working array of live pieces (mutates in place).
   Returns the ids pocketed on this tick. */
function step(live) {
  const pocketed = [];
  for (const p of live) {
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    p.vx *= FRICTION;
    p.vy *= FRICTION;
    if (Math.hypot(p.vx, p.vy) < STOP_V) { p.vx = 0; p.vy = 0; }
    // walls
    if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx) * WALL_REST; }
    if (p.x > BOARD - p.r) { p.x = BOARD - p.r; p.vx = -Math.abs(p.vx) * WALL_REST; }
    if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy) * WALL_REST; }
    if (p.y > BOARD - p.r) { p.y = BOARD - p.r; p.vy = -Math.abs(p.vy) * WALL_REST; }
  }
  // pair collisions (elastic, equal mass) with positional separation
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1e-6;
      const min = a.r + b.r;
      if (dist < min) {
        const nx = dx / dist, ny = dy / dist;
        const overlap = (min - dist) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        // relative velocity along the normal
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const imp = -(1 + COIN_REST) * vn / 2; // equal mass
          a.vx -= imp * nx; a.vy -= imp * ny;
          b.vx += imp * nx; b.vy += imp * ny;
        }
      }
    }
  }
  // pocket capture (centre within pocket radius)
  for (let k = live.length - 1; k >= 0; k--) {
    const p = live[k];
    for (const pk of POCKETS) {
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < POCKET_R) {
        pocketed.push(p.id);
        live.splice(k, 1);
        break;
      }
    }
  }
  return pocketed;
}

/* Simulate a launched striker among the live pieces until everything rests.
   Returns { live (final positions), pocketedOrder, frames }. Deterministic.
   frames (when recordFrames) is a downsampled trajectory for the renderer:
   each frame is [{ id, x, y, owner, r }] of the still-live pieces. */
export function simulate(pieces, striker, recordFrames = false) {
  const live = [
    ...pieces.filter((p) => !p.pocketed).map((p) => ({ ...p })),
    { ...striker, id: "striker", owner: "striker", r: STRIKER_R, pocketed: false },
  ];
  const pocketedOrder = [];
  const frames = recordFrames ? [] : null;
  const snap = () => frames.push(live.map((p) => ({ id: p.id, x: p.x, y: p.y, owner: p.owner, r: p.r })));
  if (recordFrames) snap();
  for (let s = 0; s < MAX_STEPS; s++) {
    const got = step(live);
    for (const id of got) pocketedOrder.push(id);
    if (recordFrames && s % 2 === 0) snap();
    if (live.every((p) => p.vx === 0 && p.vy === 0)) break;
  }
  if (recordFrames) snap();
  return { live, pocketedOrder, frames };
}

/* Resolve one shot. `shot` = { x, y, angle, power } — striker launch from
   (x,y) at `angle` (radians) with `power` in [0,1]. `mover` is 0 or 1.
   Returns { endState, outcome, continues, winner }. Pure. */
export function resolveShot(state, shot, mover, opts = {}) {
  const myColour = OWNER_OF[mover];
  const oppColour = OWNER_OF[mover === 0 ? 1 : 0];
  const speed = Math.max(0, Math.min(1, shot.power)) * MAX_LAUNCH_SPEED;
  const striker = {
    x: shot.x, y: shot.y, r: STRIKER_R,
    vx: Math.cos(shot.angle) * speed,
    vy: Math.sin(shot.angle) * speed,
  };

  const { live, pocketedOrder, frames } = simulate(state.pieces, striker, !!opts.frames);

  const strikerPocketed = pocketedOrder.includes("striker");
  const pocketedCoins = pocketedOrder.filter((id) => id !== "striker");
  const byId = (id) => state.pieces.find((p) => p.id === id);
  const scored = pocketedCoins.filter((id) => byId(id)?.owner === myColour);
  const oppScored = pocketedCoins.filter((id) => byId(id)?.owner === oppColour);
  const queenPocketedThisShot = pocketedCoins.includes("q");

  // Build the next piece list from the survivors + still-pocketed ones.
  const surviving = new Set(live.map((p) => p.id));
  let nextPieces = state.pieces.map((p) => {
    const l = live.find((x) => x.id === p.id);
    if (l) return { ...p, x: l.x, y: l.y, vx: 0, vy: 0, pocketed: false };
    if (!p.pocketed && !surviving.has(p.id)) return { ...p, pocketed: true, vx: 0, vy: 0 };
    return p;
  });

  let queenCovered = state.queenCovered;
  let queenPocketed = state.queenPocketed;
  let queen = "none"; // none | pocketed_covered | pocketed_uncovered

  // Fouls (simplified): striker in a pocket, or pocketing an opponent coin.
  let foul = false;
  let foulReason = null;
  if (strikerPocketed) { foul = true; foulReason = "striker_pocketed"; }
  else if (oppScored.length > 0) { foul = true; foulReason = "opponent_coin"; }

  /* ORDER MATTERS HERE, and it is the whole of this rule: THE PENALTY IS
     PAID BEFORE THE COVER IS DECIDED.

     Covering the queen means having a coin of your own down to answer
     for her. A coin that goes into a pocket and comes straight back out
     as a foul penalty answers for nothing — so it cannot buy a cover.
     Deciding the cover first (as this did until now) let a player sink
     the queen, their only coin and the striker together and walk away
     with a permanent cover bought by a coin that was back on the board
     before the shot had finished resolving, and unscored at that.

     So: pay the penalty, then look at the board and ask whether a coin
     of theirs is still down. */

  /* Striker-pocketed penalty: one of the mover's pocketed coins comes
     back to the centre band. A coin sunk on THIS shot is the last
     resort, because game_exec_carrom validates that every coin claimed
     as scored is pocketed in the end state — returning the very coin
     being claimed makes the server refuse the whole shot, and a legal
     shot then fails as though the tap did nothing. So: prefer a coin
     from an earlier shot; if this shot's coin is the only one there is,
     it goes back AND is not scored. A foul that pays its own penalty. */
  let scoredFinal = scored;
  if (strikerPocketed) {
    const justScored = new Set(scored);
    const earlier = nextPieces.find(
      (p) => p.owner === myColour && p.pocketed && !justScored.has(p.id)
    );
    const owned = earlier || nextPieces.find((p) => p.owner === myColour && p.pocketed);
    if (owned) {
      nextPieces = nextPieces.map((p) =>
        p.id === owned.id ? { ...p, pocketed: false, x: 0.5, y: 0.42, vx: 0, vy: 0 } : p
      );
      if (justScored.has(owned.id)) scoredFinal = scored.filter((id) => id !== owned.id);
    }
  }

  /* Coins of mine still on the board once the penalty has been paid —
     the number the cover rule and the win condition both turn on. */
  const myLeftAfterPenalty = nextPieces.filter((p) => p.owner === myColour && !p.pocketed).length;

  if (queenPocketedThisShot) {
    /* Covering means having one of your own down alongside her — judged
       on the board AFTER the penalty, so `scoredFinal`, not `scored`.
       Or, if you have none left at all, pocketing her covers her:
       without that second clause a player whose coins are all down can
       never cover her, since covering needs a coin they do not have.
       The queen would return to centre for ever and they could only win
       if the OPPONENT covered her. A soft deadlock, which is the worst
       kind — nothing errors. */
    if (scoredFinal.length > 0 || myLeftAfterPenalty === 0) {
      queen = "pocketed_covered";
      queenCovered = true;
      queenPocketed = true;
    } else {
      // Uncovered: the queen returns to the centre (simplified rule).
      queen = "pocketed_uncovered";
      nextPieces = nextPieces.map((p) =>
        p.id === "q" ? { ...p, pocketed: false, x: 0.5, y: 0.5, vx: 0, vy: 0 } : p
      );
    }
  }

  const endState = { pieces: nextPieces, queenCovered, queenPocketed };

  // You shoot again only if you legally pocketed one of your own and fouled not.
  const continues = scoredFinal.length > 0 && !foul;

  // Win: all your coins down AND the queen covered.
  const myLeft = endState.pieces.filter((p) => p.owner === myColour && !p.pocketed).length;
  const winner = myLeft === 0 && queenCovered ? mover : null;

  return {
    endState,
    continues,
    winner,
    frames,
    outcome: {
      scored: scoredFinal,
      oppScored,
      strikerPocketed,
      pocketed: pocketedCoins,
      queen,
      foul,
      foulReason,
    },
  };
}
