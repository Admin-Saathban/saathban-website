/* ════════════════════════════════════════════════
   Carrom turn logic — a pure reducer over the physics outcome. Shared by
   the standalone hotseat controller and (once wired) the rails controller,
   and unit-tested headlessly.

   Turn rules (SPEC + carrom-specific):
   - Pocket one of your own with no foul → you shoot again (continues).
   - Foul (striker pocketed, or an opponent coin pocketed) → turn passes.
   - A plain miss → turn passes.
   - A TIMED-OUT turn is simply MISSED: it passes to the opponent with NO
     bot shot (carrom's departure from the rails' bot-plays-the-seat default).
     Never a forfeit — coming back is always the next turn.
   - Win: the physics reports a winner (all your coins down + queen covered).
   ════════════════════════════════════════════════ */

import { initialLayout } from "./physics.js";

// Default per-turn clock — mirrors the rails' house_rules.turn_seconds default.
export const TURN_SECONDS = 60;

export function newGame(seats = 2) {
  return {
    state: initialLayout(),
    seat: 0,
    seats,
    status: "active", // active | finished
    winner: null,
    misses: seats === 2 ? [0, 0] : Array.from({ length: seats }, () => 0),
    message: null, // { kind: 'score'|'foul'|'missed'|'win', … }
    turn: 0, // increments each turn change — handy for a countdown key
  };
}

/* Fold a resolved shot into the game. `result` is resolveShot()'s return. */
export function applyShotResult(g, result) {
  if (g.status !== "active") return g;
  const state = result.endState;

  if (result.winner != null) {
    return { ...g, state, status: "finished", winner: result.winner,
      message: { kind: "win", seat: result.winner }, turn: g.turn + 1 };
  }

  let message;
  if (result.outcome.foul) {
    message = { kind: "foul", reason: result.outcome.foulReason, seat: g.seat };
  } else if (result.outcome.scored.length > 0) {
    message = { kind: "score", n: result.outcome.scored.length, seat: g.seat, queen: result.outcome.queen };
  } else {
    message = { kind: "miss", seat: g.seat };
  }

  const continues = result.continues;
  const seat = continues ? g.seat : (g.seat + 1) % g.seats;
  return { ...g, state, seat, message, turn: continues ? g.turn : g.turn + 1 };
}

/* A timed-out turn: MISSED — pass to the opponent, no shot played. */
export function applyTimeout(g) {
  if (g.status !== "active") return g;
  const misses = g.misses.slice();
  misses[g.seat] = (misses[g.seat] || 0) + 1;
  return {
    ...g,
    seat: (g.seat + 1) % g.seats,
    misses,
    message: { kind: "missed", seat: g.seat },
    turn: g.turn + 1,
  };
}
