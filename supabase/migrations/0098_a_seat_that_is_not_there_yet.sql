/* ════════════════════════════════════════════════
   0098 — a seat that is not there yet

   game_invite_to_seat (0093) was written for a §8 table: active,
   with bots holding every seat but yours, and the invitation takes
   one of the bots' chairs. It asks for a seat row that exists and
   is_bot, and refuses anything else.

   CARROM HAS NO BOTS. Its timeout_style is 'pass_turn' and
   start_with_bots refuses it outright — "This game is played between
   people". So a carrom table opened by tapping the game stays a
   LOBBY with exactly one seat row in it: yours. There is no bot
   chair to invite anybody into, and the seat you would invite them
   to has no row at all yet.

   Reproduced before changing anything:

     start_with_bots  → 400  "This game is played between people"
     table            → lobby, seats_total 2
     seats            → [{seat_no: 1, is_bot: false}]
     invite to seat 2 → 400  "That seat is not free"

   That breaks two callers. Lane 38's "Play something" row, shipped
   an hour ago on this function, throws for carrom. And my own games
   home promises a playable table on a tap, which carrom cannot give
   — it needs a person, and the invitation is the whole point of
   opening one.

   So the function takes both shapes. A bot's chair is taken over as
   before. A seat that does not exist yet — within seats_total, at a
   table nobody has played — gets the invitation reserved against its
   NUMBER, which is exactly what the old lobby invite_to_game did and
   what respond_game_invite's existing lobby branch already knows how
   to fill.

   Restated whole from the live definition. The change is the seat
   test and the branch marked NEW.
   ════════════════════════════════════════════════ */

create or replace function public.game_invite_to_seat(
  p_session uuid,
  p_invitee uuid,
  p_seat smallint
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s public.game_sessions%rowtype;
  v_existing public.game_invites%rowtype;
  v_seat public.game_seats%rowtype;
  v_found boolean;
  v_id uuid;
  v_inviter text;
  v_game_name text;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.created_by <> auth.uid() then
    raise exception 'Only the person who opened the table can invite to it';
  end if;
  if not public.game_table_is_soft(p_session) then
    raise exception 'The game has begun - ask them to the next one';
  end if;
  if not public.can_use_community_profile(p_invitee) then
    raise exception 'That neighbour cannot join games right now';
  end if;
  if not public.game_connected(auth.uid(), p_invitee) then
    raise exception 'Invitations go to people connected with you';
  end if;

  select * into v_seat from public.game_seats
  where session_id = p_session and seat_no = p_seat;
  v_found := found;

  /* NEW (0098) — three shapes, not one.

     a bot is holding it   → they take it over on accept (0093)
     no row exists yet     → the invitation is reserved against the
                             seat NUMBER, the way a lobby invite has
                             always worked. This is carrom, and any
                             game that will not seat a bot.
     a person is in it     → refused, as before. */
  if v_found and not v_seat.is_bot then
    raise exception 'Someone is sitting there';
  end if;
  if not v_found and (p_seat < 1 or p_seat > s.seats_total) then
    raise exception 'That seat is not at this table';
  end if;

  if exists (select 1 from public.game_seats where session_id = p_session and profile_id = p_invitee) then
    return null;
  end if;

  /* Already asked: re-point the existing invitation at the seat they
     tapped this time rather than sending a second notification. */
  select * into v_existing from public.game_invites
  where session_id = p_session and invitee_id = p_invitee;
  if v_existing.id is not null then
    if v_existing.status = 'pending' then
      update public.game_invites set seat_no = p_seat where id = v_existing.id;
    end if;
    return v_existing.id;
  end if;

  /* Two people cannot be kept the same empty chair. A bot seat can
     be double-booked harmlessly (the first to accept takes it and
     the second is told it is filled), but an empty one has nothing
     holding it, so the reservation has to be honest. */
  if not v_found and exists (
    select 1 from public.game_invites
    where session_id = p_session and seat_no = p_seat and status = 'pending'
  ) then
    raise exception 'That seat is already being kept for somebody';
  end if;

  insert into public.game_invites (session_id, inviter_id, invitee_id, seat_no)
  values (p_session, auth.uid(), p_invitee, p_seat)
  returning id into v_id;

  select full_name into v_inviter from public.profiles where id = auth.uid();
  select name_en into v_game_name from public.games where key = s.game_key;
  perform public.game_notify(
    p_invitee,
    'A seat is waiting for you',
    coalesce(v_inviter, 'A neighbour') || ' has kept you a seat at a game of ' || v_game_name || '.',
    case when s.game_key = 'ludo'
         then '/app/games/ludo/' || p_session
         else '/app/games/s/' || p_session end
  );
  return v_id;
end;
$function$;
