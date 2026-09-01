-- ════════════════════════════════════════════════
-- A table you left is still a table.
--
-- Leaving a game in play hands your seat to a bot and sets
-- profile_id to null. That is right for the game and it erases you
-- from the table completely: fetchMySessions reads game_seats by
-- profile_id, so the moment you leave, the table stops existing as
-- far as your app is concerned. You cannot see it, you cannot go
-- back to it, and you are not told how it ended.
--
-- The owner's report is the other half of the same hole: he sees a
-- game he thinks he has left still asking for his attention, and no
-- way to tell "still playing" from "walked away" in the list.
--
-- ONE COLUMN FIXES BOTH. left_by remembers whose chair the bot is
-- sitting in. From it:
--
--   * the games list can show the table, labelled as one you left,
--     distinct from one you are still in;
--   * rejoin_left_seat lets you take it back, if the bot has not
--     been given to somebody else in the meantime;
--   * the finish notification reaches you, once, with the result --
--     which is the ONE thing a person who left still wants to know.
--
-- Turn notifications deliberately do NOT follow left_by. exec_game_move
-- notifies by profile_id, which is null for that seat, so a leaver
-- stops hearing "your move" the instant they go. The bot's turns are
-- not their business.
-- ════════════════════════════════════════════════

alter table public.game_seats
  add column if not exists left_by uuid references public.profiles(id) on delete set null;

comment on column public.game_seats.left_by is
  'Who walked away from this seat, when a bot took it over mid-game. '
  'Not a participant: RLS and every turn notification key off '
  'profile_id, which is null. This exists so the table can still be '
  'found, rejoined and reported on by the person who left it.';

create index if not exists game_seats_left_by_idx
  on public.game_seats (left_by) where left_by is not null;

-- ── leaving records who left ─────────────────────────────────────
create or replace function public.leave_game_session(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s        public.game_sessions%rowtype;
  v_seat   smallint;
  v_humans int;
  v_who    text;
  v_game   text;
  v_has_bot boolean;
  r        record;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if s.id is null then
    raise exception 'That table is gone';
  end if;

  select seat_no into v_seat
  from public.game_seats
  where session_id = p_session and profile_id = auth.uid();
  if v_seat is null then
    return jsonb_build_object('result', 'not_seated');
  end if;

  if s.status in ('finished', 'cancelled') then
    return jsonb_build_object('result', 'over');
  end if;

  select full_name into v_who from public.profiles where id = auth.uid();
  select coalesce(g.name_en, s.game_key), g.timeout_style <> 'pass_turn'
    into v_game, v_has_bot
  from public.games g where g.key = s.game_key;
  v_has_bot := coalesce(v_has_bot, true);

  if s.status = 'lobby' then
    if s.created_by = auth.uid() then
      perform public.cancel_game_session(p_session);
      return jsonb_build_object('result', 'cancelled');
    end if;

    delete from public.game_seats
    where session_id = p_session and seat_no = v_seat;

    perform public.game_notify(
      s.created_by,
      coalesce(v_game, 'A game') || ' - a seat is free again',
      coalesce(v_who, 'Someone') || ' has stepped away from the table.',
      '/app/games/s/' || p_session
    );
    return jsonb_build_object('result', 'left', 'seat', 'released');
  end if;

  -- A game in play at a table with NO bot player: there is nobody to
  -- hand the chair to, so the table is called off rather than staffed
  -- by a seat that can never take a shot.
  if not v_has_bot then
    update public.game_sessions
    set status = 'cancelled', finished_at = now(),
        current_seat = null, turn_started_at = null
    where id = p_session;

    for r in
      select profile_id from public.game_seats
      where session_id = p_session and profile_id is not null
        and profile_id <> auth.uid()
    loop
      perform public.game_notify(
        r.profile_id,
        coalesce(v_game, 'A game') || ' - the game was called off',
        coalesce(v_who, 'The other player') || ' had to go, and this game needs two.',
        '/app/games'
      );
    end loop;

    return jsonb_build_object('result', 'cancelled', 'reason', 'needs_two');
  end if;

  update public.game_seats
  set profile_id = null,
      is_bot = true,
      presence = 'active',
      missed_turns = 0,
      -- NEW: the chair remembers whose it was.
      left_by = auth.uid()
  where session_id = p_session and seat_no = v_seat;

  select count(*) into v_humans
  from public.game_seats
  where session_id = p_session and profile_id is not null;

  if v_humans = 0 then
    update public.game_sessions set status = 'cancelled' where id = p_session;
    return jsonb_build_object('result', 'cancelled');
  end if;

  for r in
    select profile_id from public.game_seats
    where session_id = p_session and profile_id is not null
  loop
    perform public.game_notify(
      r.profile_id,
      coalesce(v_game, 'A game') || ' - a friendly bot takes over',
      coalesce(v_who, 'A player') || ' had to go; the game carries on.',
      '/app/games/s/' || p_session
    );
  end loop;

  return jsonb_build_object('result', 'left', 'seat', 'bot');
end;
$function$;

-- ── and you can take the chair back ──────────────────────────────
create or replace function public.rejoin_left_seat(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s      public.game_sessions%rowtype;
  v_seat smallint;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if s.id is null or s.status <> 'active' then
    return jsonb_build_object('ok', false, 'why', 'over');
  end if;

  -- Only a chair that is still the bot's. If somebody else has taken
  -- it in the meantime it is theirs, and the answer is no rather than
  -- a struggle over a seat.
  select seat_no into v_seat
  from public.game_seats
  where session_id = p_session
    and left_by = auth.uid()
    and profile_id is null
    and is_bot
  limit 1;

  if v_seat is null then
    return jsonb_build_object('ok', false, 'why', 'taken');
  end if;

  update public.game_seats
  set profile_id = auth.uid(),
      is_bot = false,
      presence = 'active',
      missed_turns = 0,
      left_by = null
  where session_id = p_session and seat_no = v_seat;

  return jsonb_build_object('ok', true, 'seat', v_seat);
end;
$function$;

revoke all on function public.rejoin_left_seat(uuid) from public, anon;
grant execute on function public.rejoin_left_seat(uuid) to authenticated;

-- ── the tables you walked away from ──────────────────────────────
create or replace function public.my_left_tables()
returns table (
  id uuid,
  game_key text,
  title text,
  status text,
  seats_total smallint,
  created_at timestamptz,
  seat_no smallint,
  still_open boolean
)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select s.id, s.game_key, s.title, s.status, s.seats_total, s.created_at,
         gs.seat_no,
         -- can it still be taken back? the bot may have been replaced
         (gs.profile_id is null and gs.is_bot and s.status = 'active') as still_open
  from public.game_seats gs
  join public.game_sessions s on s.id = gs.session_id
  where gs.left_by = auth.uid()
    and s.status in ('active', 'finished')
  order by s.created_at desc
  limit 20;
$function$;

revoke all on function public.my_left_tables() from public, anon;
grant execute on function public.my_left_tables() to authenticated;

-- ── one notification when a table you left finishes ──────────────
create or replace function public.exec_game_move(
  p_session uuid, p_seat smallint, p_by_bot boolean, p_payload jsonb default null::jsonb
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

  insert into public.game_moves (session_id, seat_no, by_bot, move, state_before)
  values (p_session, p_seat, p_by_bot, v_move, s.state);

  select name_en into v_game_name from public.games where key = s.game_key;

  if v_winner then
    update public.game_sessions
    set status = 'finished', winner_seat = p_seat, finished_at = now(),
        current_seat = null, turn_started_at = null
    where id = p_session;
    -- Everyone still at the table, AND everyone who walked away from
    -- it: how a game you were in ended is the one thing a leaver
    -- still wants, and the only notification they get.
    for seat_rec in
      select profile_id from public.game_seats
      where session_id = p_session and profile_id is not null
      union
      select left_by from public.game_seats
      where session_id = p_session and left_by is not null
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
    -- By profile_id only. A seat somebody has left has none, so the
    -- bot's turns never reach the person who walked away.
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
