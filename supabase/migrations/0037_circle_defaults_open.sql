-- ============================================================================
-- 0037 — Family circles default OPEN (circle lane; product decision recorded
-- in SPEC.md §My Circle).
--
-- The old model made every grant opt-in, one toggle at a time. In practice
-- the people joining an Icon's circle are their daughter, their son, their
-- neighbour of thirty years — and the first thing they met was five switches
-- all set to "no". So a NEW membership now arrives with sharing ON: daily
-- summary/mood, health notes, reminders, and the SOS slot. The Icon is TOLD,
-- in one plain line with a deep link to that member's own settings, and the
-- granular editor is unchanged for anyone who wants distance.
--
-- Three rules this migration keeps:
--
-- 1. NEW ROWS ONLY. There is no UPDATE over circle_members anywhere in this
--    file. Someone who deliberately left a switch off keeps it off; nobody
--    wakes up sharing more than they did yesterday.
-- 2. IDEMPOTENT. Both RPCs already used `on conflict do nothing`; the
--    defaults now ride the INSERT, so re-running against an existing
--    membership changes nothing and re-notifies nobody.
-- 3. SOS ordering stays app-shaped: a new SOS contact is appended after the
--    existing ones (max + 1), never renumbering anyone.
--
-- Also here: circle_members.quiet_days_notice — a per-member, Icon-controlled
-- toggle, OFF by default, for "tell this person if my days go quiet". The
-- sender (notify_quiet_days) is defined but NOT scheduled; wiring it to a cron
-- is a separate decision, and an unscheduled function sends nothing.
-- ============================================================================

alter table public.circle_members
  add column quiet_days_notice boolean not null default false;

comment on column public.circle_members.quiet_days_notice is
  'Icon-controlled, per member, default false: may this person be told when the Icon has not logged for a few days. Delivery is not scheduled yet (see notify_quiet_days).';

-- ----------------------------------------------------------------------------
-- The Icon approves a request to join. The new membership arrives open, and
-- the Icon gets the review line.
-- ----------------------------------------------------------------------------
create or replace function public.approve_circle_request(p_invite_id uuid)
returns uuid
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_invite public.circle_invites%rowtype;
  v_member uuid;
  v_first  text;
  v_joiner text;
  v_sos    smallint;
begin
  if public.app_role() is distinct from 'saath_icon' or not public.account_ok() then
    raise exception 'Only the Saath-Icon can approve this request';
  end if;

  select * into v_invite
  from public.circle_invites
  where id = p_invite_id
    and direction = 'member_to_icon'
    and icon_id = auth.uid()
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'That request is not valid or has expired';
  end if;

  update public.circle_invites set used_at = now() where id = v_invite.id;

  -- Appended after the SOS contacts that already exist.
  select coalesce(max(sos_order), 0) + 1 into v_sos
  from public.circle_members
  where icon_id = auth.uid() and is_sos_contact;

  insert into public.circle_members (
    icon_id, member_id,
    can_see_mood, can_see_health, can_manage_reminders,
    is_sos_contact, sos_order
  )
  values (auth.uid(), v_invite.created_by, true, true, true, true, v_sos)
  on conflict (icon_id, member_id) do nothing
  returning id into v_member;

  if v_member is null then
    -- Already a member: their existing grants are theirs. Nothing changes
    -- and nobody is notified twice.
    select id into v_member from public.circle_members
    where icon_id = auth.uid() and member_id = v_invite.created_by;
    return v_member;
  end if;

  select split_part(coalesce(full_name, ''), ' ', 1) into v_first
  from public.profiles where id = auth.uid();
  select split_part(coalesce(full_name, ''), ' ', 1) into v_joiner
  from public.profiles where id = v_invite.created_by;

  -- The person who joined hears they're in.
  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (
    v_invite.created_by,
    '🤝 ' || coalesce(nullif(v_first, ''), 'They') || ' said yes',
    'You''re in ' || coalesce(nullif(v_first, ''), 'their') || '''s circle now — their card is on your home page.',
    'circle',
    '/app/fam',
    auth.uid()
  );

  -- The Icon hears exactly what that means, with the way to change it.
  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (
    auth.uid(),
    coalesce(nullif(v_joiner, ''), 'Someone') || ' can now see your days',
    'Tap to review what''s shared. You can change any of it, any time.',
    'circle',
    '/app/circle?member=' || v_member,
    auth.uid()
  );

  return v_member;
end;
$$;

-- ----------------------------------------------------------------------------
-- The Fam member redeems the Icon's code. The Icon invited them, so the same
-- open default applies — and the same review line goes to the Icon.
-- ----------------------------------------------------------------------------
create or replace function public.accept_circle_invite(p_code text)
returns uuid
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_invite public.circle_invites%rowtype;
  v_member uuid;
  v_first  text;
  v_sos    smallint;
begin
  if public.app_role() is distinct from 'family_member' or not public.account_ok() then
    raise exception 'Only a family account can accept a circle invite';
  end if;

  select * into v_invite
  from public.circle_invites
  where code = trim(p_code)
    and direction = 'icon_to_member'
    and used_at is null
    and expires_at > now()
  for update;

  if not found or v_invite.icon_id = auth.uid() then
    raise exception 'That code is not valid or has expired';
  end if;

  update public.circle_invites set used_at = now() where id = v_invite.id;

  select coalesce(max(sos_order), 0) + 1 into v_sos
  from public.circle_members
  where icon_id = v_invite.icon_id and is_sos_contact;

  insert into public.circle_members (
    icon_id, member_id,
    can_see_mood, can_see_health, can_manage_reminders,
    is_sos_contact, sos_order
  )
  values (v_invite.icon_id, auth.uid(), true, true, true, true, v_sos)
  on conflict (icon_id, member_id) do nothing
  returning id into v_member;

  if v_member is null then
    select id into v_member from public.circle_members
    where icon_id = v_invite.icon_id and member_id = auth.uid();
    return v_member;
  end if;

  select split_part(coalesce(full_name, ''), ' ', 1) into v_first
  from public.profiles where id = auth.uid();

  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (
    v_invite.icon_id,
    coalesce(nullif(v_first, ''), 'Someone') || ' can now see your days',
    'Tap to review what''s shared. You can change any of it, any time.',
    'circle',
    '/app/circle?member=' || v_member,
    auth.uid()
  );

  return v_member;
end;
$$;

-- ----------------------------------------------------------------------------
-- Quiet days: the sender, defined but not scheduled.
--
-- "Quiet" is deliberately dull: no logs at all for p_days days. It says only
-- that the days have been quiet and suggests a phone call — never mood, never
-- health, never a number. Only members the Icon switched this on for hear it,
-- and only once per quiet stretch (the dedupe below).
-- ----------------------------------------------------------------------------
create or replace function public.notify_quiet_days(p_days integer default 3)
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  rec   record;
  v_sent int := 0;
  v_first text;
begin
  for rec in
    select cm.id, cm.icon_id, cm.member_id
    from public.circle_members cm
    where cm.quiet_days_notice
      and not exists (
        select 1 from public.daily_logs dl
        where dl.icon_id = cm.icon_id
          and dl.log_date > current_date - p_days
      )
      and not exists (
        -- one notice per quiet stretch, not one per day
        select 1 from public.notifications n
        where n.profile_id = cm.member_id
          and n.kind = 'circle'
          and n.created_at > now() - (p_days || ' days')::interval
          and n.link = '/app/fam'
          and n.title like '%quiet%'
      )
  loop
    select split_part(coalesce(full_name, ''), ' ', 1) into v_first
    from public.profiles where id = rec.icon_id;
    insert into public.notifications (profile_id, title, body, kind, link)
    values (
      rec.member_id,
      'It has been quiet on ' || coalesce(nullif(v_first, ''), 'their') || '''s side',
      'Nothing has been logged for a few days. That is often nothing at all — but a phone call is never wasted.',
      'circle',
      '/app/fam'
    );
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

revoke execute on function public.notify_quiet_days(integer) from public, anon, authenticated;
