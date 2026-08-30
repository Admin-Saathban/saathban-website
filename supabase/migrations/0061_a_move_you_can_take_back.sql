/* ════════════════════════════════════════════════
   0061 — a move you can take back

   LUDO_MOTION_SPEC §8: "A single-step undo available to the player who
   just moved, until the next player rolls. House-rules toggle, default
   ON. Server-validated: the move is reversed in the log, never
   silently rewritten."

   THE BOARD BEFORE THE MOVE IS RECORDED IN ONE PLACE, NOT PER GAME.
   exec_game_move already reads the session row before it dispatches to
   game_exec_<key>, so the state before the move is sitting in a local
   variable at the moment the move row is written. Capturing it there
   means undo needs nothing from ludo's engine, nothing from carrom's,
   and nothing from any executor written later — and there is no second
   copy of the board to drift out of step with the first.

   REVERSED IN THE LOG, NEVER REWRITTEN. The undone move's row stays
   exactly as it was. A new row is appended saying that it was undone
   and which row it undid. game_moves is append-only by design (0022)
   and this does not make an exception of itself: a game's history is a
   record of what happened, and "she moved and then took it back" is
   what happened.

   WHAT MAKES IT SAFE:
   - Only the player whose move it was, and never a bot's move.
   - Only the most recent move, and only while the board still stands
     where that move left it.
   - Never once the next player has rolled — dice on the table are the
     line, and after it the game has moved on without you.
   - Never on a finished game.
   Each of those is checked at the database, not in the app.
   ════════════════════════════════════════════════ */

/* ── 1. The board before ───────────────────────────────────────── */

alter table public.game_moves
  add column if not exists state_before jsonb;

comment on column public.game_moves.state_before is
  'The session state immediately before this move, captured by '
  'exec_game_move. Undo (0061) restores it. Null for rows written '
  'before this migration, which therefore cannot be undone — correct, '
  'since a game in progress at deploy time has no recorded past.';

/* ── 2. Capture it at the one choke point ──────────────────────── */

create or replace function public.exec_game_move(
  p_session uuid,
  p_seat smallint,
  p_by_bot boolean,
  p_payload jsonb default null::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s public.game_sessions%rowtype;
  v_result jsonb;
  v_move jsonb;
  v_winner boolean;
  v_again boolean;
  v_next smallint;
  v_next_profile uuid;
  v_game_name text;
  seat_rec record;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if s.status <> 'active' or s.current_seat is distinct from p_seat then
    raise exception 'Not this seat''s turn';
  end if;

  if coalesce(p_payload ->> 'pass', 'false') = 'true' then
    v_move := jsonb_build_object('pass', true);
    v_winner := false;
    v_again := false;
  else
    begin
      execute format('select public.%I($1, $2, $3, $4)', 'game_exec_' || s.game_key)
      into v_result using p_session, p_seat, p_by_bot, p_payload;
    exception when undefined_function then
      raise exception 'Game % has no executor yet', s.game_key;
    end;
    v_move := v_result -> 'move';
    v_winner := coalesce((v_result ->> 'winner')::boolean, false);
    v_again := coalesce((v_result ->> 'again')::boolean, false);
  end if;

  /* THE ONLY CHANGE IN THIS FUNCTION: s.state is the board as it stood
     before the executor ran, because s was read at the top. Written
     with the move so undo has something true to restore. */
  insert into public.game_moves (session_id, seat_no, by_bot, move, state_before)
  values (p_session, p_seat, p_by_bot, v_move, s.state);

  select name_en into v_game_name from public.games where key = s.game_key;

  if v_winner then
    update public.game_sessions
    set status = 'finished', winner_seat = p_seat, finished_at = now(),
        current_seat = null, turn_started_at = null
    where id = p_session;
    for seat_rec in
      select profile_id from public.game_seats
      where session_id = p_session and profile_id is not null
    loop
      perform public.game_notify(
        seat_rec.profile_id,
        'Game over',
        v_game_name || ': the game has finished. Come see the board!',
        '/app/games/s/' || p_session
      );
    end loop;
  elsif v_again then
    update public.game_sessions
    set turn_started_at = now()
    where id = p_session;
  else
    v_next := (p_seat % s.seats_total) + 1;
    update public.game_sessions
    set current_seat = v_next, turn_started_at = now()
    where id = p_session;
    select profile_id into v_next_profile
    from public.game_seats
    where session_id = p_session and seat_no = v_next
      and profile_id is not null and presence = 'active';
    if v_next_profile is not null then
      perform public.game_notify(
        v_next_profile,
        'Your turn',
        v_game_name || ': it''s your move.',
        '/app/games/s/' || p_session
      );
    end if;
  end if;

  return v_move;
end;
$function$;

/* ── 3. Can this person take that move back? ───────────────────── */

create or replace function public.game_undo_available(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s public.game_sessions%rowtype;
  m public.game_moves%rowtype;
  v_seat smallint;
begin
  select * into s from public.game_sessions where id = p_session;
  if not found then
    return jsonb_build_object('can', false, 'why', 'no_game');
  end if;

  /* The house rule. Absent means on, so an old table behaves like a
     new one and the row keeps the shape it already had. */
  if coalesce((s.house_rules ->> 'undo')::boolean, true) is not true then
    return jsonb_build_object('can', false, 'why', 'house_rule_off');
  end if;

  if s.status <> 'active' then
    return jsonb_build_object('can', false, 'why', 'not_playing');
  end if;

  select seat_no into v_seat from public.game_seats
  where session_id = p_session and profile_id = auth.uid();
  if v_seat is null then
    return jsonb_build_object('can', false, 'why', 'not_seated');
  end if;

  select * into m from public.game_moves
  where session_id = p_session
  order by id desc limit 1;
  if not found then
    return jsonb_build_object('can', false, 'why', 'nothing_to_undo');
  end if;

  if m.move ? 'undo' then
    return jsonb_build_object('can', false, 'why', 'already_undone');
  end if;
  if m.seat_no is distinct from v_seat then
    return jsonb_build_object('can', false, 'why', 'not_your_move');
  end if;
  if m.by_bot then
    return jsonb_build_object('can', false, 'why', 'not_your_move');
  end if;
  if m.state_before is null then
    /* A move from before this migration. There is no recorded past to
       go back to, and inventing one would be worse than refusing. */
    return jsonb_build_object('can', false, 'why', 'nothing_to_undo');
  end if;

  /* THE LINE: dice on the table. Once the next player has rolled, the
     game has moved on without you and the move is theirs to answer,
     not yours to withdraw. */
  if s.state ? 'dice' and jsonb_array_length(coalesce(s.state -> 'dice', '[]'::jsonb)) > 0 then
    return jsonb_build_object('can', false, 'why', 'they_have_rolled');
  end if;

  return jsonb_build_object('can', true, 'move_id', m.id);
end;
$function$;

/* ── 4. Take it back ───────────────────────────────────────────── */

create or replace function public.game_undo(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s public.game_sessions%rowtype;
  m public.game_moves%rowtype;
  v_check jsonb;
begin
  /* Lock first, then re-check. The availability check is advisory —
     between a person seeing the button and pressing it, the next
     player may have rolled. */
  select * into s from public.game_sessions where id = p_session for update;
  v_check := public.game_undo_available(p_session);
  if coalesce((v_check ->> 'can')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'why', v_check ->> 'why');
  end if;

  select * into m from public.game_moves
  where id = (v_check ->> 'move_id')::bigint;

  update public.game_sessions
  set state = m.state_before,
      current_seat = m.seat_no,
      turn_started_at = now()
  where id = p_session;

  /* Appended, never rewritten. The original row stays exactly as it
     was; this one says what happened next. */
  insert into public.game_moves (session_id, seat_no, by_bot, move, state_before)
  values (
    p_session,
    m.seat_no,
    false,
    jsonb_build_object('undo', true, 'undid', m.id, 'of', m.move),
    s.state
  );

  return jsonb_build_object('ok', true, 'undid', m.id);
end;
$function$;

/* ── 5. Who may call them ──────────────────────────────────────── */

revoke all on function public.game_undo_available(uuid) from public;
revoke all on function public.game_undo(uuid) from public;
grant execute on function public.game_undo_available(uuid) to authenticated;
grant execute on function public.game_undo(uuid) to authenticated;
