-- ============================================================================
-- 0040 — Leaving a table you are seated at
--
-- The games home now allows ONE live table at a time, and offers a person
-- who already has one a choice: finish it, or leave it and start the new one.
-- The second button needs a server path, and 0038's cancel_game_session
-- cannot be it: that is host-only and lobby-only, by a deliberate design this
-- migration does not touch. The blocking table is very often neither — a
-- lobby someone ELSE set, or a game already in play — so without this the
-- choice would offer a button that cannot keep its promise.
--
-- What leaving means, per situation:
--
--   lobby, and I set the table  → delegate to cancel_game_session, so its
--                                 notifications and its (load-bearing)
--                                 decline-don't-delete handling of invites
--                                 stay the single source of truth.
--   lobby, and I merely joined  → my seat is released; the table stands for
--                                 everyone else.
--   active                      → MY SEAT BECOMES A BOT. It does not vanish.
--                                 The rails have promised since 0022 that a
--                                 seat is never forfeited and never removed
--                                 mid-game; the others must not be stranded
--                                 with a hole where a player was, and
--                                 game_tick already plays bot seats. This is
--                                 the 'away' behaviour, made permanent.
--   active, and I was the last
--   human at the table          → the table is called off ('cancelled'). A
--                                 board played out by bots alone helps
--                                 nobody. 'cancelled' rather than 'finished'
--                                 because there is no winner to record.
--
-- Idempotent: leaving a table you have already left, or one that is over,
-- reports that plainly instead of failing.
--
-- KNOWN CONSTRAINT, so it is not a surprise later: the bot conversion assumes
-- the game has a bot that can actually take a turn. Carrom seats two and its
-- timeout_style is pass_turn, so a leave there always lands in the last-human
-- branch and calls the table off — correct today. If carrom ever gains seats,
-- a converted seat would be one no bot can play, and this branch would need a
-- per-game answer (cancel for pass_turn games, bot for bot_plays games).
--
-- CLIENT NOTE: a GUEST who leaves loses read access to the session in the same
-- instant (is_game_participant is seat-based, and can_view_game only otherwise
-- admits invitees and the host). The client must therefore navigate away as
-- part of the leave, and must not treat the empty read that follows as an
-- error — otherwise the person is told the table is "private to its players"
-- one second after they themselves left it. Widening the policy would be the
-- wrong fix: leaving really should end your access.
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
    return jsonb_build_object('result', 'left');
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

  return jsonb_build_object('result', 'left');
end;
$$;

revoke execute on function public.leave_game_session(uuid) from public, anon;
grant execute on function public.leave_game_session(uuid) to authenticated;
