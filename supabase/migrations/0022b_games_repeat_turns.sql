-- 0022b — repeat turns (games lane; patch on 0022, same day).
--
-- An executor may return {"again": true} alongside move/winner: the
-- seat keeps the turn (ludo's extra roll on six, carrom's pocket-and-
-- continue). The rails reset the turn clock and skip rotation; no
-- notification, since the same player just moved. Everything else in
-- exec_game_move is unchanged from 0022.

create or replace function public.exec_game_move(
  p_session uuid, p_seat smallint, p_by_bot boolean, p_payload jsonb default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
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

  insert into public.game_moves (session_id, seat_no, by_bot, move)
  values (p_session, p_seat, p_by_bot, v_move);

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
    -- Same seat goes again; just restart the turn clock.
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
$$;

revoke execute on function public.exec_game_move(uuid, smallint, boolean, jsonb) from public, anon, authenticated;
