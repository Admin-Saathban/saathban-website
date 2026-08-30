-- 0055 — first contact, server-enforced.  APPLIED 2026-08-30.
--
-- PRODUCT_DECISIONS §6.5 (who may send a first message) and §6.6 (profile
-- completeness gates FIRST CONTACT ONLY), enforced where §0.9 requires it:
-- at the database, not in the screen that happens to call it.
--
-- Deliberately NOT gated: replying, and messaging someone you are already
-- connected to. §6 is explicit — the person most likely to have a sparse
-- profile is the isolated senior, and a blanket block traps them while
-- merely inconveniencing a scammer.

alter table public.profiles
  add column if not exists who_can_message text not null default 'met';

alter table public.profiles drop constraint if exists profiles_who_can_message_check;
alter table public.profiles add constraint profiles_who_can_message_check
  check (who_can_message in ('met', 'anyone', 'connected'));

comment on column public.profiles.who_can_message is
  'S6.5 - met (default) / anyone / connected. Governs FIRST contact only.';

create or replace function public.have_met(a uuid, b uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select
    exists (select 1 from public.group_members ga
            join public.group_members gb on gb.group_id = ga.group_id
            where ga.member_id = a and gb.member_id = b)
    or exists (select 1 from public.event_rsvps ra
            join public.event_rsvps rb on rb.event_id = ra.event_id
            where ra.profile_id = a and rb.profile_id = b)
    or exists (select 1 from public.park_board_messages pa
            join public.park_board_messages pb on pb.place_id = pa.place_id
            where pa.author_id = a and pb.author_id = b);
$fn$;

create or replace function public.profile_is_complete(p uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select coalesce(
    (select length(coalesce(pr.full_name, '')) >= 3
        and length(coalesce(pr.city, '')) >= 2
        and (pr.avatar_url is not null or pr.languages is not null)
     from public.profiles pr where pr.id = p),
    false);
$fn$;

create or replace function public.send_dm_request(p_recipient uuid)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare
  v_req       public.dm_requests%rowtype;
  v_setting   text;
  v_connected boolean;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  if not exists (select 1 from public.profiles where id = p_recipient and not is_blocked)
     or p_recipient = auth.uid() then
    raise exception 'That request cannot be sent';
  end if;
  if public.caller_hides(p_recipient) then
    raise exception 'That request cannot be sent';
  end if;

  select * into v_req from public.dm_requests
  where (requester_id = auth.uid() and recipient_id = p_recipient)
     or (requester_id = p_recipient and recipient_id = auth.uid())
  limit 1;

  if found then
    -- A DECLINE IS PERMANENT (S6). This used to return the declined row as
    -- though the request had gone through.
    if v_req.status = 'declined' then
      raise exception 'That request cannot be sent';
    end if;
    if v_req.status = 'pending' and v_req.recipient_id = auth.uid() then
      update public.dm_requests set status = 'accepted', decided_at = now()
        where id = v_req.id;
    end if;
    return v_req.id;
  end if;

  -- Below here is FIRST CONTACT with someone there is no row for.
  select coalesce(who_can_message, 'met') into v_setting
  from public.profiles where id = p_recipient;

  v_connected :=
    exists (select 1 from public.circle_members cm
             where (cm.icon_id = p_recipient and cm.member_id = auth.uid())
                or (cm.icon_id = auth.uid() and cm.member_id = p_recipient))
    or exists (select 1 from public.friend_requests f
                where f.status = 'accepted'
                  and ((f.requester_id = auth.uid() and f.recipient_id = p_recipient)
                    or (f.requester_id = p_recipient and f.recipient_id = auth.uid())));

  if not v_connected then
    if v_setting = 'connected' then
      raise exception 'This person only takes messages from people they are connected to';
    elsif v_setting = 'met' and not public.have_met(auth.uid(), p_recipient) then
      raise exception 'You have not met this person anywhere on Saathban yet';
    end if;
    if not public.profile_is_complete(auth.uid()) then
      raise exception 'Please finish your profile before writing to someone new';
    end if;
  end if;

  if (select count(*) from public.dm_requests
      where requester_id = auth.uid() and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Too many requests today - please try again tomorrow';
  end if;

  insert into public.dm_requests (requester_id, recipient_id)
  values (auth.uid(), p_recipient)
  returning * into v_req;
  return v_req.id;
end;
$fn$;

revoke execute on function public.have_met(uuid, uuid) from public, anon;
revoke execute on function public.profile_is_complete(uuid) from public, anon;
grant execute on function public.have_met(uuid, uuid) to authenticated;
grant execute on function public.profile_is_complete(uuid) to authenticated;
