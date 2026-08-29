-- ============================================================================
-- 0044b — a game nobody is playing must stop
--
-- FOUND BY LANE -38 AS A LIVE WRITE LOOP, not by reasoning. The pg_cron job
-- `saathban_game_tick` runs `game_tick()` every minute. Against seven stranded
-- carrom tables it was writing a measured **350 pass-moves per minute, flat,
-- for at least eight minutes** — 50 per table per call, ~100% `{"pass": true}`,
-- and it would have continued for ever. Roughly half a million rows a day into
-- game_moves, on a database this project has already seen go unresponsive
-- under concurrent load.
--
-- THE MECHANISM. Carrom is `timeout_style = 'pass_turn'`, so game_tick's
-- payload for a lapsed or bot seat is `{"pass": true}`. Its inner loop plays
-- any seat that is a bot OR whose person has gone `away`, and only exits when
-- it reaches a seat that is neither. Give it a table where EVERY seat is one
-- or the other and it never reaches that exit: it spins to its guard of 50,
-- writing a pass each time. A pass changes nothing, so the next tick finds the
-- identical table and does it again.
--
-- 0044 stops one route into that state (leaving no longer seats a bot at a
-- game that has none). **This is the other half, and it is the more important
-- one, because the state is reachable with no bot at all**: two people start a
-- carrom game, both walk away, both are marked `away` after three missed
-- turns, and the loop begins. No defect required — just two people losing
-- interest at the same time, which is a thing that will happen.
--
-- THE RULE. In a game with no bot player, a table where every seat does
-- nothing but pass is a table nobody is playing. So:
--
--   * within one call, stop after a full circuit of consecutive passes —
--     going round again in the same call cannot produce anything different;
--   * across calls, once the log ends in enough consecutive passes that a
--     brief absence cannot explain it, call the table off and tell whoever
--     is still nominally seated.
--
-- WHY IT READS THE MOVE BODY AND NOT `by_bot` (lane -f2 established this):
-- for a `{"pass": true}` payload exec_game_move short-circuits before the
-- executor, so `by_bot` on those rows means "not played by the seated human",
-- NOT "a bot played". The flag cannot distinguish a game being played from a
-- game being abandoned. The body can.
--
-- WHY IT IS RESTRICTED TO `pass_turn` GAMES, which is the part I would have
-- got wrong: in LUDO a pass is legitimate and common — every piece in the yard
-- and no six is a pass — so eight in a row runs about 23% in the opening. A
-- general "too many passes means abandoned" rule would have cancelled real
-- ludo games with people sitting at them. In a pass_turn game a pass means
-- nobody acted; in a bot_plays game it can mean the dice did not cooperate.
-- Same word, different fact.
--
-- Nothing here changes ludo or snakes: bot_plays games keep the existing
-- behaviour exactly, guard of 50 included.
-- ============================================================================

create or replace function public.game_tick(p_session uuid default null)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $function$
declare
  s record;
  seat_rec record;
  v_turn_seconds int;
  v_style text;
  v_payload jsonb;
  v_played int := 0;
  v_guard int;
  v_passes int;          -- consecutive passes played in THIS call
  v_trailing int;        -- consecutive passes at the END of the log
  v_game_name text;
  v_dead boolean;
  r record;
begin
  for s in
    select sess.id, sess.seats_total, sess.game_key, g.timeout_style
    from public.game_sessions sess
    join public.games g on g.key = sess.game_key
    where sess.status = 'active' and (p_session is null or sess.id = p_session)
  loop
    v_style := s.timeout_style;
    v_payload := case when v_style = 'pass_turn' then '{"pass": true}'::jsonb end;
    v_guard := 0;
    v_passes := 0;
    v_dead := false;

    begin
    -- ── Has this table been doing nothing but passing? ──
    -- Only asked of games with no bot player: elsewhere a pass is a normal
    -- part of play rather than evidence that nobody is there.
    if v_style = 'pass_turn' then
      with recent as (
        select (m.move ? 'pass') as is_pass,
               row_number() over (order by m.created_at desc, m.id desc) as rn
        from public.game_moves m
        where m.session_id = s.id
        order by m.created_at desc, m.id desc
        limit 60
      )
      select coalesce((select min(rn) - 1 from recent where not is_pass),
                      (select count(*) from recent))
      into v_trailing;

      -- Four full circuits of nothing. A person who stepped out for a
      -- moment is covered by the three missed turns it already takes to be
      -- marked away; this is well past that.
      if v_trailing >= greatest(8, s.seats_total * 4) then
        update public.game_sessions
        set status = 'cancelled', finished_at = now(),
            current_seat = null, turn_started_at = null
        where id = s.id;

        select name_en into v_game_name from public.games where key = s.game_key;
        for r in
          select profile_id from public.game_seats
          where session_id = s.id and profile_id is not null
        loop
          perform public.game_notify(
            r.profile_id,
            coalesce(v_game_name, 'A game') || ' — the table was closed',
            'Nobody had played for a while, so we tidied the table away. Start a new one whenever you like.',
            '/app/games'
          );
        end loop;
        v_dead := true;               -- nothing more to do with this session
      end if;
    end if;

    if not v_dead then
    loop
      v_guard := v_guard + 1;
      exit when v_guard > 50;

      select gs.*, sess.house_rules, sess.turn_started_at as t0, sess.status as sess_status
      into seat_rec
      from public.game_sessions sess
      join public.game_seats gs
        on gs.session_id = sess.id and gs.seat_no = sess.current_seat
      where sess.id = s.id;

      exit when seat_rec is null or seat_rec.sess_status <> 'active';

      v_turn_seconds := coalesce((seat_rec.house_rules ->> 'turn_seconds')::int, 60);

      if seat_rec.is_bot or seat_rec.presence = 'away' then
        perform public.exec_game_move(s.id, seat_rec.seat_no, true, v_payload);
        v_played := v_played + 1;
      elsif now() >= seat_rec.t0 + make_interval(secs => v_turn_seconds) then
        update public.game_seats
        set missed_turns = missed_turns + 1,
            presence = case when missed_turns + 1 >= 3 then 'away' else presence end
        where session_id = s.id and seat_no = seat_rec.seat_no;
        perform public.exec_game_move(s.id, seat_rec.seat_no, true, v_payload);
        v_played := v_played + 1;
      else
        exit;
      end if;

      -- A whole circuit of passes in one call: going round again cannot
      -- produce anything different, so stop rather than spin to the guard.
      -- This is what turned 50 writes per minute into 2.
      if v_payload is not null then
        v_passes := v_passes + 1;
        exit when v_passes >= s.seats_total;
      else
        v_passes := 0;
      end if;
    end loop;
    end if;
    exception when others then
      raise notice 'game_tick: session % skipped (%)', s.id, sqlerrm;
    end;
  end loop;
  return v_played;
end;
$function$;

revoke execute on function public.game_tick(uuid) from public, anon;
grant execute on function public.game_tick(uuid) to authenticated;
