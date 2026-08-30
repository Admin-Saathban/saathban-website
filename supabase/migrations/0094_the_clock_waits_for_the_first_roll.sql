/* ════════════════════════════════════════════════
   0094 — the clock waits for the first roll

   FOUND BY DRIVING §8, NOT BY READING IT. A table opened by tapping
   a game is 'active' from the first instant, so its 30-second turn
   clock starts before the person has looked at it. Thirty seconds
   later game_tick plays their opening turn for them with the bot
   heuristic — and because a die has now been thrown, the table stops
   being soft (0092) and every one of §8's taps disappears.

   So "seats, invites, colour, one-die-or-two and the name are all
   changed at the table" had a half-minute in which to be true. That
   is not a window, it is a flicker; the first attempt to drive it
   end to end lost the race and reported the whole feature missing.

   WHAT THE CLOCK IS FOR is the reason this is safe. It exists so a
   table does not stall on somebody who has walked away — it protects
   the OTHER PLAYERS' evening. Before the first roll, at a table
   where every other seat is a bot, there is nobody to protect: the
   bots are not kept waiting, and the person is still setting their
   table. So the clock holds.

   The two conditions are both load-bearing and neither is optional:

     still soft   — once play has begun the clock governs every turn
                    exactly as before, including the opener's second.
     bots only    — the moment a real person is at the table the
                    clock is protecting them again, and it runs from
                    the first second, unchanged.

   The board must agree, or this trades a turn played without you for
   a ring emptying while nothing happens — the "clock that lies" this
   codebase has twice written comments against. LudoSession stops
   drawing the countdown under the same two conditions, in the same
   commit.

   game_tick is restated WHOLE. The body is the live definition read
   immediately before this change; the only addition is the branch
   marked NEW.
   ════════════════════════════════════════════════ */

create or replace function public.game_tick(p_session uuid default null::uuid)
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
  v_guard int;
  v_passes int;
  v_trailing int;
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
            coalesce(v_game_name, 'A game') || ' — the table was closed',
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

      select gs.*, sess.house_rules, sess.turn_started_at as t0, sess.status as sess_status
      into seat_rec
      from public.game_sessions sess
      join public.game_seats gs
        on gs.session_id = sess.id and gs.seat_no = sess.current_seat
      where sess.id = s.id;

      exit when seat_rec is null or seat_rec.sess_status <> 'active';

      -- THIRTY SECONDS, not sixty. TONIGHT.md settles it, and the
      -- fallback has to move HERE as well as in the client: a client
      -- counting 30 over a server waiting 60 shows a clock that empties
      -- while nothing happens, which is worse than either number.
      -- Tables that named their own turn_seconds are untouched.
      v_turn_seconds := coalesce((seat_rec.house_rules ->> 'turn_seconds')::int, 30);

      if seat_rec.is_bot or seat_rec.presence = 'away' then
        perform public.exec_game_move(s.id, seat_rec.seat_no, true, v_payload);
        v_played := v_played + 1;
      elsif now() >= seat_rec.t0 + make_interval(secs => v_turn_seconds) then
        -- NEW (0094): the clock does not take somebody's FIRST turn at
        -- a table that has not been played and holds nobody but bots.
        -- They are setting it up (§8); no one is kept waiting by it.
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

        update public.game_seats
        set missed_turns = missed_turns + 1,
            presence = case when missed_turns + 1 >= 3 then 'away' else presence end
        where session_id = s.id and seat_no = seat_rec.seat_no;
        perform public.exec_game_move(s.id, seat_rec.seat_no, true, v_payload);
        v_played := v_played + 1;
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
