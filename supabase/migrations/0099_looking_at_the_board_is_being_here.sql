/* ════════════════════════════════════════════════
   0099 — looking at the board is being here

   REPRODUCED AS A PERSON, not as a fixture, because the owner's
   report survived two earlier fixes and I wanted to see it happen.
   Opened a table on a phone-sized screen, rolled once, then did
   what he does: read the board. Eighty seconds later his own plate
   said

       Test Icon (you)  BOT
       Test Icon stepped away — a bot is playing their seat

   while the browser was sitting there polling every 2.5 seconds.

   WHAT 0097 FIXED AND WHAT IT DID NOT. 0097 made a roll clear the
   away flag, so a player who came back was no longer labelled gone
   for the rest of the game. That was real, and it is not this. This
   is the flag going ON while somebody is present: the turn clock
   lapses three times — ninety seconds at the default, forty-five on
   this table — and game_tick concludes they have left. Reading a
   board for ninety seconds is not leaving. It is how a
   seventy-nine-year-old plays a board game.

   THE TWO THINGS THAT WERE ONE THING. Playing a lapsed turn so the
   table does not stall is right, and every other seat depends on it.
   DECLARING THE PERSON GONE is a different act with a different
   consequence — a label on their seat, a line under the board
   telling everyone they walked off, and (via exec_game_move) no more
   "your turn" notifications. The two were welded together on one
   counter.

   So a seat now says when its client last looked. A browser with the
   board open touches game_seen on its poll; a seat seen inside the
   grace window keeps its turn played for it AND keeps its name. Only
   a seat nobody is watching gets the away label.

   The grace is deliberately generous. A phone that sleeps in
   somebody's hand, a tunnel, a grandchild borrowing it — none of
   those are leaving either, and the cost of being wrong in this
   direction is a bot playing a turn for someone who is still there,
   which already happens and is survivable. The cost of being wrong
   the other way is telling a room that a person left when they are
   sitting right there.
   ════════════════════════════════════════════════ */

alter table public.game_seats
  add column if not exists last_seen_at timestamptz;

comment on column public.game_seats.last_seen_at is
  'When this seat''s client last had the board open. Presence, as opposed to whether they have tapped recently.';

/* The heartbeat. Deliberately tiny: no return, no read, one row, and
   it is safe to call on every poll. It touches only the caller's own
   seat, so it cannot be used to make somebody else look present. */
create or replace function public.game_seen(p_session uuid)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  update public.game_seats
  set last_seen_at = now()
  where session_id = p_session
    and profile_id = auth.uid();
$function$;

revoke all on function public.game_seen(uuid) from public;
grant execute on function public.game_seen(uuid) to authenticated;

/* game_tick, restated whole from the live definition read
   immediately before this change. The only difference is the block
   marked NEW: a lapsed turn is still played, and the away LABEL is
   only applied to a seat nobody is watching. */
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

      v_turn_seconds := coalesce((seat_rec.house_rules ->> 'turn_seconds')::int, 30);

      if seat_rec.is_bot or seat_rec.presence = 'away' then
        perform public.exec_game_move(s.id, seat_rec.seat_no, true, v_payload);
        v_played := v_played + 1;
      elsif now() >= seat_rec.t0 + make_interval(secs => v_turn_seconds) then
        -- 0094: the clock does not take a FIRST turn at a table that
        -- has not been played and holds nobody but bots.
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

        -- NEW (0099): is anybody watching this seat? A board open in
        -- a browser touches game_seen on its poll. Somebody reading
        -- the board is present, however long they take over a move.
        v_watching := seat_rec.last_seen_at is not null
                      and seat_rec.last_seen_at > now() - interval '90 seconds';

        if v_watching then
          -- Play the turn so the table keeps moving, and say nothing
          -- about them having left, because they have not.
          perform public.exec_game_move(s.id, seat_rec.seat_no, true, v_payload);
          v_played := v_played + 1;
        else
          update public.game_seats
          set missed_turns = missed_turns + 1,
              presence = case when missed_turns + 1 >= 3 then 'away' else presence end
          where session_id = s.id and seat_no = seat_rec.seat_no;
          perform public.exec_game_move(s.id, seat_rec.seat_no, true, v_payload);
          v_played := v_played + 1;
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

/* Nobody currently at a table should be wearing a label this
   migration has just established was wrong. Finished tables keep
   their record. */
update public.game_seats s
set presence = 'active', missed_turns = 0
from public.game_sessions g
where g.id = s.session_id
  and g.status in ('lobby', 'active')
  and not s.is_bot
  and (s.presence is distinct from 'active' or s.missed_turns <> 0);
