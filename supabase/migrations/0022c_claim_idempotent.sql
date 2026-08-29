-- 0022c — claim_open_seat idempotency fix (games lane; patch on 0022).
--
-- Found by tests/games.mjs: the already-seated check sat AFTER the
-- lobby-status check, so someone re-tapping an open-table post after
-- the game auto-started got "already started" instead of being routed
-- to their own board. Seated callers now return the session id first,
-- whatever the status.

create or replace function public.claim_open_seat(p_session uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_taken int;
  v_seat smallint;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  select * into s from public.game_sessions where id = p_session for update;
  if exists (select 1 from public.game_seats where session_id = p_session and profile_id = auth.uid()) then
    return p_session; -- already at this table; nothing to claim
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
