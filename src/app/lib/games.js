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
    /* timeout_style matters to the CLIENT, not just the rails: carrom
       is pass_turn, which has no bot player, and start_with_bots
       refuses it (0043). Without this column every caller computed
       `timeout_style !== "pass_turn"` against undefined and got true,
       so the bot option was offered for carrom and only refused at the
       server. */
    .select("key, name_en, name_ur, tagline_en, tagline_ur, kind, min_seats, max_seats, enabled, timeout_style")
    .order("key");
  if (error) throw error;
  return data ?? [];
}

// ── Sessions ────────────────────────────────────────────────────────

const SESSION_COLS =
  "id, game_key, status, seats_total, house_rules, join_code, current_seat, turn_started_at, winner_seat, created_by, created_at, started_at, finished_at, title";

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

/* D2 — the tables you have played, newest first, with everyone who
   sat at them.

   Deliberately NOT a record. No wins, no losses, no counts: this
   returns who was there and when, and nothing that could be totalled.
   The backlog says "warm, never a performance record", and the way to
   guarantee that is to not fetch the numbers in the first place —
   a UI can be talked into showing a field it has; it cannot show one
   it never received. `winner_seat` is in SESSION_COLS and reaches the
   caller, but nothing here aggregates it and nothing should.

   Paginated by finished_at rather than by offset, so a table
   finishing while someone reads page one cannot shift page two and
   duplicate a row. */
export async function fetchTableHistory(profileId, { limit = 20, before = null } = {}) {
  let q = supabase
    .from("game_sessions")
    .select(`${SESSION_COLS}, game_seats!inner(profile_id)`)
    .eq("game_seats.profile_id", profileId)
    .eq("status", "finished")
    .order("finished_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (before) q = q.lt("finished_at", before);
  const { data, error } = await q;
  if (error) throw error;
  const sessions = (data ?? []).map(({ game_seats, ...s }) => s);
  if (!sessions.length) return [];

  /* Everyone at those tables, in one round trip rather than one per
     row — a history page that fires twenty queries is a history page
     that arrives late on a phone. */
  const ids = sessions.map((s) => s.id);
  const { data: seats, error: sErr } = await supabase
    .from("game_seats")
    .select("session_id, seat_no, profile_id, is_bot")
    .in("session_id", ids)
    .order("seat_no");
  if (sErr) throw error;

  const people = [...new Set((seats ?? []).map((s) => s.profile_id).filter(Boolean))];
  let names = new Map();
  if (people.length) {
    const { data: profiles } = await supabase.from("safe_profiles").select("id, full_name").in("id", people);
    names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  }

  const bySession = new Map();
  for (const s of seats ?? []) {
    if (!bySession.has(s.session_id)) bySession.set(s.session_id, []);
    bySession.get(s.session_id).push({
      seat: s.seat_no,
      is_bot: s.is_bot,
      is_me: s.profile_id === profileId,
      name: s.is_bot ? null : names.get(s.profile_id) || null,
    });
  }
  return sessions.map((s) => ({ ...s, players: bySession.get(s.id) ?? [] }));
}

/* D3 — how many games two people have finished together.

   A COUNT AND NOTHING ELSE. Never who won, never a split, never a
   run. "You've played 14 games together" is a fact about a
   friendship; "you've won 4 of 14" is a fact about a contest, and
   only one of those belongs on the profile of someone's daughter.

   Computed the explicit way — my finished tables, then their seats
   within exactly those tables — rather than counting their seats and
   trusting RLS to have narrowed the set to ours. RLS SHOULD narrow
   it, but a number whose correctness depends on a policy staying
   exactly as broad as it is today is a number that will quietly
   become wrong. This one is right whatever the policy does.

   Returns 0 rather than throwing when there is nothing: a profile
   must render for someone you have never played with. */
export async function fetchGamesTogether(myId, theirId) {
  if (!myId || !theirId || myId === theirId) return 0;
  const { data: mine, error } = await supabase
    .from("game_seats")
    .select("session_id, game_sessions!inner(status)")
    .eq("profile_id", myId)
    .eq("game_sessions.status", "finished");
  if (error) throw error;
  const ids = (mine ?? []).map((r) => r.session_id);
  if (!ids.length) return 0;

  const { count, error: e2 } = await supabase
    .from("game_seats")
    .select("session_id", { count: "exact", head: true })
    .eq("profile_id", theirId)
    .in("session_id", ids);
  if (e2) throw e2;
  return count ?? 0;
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

/* `title` is optional and stays optional. Passing nothing — which is
   what every other caller does — creates a table with no name, and
   every screen that shows a name simply shows what it showed before.
   The server normalises and caps it (0049) because there are two doors
   into session creation, and a rule enforced in one of them is not a
   rule. */
export async function createSession(gameKey, seats, houseRules = {}, title = null) {
  const { data, error } = await supabase.rpc("create_game_session", {
    p_game: gameKey,
    p_seats: seats,
    p_house_rules: houseRules,
    p_title: title || null,
  });
  if (error) throw error;
  return data; // session id
}

/* §17 — "send a link" seat option (0060).

   Distinct from the table's join CODE on purpose: the code is
   reusable and spoken aloud to a room, this is single-use and dies in
   48 hours, because a link sent on WhatsApp gets forwarded and a
   forwarded code would let three strangers into a family game. */
export async function createSeatLink(sessionId, seatNo) {
  const { data, error } = await supabase.rpc("create_seat_link", {
    p_session: sessionId,
    p_seat: seatNo,
  });
  if (error) throw error;
  return data; // the token
}

/* Returns the session id, so the caller lands the person AT THE TABLE
   rather than on a confirmation screen (§11). */
export async function claimSeatLink(token) {
  const { data, error } = await supabase.rpc("claim_seat_link", { p_token: token });
  if (error) throw error;
  return data;
}

/* The links still holding chairs at this table. Only participants can
   read them (0060's policy), which is also what lets any of them
   re-share — a guest inviting the fourth player is the point. */
export async function fetchSeatLinks(sessionId) {
  const { data, error } = await supabase
    .from("game_seat_links")
    .select("seat_no, token, expires_at")
    .eq("session_id", sessionId)
    .is("used_at", null);
  if (error) throw error;
  return data || [];
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
/* How many tables this person has FINISHED — the number table themes
   are earned from (backlog C1). Derived, never stored: a fact belongs
   in a table only if it could not be recomputed from what already
   happened, and this one can, for ever. (Registrar's ruling; stickers
   differ because gift and stake make them path-dependent.)

   Counts a table played against BOTS exactly like one played against
   people. The person this app exists for is playing at eleven at night
   with nobody free, and counting only human tables would hand every
   reward to whoever has company.

   head:true, so it costs a COUNT rather than a page of rows. */
export async function fetchGamesFinished(profileId) {
  const { count, error } = await supabase
    .from("game_seats")
    .select("session_id, game_sessions!inner(status)", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("game_sessions.status", "finished");
  if (error) throw error;
  return count ?? 0;
}

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
  return liveSessionsOf(sessions)[0] ?? null;
}

/* ALL of them, because "one at a time" is the rule and not the state
   of the data. Tables from before the rule, and any that slipped past
   it, mean a person can genuinely have several — and a gate that
   clears one at a time, showing an identical card each round, is what
   made the user cancel "the same game" four times. Nothing was broken
   on the way in; they were being shown a queue and told it was one
   table. Whatever clears the way has to see the whole queue. */
export function liveSessionsOf(sessions) {
  return (sessions ?? []).filter((s) => s.status === "lobby" || s.status === "active");
}

/* A table nobody has touched for this long is not a game in progress,
   it is a game somebody walked away from.

   The turn clock is the evidence: every move sets turn_started_at, and
   game_tick only runs while somebody has the board open. So a table
   whose turn opened hours ago has had no player and no bot attend to
   it since — it is not waiting for you in any sense a person would
   recognise, and telling them "your move" about it is a lie the app
   repeats every time they open the home screen.

   Two hours rather than minutes: a real game between two people who
   are cooking dinner is still a real game, and the point is to catch
   abandonment, not slowness. */
export const DORMANT_MS = 2 * 60 * 60 * 1000;

export function isDormant(session, now = Date.now()) {
  if (!session || session.status !== "active") return false;
  const started = session.turn_started_at ? new Date(session.turn_started_at).getTime() : NaN;
  if (!Number.isFinite(started)) return false;
  /* A clock that reads the future is skew, not staleness — treat it as
     fresh rather than declaring a table dead because a phone is fast. */
  const age = now - started;
  return age > DORMANT_MS;
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

/* ── Who is at these tables ──────────────────────────────────────
   GAMES_IMMERSION_SPEC §9: games home "should be tables and faces —
   live tables first, WITH WHO IS IN THEM".

   The same shape fetchTableHistory returns for finished tables, for
   live ones, and in one round trip for all of them rather than one
   per card. Names come through safe_profiles because RLS refuses one
   person reading another's profiles row — an embed returns null,
   quietly, with a 200.

   Bots come back as a seat with no name rather than being filtered
   out: a four-seat table showing one face would read as a table with
   one player at it, and three of those seats are somebody to play
   against. */
export async function fetchTablePeople(sessionIds, profileId) {
  const ids = [...new Set((sessionIds || []).filter(Boolean))];
  if (!ids.length) return new Map();

  const { data: seats, error } = await supabase
    .from("game_seats")
    .select("session_id, seat_no, profile_id, is_bot")
    .in("session_id", ids)
    .order("seat_no");
  if (error) return new Map();

  const people = [...new Set((seats ?? []).map((s) => s.profile_id).filter(Boolean))];
  let names = new Map();
  if (people.length) {
    const { data: profiles } = await supabase
      .from("safe_profiles")
      .select("id, full_name")
      .in("id", people);
    names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  }

  const bySession = new Map();
  for (const s of seats ?? []) {
    if (!bySession.has(s.session_id)) bySession.set(s.session_id, []);
    bySession.get(s.session_id).push({
      seat: s.seat_no - 1,
      is_bot: s.is_bot,
      is_me: !!profileId && s.profile_id === profileId,
      name: s.is_bot ? null : names.get(s.profile_id) || null,
    });
  }
  return bySession;
}
