-- ════════════════════════════════════════════════
-- A tick that plays ONE turn, when the caller asks for one.
--
-- THE BUG THIS FIXES IS VISIBLE, NOT STRUCTURAL. game_tick loops
-- until it reaches a human's turn, up to fifty plays. At a table with
-- one person and three bots that means one call can play three bot
-- turns, and the client only ever sees the board they left behind. So
-- the gotis JUMP: the board goes from before-the-bots to
-- after-all-of-them in one state change, three moves collapsed into
-- one, and there is nothing left for the walk animation to walk.
--
-- Measured on a real table: my own goti travelled twelve squares and
-- was seen in thirteen positions — it walked. A bot's travelled
-- twenty-one and was seen in seven. Same code, same board, same
-- animation; the difference is entirely how many moves arrived at
-- once.
--
-- The owner's word for it is that a turn you cannot watch is not a
-- turn.
--
-- p_max caps the plays PER SESSION. Passing 1 makes the client the
-- pacemaker: it asks for one turn, shows the dice tumbling, walks the
-- goti, and asks for the next. Passing nothing keeps the old
-- behaviour exactly, which matters because the cron and the other
-- lanes call this with a session id and nothing else — and a
-- background sweep SHOULD catch a table up in one go, because nobody
-- is watching it.
--
-- The one-argument function is DROPPED rather than left beside a
-- two-argument one: PostgREST resolves by argument names, and two
-- overloads both matching {"p_session"} is an ambiguity error at
-- every call site rather than at this one.
-- ════════════════════════════════════════════════

drop function if exists public.game_tick(uuid);

create or replace function public.game_tick(
  p_session uuid default null::uuid,
  p_max int default null
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s record;
  seat_rec record;
  v_turn_seconds int;
  v_style text;
  v_payload jsonb;
  v_played int := 0;
  v_here int;
  v_guard int;
  v_passes int;
  v_trailing int;
  v_game_name text;
  v_dead boolean;
  v_watching boolean;
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
    -- plays made for THIS session, which is what p_max caps
    v_here := 0;

    begin
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
            coalesce(v_game_name, 'A game') || ' - the table was closed',
            'Nobody had played for a while, so we tidied the table away. Start a new one whenever you like.',
            '/app/games'
          );
        end loop;
        v_dead := true;
      end if;
    end if;

    if not v_dead then
    loop
      v_guard := v_guard + 1;
      exit when v_guard > 50;
      -- ONE TURN, IF ONE WAS ASKED FOR.
      exit when p_max is not null and v_here >= p_max;

      select gs.*, sess.house_rules, sess.turn_started_at as t0, sess.status as sess_status
      into seat_rec
      from public.game_sessions sess
      join public.game_seats gs
        on gs.session_id = sess.id and gs.seat_no = sess.current_seat
      where sess.id = s.id;

      exit when seat_rec is null or seat_rec.sess_status <> 'active';

      v_turn_seconds := coalesce((seat_rec.house_rules ->> 'turn_seconds')::int, 30);

      if seat_rec.is_bot or seat_rec.presence = 'away' then
        perform public.exec_game_move(s.id, seat_rec.seat_no, true, v_payload);
        v_played := v_played + 1;
        v_here := v_here + 1;
      elsif now() >= seat_rec.t0 + make_interval(secs => v_turn_seconds) then
        if public.game_table_is_soft(s.id)
           and not exists (
             select 1 from public.game_seats o
             where o.session_id = s.id
               and o.seat_no <> seat_rec.seat_no
               and not o.is_bot
           )
        then
          exit;
        end if;

        -- 0099: somebody reading the board is present.
        v_watching := seat_rec.last_seen_at is not null
                      and seat_rec.last_seen_at > now() - interval '90 seconds';

        if v_watching then
          perform public.exec_game_move(s.id, seat_rec.seat_no, true, v_payload);
          v_played := v_played + 1;
          v_here := v_here + 1;
        else
          update public.game_seats
          set missed_turns = missed_turns + 1,
              presence = case when missed_turns + 1 >= 3 then 'away' else presence end
          where session_id = s.id and seat_no = seat_rec.seat_no;
          perform public.exec_game_move(s.id, seat_rec.seat_no, true, v_payload);
          v_played := v_played + 1;
          v_here := v_here + 1;
        end if;
      else
        exit;
      end if;

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

revoke all on function public.game_tick(uuid, int) from public;
grant execute on function public.game_tick(uuid, int) to authenticated;
