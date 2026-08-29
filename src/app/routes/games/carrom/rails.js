/* ════════════════════════════════════════════════
   Carrom ⇄ games rails — the ONLY seam between carrom and the platform
   rails (lib/games.js + 0020 engine + a carrom migration). Everything
   else in this folder is rails-independent and already tested.

   STATUS: the rails client (src/app/lib/games.js) and the carrom server
   RPCs do not exist yet — see GAMES_CONTRACT_ASKS.md (asks A1–A4) and the
   messages sent to the rails lane. This module is the shape carrom will
   fill in the moment they land; each function names exactly the rails
   call it needs. Nothing here is imported by the tested core, so the
   physics/board/logic ship and run standalone (CarromGame hotseat) today.

   Mapping (from the rails contract):
   - game_sessions.state (jsonb)  ← our physics state { pieces, queenCovered, … }
   - game_sessions.current_seat   ← whose turn (1-based on the rails; we use 0-based)
   - game_sessions.turn_started_at + house_rules.turn_seconds ← the countdown
   - game_seats.score             ← coins pocketed
   - game_moves.move (jsonb)      ← the shot payload + outcome (asks A1)
   ════════════════════════════════════════════════ */

// import games from "../../../../lib/games.js";  // ← enable once it exists
// import supabase from "../../../../lib/supabase.js";

const NOT_WIRED = "Carrom rails not wired yet — lib/games.js + carrom RPCs pending (GAMES_CONTRACT_ASKS.md A1–A4).";

/* Create a carrom session (2 seats for 1v1). Rails: create_game_session
   ('carrom', seats, { turn_seconds }). Returns the session id. */
export async function createCarromSession(/* { seats = 2, turnSeconds = 60 } = {} */) {
  throw new Error(NOT_WIRED);
  // return games.createSession('carrom', seats, { turn_seconds: turnSeconds });
}

/* Live session → the `game` shape CarromGame/CarromBoard consume:
   { state, seat (0-based current), seats, status, winner, turnStartedAt }.
   Rails: subscribe to game_sessions (Realtime, if exposed) or poll. */
export function subscribeSession(/* sessionId, onChange */) {
  throw new Error(NOT_WIRED);
}

/* Commit a resolved shot for server validation. The server RE-RUNS
   resolveShot(state, shot, seat) and must agree with `result.outcome`
   before it writes state/score/move and advances the turn (asks A1).
   Rails: carrom_submit_move(sessionId, { shot, outcome, endState }). */
export async function submitShot(/* sessionId, shot, result */) {
  throw new Error(NOT_WIRED);
}

/* Client-driven timeout resolve for a snappy on-screen countdown: a
   carrom lapse is a MISSED turn — pass, NO bot shot (asks A2). Rails:
   carrom_pass_timed_out_turn(sessionId); carrom is excluded from
   game_tick() so its CASE-else never fires. */
export async function passIfTimedOut(/* sessionId */) {
  throw new Error(NOT_WIRED);
}

/* Chat-transform: create a session from inside a DM thread and return a
   reference the thread can render <CarromBoard/> against (asks A4).
   Needs the community DM lane to allow an embedded game view. */
export async function startCarromInThread(/* threadId, opponentId */) {
  throw new Error(NOT_WIRED);
}

export const CARROM_GAME_KEY = "carrom";
