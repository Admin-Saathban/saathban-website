-- ============================================================================
-- 0041 — Leaving: say WHICH of the two things happened
--
-- 0040 returns 'left' for two materially different outcomes:
--
--   a guest leaving a LOBBY      → their seat is deleted; the chair is empty
--   a player leaving a game IN   → their seat is CONVERTED TO A BOT; the chair
--   PLAY                           is still occupied and still plays
--
-- The sentence a person should read differs accordingly — "you've left the
-- table" against "a friendly bot will play your seat" — but the caller was
-- given one word for both, so the only way to choose was to read
-- game_sessions.status on the client at tap time. That is wrong in exactly
-- the window where a table fills between the screen rendering and the tap
-- landing, and no amount of client care can close it: only this transaction
-- knows what it actually did.
--
-- So it now says. `seat` is 'released' or 'bot' on a 'left' result. The
-- 'cancelled' branches deliberately carry no seat: when the table itself has
-- been called off, the sentence is about the table, not the chair.
--
-- Additive only — 'result' keeps its four existing values, so a client that
-- ignores `seat` behaves exactly as before.
-- ============================================================================

create or replace function public.leave_game_session(p_session uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s        public.game_sessions%rowtype;
  v_seat   smallint;
  v_humans int;
  v_who    text;
  v_game   text;
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
    return jsonb_build_object('result', 'not_seated');  -- already gone
  end if;

  if s.status in ('finished', 'cancelled') then
    return jsonb_build_object('result', 'over');
  end if;

  select full_name into v_who from public.profiles where id = auth.uid();
  select coalesce(g.name_en, s.game_key) into v_game
  from public.games g where g.key = s.game_key;

  -- ── A table that hasn't started ──
  if s.status = 'lobby' then
    if s.created_by = auth.uid() then
      perform public.cancel_game_session(p_session);
      return jsonb_build_object('result', 'cancelled');
    end if;

    delete from public.game_seats
    where session_id = p_session and seat_no = v_seat;

    perform public.game_notify(
      s.created_by,
      coalesce(v_game, 'A game') || ' — a seat is free again',
      coalesce(v_who, 'Someone') || ' has stepped away from the table.',
      '/app/games/s/' || p_session
    );
    return jsonb_build_object('result', 'left', 'seat', 'released');
  end if;

  -- ── A game in play: the seat stays, played by a bot ──
  update public.game_seats
  set profile_id = null,
      is_bot = true,
      presence = 'active',
      missed_turns = 0
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
      coalesce(v_game, 'A game') || ' — a friendly bot takes over',
      coalesce(v_who, 'A player') || ' had to go; the game carries on.',
      '/app/games/s/' || p_session
    );
  end loop;

  return jsonb_build_object('result', 'left', 'seat', 'bot');
end;
$$;

revoke execute on function public.leave_game_session(uuid) from public, anon;
grant execute on function public.leave_game_session(uuid) to authenticated;
