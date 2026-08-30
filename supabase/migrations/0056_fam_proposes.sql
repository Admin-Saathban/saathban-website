-- 0056 — Fam proposes, Icon disposes.  APPLIED 2026-08-30.
--
-- PRODUCT_DECISIONS §10. Nothing a family member does to an Icon's account
-- takes effect until the Icon approves it. §0.9 and §20.6 require that at
-- the DATABASE with a negative test: an approval built as a UI gate over a
-- write that already happened is not an approval.
--
-- WHAT WAS ALREADY RIGHT, checked before writing a line:
--   * profiles UPDATE is self-only, so a circle member already could not
--     change an Icon's settings, including who_can_message;
--   * circle_members UPDATE is icon-only, so a member cannot widen their
--     own permissions;
--   * reminders and daily_log_prefs already implement §10's recurring-
--     permission row, announcing every instance by trigger.
-- The missing half was the ability to ASK. §10 was implemented as a wall
-- where it should have been a door.

create table if not exists public.icon_change_proposals (
  id           uuid primary key default gen_random_uuid(),
  icon_id      uuid not null references public.profiles(id) on delete cascade,
  proposed_by  uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('profile_field','circle_permission','setup_batch')),
  payload      jsonb not null default '{}'::jsonb,
  note         text,
  status       text not null default 'pending'
               check (status in ('pending','approved','rejected','withdrawn')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  constraint proposal_not_self check (icon_id <> proposed_by)
);

create index if not exists icon_change_proposals_icon_idx
  on public.icon_change_proposals (icon_id, status, created_at desc);

alter table public.icon_change_proposals enable row level security;

-- Only the two people involved. Not other circle members: §10 is explicit
-- that there is no hidden channel, and a proposal about somebody's account
-- is between the person asking and the person deciding.
drop policy if exists "proposal visible to icon and proposer" on public.icon_change_proposals;
create policy "proposal visible to icon and proposer"
  on public.icon_change_proposals for select
  using (icon_id = auth.uid() or proposed_by = auth.uid());

drop policy if exists "proposer withdraws own pending" on public.icon_change_proposals;
create policy "proposer withdraws own pending"
  on public.icon_change_proposals for update
  using (proposed_by = auth.uid() and status = 'pending')
  with check (proposed_by = auth.uid() and status = 'withdrawn');

-- Deliberately NO insert policy and NO icon-update policy: both go through
-- the definer functions, so the whitelist and the apply-on-approve step
-- cannot be bypassed by writing the table directly.


create or replace function public.propose_icon_change(
  p_icon uuid, p_kind text, p_payload jsonb, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_id uuid;
  v_field text := p_payload ->> 'field';
begin
  if not exists (
    select 1 from public.circle_members
    where icon_id = p_icon and member_id = auth.uid()
  ) then
    raise exception 'Only someone in this circle may suggest a change';
  end if;

  if p_kind = 'profile_field' then
    if v_field is null or v_field not in
       ('who_can_message','city','area','preferred_language') then
      raise exception 'That is not a setting you can suggest a change to';
    end if;
  elsif p_kind = 'circle_permission' then
    if v_field is null or v_field not in
       ('can_see_mood','can_see_health','can_manage_reminders',
        'can_configure_daily_log','quiet_days_notice','location_access','is_sos_contact') then
      raise exception 'That is not a permission you can ask for';
    end if;
  end if;

  insert into public.icon_change_proposals (icon_id, proposed_by, kind, payload, note)
  values (p_icon, auth.uid(), p_kind, coalesce(p_payload, '{}'::jsonb), p_note)
  returning id into v_id;

  -- S10: the Icon is always told, with a link to review.
  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (p_icon,
          'Someone suggested a change to your settings',
          coalesce(p_note, 'Tap to see what they suggested.'),
          'proposal', '/app/home/approvals', auth.uid());

  return v_id;
end;
$fn$;

-- The ONLY path in the database that applies one of these changes. No policy
-- lets a proposal be marked approved any other way, so an unapproved change
-- has nowhere to happen.
create or replace function public.decide_icon_proposal(p_id uuid, p_approve boolean)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  r public.icon_change_proposals%rowtype;
  v_field text; v_val jsonb; v_item jsonb;
begin
  select * into r from public.icon_change_proposals where id = p_id;
  if not found then raise exception 'No such suggestion'; end if;
  if r.icon_id <> auth.uid() then
    raise exception 'Only this person can decide about their own account';
  end if;
  if r.status <> 'pending' then
    raise exception 'That suggestion has already been decided';
  end if;

  if not p_approve then
    update public.icon_change_proposals set status='rejected', decided_at=now() where id=p_id;
  else
    v_field := r.payload ->> 'field';
    v_val   := r.payload -> 'value';

    if r.kind = 'profile_field' then
      if    v_field='who_can_message'    then update public.profiles set who_can_message=(v_val #>> '{}') where id=r.icon_id;
      elsif v_field='city'               then update public.profiles set city=(v_val #>> '{}') where id=r.icon_id;
      elsif v_field='area'               then update public.profiles set area=(v_val #>> '{}') where id=r.icon_id;
      elsif v_field='preferred_language' then update public.profiles set preferred_language=(v_val #>> '{}') where id=r.icon_id;
      else raise exception 'That is not a setting that can be changed this way'; end if;

    elsif r.kind = 'circle_permission' then
      if    v_field='can_see_mood'            then update public.circle_members set can_see_mood=(v_val #>> '{}')::boolean where icon_id=r.icon_id and member_id=r.proposed_by;
      elsif v_field='can_see_health'          then update public.circle_members set can_see_health=(v_val #>> '{}')::boolean where icon_id=r.icon_id and member_id=r.proposed_by;
      elsif v_field='can_manage_reminders'    then update public.circle_members set can_manage_reminders=(v_val #>> '{}')::boolean where icon_id=r.icon_id and member_id=r.proposed_by;
      elsif v_field='can_configure_daily_log' then update public.circle_members set can_configure_daily_log=(v_val #>> '{}')::boolean where icon_id=r.icon_id and member_id=r.proposed_by;
      elsif v_field='quiet_days_notice'       then update public.circle_members set quiet_days_notice=(v_val #>> '{}')::boolean where icon_id=r.icon_id and member_id=r.proposed_by;
      elsif v_field='is_sos_contact'          then update public.circle_members set is_sos_contact=(v_val #>> '{}')::boolean where icon_id=r.icon_id and member_id=r.proposed_by;
      elsif v_field='location_access'         then update public.circle_members set location_access=(v_val #>> '{}') where icon_id=r.icon_id and member_id=r.proposed_by;
      else raise exception 'That is not a permission that can be granted this way'; end if;

    elsif r.kind = 'setup_batch' then
      -- Assisted signup: the Icon approves ONCE, at the end, for the whole set.
      for v_item in select * from jsonb_array_elements(coalesce(r.payload -> 'items', '[]'::jsonb))
      loop
        if    (v_item ->> 'field')='city'               then update public.profiles set city=(v_item ->> 'value') where id=r.icon_id;
        elsif (v_item ->> 'field')='area'               then update public.profiles set area=(v_item ->> 'value') where id=r.icon_id;
        elsif (v_item ->> 'field')='preferred_language' then update public.profiles set preferred_language=(v_item ->> 'value') where id=r.icon_id;
        elsif (v_item ->> 'field')='who_can_message'    then update public.profiles set who_can_message=(v_item ->> 'value') where id=r.icon_id;
        end if;
      end loop;
    end if;

    update public.icon_change_proposals set status='approved', decided_at=now() where id=p_id;
  end if;

  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (r.proposed_by,
          case when p_approve then 'Your suggestion was accepted'
               else 'Your suggestion was not taken up' end,
          'They decided about the change you suggested.',
          'proposal', '/app/fam', auth.uid());

  return case when p_approve then 'approved' else 'rejected' end;
end;
$fn$;

revoke execute on function public.propose_icon_change(uuid, text, jsonb, text) from public, anon;
revoke execute on function public.decide_icon_proposal(uuid, boolean) from public, anon;
grant execute on function public.propose_icon_change(uuid, text, jsonb, text) to authenticated;
grant execute on function public.decide_icon_proposal(uuid, boolean) to authenticated;
grant select, update on public.icon_change_proposals to authenticated;
