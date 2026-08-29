-- ============================================================================
-- 0044 — leaving must not seat a bot that cannot play
--
-- THE THIRD DOOR. 0042d fixed a bot that could not be authenticated. 0043
-- stopped `start_with_bots` seating bots at a game with no bot player. This is
-- the same defect arriving through the one route neither of those covers:
-- **`leave_game_session` seats a bot too.**
--
-- Its active branch converts the leaver's chair into a bot seat, and it never
-- asks whether this game has a bot to put in it. Carrom does not — it is
-- `timeout_style = 'pass_turn'`, so `game_tick` passes a bot seat's turn
-- straight on rather than playing it. In a two-seat carrom game, one person
-- leaving does not take the human count to zero; it takes it to one. The
-- last-human branch does not fire, the chair becomes a bot, and **the person
-- still sitting there is at a table with an opponent that can never take a
-- shot.** Nothing errors. The turn simply comes round to a chair that passes,
-- for ever.
--
-- Not theoretical: seven such tables existed, all created AFTER 0043 was
-- applied, all through this door. 0044b calls them off, by mechanism rather
-- than by a data patch — see the note at the foot of this file.
--
-- WHY THE OTHER GUARDS MISSED IT, recorded because the pattern is the point.
-- 0043 guards one RPC and the test written from it exercises that same RPC. A
-- test written from a fix inherits that fix's blind spot. The property that
-- actually matters is not "this RPC refuses" but "no live table in a bot-less
-- game contains a bot seat", reachable by any route including ones nobody has
-- thought of yet — which is how tests/bot-players.mjs now asserts it.
--
-- THE FIX. A game with no bot player has no one to hand a seat to, so there is
-- nothing to hand it to. When the leaver is the last human at such a table,
-- the table is called off rather than staffed by a bot that cannot play.
--
-- Deliberately NOT extended to bot_plays games: ludo and snakes both have real
-- bot players (0042d and game_exec_snakes respectively, held to it by
-- tests/bot-players.mjs), and there the existing behaviour is the kind one —
-- the game carries on for whoever is still enjoying it instead of collapsing
-- because somebody had to go.
--
-- The lobby branch was checked, not assumed: a host leaving a lobby already
-- routes to cancel_game_session, and a guest leaving only deletes their own
-- seat. Neither seats a bot, so neither needed changing.
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
    return jsonb_build_object('result', 'not_seated');  -- already gone
  end if;

  if s.status in ('finished', 'cancelled') then
    return jsonb_build_object('result', 'over');
  end if;

  select full_name into v_who from public.profiles where id = auth.uid();
  select coalesce(g.name_en, s.game_key), g.timeout_style <> 'pass_turn'
    into v_game, v_has_bot
  from public.games g where g.key = s.game_key;
  v_has_bot := coalesce(v_has_bot, true);

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

  -- ── A game in play, at a table with NO bot player ──
  -- There is nobody to hand the chair to. Handing it to a bot anyway is what
  -- stranded seven carrom tables: the remaining player keeps their turn coming
  -- round to a seat that only ever passes.
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
        coalesce(v_game, 'A game') || ' — the game was called off',
        coalesce(v_who, 'The other player') || ' had to go, and this game needs two.',
        '/app/games'
      );
    end loop;

    return jsonb_build_object('result', 'cancelled', 'reason', 'needs_two');
  end if;

  -- ── A game in play with a real bot player: the seat stays, played by a bot ──
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

-- ── Remediation is left to 0044b, on purpose ──
-- The tables this defect already stranded are not cleaned up by a data patch
-- here. 0044b gives game_tick a termination condition, and the very first
-- thing it does to a table with a long tail of passes is call it off — so the
-- stranded tables are remediated BY THE FIX, on the next cron minute, rather
-- than by a one-off UPDATE that would also have to be right.
--
-- That is the better proof as well as the smaller change: if the seven go
-- quiet on their own, the termination condition demonstrably works on the real
-- thing. A data patch would have tidied away the only live evidence that it
-- does.
