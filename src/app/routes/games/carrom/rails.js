/* ════════════════════════════════════════════════
   Carrom ⇄ games rails — the ONLY seam between carrom and the platform
   rails (0022_games engine + 0024_carrom executor). Verified live: a full
   game (foul → timed-out miss → win) runs through these RPCs.

   These call the rails RPCs directly (create_game_session, invite_to_game,
   respond_game_invite, play_turn, game_tick, reclaim_seat) plus carrom's own
   carrom_init. When the rails lane ships a `lib/games.js` convenience wrapper
   + a Realtime subscribe helper, this module delegates to it (and drops the
   poller) — the callers don't change. Contract: GAMES_CONTRACT.md.

   Conventions: current_seat / seat_no are 1-BASED on the rails; the client
   physics uses 0-based (mover = seat_no - 1). game_sessions.state holds the
   physics state (the rails never touch it).
   ════════════════════════════════════════════════ */

import supabase from "../../../lib/supabase.js";
import { CARROM_GAME_KEY, initialLayout } from "./physics.js";

export { CARROM_GAME_KEY };

const rpc = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};

/* Create a 1v1 carrom session; the creator takes seat 1. Returns the id. */
export function createCarromSession({ turnSeconds = 60 } = {}) {
  return rpc("create_game_session", {
    p_game: CARROM_GAME_KEY,
    p_seats: 2,
    p_house_rules: { turn_seconds: turnSeconds },
  });
}

export function inviteToGame(sessionId, profileId) {
  return rpc("invite_to_game", { p_session: sessionId, p_invitee: profileId });
}
export function respondInvite(inviteId, accept) {
  return rpc("respond_game_invite", { p_invite: inviteId, p_accept: accept });
}

/* Set the opening board once (deterministic layout; first-writer-wins). */
export function initBoard(sessionId, state = initialLayout()) {
  return rpc("carrom_init", { p_session: sessionId, p_state: state });
}

/* Commit a resolved shot for server validation + turn bookkeeping. The
   payload is exactly what game_exec_carrom validates. */
export function submitShot(sessionId, shot, result) {
  return rpc("play_turn", {
    p_session: sessionId,
    p_payload: { shot, outcome: result.outcome, endState: result.endState },
  });
}

/* Client-driven tick so a visible countdown resolves at zero. For carrom
   (timeout_style='pass_turn') a lapsed turn is passed — no bot shot. */
export function tick(sessionId) {
  return rpc("game_tick", { p_session: sessionId });
}
export function reclaim(sessionId) {
  return rpc("reclaim_seat", { p_session: sessionId });
}

/* Read a session and its seats (RLS: participants + invitees). Shaped for
   the board/controller: 0-based current seat, my seat, board state. */
export async function fetchSession(sessionId, myProfileId) {
  const [{ data: s, error: e1 }, { data: seats, error: e2 }] = await Promise.all([
    supabase.from("game_sessions")
      .select("id, status, seats_total, state, current_seat, turn_started_at, winner_seat, house_rules")
      .eq("id", sessionId).maybeSingle(),
    supabase.from("game_seats")
      .select("seat_no, profile_id, is_bot, presence, missed_turns, score")
      .eq("session_id", sessionId).order("seat_no", { ascending: true }),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  if (!s) return null;
  const mine = (seats || []).find((x) => x.profile_id === myProfileId);
  return {
    id: s.id,
    status: s.status,
    state: s.state && s.state.pieces ? s.state : null,
    seatsTotal: s.seats_total,
    seats: seats || [],
    currentSeat0: s.current_seat != null ? s.current_seat - 1 : null,
    mySeat0: mine ? mine.seat_no - 1 : null,
    isMyTurn: !!mine && s.current_seat === mine.seat_no && s.status === "active",
    turnStartedAt: s.turn_started_at,
    turnSeconds: (s.house_rules && s.house_rules.turn_seconds) || 60,
    winnerSeat0: s.winner_seat != null ? s.winner_seat - 1 : null,
  };
}

/* Poll a session (until Realtime is standardised in lib/games.js). Returns
   an unsubscribe. Ticks the server when it's a human turn that has lapsed,
   so the countdown resolves without waiting on cron. */
export function subscribeSession(sessionId, myProfileId, onChange, intervalMs = 2500) {
  let alive = true;
  const poll = async () => {
    if (!alive) return;
    try {
      const v = await fetchSession(sessionId, myProfileId);
      if (!alive || !v) return;
      onChange(v);
      if (v.status === "active" && v.turnStartedAt) {
        const deadline = new Date(v.turnStartedAt).getTime() + v.turnSeconds * 1000;
        if (Date.now() > deadline + 500) tick(sessionId).catch(() => {});
      }
    } catch {
      /* transient — the next poll retries */
    }
  };
  poll();
  const h = setInterval(poll, intervalMs);
  return () => { alive = false; clearInterval(h); };
}

/* Chat-transform: create a carrom session from a DM and invite the other
   person, returning the session id the thread renders <CarromRailsController>
   against. The inline-in-thread embed is the community DM lane's hook (a
   message/attachment carrying game_session_id) — see CARROM_WIRING.md. */
export async function startCarromInThread(opponentId, { turnSeconds = 60 } = {}) {
  const sessionId = await createCarromSession({ turnSeconds });
  await inviteToGame(sessionId, opponentId);
  return sessionId;
}
