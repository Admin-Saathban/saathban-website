-- ============================================================================
-- 0105 — Snakes & Ladders: a table the host can set, and a board the
--        server agrees with.
--
-- The board used to be one immutable function, snakes_board_jump(). The
-- host can now choose how many snakes and how many ladders their table
-- has, and up to eight people can sit at it, each in a colour they pick
-- when they join. None of that fits a fixed function.
--
-- WHERE THE BOARD LIVES NOW: game_sessions.house_rules.board, as a flat
-- {"from": to} object. The client builds it (design.js, from ordered
-- pools) and stores it here; game_exec_snakes reads it back when it
-- moves a piece. ONE map, stored once, read by both — which is the
-- property that matters, because a client drawing a snake the server
-- does not honour is a board that lies to the person tracing it.
--
-- WHY THE CLIENT MAY CHOOSE THE MAP AND THE SERVER STILL DECIDES.
-- Re-deriving the pools in PL/pgSQL would put the same table in two
-- languages and 0036's comment already explains where that ends. So
-- the server does not check WHICH legal board was chosen — it checks
-- that the board IS legal, which is the actual contract:
--
--   * every square in 1..100, and neither 1 nor 100 involved in a jump
--   * no square used twice (so no square hosts two jumps, no jump lands
--     on another's mouth, and chains cannot exist)
--   * at most 24 jumps, so nobody stores a board of a thousand snakes
--
-- A caller can therefore build an unusual table. A caller cannot build
-- one that breaks the game, and cannot touch anybody else's table: both
-- writes are security definer, host-only or own-seat-only, and refuse
-- once the game has started.
--
-- Sessions created before this migration have no stored board. They
-- keep playing exactly as they were: game_exec_snakes falls through to
-- snakes_board_jump(), and boardFor() on the client defaults to the
-- same shape. No backfill, no migration of live tables.
-- ============================================================================

-- ── is this a board we are willing to play on? ──────────────────────────────
create or replace function public.snakes_board_ok(p_board jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  k text;
  v int;
  f int;
  seen int[] := '{}';
begin
  if p_board is null or jsonb_typeof(p_board) <> 'object' then
    return false;
  end if;
  if (select count(*) from jsonb_object_keys(p_board)) > 24 then
    return false;
  end if;

  for k in select jsonb_object_keys(p_board) loop
    begin
      f := k::int;
      v := (p_board ->> k)::int;
    exception when others then
      return false;
    end;
    if f < 2 or f > 99 or v < 2 or v > 99 then return false; end if;
    if f = v then return false; end if;
    if f = any(seen) or v = any(seen) then return false; end if;
    seen := seen || f || v;
  end loop;

  return true;
end;
$$;

-- ── the host sets the table ─────────────────────────────────────────────────
create or replace function public.snakes_set_table(
  p_session uuid,
  p_players int,
  p_snakes  int,
  p_ladders int,
  p_board   jsonb
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_status text;
  v_game text;
  v_filled int;
begin
  select created_by, status, game_key into v_owner, v_status, v_game
  from public.game_sessions where id = p_session;

  if v_owner is null then raise exception 'no such table'; end if;
  if v_game <> 'snakes' then raise exception 'not a snakes table'; end if;
  if v_owner <> auth.uid() then raise exception 'only the host may set the table'; end if;
  if v_status <> 'lobby' then raise exception 'the game has already started'; end if;

  if p_players < 2 or p_players > 8 then raise exception 'a table seats 2 to 8'; end if;
  if not public.snakes_board_ok(p_board) then raise exception 'that board is not playable'; end if;

  -- The table may not be shrunk below the people already sitting at it.
  select count(*) into v_filled
  from public.game_seats where session_id = p_session and profile_id is not null;
  if p_players < v_filled then
    raise exception 'there are already % people here', v_filled;
  end if;

  update public.game_sessions
     set seats_total = p_players,
         house_rules = coalesce(house_rules, '{}'::jsonb)
                       || jsonb_build_object('snakes', p_snakes,
                                             'ladders', p_ladders,
                                             'board', p_board),
         updated_at  = now()
   where id = p_session;

  -- Seats follow the stepper: add the empty ones, remove the empty ones
  -- that are no longer wanted. A seat with a person in it is never
  -- touched here — that is what the check above is for.
  insert into public.game_seats (session_id, seat_no, score)
  select p_session, g, 0
  from generate_series(0, p_players - 1) g
  where not exists (
    select 1 from public.game_seats s where s.session_id = p_session and s.seat_no = g
  );

  delete from public.game_seats
   where session_id = p_session
     and seat_no >= p_players
     and profile_id is null;
end;
$$;

revoke execute on function public.snakes_set_table(uuid, int, int, int, jsonb) from public, anon;
grant  execute on function public.snakes_set_table(uuid, int, int, int, jsonb) to authenticated;

-- ── a player takes a colour ─────────────────────────────────────────────────
-- Their own seat only, and only a colour nobody else at the table holds.
-- Stored on the session rather than on the seat because house_rules is
-- the bag of table settings that already exists, and adding a column to
-- game_seats would put a snakes-only field on every ludo table too.
create or replace function public.snakes_pick_color(p_session uuid, p_color int)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_seat int;
  v_colors jsonb;
  v_other text;
begin
  if p_color < 0 or p_color > 7 then raise exception 'no such colour'; end if;

  select seat_no into v_seat
  from public.game_seats
  where session_id = p_session and profile_id = auth.uid();

  if v_seat is null then raise exception 'you are not seated at this table'; end if;

  select coalesce(house_rules -> 'colors', '{}'::jsonb) into v_colors
  from public.game_sessions where id = p_session;

  -- Taken by somebody else? Their claim stands; first to sit down keeps
  -- the colour, which is the rule a room would use.
  for v_other in select jsonb_object_keys(v_colors) loop
    if v_other <> v_seat::text and (v_colors ->> v_other)::int = p_color then
      raise exception 'that colour is taken';
    end if;
  end loop;

  update public.game_sessions
     set house_rules = coalesce(house_rules, '{}'::jsonb)
                       || jsonb_build_object('colors',
                            v_colors || jsonb_build_object(v_seat::text, p_color)),
         updated_at = now()
   where id = p_session;
end;
$$;

revoke execute on function public.snakes_pick_color(uuid, int) from public, anon;
grant  execute on function public.snakes_pick_color(uuid, int) to authenticated;

-- ── the engine reads the table's own board ──────────────────────────────────
create or replace function public.game_exec_snakes(
  p_session uuid, p_seat smallint, p_by_bot boolean, p_payload jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_roll   int;
  v_from   int;
  v_landed int;
  v_to     int;
  v_via    text;
  v_board  jsonb;
begin
  select score into v_from
  from public.game_seats where session_id = p_session and seat_no = p_seat;

  select house_rules -> 'board' into v_board
  from public.game_sessions where id = p_session;

  -- The server IS the dice; the client payload carries nothing.
  v_roll := floor(random() * 6)::int + 1;

  if v_from + v_roll > 100 then
    -- Classic finish: an exact roll is needed. Stay put, turn passes.
    return jsonb_build_object(
      'move', jsonb_build_object(
        'roll', v_roll, 'from', v_from, 'landed', v_from, 'to', v_from,
        'via', null, 'stuck', true, 'need', 100 - v_from, 'score', v_from
      ),
      'winner', false
    );
  end if;

  v_landed := v_from + v_roll;

  -- This table's own board if it has one; the 0036 map if it predates
  -- boards being per-table.
  if v_board is not null and jsonb_typeof(v_board) = 'object'
     and v_board ? v_landed::text then
    v_to := (v_board ->> v_landed::text)::int;
  elsif v_board is not null and jsonb_typeof(v_board) = 'object' then
    v_to := v_landed;
  else
    v_to := public.snakes_board_jump(v_landed);
  end if;

  v_via := case when v_to > v_landed then 'ladder'
                when v_to < v_landed then 'snake'
                else null end;

  update public.game_seats set score = v_to
  where session_id = p_session and seat_no = p_seat;

  return jsonb_build_object(
    'move', jsonb_build_object(
      'roll', v_roll, 'from', v_from, 'landed', v_landed, 'to', v_to,
      'via', v_via, 'stuck', false, 'score', v_to
    ),
    'winner', v_to = 100
  );
end;
$$;

revoke execute on function public.game_exec_snakes(uuid, smallint, boolean, jsonb) from public, anon, authenticated;
