-- ============================================================================
-- 0023 — Ludo onto the games rails (GAMES_CONTRACT.md; rails 0022 + the
-- 0022b repeat-turns amendment).
--
-- 0020 shipped Ludo self-contained; 0022 rebased the shared tables under
-- it (game→game_key, target_seats→seats_total, 'playing'→'active',
-- turn_deadline→turn_started_at + house_rules.turn_seconds, seat_no
-- 1-based). This migration finishes the plug:
--
--   - drops the 0020 orchestration the rails supersede (create/start/
--     move/tick/advance → create_game_session, start_with_bots,
--     play_turn, game_tick)
--   - keeps the PURE engine untouched (ludo_rules/ludo_abs/ludo_is_safe/
--     ludo_legal/ludo_apply/ludo_bot_pick; internal state stays 0-based,
--     mapped at the boundary as seat_no - 1)
--   - ships game_exec_ludo(): ONE roll-and-move per call, returning
--     {"move", "winner", "again"} — "again" (0022b) keeps the seat for
--     extra-roll-on-six, so a human's bonus roll comes back to the human
--   - rewrites ludo_roll (two-phase: roll → see dice → choose; writes
--     only into game-owned state, never game_moves/current_seat/
--     turn_started_at), ludo_join (by spoken code; auto-starts via
--     game_start_if_full when the last seat fills), ludo_rematch
--   - initializes Ludo state lazily (ludo_state_init) — the rails can't
--     know a game's state shape, so first contact builds it
--   - flips games.enabled for 'ludo'
-- ============================================================================

drop function if exists public.ludo_create(int, jsonb);
drop function if exists public.ludo_start(uuid);
drop function if exists public.ludo_move(uuid, int);
drop function if exists public.ludo_tick(uuid);
drop function if exists public.ludo_advance(uuid, boolean);
drop function if exists public.ludo_roll(uuid);
drop function if exists public.ludo_join(text);
drop function if exists public.ludo_rematch(uuid);

-- Fresh state for a session (pieces sized to seats_total; the frozen
-- rules copied from house_rules).
create or replace function public.ludo_state_init(p_seats int, p_house_rules jsonb)
returns jsonb
language plpgsql immutable
as $$
declare
  v_pieces jsonb := '[]';
  v_flags jsonb := '[]';
  i int;
begin
  for i in 1..p_seats loop
    v_pieces := v_pieces || jsonb_build_array(jsonb_build_array(0, 0, 0, 0));
    v_flags := v_flags || to_jsonb(false);
  end loop;
  return jsonb_build_object(
    'pieces', v_pieces,
    'captured_by', v_flags,
    'rules', public.ludo_rules(p_house_rules),
    'last', null
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- The rails executor. One roll-and-move per call.
--   p_by_bot = true  → finish a pending human roll if one exists,
--                      otherwise roll fresh; pick with the heuristic.
--   p_by_bot = false → requires state.dice (from ludo_roll) and
--                      p_payload {"piece": n}, validated server-side.
-- Returns {"move": {dice,piece,capture,skipped}, "winner": bool,
--          "again": bool} — again per extra_roll_on_six (never after a
-- skip or a win). State is written here; everything else is the rails'.
-- ----------------------------------------------------------------------------
create or replace function public.game_exec_ludo(
  p_session uuid,
  p_seat smallint,
  p_by_bot boolean,
  p_payload jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s       public.game_sessions%rowtype;
  v_seat  int := p_seat - 1;               -- contract 1-based → engine 0-based
  v_state jsonb;
  v_rules jsonb;
  v_dice  int;
  v_legal int[];
  v_pick  int;
  a       record;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found then
    raise exception 'No such game';
  end if;

  v_state := s.state;
  if not (v_state ? 'pieces') then
    v_state := public.ludo_state_init(s.seats_total, s.house_rules);
  end if;
  v_rules := public.ludo_rules(v_state->'rules');

  if v_state ? 'dice' then
    v_dice := (v_state->>'dice')::int;
  elsif p_by_bot then
    v_dice := 1 + floor(random() * 6)::int;
  else
    raise exception 'Roll first';
  end if;

  v_legal := public.ludo_legal(v_state, v_seat, v_dice);

  if coalesce(array_length(v_legal, 1), 0) = 0 then
    v_state := jsonb_set(v_state, '{last}', jsonb_build_object(
      'seat', v_seat, 'dice', v_dice, 'piece', null, 'capture', false, 'skipped', true));
    update public.game_sessions
    set state = (v_state - 'dice' - 'legal')
    where id = p_session;
    return jsonb_build_object(
      'move', jsonb_build_object('dice', v_dice, 'skipped', true),
      'winner', false,
      'again', false);
  end if;

  if p_by_bot then
    v_pick := public.ludo_bot_pick(v_state, v_seat, v_dice, v_legal);
  else
    v_pick := (p_payload->>'piece')::int;
    if v_pick is null or not (v_pick = any (v_legal)) then
      raise exception 'That piece has no legal move';
    end if;
  end if;

  select * into a from public.ludo_apply(v_state, v_seat, v_pick, v_dice);

  update public.game_sessions
  set state = (a.o_state - 'dice' - 'legal')
  where id = p_session;

  return jsonb_build_object(
    'move', jsonb_build_object('dice', v_dice, 'piece', v_pick, 'capture', a.o_capture),
    'winner', a.o_finished,
    'again', (v_dice = 6
              and (v_rules->>'extra_roll_on_six')::boolean
              and not a.o_finished));
end;
$$;

revoke execute on function public.game_exec_ludo(uuid, smallint, boolean, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- The human two-phase roll. Per the contract addendum: verifies the
-- session is active and the caller holds current_seat; writes ONLY into
-- state; never touches game_moves / current_seat / turn_started_at
-- (roll and choice share one turn clock). No legal move → the generic
-- pass through play_turn, so the rails keep the bookkeeping.
-- ----------------------------------------------------------------------------
create or replace function public.ludo_roll(p_session uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_seat int;
  v_dice int;
  v_legal int[];
  v_state jsonb;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.status <> 'active' or s.game_key <> 'ludo' then
    raise exception 'No game to roll in';
  end if;
  if not exists (
    select 1 from public.game_seats gs
    where gs.session_id = s.id and gs.seat_no = s.current_seat and gs.profile_id = auth.uid()
  ) then
    raise exception 'Not your turn';
  end if;
  if s.state ? 'dice' then
    raise exception 'You already rolled — choose a piece';
  end if;

  v_state := s.state;
  if not (v_state ? 'pieces') then
    v_state := public.ludo_state_init(s.seats_total, s.house_rules);
  end if;

  v_seat := s.current_seat - 1;
  v_dice := 1 + floor(random() * 6)::int;
  v_legal := public.ludo_legal(v_state, v_seat, v_dice);

  if coalesce(array_length(v_legal, 1), 0) = 0 then
    update public.game_sessions
    set state = jsonb_set(v_state, '{last}', jsonb_build_object(
          'seat', v_seat, 'dice', v_dice, 'piece', null, 'capture', false, 'skipped', true))
    where id = s.id;
    perform public.play_turn(s.id, '{"pass": true}'::jsonb);
    return jsonb_build_object('dice', v_dice, 'legal', '[]'::jsonb, 'skipped', true);
  end if;

  update public.game_sessions
  set state = v_state || jsonb_build_object('dice', v_dice, 'legal', to_jsonb(v_legal))
  where id = s.id;
  return jsonb_build_object('dice', v_dice, 'legal', to_jsonb(v_legal), 'skipped', false);
end;
$$;

revoke execute on function public.ludo_roll(uuid) from public, anon;
grant execute on function public.ludo_roll(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Join by the spoken 6-digit code (Ludo's lobby door; flagged for rails
-- absorption). Auto-starts through the rails when the last seat fills.
-- ----------------------------------------------------------------------------
create or replace function public.ludo_join(p_code text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_seat int;
begin
  if auth.uid() is null or not public.account_ok() then
    raise exception 'Sign in required';
  end if;

  select * into s from public.game_sessions
  where join_code = trim(p_code) and status = 'lobby' and game_key = 'ludo'
  for update;
  if not found then
    raise exception 'That code did not match an open game';
  end if;

  if exists (select 1 from public.game_seats where session_id = s.id and profile_id = auth.uid()) then
    return s.id;
  end if;

  select min(x) into v_seat from generate_series(1, s.seats_total::int) x
  where not exists (select 1 from public.game_seats gs where gs.session_id = s.id and gs.seat_no = x);
  if v_seat is null then
    raise exception 'That game is full';
  end if;

  insert into public.game_seats (session_id, seat_no, profile_id, is_bot)
  values (s.id, v_seat, auth.uid(), false);

  perform public.game_start_if_full(s.id);
  return s.id;
end;
$$;

revoke execute on function public.ludo_join(text) from public, anon;
grant execute on function public.ludo_join(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Rematch: same seats, same rules (no rails rematch yet — flagged in
-- GAMES_CONTRACT_ASKS.md). Starts immediately; clients follow rematch_id.
-- ----------------------------------------------------------------------------
create or replace function public.ludo_rematch(p_session uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_id uuid;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.status <> 'finished' or s.game_key <> 'ludo' then
    raise exception 'Only a finished game can be replayed';
  end if;
  if not public.is_game_participant(s.id) then
    raise exception 'Not your game';
  end if;
  if s.rematch_id is not null then
    return s.rematch_id;
  end if;

  insert into public.game_sessions
    (game_key, join_code, seats_total, house_rules, created_by,
     status, current_seat, turn_started_at, started_at, state)
  values
    ('ludo', s.join_code, s.seats_total, s.house_rules, s.created_by,
     'active', 1, now(), now(),
     public.ludo_state_init(s.seats_total, s.house_rules))
  returning id into v_id;

  insert into public.game_seats (session_id, seat_no, profile_id, is_bot)
  select v_id, seat_no, profile_id, is_bot from public.game_seats where session_id = s.id;

  update public.game_sessions set rematch_id = v_id where id = s.id;
  return v_id;
end;
$$;

revoke execute on function public.ludo_rematch(uuid) from public, anon;
grant execute on function public.ludo_rematch(uuid) to authenticated;

-- Ludo goes live in the registry.
update public.games set enabled = true where key = 'ludo';
