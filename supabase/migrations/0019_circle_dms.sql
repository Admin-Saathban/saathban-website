-- ============================================================================
-- 0019 — Circle DMs: open_dm_with()
--
-- Circle members are already trusted — the Icon added them by hand
-- (migration 0005), which is a stronger consent than a DM request. So a
-- DM opened between two circle-linked accounts skips the request gate
-- and lands accepted; everyone else goes through the normal
-- send_dm_request() path (rate limits, silent-block behaviour, the
-- recipient's one-tap accept — 0014, unchanged).
--
-- Blocks still beat trust: dm_open() (0014) refuses a thread with a
-- block in either direction regardless of its accepted status, so
-- auto-acceptance can never message past a block.
--
-- Deliberate reading, noted in QUESTIONS.md: joining a circle also
-- revives a previously declined request between the pair — the circle
-- grant post-dates and outranks the old decline. Removal from the
-- circle does NOT close the thread (relationships outlive the grant);
-- blocking is the door that closes it.
-- ============================================================================

create or replace function public.open_dm_with(p_other uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_req    public.dm_requests%rowtype;
  v_circle boolean;
begin
  if auth.uid() is null or not public.account_ok() then
    raise exception 'Sign in required';
  end if;
  if p_other = auth.uid() or not exists (
    select 1 from public.profiles where id = p_other and not is_blocked
  ) then
    raise exception 'That thread cannot be opened';
  end if;
  -- Blocking someone and then opening a DM with them makes no sense.
  if public.caller_hides(p_other) then
    raise exception 'That thread cannot be opened';
  end if;

  select exists (
    select 1 from public.circle_members
    where (icon_id = auth.uid() and member_id = p_other)
       or (icon_id = p_other and member_id = auth.uid())
  ) into v_circle;

  -- One pair, one request — reuse it whichever direction it was made in.
  select * into v_req from public.dm_requests
  where (requester_id = auth.uid() and recipient_id = p_other)
     or (requester_id = p_other and recipient_id = auth.uid())
  limit 1;

  if found then
    if v_req.status <> 'accepted' and v_circle then
      update public.dm_requests set status = 'accepted' where id = v_req.id;
    end if;
    return v_req.id;
  end if;

  if v_circle then
    insert into public.dm_requests (requester_id, recipient_id, status, decided_at)
    values (auth.uid(), p_other, 'accepted', now())
    returning id into v_req.id;
    return v_req.id;
  end if;

  -- Not circle-linked: the normal request gate, exactly as 0014 built it.
  return public.send_dm_request(p_other);
end;
$$;

revoke execute on function public.open_dm_with(uuid) from public, anon;
grant execute on function public.open_dm_with(uuid) to authenticated;
