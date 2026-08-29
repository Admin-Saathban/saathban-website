-- 0029c — claim_open_seat consumes the caller's own pending invite
-- (games/community lane; patch on 0029, flagged by the parity audit).
--
-- An invited player whose lobby was full-by-pending-invites got
-- "already started" from claim_open_seat, because their own reserved
-- allocation counted against them. Claiming with a pending invite on
-- file now simply accepts that invite (respond_game_invite v2 path —
-- graceful 'filled' handling included), so every entry point does the
-- right thing.

create or replace function public.claim_open_seat(p_session uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_invite uuid;
  v_result jsonb;
  v_taken int;
  v_seat smallint;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  select * into s from public.game_sessions where id = p_session for update;
  if exists (select 1 from public.game_seats where session_id = p_session and profile_id = auth.uid()) then
    return p_session; -- already at this table (0022c)
  end if;

  -- A pending invite is a reserved seat: accept it instead of
  -- claiming past it.
  select id into v_invite from public.game_invites
  where session_id = p_session and invitee_id = auth.uid() and status = 'pending';
  if v_invite is not null then
    v_result := public.respond_game_invite(v_invite, true);
    if v_result ->> 'result' = 'filled' then
      raise exception 'This table has already started';
    end if;
    return p_session;
  end if;

  if s.status <> 'lobby' then
    raise exception 'This table has already started';
  end if;
  select count(*) into v_taken from public.game_seats where session_id = p_session;
  if v_taken >= s.seats_total then
    raise exception 'This table has already started';
  end if;
  select coalesce(max(seat_no), 0) + 1 into v_seat
  from (
    select seat_no from public.game_seats where session_id = p_session
    union all
    select seat_no from public.game_invites where session_id = p_session and status = 'pending'
  ) taken;
  if v_seat > s.seats_total then
    raise exception 'This table has already started';
  end if;
  insert into public.game_seats (session_id, seat_no, profile_id)
  values (p_session, v_seat, auth.uid());
  perform public.game_start_if_full(p_session);
  return p_session;
end;
$$;

revoke execute on function public.claim_open_seat(uuid) from public, anon;
grant execute on function public.claim_open_seat(uuid) to authenticated;
