/* ════════════════════════════════════════════════
   Ludo ↔ backend, in ONE file on purpose — and it earned its keep:
   when the games rails landed mid-lane (0022 + 0022b, see
   GAMES_CONTRACT.md), this file was the entire adaptation surface.

   Contract mapping done here so the components never learn it:
     status  'active'      → 'playing'
     seats   seat_no 1..4  → seat 0..3
     current_seat 1-based  → 0-based
     seats_total           → target_seats
     deadline              = turn_started_at + house_rules.turn_seconds
     winner_seat 1-based   → 0-based

   Rails RPCs: create_game_session / start_with_bots / play_turn /
   game_tick. Ludo-owned RPCs: ludo_roll (two-phase roll),
   ludo_join (by code), ludo_rematch (0023).
   ════════════════════════════════════════════════ */

import supabase from "../../../lib/supabase.js";

export const DEFAULT_RULES = {
  extra_roll_on_six: true,
  capture_before_home: false,
  exact_home: true,
  safe_squares: "standard",
  /* THIRTY SECONDS, not sixty. A minute is a long time to sit
     watching somebody else's turn, and the clock is the main thing
     that makes a four-handed game drag.

     It is written EXPLICITLY into every table's house_rules rather
     than left to a client default, and that is the important part:
     game_tick's own fallback is 60, so a ludo table whose house_rules
     lacked the key would have the board counting down from 30 while
     the server waited 60 — a visible clock that lies, and the player
     blamed for a turn they were told they had lost. Configurable per
     table; only the default moves. */
  turn_seconds: 30,
  // One die or two. Two is the Desi table: both dice are rolled
  // together and assigned separately, and only a DOUBLE six repeats.
  dice_count: 1,
};

export async function createSession(targetSeats, houseRules) {
  const { data, error } = await supabase.rpc("create_game_session", {
    p_game: "ludo",
    p_seats: targetSeats,
    p_house_rules: houseRules,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function joinByCode(code) {
  const { data, error } = await supabase.rpc("ludo_join", {
    p_code: code.replace(/\D/g, ""),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function startSession(sessionId) {
  const { error } = await supabase.rpc("start_with_bots", { p_session: sessionId });
  if (error) throw new Error(error.message);
}

export async function roll(sessionId) {
  const { data, error } = await supabase.rpc("ludo_roll", { p_session: sessionId });
  if (error) throw new Error(error.message);
  return data; // { dice, legal, skipped }
}

/* One die, assigned to one piece. `die` is the INDEX into state.dice,
   not its face, so a player holding two sixes can say which one they
   are spending. `split` chooses, for a piece standing in a pair,
   between moving the pair together and moving this goti alone. */
export async function move(sessionId, { piece, die = 0, split = false }) {
  const { error } = await supabase.rpc("play_turn", {
    p_session: sessionId,
    p_payload: { piece, die, split },
  });
  if (error) throw new Error(error.message);
}

/* What one die could do — asked of the SERVER, never worked out here.
   The executor validates every incoming move against this same array,
   so what a person is offered and what will be accepted cannot drift
   apart. Returns [{piece, split, to, kind}]. */
export async function legalFor(state, seat, seats, die) {
  const { data, error } = await supabase.rpc("ludo_desi_legal", {
    p_state: state,
    p_seat: seat,
    p_seats: seats,
    p_die: die,
  });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function tick(sessionId) {
  const { data, error } = await supabase.rpc("game_tick", { p_session: sessionId });
  if (error) throw new Error(error.message);
  return data;
}

export async function rematch(sessionId) {
  const { data, error } = await supabase.rpc("ludo_rematch", { p_session: sessionId });
  if (error) throw new Error(error.message);
  return data;
}

/* §8 UNDO. Two calls, because "can I?" and "do it" are different
   questions with different answers a second apart — the availability
   probe drives what is on screen, and game_undo re-checks under a
   lock before it touches anything. Both refuse with a REASON rather
   than a bare false, so the screen can say why instead of leaving a
   dead button. */
export async function undoAvailable(sessionId) {
  const { data, error } = await supabase.rpc("game_undo_available", { p_session: sessionId });
  if (error) return { can: false, why: "error" };
  return data || { can: false, why: "error" };
}

export async function undoMove(sessionId) {
  const { data, error } = await supabase.rpc("game_undo", { p_session: sessionId });
  if (error) return { ok: false, why: "error" };
  return data || { ok: false, why: "error" };
}

/* Session + seats + public names, normalized to Ludo's 0-based world. */
export async function fetchSession(sessionId) {
  const [{ data: session, error: sErr }, { data: seats, error: tErr }] = await Promise.all([
    supabase.from("game_sessions").select("*").eq("id", sessionId).maybeSingle(),
    supabase
      .from("game_seats")
      .select("seat_no, profile_id, is_bot, presence")
      .eq("session_id", sessionId)
      .order("seat_no"),
  ]);
  if (sErr) throw new Error(sErr.message);
  if (tErr) throw new Error(tErr.message);
  if (!session) return null;

  const ids = (seats || []).map((s) => s.profile_id).filter(Boolean);
  let names = new Map();
  if (ids.length) {
    const { data: profiles, error: pErr } = await supabase
      .from("safe_profiles")
      .select("id, full_name")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    names = new Map((profiles || []).map((p) => [p.id, p.full_name]));
  }

  /* NOW 30, because the SERVER now says 30.

     This used to be 60 deliberately: game_tick decides when a turn has
     really lapsed and its fallback was 60, so a client counting 30
     over a server waiting 60 would show a clock emptying while nothing
     happened. That reasoning was right and it is why the client was
     not changed on its own.

     TONIGHT.md settles the number at 30, so the fallback moved on BOTH
     sides — migration 0091 changes game_tick's — and the two agree
     again. Tables that named their own turn_seconds are untouched
     either way; this line only ever governed the ones that did not. */
  const turnSeconds = Number(session.house_rules?.turn_seconds) || 30;
  const status = session.status === "active" ? "playing" : session.status;

  // The rails can't know Ludo's state shape; before the first action the
  // board still deserves its pieces — mirror ludo_state_init locally.
  let state = session.state || {};
  if (status !== "lobby" && !state.pieces) {
    state = {
      ...state,
      pieces: Array.from({ length: session.seats_total }, () => [0, 0, 0, 0]),
      captured_by: Array.from({ length: session.seats_total }, () => false),
      rules: state.rules || session.house_rules,
      ruleset: "desi",
      dice_count: Number(session.house_rules?.dice_count) || 1,
      pairs_moved: {},
      chain: 0,
    };
  }

  return {
    id: session.id,
    status,
    /* The table's name (0049). The rails select * but MAP explicitly,
       so a new column reaches the board only if it is named here —
       which is the point of an adapter, and also the way a new field
       silently goes missing. */
    title: session.title || null,
    join_code: session.join_code,
    house_rules: session.house_rules,
    created_by: session.created_by,
    /* Named here deliberately, per the note above: §9 asks whether
       the table started SECONDS ago, to tell a real beginning from
       someone reopening a game in progress. Unmapped it would be
       undefined, the comparison would quietly be false forever, and
       the countdown would simply never appear for anyone arriving by
       link — a silent no-op, which is exactly the failure this
       adapter comment warns about. */
    started_at: session.started_at || null,
    rematch_id: session.rematch_id,
    target_seats: session.seats_total,
    current_seat: session.current_seat != null ? session.current_seat - 1 : null,
    winner_seat: session.winner_seat != null ? session.winner_seat - 1 : null,
    turn_deadline:
      status === "playing" && session.turn_started_at
        ? new Date(new Date(session.turn_started_at).getTime() + turnSeconds * 1000).toISOString()
        : null,
    state,
    seats: (seats || []).map((s) => ({
      seat: s.seat_no - 1,
      profile_id: s.profile_id,
      is_bot: s.is_bot,
      presence: s.presence,
      name: s.is_bot ? null : names.get(s.profile_id) || null,
    })),
  };
}

/* ─── In-game chat: body text plus the rails' fixed sticker column.
   Ludo's wider warm set travels as emoji-only bodies (rendered large
   client-side); either way the same participants-only RLS applies. ─── */

export async function fetchChat(sessionId) {
  const { data, error } = await supabase
    .from("game_messages")
    .select("id, sender_id, body, sticker, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data || []).map((m) => ({ ...m, body: m.body ?? m.sticker }));
}

export async function sendChat(sessionId, body) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("game_messages").insert({
    session_id: sessionId,
    sender_id: user?.id,
    body,
  });
  if (error) throw new Error(error.message);
}

/* ════════════════════════════════════════════════
   CHANGING THE TABLE AT THE TABLE — §8, migrations 0092/0093.

   Everything the old setup form asked, asked again at the board by
   tapping the thing itself. All four refuse server-side once a die
   has been thrown (game_table_is_soft), so nothing here needs to
   guess whether it is still allowed — it asks, and the board hides
   the taps it knows will fail.
   ════════════════════════════════════════════════ */

/* Is this table still soft — set, but not yet played? */
export async function tableIsSoft(sessionId) {
  const { data, error } = await supabase.rpc("game_table_is_soft", { p_session: sessionId });
  if (error) return false;
  return data === true;
}

/* Name, house rules and seat count. Send only what changed. */
export async function reformTable(sessionId, { seats, houseRules, title } = {}) {
  const { error } = await supabase.rpc("game_reform_table", {
    p_session: sessionId,
    p_seats: seats ?? null,
    p_house_rules: houseRules ?? null,
    p_title: title ?? null,
  });
  if (error) throw new Error(error.message);
}

/* Sit in a different corner. On a ludo board the colour IS the seat
   — blue, red, yellow, green, in that order, always — so this is
   what the setup form's colour circles were really choosing. */
export async function takeSeat(sessionId, seat) {
  const { error } = await supabase.rpc("game_take_seat", {
    p_session: sessionId,
    p_seat: seat + 1, // seat 0..3 → seat_no 1..4
  });
  if (error) throw new Error(error.message);
}

/* Ask one person to one seat. The bot holds it until they arrive. */
export async function inviteToSeat(sessionId, profileId, seat) {
  const { data, error } = await supabase.rpc("game_invite_to_seat", {
    p_session: sessionId,
    p_invitee: profileId,
    p_seat: seat + 1,
  });
  if (error) throw new Error(error.message);
  return data;
}

/* Who has been asked, and to which seat — this is what puts
   "waiting for {name}" IN THE SEAT rather than in a list somewhere
   else on the screen (§8). Seat numbers come back 0-based like every
   other seat number the components see. */
export async function fetchSeatInvites(sessionId) {
  const { data, error } = await supabase
    .from("game_invites")
    .select("id, seat_no, invitee_id")
    .eq("session_id", sessionId)
    .eq("status", "pending");
  if (error || !data?.length) return [];

  /* THE NAME COMES FROM safe_profiles, NOT FROM AN EMBED.

     profiles!game_invites_invitee_id_fkey(full_name) is the obvious
     way to write this and it returns invitee: null — RLS on
     profiles refuses one person reading another's row, quietly and
     with a 200. The seat then had no name to wait for, so the badge
     never rendered and "waiting for {name}" looked unbuilt.

     safe_profiles is the view the rest of this file already reads
     names through (fetchSession does the same, two queries, for the
     same reason). One more round trip; one fewer silent null. */
  const ids = [...new Set(data.map((r) => r.invitee_id).filter(Boolean))];
  let names = new Map();
  if (ids.length) {
    const { data: people } = await supabase
      .from("safe_profiles")
      .select("id, full_name")
      .in("id", ids);
    names = new Map((people || []).map((p) => [p.id, p.full_name]));
  }
  return data.map((r) => ({
    id: r.id,
    seat: (r.seat_no ?? 1) - 1,
    name: names.get(r.invitee_id) || null,
  }));
}

/* People this person may ask: the games rails' own list, which
   already answers "connected, and allowed to play". */
export async function fetchAskable() {
  const { data, error } = await supabase.rpc("game_people");
  if (error) return [];
  return (data || []).map((p) => ({
    id: p.id ?? p.profile_id,
    name: p.full_name ?? p.name ?? null,
  }));
}

/* ── The marks a person wears on their own four gotis (0095) ─────
   LANE B, and the owner's oldest complaint: "you cannot tell which
   goti is which". Pawn has taken a `mark` since the crown landed and
   had nobody to pass it one; this is where the choice comes from.

   Never a colour. The colour is the seat — blue, red, yellow, green,
   as originally assigned — and two people choosing the same one is a
   board nobody can read. */
export async function fetchPieceMarks(profileIds) {
  const ids = [...new Set((profileIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from("game_piece_marks")
    .select("profile_id, marks")
    .in("profile_id", ids);
  if (error) return new Map();
  return new Map((data || []).map((r) => [r.profile_id, r.marks || []]));
}

export async function setPieceMarks(marks) {
  const four = [0, 1, 2, 3].map((i) => String(marks?.[i] ?? "").slice(0, 4));
  const { error } = await supabase.rpc("set_piece_marks", { p_marks: four });
  if (error) throw new Error(error.message);
  return four;
}


/* A board that is open says so (0099).

   The turn clock cannot tell somebody reading the board from
   somebody who has gone, and it used to resolve that by
   declaring them gone — the owner watched his own seat say BOT
   while he was looking at it. This is the missing fact: a
   browser with the board open touches its seat, and game_tick
   plays a lapsed turn for a watching seat WITHOUT labelling
   the person away.

   Fire-and-forget on purpose. If it fails the worst case is the
   old behaviour, and it must never delay a poll or raise. */
export function seen(sessionId) {
  supabase.rpc("game_seen", { p_session: sessionId }).then(
    () => {},
    () => {}
  );
}