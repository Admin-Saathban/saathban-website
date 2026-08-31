/* ════════════════════════════════════════════════
   0100 — bots take their chairs without starting the game

   The setup room lets the host say who sits in each chair: a person
   by name, a bot, an open invitation, or a link. Then the board opens
   and the host waits ON it while the humans arrive.

   For that to be true the BOTS have to be sitting there already —
   the whole point of item 2 is a board that looks like a table with
   people arriving at it, not a grid of empty chairs.

   start_with_bots cannot do it. It fills EVERY empty chair and then
   starts the game, which would slam the door on the person the host
   just invited. NewGame knew this and worked around it by seating no
   bots at all whenever anybody was invited, so a host who asked one
   daughter and two bots waited on a board with three empty seats.

   This seats the bots the host actually chose, in the chairs they
   chose, and does not start anything. The game starts by itself when
   the last seat fills, through game_start_if_full, which
   respond_game_invite already calls when a guest accepts — so the
   start still announces itself with the countdown rather than
   happening the moment the room is dismissed.
   ════════════════════════════════════════════════ */

create or replace function public.game_seat_bots(p_session uuid, p_seats smallint[])
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s public.game_sessions%rowtype;
  v_style text;
  v_seat smallint;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.created_by <> auth.uid() then
    raise exception 'Only the person who opened the table can seat it';
  end if;
  if s.status <> 'lobby' then
    raise exception 'This table has already started';
  end if;

  select timeout_style into v_style from public.games where key = s.game_key;
  if v_style = 'pass_turn' then
    raise exception 'This game is played between people';
  end if;

  foreach v_seat in array coalesce(p_seats, '{}')
  loop
    if v_seat >= 1 and v_seat <= s.seats_total
       and not exists (
         select 1 from public.game_seats
         where session_id = p_session and seat_no = v_seat
       )
    then
      insert into public.game_seats (session_id, seat_no, profile_id, is_bot)
      values (p_session, v_seat, null, true);
    end if;
  end loop;

  /* If that happened to complete the table — every chair a bot, or
     the last human already seated — it starts here, with the same
     announcement any other full table gets. */
  perform public.game_start_if_full(p_session);
end;
$function$;

revoke all on function public.game_seat_bots(uuid, smallint[]) from public;
grant execute on function public.game_seat_bots(uuid, smallint[]) to authenticated;

comment on function public.game_seat_bots(uuid, smallint[]) is
  'Seat bots in named chairs without filling the rest or starting the game. The setup room chooses which chairs; the table starts when the last one fills.';
