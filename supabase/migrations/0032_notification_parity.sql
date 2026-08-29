-- ============================================================================
-- 0032 — Notification parity (parity-audit lane; number reserved via
-- the registrar). Two things, no new tables:
--
-- 1. DEEP LINKS on the pre-0022 writers. The link column arrived with
--    0022 and the older writers were never backfilled — a milestone
--    notification pointed nowhere while /app/milestones sat guarded
--    exactly for its recipient. Every function below is re-created
--    from its LIVE definition (pg_get_functiondef) with only the
--    notification insert gaining a link:
--      attach_milestone_message   → /app/milestones        (icon)
--      on_document_request_insert → /app/vetting           (buddy)
--      on_document_request_update → /app/admin/buddies/<id> (admin)
--      on_reminder_write          → /app/home              (icon)
--      approve/decline_event_proposal → /app/events        (any role)
--    Each link targets a route its recipient's role can open
--    (checked against AppRoot's guards) — a notification must never
--    point at a page its reader is bounced from.
--
-- 2. CIRCLE NOTIFICATIONS (kind 'circle' — distinct from 0030's 'dm'
--    so its one-unread-per-thread dedupe query stays true). The fam
--    bell was silent for the two moments that matter most:
--      approve_circle_request → tells the approved member they're in
--        (link /app/fam — family_member route)
--      accept_circle_invite   → tells the Icon who joined
--        (link /app/circle — saath_icon route)
--    Titles stay content-free about health/mood — membership news
--    only. English-only server text is a known, ledgered gap shared
--    by every writer (PARITY.md).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1a. Milestone message → /app/milestones
-- ----------------------------------------------------------------------------
create or replace function public.attach_milestone_message(p_earned uuid, p_message text)
returns uuid
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row   public.earned_badges%rowtype;
  v_badge public.badges%rowtype;
  v_note  uuid;
begin
  if not public.is_admin() then
    raise exception 'Staff only';
  end if;
  if coalesce(length(trim(p_message)), 0) < 5 then
    raise exception 'A message is required';
  end if;

  select * into v_row from public.earned_badges where id = p_earned for update;
  if not found then
    raise exception 'No such award';
  end if;

  select * into v_badge from public.badges where key = v_row.badge_key;

  update public.earned_badges
  set message = trim(p_message), message_by = auth.uid(), message_at = now()
  where id = p_earned;

  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (
    v_row.profile_id,
    v_badge.emoji || ' ' || v_badge.name_en,
    trim(p_message),
    'milestone',
    '/app/milestones',
    auth.uid()
  )
  returning id into v_note;

  perform public.write_audit(
    'milestone_message',
    v_row.profile_id,
    'personalised milestone congratulation',
    jsonb_build_object('earned_badge_id', p_earned, 'badge', v_row.badge_key)
  );

  return v_note;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1b. Document request → /app/vetting (the applicant's own page)
-- ----------------------------------------------------------------------------
create or replace function public.on_document_request_insert()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_applicant uuid;
begin
  if new.requested_by is null then
    new.requested_by := auth.uid();
  end if;
  select applicant_id into v_applicant
    from public.buddy_applications where id = new.application_id;

  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (
    v_applicant,
    'Document needed: ' || new.doc_type,
    coalesce(new.note || E'\n\n', '') ||
      'Please add this document to your volunteer application.',
    'document_request',
    '/app/vetting',
    auth.uid()
  );

  perform public.write_audit(
    'document_request',
    v_applicant,
    'Buddy vetting: requested ' || new.doc_type,
    jsonb_build_object('application_id', new.application_id, 'request_id', new.id)
  );
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1c. Document received → the reviewing admin's application page
-- ----------------------------------------------------------------------------
create or replace function public.on_document_request_update()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.doc_type   is distinct from old.doc_type
     or new.note    is distinct from old.note
     or new.application_id is distinct from old.application_id
     or new.requested_by   is distinct from old.requested_by then
    raise exception 'Only the response fields can be changed';
  end if;
  if old.status = 'received' and new.status <> 'received' then
    raise exception 'A received document stays received';
  end if;
  if new.response_path is distinct from old.response_path then
    new.responded_at := now();
    new.status := 'received';
    if old.requested_by is not null then
      insert into public.notifications (profile_id, title, body, kind, link, created_by)
      values (
        old.requested_by,
        'Document received: ' || new.doc_type,
        'The applicant has uploaded the requested document.',
        'document_response',
        '/app/admin/buddies/' || new.application_id,
        auth.uid()
      );
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1d. "A reminder was added for you" → the Icon's home (reminders live there)
-- ----------------------------------------------------------------------------
create or replace function public.on_reminder_write()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if array_length(new.remind_times, 1) is null then
    new.remind_times := array[new.remind_time];
  else
    new.remind_time := new.remind_times[1];
  end if;

  if tg_op = 'INSERT' and new.created_by is distinct from new.icon_id then
    insert into public.notifications (profile_id, title, body, kind, link, created_by)
    values (
      new.icon_id,
      'A reminder was added for you',
      new.emoji || ' ' || new.label,
      'reminder',
      '/app/home',
      new.created_by
    );
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1e. Event proposal outcomes → /app/events (open to every role)
-- ----------------------------------------------------------------------------
create or replace function public.approve_event_proposal(p_proposal uuid)
returns uuid
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_p       public.event_proposals%rowtype;
  v_first   text;
  v_place   public.outdoor_places%rowtype;
  v_venue   text;
  v_city    text;
  v_desc    text;
  v_event   uuid;
begin
  if not public.is_admin() then
    raise exception 'Only Saathban staff can review proposals';
  end if;

  select * into v_p from public.event_proposals
  where id = p_proposal for update;
  if not found then
    raise exception 'That proposal no longer exists';
  end if;
  if v_p.status <> 'pending' then
    raise exception 'That proposal has already been reviewed';
  end if;

  select split_part(btrim(full_name), ' ', 1) into v_first
  from public.profiles where id = v_p.proposer_id;
  v_first := coalesce(nullif(v_first, ''), 'a member');

  if v_p.place_id is not null then
    select * into v_place from public.outdoor_places where id = v_p.place_id;
    if found then
      v_venue := v_place.name || case when v_place.area is not null then ', ' || v_place.area else '' end;
      v_city  := v_place.city;
    end if;
  end if;
  if v_venue is null then
    v_venue := nullif(btrim(v_p.place_text), '');
  end if;

  v_desc := coalesce(nullif(btrim(v_p.note), '') || E'\n\n', '')
            || 'Suggested by ' || v_first || '.';

  insert into public.events
    (title, description, venue, city, event_date, start_time, is_published, created_by)
  values
    (v_p.title, v_desc, v_venue, v_city, v_p.event_date, v_p.start_time, true, auth.uid())
  returning id into v_event;

  update public.event_proposals
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      created_event_id = v_event
  where id = p_proposal;

  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (
    v_p.proposer_id,
    'Your gathering is happening!',
    'Thank you for suggesting ' || chr(8220) || v_p.title || chr(8221) || '. It' || chr(39) || 's now on the events page for everyone to join.',
    'general',
    '/app/events',
    auth.uid()
  );

  return v_event;
end;
$$;

create or replace function public.decline_event_proposal(p_proposal uuid, p_message text)
returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_p public.event_proposals%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only Saathban staff can review proposals';
  end if;
  if coalesce(char_length(btrim(p_message)), 0) < 1 then
    raise exception 'A short message to the proposer is required';
  end if;

  select * into v_p from public.event_proposals
  where id = p_proposal for update;
  if not found then
    raise exception 'That proposal no longer exists';
  end if;
  if v_p.status <> 'pending' then
    raise exception 'That proposal has already been reviewed';
  end if;

  update public.event_proposals
  set status = 'declined', reviewed_by = auth.uid(), reviewed_at = now(),
      decline_message = btrim(p_message)
  where id = p_proposal;

  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (
    v_p.proposer_id,
    'About your gathering suggestion',
    'About ' || chr(8220) || v_p.title || chr(8221) || ': ' || btrim(p_message),
    'general',
    '/app/events',
    auth.uid()
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 2a. Request approved → tell the member they're in (fam bell)
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

  insert into public.circle_members (icon_id, member_id)
  values (auth.uid(), v_invite.created_by)
  on conflict (icon_id, member_id) do nothing;

  select id into v_member from public.circle_members
  where icon_id = auth.uid() and member_id = v_invite.created_by;

  -- The moment the fam member has been waiting for — say so.
  select split_part(coalesce(full_name, ''), ' ', 1) into v_first
  from public.profiles where id = auth.uid();
  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (
    v_invite.created_by,
    '🤝 ' || coalesce(nullif(v_first, ''), 'They') || ' said yes',
    'You''re in ' || coalesce(nullif(v_first, ''), 'their') || '''s circle now — their card is on your home page.',
    'circle',
    '/app/fam',
    auth.uid()
  );

  return v_member;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2b. Invite accepted → tell the Icon who joined (their circle, their news)
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

  insert into public.circle_members (icon_id, member_id)
  values (v_invite.icon_id, auth.uid())
  on conflict (icon_id, member_id) do nothing;

  select id into v_member from public.circle_members
  where icon_id = v_invite.icon_id and member_id = auth.uid();

  select split_part(coalesce(full_name, ''), ' ', 1) into v_first
  from public.profiles where id = auth.uid();
  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (
    v_invite.icon_id,
    '🤝 ' || coalesce(nullif(v_first, ''), 'Someone') || ' joined your circle',
    'Your invitation was accepted. You choose what they can see — everything starts off.',
    'circle',
    '/app/circle',
    auth.uid()
  );

  return v_member;
end;
$$;
