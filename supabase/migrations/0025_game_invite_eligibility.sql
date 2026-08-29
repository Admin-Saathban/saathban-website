-- ============================================================================
-- 0025 — Game invite eligibility: mixed roles, connection required
--
-- The 0022 rails were never Icons-only (create/claim/accept ride
-- can_use_community(): Icons, Fam, admins, org, ACTIVE Buddies) — but
-- invite_to_game accepted ANY profile id with no connection check and
-- no invitee eligibility, and respond_game_invite skipped the
-- community gate on accept (a Buddy suspended after being invited
-- could still seat themselves). This closes both:
--
--   * any connected Icon, Fam member, or ACTIVE Buddy is invitable
--     into any seat (roles never restrict seats);
--   * connection = circle membership in either direction today —
--     game_connected() is the single place friends and buddy-matching
--     join when those systems land (see outdoor O1 precedent:
--     "connections" = circle);
--   * the invitee must pass the community gate AT INVITE TIME, and
--     the acceptor must still pass it AT ACCEPT TIME.
-- ============================================================================

-- Parameterized twin of can_use_community() (0014) for judging
-- someone other than the caller. Same gates: standing + active
-- vetting for Buddies.
create or replace function public.can_use_community_profile(p_profile uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile
      and not p.is_paused and not p.is_blocked
      and (
        p.role in ('saath_icon', 'family_member', 'admin')
        or p.is_org
        or (p.role = 'saath_buddy' and public.is_active_buddy(p.id))
      )
  );
$$;

revoke execute on function public.can_use_community_profile(uuid) from public, anon;
grant execute on function public.can_use_community_profile(uuid) to authenticated;

-- Are two people connected? Circle membership in either direction is
-- the only connection system today. Friends and Buddy matching plug
-- in HERE (one function) when they land.
create or replace function public.game_connected(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.circle_members
    where (icon_id = p_a and member_id = p_b)
       or (icon_id = p_b and member_id = p_a)
  );
$$;

revoke execute on function public.game_connected(uuid, uuid) from public, anon;
grant execute on function public.game_connected(uuid, uuid) to authenticated;

create or replace function public.invite_to_game(p_session uuid, p_invitee uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_taken int;
  v_pending int;
  v_seat smallint;
  v_id uuid;
  v_inviter text;
  v_game_name text;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if s.created_by <> auth.uid() or s.status <> 'lobby' then
    raise exception 'Only the host can invite, and only in the lobby';
  end if;
  -- 0025: the invitee must be able to play (mixed roles welcome;
  -- Buddies only once active) and must be connected to the host.
  if not public.can_use_community_profile(p_invitee) then
    raise exception 'That neighbour cannot join games right now';
  end if;
  if not public.game_connected(auth.uid(), p_invitee) then
    raise exception 'Invitations go to people connected with you';
  end if;
  if exists (select 1 from public.game_seats where session_id = p_session and profile_id = p_invitee)
     or exists (select 1 from public.game_invites where session_id = p_session and invitee_id = p_invitee) then
    raise exception 'Already asked';
  end if;
  select count(*) into v_taken from public.game_seats where session_id = p_session;
  select count(*) into v_pending from public.game_invites
    where session_id = p_session and status = 'pending';
  if v_taken + v_pending >= s.seats_total then
    raise exception 'The table is spoken for';
  end if;

  v_seat := v_taken + v_pending + 1;
  insert into public.game_invites (session_id, inviter_id, invitee_id, seat_no)
  values (p_session, auth.uid(), p_invitee, v_seat)
  returning id into v_id;

  select full_name into v_inviter from public.profiles where id = auth.uid();
  select name_en into v_game_name from public.games where key = s.game_key;
  perform public.game_notify(
    p_invitee,
    'A game invitation',
    coalesce(v_inviter, 'A neighbour') || ' has asked you to a game of ' || v_game_name || '.',
    '/app/games/s/' || p_session
  );
  return v_id;
end;
$$;

create or replace function public.respond_game_invite(p_invite uuid, p_accept boolean)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  inv public.game_invites%rowtype;
begin
  select * into inv from public.game_invites where id = p_invite for update;
  if inv.invitee_id is distinct from auth.uid() or inv.status <> 'pending' then
    raise exception 'Not yours to answer';
  end if;
  -- 0025: standing is re-checked at accept time — an invitation does
  -- not outlive a suspension or a vetting change.
  if p_accept and not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  update public.game_invites
  set status = case when p_accept then 'accepted' else 'declined' end,
      decided_at = now()
  where id = p_invite;
  if p_accept then
    insert into public.game_seats (session_id, seat_no, profile_id)
    values (inv.session_id, inv.seat_no, auth.uid());
    perform public.game_start_if_full(inv.session_id);
  end if;
  return inv.session_id;
end;
$$;
