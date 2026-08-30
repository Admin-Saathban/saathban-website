/* ════════════════════════════════════════════════
   0093 — ask someone to THIS seat

   GAMES_IMMERSION_SPEC §8, the clause 0092 could not reach:
   "Seats, INVITES, colour… changed at the table", and "waiting
   happens on the board, with 'waiting for {name}' in the seat".

   WHY THE EXISTING INVITE DOES NOT WORK HERE. invite_to_game refuses
   any session that is not 'lobby', and it hands the invitee the next
   FREE seat number. Both were right when a table waited empty for
   people before it started. A §8 table does not wait: it opens
   already playing, with bots in every seat but yours. Under the old
   rails there is no lobby to invite from and no free seat to invite
   into, so at a quick table the invite button could only ever fail.

   So: an invite that names a seat a BOT is holding. The bot keeps
   playing it while the invitation is out — a table that stalls the
   moment you ask someone to join would punish you for asking — and
   the person takes that same seat, with that same colour, when they
   accept. Nobody is dropped from a game to make room.

   The window is game_table_is_soft (0092), for one reason beyond
   tidiness: taking over a bot mid-game would hand a person a
   position the bot built, which is a different game from the one
   they were invited to.

   respond_game_invite is restated WHOLE below rather than patched.
   The body is the live definition read immediately before this
   change, not an older migration file; the only addition is the
   branch marked NEW.
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
  v_id uuid;
  v_inviter text;
  v_game_name text;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.created_by <> auth.uid() then
    raise exception 'Only the person who opened the table can invite to it';
  end if;
  if not public.game_table_is_soft(p_session) then
    raise exception 'The game has begun — ask them to the next one';
  end if;
  if not public.can_use_community_profile(p_invitee) then
    raise exception 'That neighbour cannot join games right now';
  end if;
  if not public.game_connected(auth.uid(), p_invitee) then
    raise exception 'Invitations go to people connected with you';
  end if;

  select * into v_seat from public.game_seats
  where session_id = p_session and seat_no = p_seat;
  if not found or not v_seat.is_bot then
    raise exception 'That seat is not free';
  end if;

  if exists (select 1 from public.game_seats where session_id = p_session and profile_id = p_invitee) then
    return null;
  end if;

  /* Already asked. Re-pointing the existing invitation at the seat
     they tapped this time is kinder than either refusing or sending
     a second notification for the same table. */
  select * into v_existing from public.game_invites
  where session_id = p_session and invitee_id = p_invitee;
  if v_existing.id is not null then
    if v_existing.status = 'pending' then
      update public.game_invites set seat_no = p_seat where id = v_existing.id;
    end if;
    return v_existing.id;
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

comment on function public.game_invite_to_seat(uuid, uuid, smallint) is
  '§8: invite someone to one named seat at a table already playing with bots. The bot holds it until they arrive.';

create or replace function public.respond_game_invite(p_invite uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  inv public.game_invites%rowtype;
  s public.game_sessions%rowtype;
  v_taken int;
  v_name text;
  v_blocked boolean;
  v_seat public.game_seats%rowtype;
begin
  select * into inv from public.game_invites where id = p_invite for update;
  if inv.invitee_id is distinct from auth.uid() then
    raise exception 'Not yours to answer';
  end if;
  if inv.status = 'accepted' then
    return jsonb_build_object('result', 'joined', 'session_id', inv.session_id);
  end if;
  if inv.status = 'declined' then
    return jsonb_build_object('result', 'declined', 'session_id', inv.session_id);
  end if;

  if not p_accept then
    update public.game_invites
    set status = 'declined', decided_at = now() where id = p_invite;
    select exists (
      select 1 from public.user_blocks
      where kind = 'block'
        and ((blocker_id = inv.inviter_id and blocked_id = auth.uid())
          or (blocker_id = auth.uid() and blocked_id = inv.inviter_id))
    ) into v_blocked;
    if not v_blocked then
      select full_name into v_name from public.profiles where id = auth.uid();
      perform public.game_notify(
        inv.inviter_id,
        'A seat opened up',
        coalesce(v_name, 'A neighbour') || ' can''t make this game — the seat is free again.',
        '/app/games/s/' || inv.session_id
      );
    end if;
    return jsonb_build_object('result', 'declined', 'session_id', inv.session_id);
  end if;

  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  select * into s from public.game_sessions where id = inv.session_id for update;

  /* NEW (0093) — the seat they were kept is being held by a bot at a
     table that has not been played yet. Take it over: same seat, same
     colour, nothing rewritten, and the table does not change size. */
  select * into v_seat from public.game_seats
  where session_id = inv.session_id and seat_no = inv.seat_no for update;
  if found and v_seat.is_bot and public.game_table_is_soft(inv.session_id) then
    update public.game_invites
    set status = 'accepted', decided_at = now() where id = p_invite;
    update public.game_seats
    set profile_id = auth.uid(), is_bot = false, presence = 'active', missed_turns = 0
    where session_id = inv.session_id and seat_no = inv.seat_no;
    return jsonb_build_object('result', 'joined', 'session_id', inv.session_id);
  end if;

  select count(*) into v_taken from public.game_seats where session_id = inv.session_id;
  if s.status <> 'lobby'
     or v_taken >= s.seats_total
     or exists (select 1 from public.game_seats
                where session_id = inv.session_id and seat_no = inv.seat_no) then
    update public.game_invites
    set status = 'declined', decided_at = now() where id = p_invite;
    return jsonb_build_object(
      'result', 'filled',
      'session_id', inv.session_id,
      'game_key', s.game_key,
      'seats_total', s.seats_total
    );
  end if;

  update public.game_invites
  set status = 'accepted', decided_at = now() where id = p_invite;
  insert into public.game_seats (session_id, seat_no, profile_id)
  values (inv.session_id, inv.seat_no, auth.uid());
  perform public.game_start_if_full(inv.session_id);
  return jsonb_build_object('result', 'joined', 'session_id', inv.session_id);
end;
$function$;

revoke all on function public.game_invite_to_seat(uuid, uuid, smallint) from public;
grant execute on function public.game_invite_to_seat(uuid, uuid, smallint) to authenticated;
