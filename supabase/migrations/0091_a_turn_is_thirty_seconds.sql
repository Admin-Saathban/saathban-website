/* ════════════════════════════════════════════════
   0091 — a turn is thirty seconds

   TONIGHT.md: "Turn timer 30 seconds, not 60."

   THE FALLBACK HAD TO MOVE ON BOTH SIDES AT ONCE. Ludo's client
   default has said 30 since DEFAULT_RULES was written, and every new
   table carries turn_seconds explicitly — but a table created before
   that carries no key at all, and for those the number came from two
   different fallbacks: game_tick's 60 here, and ludoRails' 60 in the
   browser. They agreed, which is why the client one was deliberately
   left at 60 rather than "fixed" on its own: a client counting 30 over
   a server waiting 60 shows a clock emptying while nothing happens,
   and blames the player for a turn they were told they had lost.

   So this changes the server's fallback, and ludoRails changes the
   client's in the same commit. Tables that named their own
   turn_seconds are untouched by either.

   The function is re-stated whole rather than patched, because
   CREATE OR REPLACE is the only way to change one line of a function
   and a partial copy would silently revert whatever else had landed.
   The body below was taken from the LIVE definition immediately
   before the change, not from an older migration file — the two are
   not always the same thing, and the live one is the truth.

   The single behavioural change is the coalesce marked below.
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
    -- Has this table been doing nothing but passing? Asked only of games
    -- with no bot player: elsewhere a pass is a normal part of play rather
    -- than evidence that nobody is there.
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

      -- ── THE CHANGE ──────────────────────────────────────────────
      -- THIRTY SECONDS, not sixty. The fallback has to move here as
      -- well as in the client: a client counting 30 over a server
      -- waiting 60 shows a clock that empties while nothing happens.
      -- Tables that named their own turn_seconds are untouched.
      v_turn_seconds := coalesce((seat_rec.house_rules ->> 'turn_seconds')::int, 30);

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
