/* Data layer for the games platform (migrations 0022 / 0022b).
   Everything that moves a game forward goes through the server-side
   engine RPCs — the client never writes game tables directly except
   chat. See GAMES_CONTRACT.md for the rails contract. */

import { supabase } from "./supabase.js";

/* The riddle day rolls over on the server's calendar (UTC), so the
   client must ask for the same date the server considers "today". */
export function puzzleToday() {
  return new Date().toISOString().slice(0, 10);
}

// ── Registry ────────────────────────────────────────────────────────

export async function fetchGames() {
  const { data, error } = await supabase
    .from("games")
    .select("key, name_en, name_ur, tagline_en, tagline_ur, kind, min_seats, max_seats, enabled")
    .order("key");
  if (error) throw error;
  return data ?? [];
}

// ── Sessions ────────────────────────────────────────────────────────

const SESSION_COLS =
  "id, game_key, status, seats_total, house_rules, join_code, current_seat, turn_started_at, winner_seat, created_by, created_at, started_at, finished_at";

export async function fetchMySessions(profileId) {
  const { data, error } = await supabase
    .from("game_seats")
    .select(`seat_no, session:game_sessions(${SESSION_COLS})`)
    .eq("profile_id", profileId);
  if (error) throw error;
  return (data ?? [])
    .filter((r) => r.session)
    .map((r) => ({ ...r.session, my_seat: r.seat_no }))
    .sort((a, b) => {
      const rank = { active: 0, lobby: 1, finished: 2 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return new Date(b.created_at) - new Date(a.created_at);
    });
}

export async function fetchSession(sessionId) {
  const [{ data: session, error: e1 }, { data: seats, error: e2 }] = await Promise.all([
    supabase.from("game_sessions").select(SESSION_COLS).eq("id", sessionId).maybeSingle(),
    supabase
      .from("game_seats")
      .select("seat_no, profile_id, is_bot, presence, missed_turns, score")
      .eq("session_id", sessionId)
      .order("seat_no"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (!session) return null;

  const ids = (seats ?? []).map((s) => s.profile_id).filter(Boolean);
  let names = {};
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("safe_profiles")
      .select("id, full_name")
      .in("id", ids);
    names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]));
  }
  return {
    ...session,
    seats: (seats ?? []).map((s) => ({ ...s, name: s.profile_id ? names[s.profile_id] ?? null : null })),
  };
}

export async function fetchMoves(sessionId, afterId = 0) {
  const { data, error } = await supabase
    .from("game_moves")
    .select("id, seat_no, by_bot, move, created_at")
    .eq("session_id", sessionId)
    .gt("id", afterId)
    .order("id");
  if (error) throw error;
  return data ?? [];
}

// ── Engine RPCs (server-validated; the client only asks) ────────────

export async function createSession(gameKey, seats, houseRules = {}) {
  const { data, error } = await supabase.rpc("create_game_session", {
    p_game: gameKey,
    p_seats: seats,
    p_house_rules: houseRules,
  });
  if (error) throw error;
  return data; // session id
}

export async function inviteToGame(sessionId, inviteeId) {
  const { error } = await supabase.rpc("invite_to_game", {
    p_session: sessionId,
    p_invitee: inviteeId,
  });
  if (error) throw error;
}

/* v2 (0029): returns {result: 'joined'|'filled'|'declined',
   session_id, …}. 'filled' means the table completed while the invite
   sat — graceful, with enough info to start a fresh table. */
export async function respondInvite(inviteId, accept) {
  const { data, error } = await supabase.rpc("respond_game_invite", {
    p_invite: inviteId,
    p_accept: accept,
  });
  if (error) throw error;
  return data;
}

/* ── The together layer (0029) ────────────────────────────────────── */

/* The caller's invitable connections — circle ∪ friends ∪ group
   co-members, deduped, eligibility- and block-filtered SERVER-side so
   the picker can never show someone and then fail. */
export async function gamePeople() {
  const { data, error } = await supabase.rpc("game_people");
  if (error) throw error;
  return data ?? [];
}

/* {result: 'joined'|'filled'|'no_table', session_id?}. Rate-limited
   server-side; a wrong code is indistinguishable from an expired one. */
export async function joinByCode(code) {
  const { data, error } = await supabase.rpc("join_by_code", { p_code: code });
  if (error) throw error;
  return data;
}

/* Before the caller solves: {solved:false, solved_count}. After:
   {solved:true, people:[{id,name,how,solved,cheered,nudged}]} —
   never answers, never guess counts. */
export async function riddlePeople(date = puzzleToday()) {
  const { data, error } = await supabase.rpc("riddle_people", { p_date: date });
  if (error) throw error;
  return data;
}

/* One cheer + one nudge per person per riddle day (server-enforced).
   Returns {sent} — false means the cap already spoke for you. */
export async function riddleTouch(toId, kind, sticker = null, date = puzzleToday()) {
  const { data, error } = await supabase.rpc("riddle_touch", {
    p_to: toId,
    p_date: date,
    p_kind: kind,
    p_sticker: sticker,
  });
  if (error) throw error;
  return data;
}

/* Celebration facts about ONE connection — {solved_today, badges}.
   No counts, no points, nothing comparable. */
export async function personWarmth(profileId) {
  const { data, error } = await supabase.rpc("person_warmth", { p_profile: profileId });
  if (error) throw error;
  return data;
}

/* Share your OWN moment with your people. Retry-proof server-side. */
export async function boastToPeople(kind, refKey, payload = {}) {
  const { data, error } = await supabase.rpc("boast_to_people", {
    p_kind: kind,
    p_ref: refKey,
    p_payload: payload,
  });
  if (error) throw error;
  return data; // people notified (0 on a repeat tap)
}

/* Call off a table that never started (0038). Host-only and lobby-only
   server-side; the row survives — deleting it would cascade into
   dm_messages.game_session_id and destroy a message in someone's chat. */
/* Leave a table you hold a seat at (0040/0041). Returns
   {result: cancelled | left | not_seated | over}, and on a `left`
   result also {seat: "released" | "bot"} — a lobby seat is really
   deleted, whereas leaving a game IN PLAY converts your seat to a bot
   so the others are not stranded. Prefer `seat` for the wording; only
   the transaction knows which happened. NOTE for callers: a GUEST who
   leaves loses read access to that session in the same instant, so
   navigate away as part of the action and never treat the empty read
   that follows as an error. */
export async function leaveSession(sessionId) {
  const { data, error } = await supabase.rpc("leave_game_session", { p_session: sessionId });
  if (error) throw error;
  return data;
}

/* The ONE table a person may have on the go: any session of theirs
   that is waiting for players or in play. Waiting counts — a table
   with empty seats is still a promise to somebody. */
export function liveSessionOf(sessions) {
  return (sessions ?? []).find((s) => s.status === "lobby" || s.status === "active") ?? null;
}

export async function cancelSession(sessionId) {
  const { error } = await supabase.rpc("cancel_game_session", { p_session: sessionId });
  if (error) throw new Error(error.message);
}

export async function claimOpenSeat(sessionId) {
  const { data, error } = await supabase.rpc("claim_open_seat", { p_session: sessionId });
  if (error) throw error;
  return data;
}

export async function startWithBots(sessionId) {
  const { error } = await supabase.rpc("start_with_bots", { p_session: sessionId });
  if (error) throw error;
}

export async function playTurn(sessionId, payload = null) {
  const { data, error } = await supabase.rpc("play_turn", {
    p_session: sessionId,
    p_payload: payload,
  });
  if (error) throw error;
  return data; // the recorded move
}

/* Resolves lapsed turns for one session (or all): the visible
   countdown calls this at zero so nobody waits for the cron minute. */
export async function gameTick(sessionId = null) {
  const { data, error } = await supabase.rpc("game_tick", { p_session: sessionId });
  if (error) throw error;
  return data;
}

export async function reclaimSeat(sessionId) {
  const { error } = await supabase.rpc("reclaim_seat", { p_session: sessionId });
  if (error) throw error;
}

/* Pending invites on one session (both sides may read theirs; the
   host sees all they sent — feeds the lobby picker's "Asked" state). */
export async function fetchSessionInvites(sessionId) {
  const { data, error } = await supabase
    .from("game_invites")
    .select("id, invitee_id, inviter_id, seat_no, status")
    .eq("session_id", sessionId)
    .eq("status", "pending");
  if (error) throw error;
  return data ?? [];
}

/* Display names for a set of profile ids (safe view) → {id: name}. */
export async function fetchNames(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return {};
  const { data, error } = await supabase.from("safe_profiles").select("id, full_name").in("id", unique);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name]));
}

export async function fetchMyInvites(profileId) {
  const { data, error } = await supabase
    .from("game_invites")
    .select("id, session_id, seat_no, status, created_at, inviter_id")
    .eq("invitee_id", profileId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* Name search for "ask someone by name" in the lobby. */
export async function searchPeople(q, excludeIds = []) {
  let query = supabase
    .from("safe_profiles")
    .select("id, full_name, role")
    .ilike("full_name", `%${q}%`)
    .limit(8);
  if (excludeIds.length) query = query.not("id", "in", `(${excludeIds.join(",")})`);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ── Chat + stickers ─────────────────────────────────────────────────

export const GAME_STICKERS = ["👍", "😄", "🎉", "🌸", "☕", "🙏", "😂", "❤️"];

export async function fetchChat(sessionId) {
  const { data, error } = await supabase
    .from("game_messages")
    .select("id, sender_id, body, sticker, created_at")
    .eq("session_id", sessionId)
    .order("created_at")
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function sendChat(sessionId, senderId, { body = null, sticker = null }) {
  const { error } = await supabase.from("game_messages").insert({
    session_id: sessionId,
    sender_id: senderId,
    body: body || null,
    sticker: sticker || null,
  });
  if (error) throw error;
}

// ── Daily Riddle ────────────────────────────────────────────────────

export async function fetchPuzzle(date = puzzleToday()) {
  const { data, error } = await supabase
    .from("daily_puzzles")
    .select("puzzle_date, riddle_en, riddle_ur, hint_en, hint_ur")
    .eq("puzzle_date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMyAttempts(profileId) {
  const { data, error } = await supabase
    .from("puzzle_attempts")
    .select("puzzle_date, guesses, solved_at")
    .eq("profile_id", profileId)
    .order("puzzle_date", { ascending: false })
    .limit(60);
  if (error) throw error;
  return data ?? [];
}

export async function guessPuzzle(date, guess) {
  const { data, error } = await supabase.rpc("guess_daily_puzzle", {
    p_date: date,
    p_guess: guess,
  });
  if (error) throw error;
  return data; // {correct, guesses, solved}
}
