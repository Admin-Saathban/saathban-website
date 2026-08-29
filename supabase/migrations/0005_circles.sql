-- ============================================================================
-- 0005 — My Circle: members, permissions, invites
--
-- The Icon grants access; nothing is presumed. Per-member permissions default
-- OFF — including SOS contact (decision #2): the invite-accept flow asks the
-- Icon explicitly, the database never assumes it.
--
-- Invites work in both directions over one token (email/phone send, a large
-- 6-digit code read aloud, or a QR of the same code). Tokens are single-use
-- and expire in 48 hours. A join request by email ALWAYS answers
-- "request sent" (decision #6) so nobody can probe which emails have accounts.
-- ============================================================================

create table public.circle_members (
  id                  uuid primary key default gen_random_uuid(),
  icon_id             uuid not null references public.profiles (id) on delete cascade,
  member_id           uuid not null references public.profiles (id) on delete cascade,
  -- Default OFF. The UI asks the Icon explicitly after an invite is accepted.
  is_sos_contact      boolean not null default false,
  sos_order           smallint,        -- first, second… among SOS contacts
  can_see_mood        boolean not null default false,  -- mood + daily logs
  can_see_health      boolean not null default false,  -- health entries + appointments
  can_manage_reminders boolean not null default false, -- add/edit reminders & routines
  location_access     public.location_access not null default 'never',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (icon_id, member_id),
  check (icon_id <> member_id)
);

create index circle_members_member_idx on public.circle_members (member_id);

create trigger circle_members_updated_at
  before update on public.circle_members
  for each row execute function public.set_updated_at();

create table public.circle_invites (
  id            uuid primary key default gen_random_uuid(),
  direction     public.invite_direction not null,
  created_by    uuid not null references public.profiles (id) on delete cascade,
  -- The Icon whose circle this concerns. For a member→icon request made by
  -- email this may be NULL — the email matched no Icon — but the requester
  -- was still told "request sent" and can never tell the difference.
  icon_id       uuid references public.profiles (id) on delete cascade,
  invitee_email text,
  invitee_phone text,
  code          text not null,   -- 6 digits, shown large / read aloud / in the QR
  expires_at    timestamptz not null default now() + interval '48 hours',
  used_at       timestamptz,     -- single-use: set once, never cleared
  created_at    timestamptz not null default now()
);

-- A code can only collide with itself once redeemed.
create unique index circle_invites_active_code
  on public.circle_invites (code)
  where used_at is null;

create index circle_invites_icon_idx on public.circle_invites (icon_id);

-- ----------------------------------------------------------------------------
-- Permission lookup used by the daily-log policies (migration 0006).
-- ----------------------------------------------------------------------------
create or replace function public.has_circle_permission(p_icon uuid, p_kind text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.circle_members
    where icon_id = p_icon
      and member_id = auth.uid()
      and case p_kind
            when 'mood'      then can_see_mood
            when 'health'    then can_see_health
            when 'reminders' then can_manage_reminders
            else false
          end
  );
$$;

-- ----------------------------------------------------------------------------
-- Row-level security — circle_members
-- ----------------------------------------------------------------------------
alter table public.circle_members enable row level security;
revoke all on public.circle_members from anon;

-- The Icon sees their whole circle; each member sees their own membership row
-- (so they know exactly what they have been granted — no more).
create policy "icon and member read membership"
  on public.circle_members for select
  using (icon_id = auth.uid() or member_id = auth.uid());

-- Members join through the invite RPCs below — with ONE exception: an Icon
-- may directly add the Saathban organisation profile (decision #8), filling
-- the emergency slot even with an otherwise empty circle.
create policy "icon adds the org profile"
  on public.circle_members for insert
  with check (
    icon_id = auth.uid()
    and public.app_role() = 'saath_icon'
    and public.account_ok()
    and public.is_org_profile(member_id)
  );

-- Only the Icon changes permissions. The grant is theirs alone.
create policy "icon updates permissions"
  on public.circle_members for update
  using (icon_id = auth.uid())
  with check (icon_id = auth.uid());

-- Removal is one tap: the Icon removes anyone, and a member may leave.
-- No confirmation maze, no notification to the removed person.
create policy "icon removes member or member leaves"
  on public.circle_members for delete
  using (icon_id = auth.uid() or member_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Row-level security — circle_invites
-- ----------------------------------------------------------------------------
alter table public.circle_invites enable row level security;
revoke all on public.circle_invites from anon;

-- The creator sees their own invites; an Icon also sees pending join
-- requests aimed at them, so they can approve with one tap.
create policy "creator and target icon read invites"
  on public.circle_invites for select
  using (
    created_by = auth.uid()
    or (icon_id = auth.uid() and direction = 'member_to_icon')
  );

-- The creator can cancel an invite they sent.
create policy "creator cancels own invite"
  on public.circle_invites for delete
  using (created_by = auth.uid());

-- No insert/update policies: invites are created and redeemed only through
-- the RPCs below, which own code generation, expiry, and single-use marking.

-- ----------------------------------------------------------------------------
-- Invite RPCs
-- ----------------------------------------------------------------------------

-- Internal: a 6-digit code unique among unredeemed invites.
create or replace function public.gen_invite_code()
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  loop
    v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (
      select 1 from public.circle_invites where code = v_code and used_at is null
    );
  end loop;
  return v_code;
end;
$$;

revoke execute on function public.gen_invite_code() from public, anon, authenticated;

-- An Icon invites someone into their circle. Returns the code to show large,
-- read aloud, or render as a QR; email/phone are stored for the app to send.
create or replace function public.create_circle_invite(
  p_email text default null,
  p_phone text default null
)
returns table (invite_id uuid, code text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id   uuid;
  v_code text;
begin
  if public.app_role() is distinct from 'saath_icon' or not public.account_ok() then
    raise exception 'Only a Saath-Icon can invite someone to their circle';
  end if;

  -- Modest cap on open invites to keep the code space and inbox sane.
  if (select count(*) from public.circle_invites
      where created_by = auth.uid() and used_at is null and expires_at > now()) >= 10 then
    raise exception 'Too many open invites — let one expire or cancel one first';
  end if;

  v_code := public.gen_invite_code();
  insert into public.circle_invites (direction, created_by, icon_id, invitee_email, invitee_phone, code)
  values ('icon_to_member', auth.uid(), auth.uid(), nullif(lower(trim(p_email)), ''), nullif(trim(p_phone), ''), v_code)
  returning id into v_id;

  return query select v_id, v_code;
end;
$$;

revoke execute on function public.create_circle_invite(text, text) from public, anon;
grant execute on function public.create_circle_invite(text, text) to authenticated;

-- A Fam member requests to join an Icon's circle by email. The answer is
-- ALWAYS 'request_sent' (decision #6): whether or not the email matches an
-- Icon, the caller learns nothing. If it matched, the Icon sees the pending
-- request and approves with one tap.
create or replace function public.request_to_join_circle(p_email text)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_icon uuid;
begin
  if public.app_role() is distinct from 'family_member' or not public.account_ok() then
    raise exception 'Only a family account can request to join a circle';
  end if;

  -- Rate limit: 5 requests per 24 hours, also throttling enumeration attempts.
  if (select count(*) from public.circle_invites
      where created_by = auth.uid()
        and direction = 'member_to_icon'
        and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Too many requests today — please try again tomorrow';
  end if;

  select p.id into v_icon
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
    and p.role = 'saath_icon'
    and not p.is_blocked;

  insert into public.circle_invites (direction, created_by, icon_id, invitee_email, code)
  values ('member_to_icon', auth.uid(), v_icon, lower(trim(p_email)), public.gen_invite_code());

  return 'request_sent';
end;
$$;

revoke execute on function public.request_to_join_circle(text) from public, anon;
grant execute on function public.request_to_join_circle(text) to authenticated;

-- A Fam member redeems an Icon's invite code. Membership starts with every
-- permission OFF; the Icon is then asked explicitly about SOS and the rest.
create or replace function public.accept_circle_invite(p_code text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.circle_invites%rowtype;
  v_member uuid;
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
  return v_member;
end;
$$;

revoke execute on function public.accept_circle_invite(text) from public, anon;
grant execute on function public.accept_circle_invite(text) to authenticated;

-- The Icon approves a pending join request with one tap.
create or replace function public.approve_circle_request(p_invite_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.circle_invites%rowtype;
  v_member uuid;
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
  return v_member;
end;
$$;

revoke execute on function public.approve_circle_request(uuid) from public, anon;
grant execute on function public.approve_circle_request(uuid) to authenticated;
