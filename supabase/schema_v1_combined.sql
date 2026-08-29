-- Saathban app schema v1 — combined migrations 0001-0009
-- Paste into the Supabase SQL editor and run once.


-- ############################  0001_enums_and_helpers.sql  ############################

-- ============================================================================
-- 0001 â€” Enums and shared helpers
-- Run first. Everything else depends on these types.
-- ============================================================================

-- Roles. These DB values never change; display names ("Saath-Fam" etc.) live
-- in the frontend constants file so renaming is a one-file edit.
create type public.user_role as enum (
  'saath_icon',
  'saath_buddy',
  'family_member',
  'admin'
);

-- Tier is a separate field from role. Never conflate the two.
create type public.user_tier as enum ('free', 'subscribed');

-- Two admin levels: support (approvals, documents) and super (sensitive data).
create type public.admin_level as enum ('support', 'super');

-- Buddy vetting is a pipeline, not a boolean.
create type public.buddy_status as enum (
  'pending',
  'interviewing',
  'probation',
  'active',
  'suspended',
  'rejected'
);

-- Circle invites work in both directions over one underlying token.
create type public.invite_direction as enum ('icon_to_member', 'member_to_icon');

-- Daily log modules. Mood is always first in the UI; the rest are opt-in
-- from Settings.
create type public.log_module as enum (
  'mood',
  'sleep',
  'medication',
  'exercise',
  'diet',
  'water',
  'blood_pressure',
  'blood_sugar',
  'weight',
  'pain'
);

-- Location visibility a circle member can have: never, or only during an SOS.
create type public.location_access as enum ('never', 'sos_only');

-- Shared trigger: keep updated_at fresh on any update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ############################  0002_profiles.sql  ############################

-- ============================================================================
-- 0002 â€” Profiles, role helpers, safe_profiles view
--
-- One profile row per auth user, holding role, tier, and the two independent
-- admin flags: is_paused (reversible pause/unpause) and is_blocked (permanent
-- bar, e.g. a Buddy rejected for cause who must never reapply).
--
-- Email lives only in auth.users. Phone lives here. Both are sensitive:
-- support admins never see them â€” they see safe_profiles and use logged RPCs.
-- ============================================================================

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  role               public.user_role not null,
  tier               public.user_tier not null default 'free',
  -- Non-null exactly when role = 'admin'.
  admin_level        public.admin_level,
  full_name          text not null check (char_length(full_name) between 1 and 120),
  phone              text,          -- sensitive: self + super-admin only
  city               text,
  country            text,
  languages          text[] not null default '{}',
  relationship       text,          -- Saath-Fam: relationship to their Icon
  timezone           text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ur')),
  avatar_url         text,
  settings           jsonb not null default '{}',
  -- The one real Saathban organisation profile (official account, emergency
  -- slot for Icons with an empty circle). Set by staff only â€” see note below.
  is_org             boolean not null default false,
  -- Admin pause/unpause. Reversible; independent of is_blocked.
  is_paused          boolean not null default false,
  -- Permanent bar. Blocks Buddy reapplication regardless of cooldown.
  is_blocked         boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint admin_level_matches_role check ((role = 'admin') = (admin_level is not null))
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so RLS policies can consult profiles without
-- recursing into the profiles policies themselves.
-- ----------------------------------------------------------------------------

-- The caller's role, or null if they have no profile yet.
create or replace function public.app_role()
returns public.user_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Any admin (support or super) whose account is in good standing.
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
      and not is_paused and not is_blocked
  );
$$;

-- Super-admin only.
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and admin_level = 'super'
      and not is_paused and not is_blocked
  );
$$;

-- Is the caller's own account in good standing (not paused, not blocked)?
-- Used in write policies: a paused account can read its own data but not act.
create or replace function public.account_ok()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and not is_paused and not is_blocked
  );
$$;

-- Is this profile the Saathban organisation profile?
create or replace function public.is_org_profile(p_profile uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles where id = p_profile and is_org
  );
$$;

-- ----------------------------------------------------------------------------
-- Protected columns. RLS cannot compare old vs new values, so a trigger stops
-- anyone but a super-admin (or a logged staff RPC, which sets the transaction
-- flag below) from touching role, tier, admin_level, is_org, is_paused,
-- is_blocked. The service role (auth.uid() is null) is always allowed.
-- ----------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.id          is distinct from old.id
  or new.role        is distinct from old.role
  or new.tier        is distinct from old.tier
  or new.admin_level is distinct from old.admin_level
  or new.is_org      is distinct from old.is_org
  or new.is_paused   is distinct from old.is_paused
  or new.is_blocked  is distinct from old.is_blocked
  then
    if auth.uid() is not null
       and not public.is_super_admin()
       and coalesce(current_setting('app.protected_profile_write', true), '') <> 'allow'
    then
      raise exception 'This field can only be changed by Saathban staff';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ----------------------------------------------------------------------------
-- Row-level security
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Anonymous visitors get nothing from the app schema.
revoke all on public.profiles from anon;

-- Each person can read their own full profile row.
create policy "read own profile"
  on public.profiles for select
  using (id = auth.uid());

-- Super-admins can read any full profile row. Support admins deliberately
-- cannot: an Icon's phone and email are outside support scope â€” support works
-- from safe_profiles and contacts Icons via the logged RPC in migration 0007,
-- which never reveals the address.
create policy "super admin reads all profiles"
  on public.profiles for select
  using (public.is_super_admin());

-- A person creates exactly their own profile at signup, choosing any role
-- except admin (admin accounts are provisioned internally, never
-- self-selected), and cannot start out org / paused / blocked / subscribed.
create policy "create own profile"
  on public.profiles for insert
  with check (
    id = auth.uid()
    and role <> 'admin'
    and admin_level is null
    and is_org = false
    and is_paused = false
    and is_blocked = false
    and tier = 'free'
  );

-- People edit their own profile. The protected-columns trigger above stops
-- them from promoting themselves (role, tier, admin flags).
create policy "update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Super-admins can edit any profile: role correction, pause, block,
-- manual account recovery.
create policy "super admin updates profiles"
  on public.profiles for update
  using (public.is_super_admin());

-- No delete policy: profile rows are removed only by deleting the auth user
-- (service role / dashboard), which cascades here.

-- ----------------------------------------------------------------------------
-- safe_profiles â€” the non-sensitive projection everyone else uses.
--
-- This view intentionally runs with its owner's rights (default, NOT
-- security_invoker), which bypasses profiles RLS â€” that is the point: it
-- exposes ONLY the columns listed here, to any signed-in account. Never add
-- phone, tier, settings, or admin_level to this list. Blocked accounts are
-- hidden entirely.
-- ----------------------------------------------------------------------------
create view public.safe_profiles as
  select id, role, full_name, avatar_url, city, languages, is_org, created_at
  from public.profiles
  where not is_blocked;

revoke all on public.safe_profiles from anon;
grant select on public.safe_profiles to authenticated;

-- ----------------------------------------------------------------------------
-- The organisation profile (decision: a real profile row, not a magic id).
-- Creating it requires an auth user, which SQL alone shouldn't fabricate:
--   1. In the Supabase dashboard, invite an org email (e.g. team@saathban.org)
--      and complete a profile for it, then run as service role:
--   2. update public.profiles set is_org = true where id = '<that user id>';
-- ----------------------------------------------------------------------------


-- ############################  0003_audit_log.sql  ############################

-- ============================================================================
-- 0003 â€” Audit log
--
-- Every admin touch of sensitive data writes who, what, when, why.
-- Rows are written only by SECURITY DEFINER functions and triggers â€” clients
-- (including admins) can never insert, edit, or delete an entry directly.
-- ============================================================================

create table public.audit_log (
  id                 bigint generated always as identity primary key,
  actor_id           uuid references public.profiles (id) on delete set null,
  -- e.g. 'break_glass_read_logs', 'admin_contact', 'pause_account',
  --      'buddy_status_change'
  action             text not null,
  target_profile_id  uuid references public.profiles (id) on delete set null,
  reason             text,
  detail             jsonb not null default '{}',
  created_at         timestamptz not null default now()
);

create index audit_log_target_idx on public.audit_log (target_profile_id, created_at desc);
create index audit_log_actor_idx  on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;

-- The audit trail is itself sensitive: only super-admins may read it.
create policy "super admin reads audit log"
  on public.audit_log for select
  using (public.is_super_admin());

-- No insert/update/delete policies, and privileges revoked outright:
-- entries exist only via the definer functions below. The log is append-only
-- from the API's point of view.
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- Internal helper used by staff RPCs and triggers to append an entry.
-- Not callable by clients (execute revoked); definer functions owned by
-- postgres reach it regardless.
create or replace function public.write_audit(
  p_action text,
  p_target uuid,
  p_reason text,
  p_detail jsonb default '{}'
)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_log (actor_id, action, target_profile_id, reason, detail)
  values (auth.uid(), p_action, p_target, p_reason, coalesce(p_detail, '{}'));
$$;

revoke execute on function public.write_audit(text, uuid, text, jsonb) from public, anon, authenticated;


-- ############################  0004_buddy_vetting.sql  ############################

-- ============================================================================
-- 0004 â€” Saath-Buddy vetting
--
-- Applications are VERSIONED: each attempt is its own row, so reviewers see
-- the full history. Reapplying is allowed 90 days after a rejection (enforced
-- in submit_buddy_application). Permanent cases use profiles.is_blocked.
--
-- The pipeline status lives on the application row:
--   pending â†’ interviewing â†’ probation â†’ active â†’ suspended â†’ rejected
-- A Buddy has no access to any Icon data before 'active' â€” and in this
-- schema, no policy anywhere grants Buddies access to Icon data at all yet;
-- matching arrives in a later migration and will use is_active_buddy().
--
-- CNIC images and selfies go in the PRIVATE 'buddy-documents' bucket
-- (migration 0008); this table stores only the storage paths.
-- ============================================================================

create table public.buddy_applications (
  id                uuid primary key default gen_random_uuid(),
  applicant_id      uuid not null references public.profiles (id) on delete cascade,

  -- Identity (verified, not just collected). Minimum age 18 is enforced in
  -- the submit function.
  legal_name        text not null,
  cnic_number       text not null,
  dob               date not null,
  cnic_photo_path   text not null,  -- path inside the private buddy-documents bucket
  selfie_path       text not null,  -- taken at signup, same bucket
  phone             text not null,

  -- Profile. Languages spoken is the single most important matching field.
  occupation        text,
  city              text not null,
  reachable_areas   text,
  languages         text[] not null default '{}',

  -- Motivation is free-form â€” the field the reviewer reads first.
  motivation        text not null,
  experience        text,
  weekly_hours      smallint,
  commitment_months smallint,

  -- Declarations. Consent and code-of-conduct must be true to submit;
  -- criminal record is a disclosure and may be either value.
  declared_criminal_record        boolean not null default false,
  criminal_record_details         text,
  consented_character_certificate boolean not null check (consented_character_certificate),
  accepted_code_of_conduct        boolean not null check (accepted_code_of_conduct),

  -- Review. reviewer_flags holds the red-flag tags the admin UI surfaces
  -- (specific-person request, ID reluctance, availability mismatch,
  -- off-platform contact attempts).
  status            public.buddy_status not null default 'pending',
  reviewer_flags    text[] not null default '{}',
  review_notes      text,
  reviewed_by       uuid references public.profiles (id) on delete set null,
  decided_at        timestamptz,   -- set on rejection/activation; drives the 90-day cooldown
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One live application at a time; only a rejected one frees the slot.
create unique index one_live_application_per_applicant
  on public.buddy_applications (applicant_id)
  where status <> 'rejected';

create index buddy_applications_status_idx
  on public.buddy_applications (status, created_at);

create trigger buddy_applications_updated_at
  before update on public.buddy_applications
  for each row execute function public.set_updated_at();

-- Two non-family references, with phone numbers that are ACTUALLY CALLED â€”
-- called_at / call_notes record that the call happened. The collection is not
-- the safeguard; the call is.
create table public.buddy_references (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.buddy_applications (id) on delete cascade,
  name           text not null,
  relationship   text not null,   -- must be non-family; screened at review
  phone          text not null,
  called_at      timestamptz,
  called_by      uuid references public.profiles (id) on delete set null,
  call_notes     text,
  created_at     timestamptz not null default now()
);

create index buddy_references_application_idx
  on public.buddy_references (application_id);

-- Convenience for later migrations: does this profile have an active-status
-- application (i.e. a fully vetted, working Buddy)?
create or replace function public.is_active_buddy(p_profile uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.buddy_applications
    where applicant_id = p_profile and status = 'active'
  );
$$;

-- ----------------------------------------------------------------------------
-- Status changes append to the audit log automatically, so a plain UPDATE by
-- an admin can never move the pipeline silently. Routine reads of the review
-- queue are logged at the app level, not here (decision #1).
-- ----------------------------------------------------------------------------
create or replace function public.on_buddy_status_change()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('rejected', 'active', 'suspended') then
      new.decided_at := now();
    end if;
    if new.reviewed_by is null then
      new.reviewed_by := auth.uid();
    end if;
    insert into public.audit_log (actor_id, action, target_profile_id, reason, detail)
    values (
      auth.uid(),
      'buddy_status_change',
      new.applicant_id,
      new.review_notes,
      jsonb_build_object('application_id', new.id, 'from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger buddy_applications_status_audit
  before update on public.buddy_applications
  for each row execute function public.on_buddy_status_change();

-- ----------------------------------------------------------------------------
-- Row-level security
-- ----------------------------------------------------------------------------
alter table public.buddy_applications enable row level security;
alter table public.buddy_references  enable row level security;
revoke all on public.buddy_applications from anon;
revoke all on public.buddy_references  from anon;

-- Applicants can read their own applications (all versions).
create policy "applicant reads own applications"
  on public.buddy_applications for select
  using (applicant_id = auth.uid());

-- Both admin levels review applications â€” approvals and documents are support
-- scope â€” and reviewers see prior attempts by design. Routine review reads
-- are audit-logged by the app, not the database.
create policy "admins read applications"
  on public.buddy_applications for select
  using (public.is_admin());

-- Admins update review fields (status, flags, notes); the trigger above
-- audit-logs every status transition. Applicants cannot edit after submit.
create policy "admins update applications"
  on public.buddy_applications for update
  using (public.is_admin());

-- No insert policy: applications are created only through
-- submit_buddy_application below, which enforces the cooldown and age rules.

-- Applicants can see the references they themselves provided.
create policy "applicant reads own references"
  on public.buddy_references for select
  using (
    exists (
      select 1 from public.buddy_applications a
      where a.id = application_id and a.applicant_id = auth.uid()
    )
  );

-- Admins read references and record the verification calls.
create policy "admins read references"
  on public.buddy_references for select
  using (public.is_admin());

create policy "admins update references"
  on public.buddy_references for update
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Submission RPC. Enforces: buddy role, account in good standing, 18+,
-- no live application, 90-day cooldown after rejection, exactly two
-- references, required declarations accepted.
-- ----------------------------------------------------------------------------
create or replace function public.submit_buddy_application(
  application jsonb,
  refs jsonb
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id  uuid;
  v_dob date;
  r     jsonb;
begin
  if public.app_role() is distinct from 'saath_buddy' or not public.account_ok() then
    raise exception 'Only Saath-Buddy accounts in good standing can apply';
  end if;

  -- profiles.is_blocked is the permanent bar; account_ok() already covers it,
  -- but the intent deserves its own line for readers of this function.
  if exists (select 1 from public.profiles where id = auth.uid() and is_blocked) then
    raise exception 'This account cannot apply';
  end if;

  if exists (
    select 1 from public.buddy_applications
    where applicant_id = auth.uid() and status <> 'rejected'
  ) then
    raise exception 'An application is already in progress';
  end if;

  -- 90-day cooldown after a rejection.
  if exists (
    select 1 from public.buddy_applications
    where applicant_id = auth.uid()
      and status = 'rejected'
      and decided_at > now() - interval '90 days'
  ) then
    raise exception 'You can apply again 90 days after a decision';
  end if;

  v_dob := (application ->> 'dob')::date;
  if v_dob is null or v_dob > current_date - interval '18 years' then
    raise exception 'Applicants must be at least 18';
  end if;

  if jsonb_array_length(coalesce(refs, '[]'::jsonb)) <> 2 then
    raise exception 'Exactly two references are required';
  end if;

  if not coalesce((application ->> 'consented_character_certificate')::boolean, false)
     or not coalesce((application ->> 'accepted_code_of_conduct')::boolean, false) then
    raise exception 'The required declarations were not accepted';
  end if;

  insert into public.buddy_applications (
    applicant_id, legal_name, cnic_number, dob, cnic_photo_path, selfie_path,
    phone, occupation, city, reachable_areas, languages, motivation,
    experience, weekly_hours, commitment_months,
    declared_criminal_record, criminal_record_details,
    consented_character_certificate, accepted_code_of_conduct
  ) values (
    auth.uid(),
    application ->> 'legal_name',
    application ->> 'cnic_number',
    v_dob,
    application ->> 'cnic_photo_path',
    application ->> 'selfie_path',
    application ->> 'phone',
    application ->> 'occupation',
    application ->> 'city',
    application ->> 'reachable_areas',
    coalesce(
      (select array_agg(x) from jsonb_array_elements_text(application -> 'languages') x),
      '{}'
    ),
    application ->> 'motivation',
    application ->> 'experience',
    (application ->> 'weekly_hours')::smallint,
    (application ->> 'commitment_months')::smallint,
    coalesce((application ->> 'declared_criminal_record')::boolean, false),
    application ->> 'criminal_record_details',
    true,
    true
  )
  returning id into v_id;

  for r in select value from jsonb_array_elements(refs) loop
    insert into public.buddy_references (application_id, name, relationship, phone)
    values (v_id, r ->> 'name', r ->> 'relationship', r ->> 'phone');
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.submit_buddy_application(jsonb, jsonb) from public, anon;
grant execute on function public.submit_buddy_application(jsonb, jsonb) to authenticated;


-- ############################  0005_circles.sql  ############################

-- ============================================================================
-- 0005 â€” My Circle: members, permissions, invites
--
-- The Icon grants access; nothing is presumed. Per-member permissions default
-- OFF â€” including SOS contact (decision #2): the invite-accept flow asks the
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
  sos_order           smallint,        -- first, secondâ€¦ among SOS contacts
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
  -- The Icon whose circle this concerns. For a memberâ†’icon request made by
  -- email this may be NULL â€” the email matched no Icon â€” but the requester
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
-- Row-level security â€” circle_members
-- ----------------------------------------------------------------------------
alter table public.circle_members enable row level security;
revoke all on public.circle_members from anon;

-- The Icon sees their whole circle; each member sees their own membership row
-- (so they know exactly what they have been granted â€” no more).
create policy "icon and member read membership"
  on public.circle_members for select
  using (icon_id = auth.uid() or member_id = auth.uid());

-- Members join through the invite RPCs below â€” with ONE exception: an Icon
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
-- Row-level security â€” circle_invites
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
    raise exception 'Too many open invites â€” let one expire or cancel one first';
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
    raise exception 'Too many requests today â€” please try again tomorrow';
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


-- ############################  0006_daily_logs.sql  ############################

-- ============================================================================
-- 0006 â€” Daily logs, welfare flags, break-glass
--
-- One row per Icon, per day, per module; module details live in payload jsonb
-- (medication checklist state, sleep hours + quality, exercise sessionsâ€¦).
-- mood_value is its own column because consecutive-low-mood detection â€” the
-- mood log's real purpose, disclosed at onboarding â€” needs to query it.
--
-- Admins have NO direct read access here. Reading an Icon's private logs is
-- break-glass only (decision #1): a logged RPC requiring a typed reason,
-- super-admin only, for genuine welfare concerns and SOS.
-- ============================================================================

create table public.daily_logs (
  id            uuid primary key default gen_random_uuid(),
  icon_id       uuid not null references public.profiles (id) on delete cascade,
  log_date      date not null,
  module        public.log_module not null,
  payload       jsonb not null default '{}',
  -- 1 (lowest) â€¦ 5 (best). Present exactly when module = 'mood'.
  mood_value    smallint check (mood_value between 1 and 5),
  is_backfilled boolean not null default false,  -- internal flag, never shown as judgement
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (icon_id, log_date, module),
  check ((module = 'mood') = (mood_value is not null))
);

create index daily_logs_icon_date_idx on public.daily_logs (icon_id, log_date desc);
create index daily_logs_mood_idx on public.daily_logs (log_date) where module = 'mood';

create trigger daily_logs_updated_at
  before update on public.daily_logs
  for each row execute function public.set_updated_at();

-- Backfill window: 48 hours, flagged internally, never in the future.
-- current_date here is the server (UTC) date; the two-day window is generous
-- enough to absorb the Pakistan offset. Local-midnight rollover is the
-- client's concern.
create or replace function public.check_daily_log_date()
returns trigger
language plpgsql
as $$
begin
  if new.log_date > current_date then
    raise exception 'A log cannot be dated in the future';
  end if;
  if new.log_date < current_date - 2 then
    raise exception 'Logs can only be added for the last 48 hours';
  end if;
  if tg_op = 'INSERT' then
    new.is_backfilled := new.log_date < current_date;
  end if;
  return new;
end;
$$;

create trigger daily_logs_date_window
  before insert or update on public.daily_logs
  for each row execute function public.check_daily_log_date();

-- ----------------------------------------------------------------------------
-- Row-level security
-- ----------------------------------------------------------------------------
alter table public.daily_logs enable row level security;
revoke all on public.daily_logs from anon;

-- The Icon owns their logs outright: read, write, edit, delete.
create policy "icon reads own logs"
  on public.daily_logs for select
  using (icon_id = auth.uid());

create policy "icon writes own logs"
  on public.daily_logs for insert
  with check (
    icon_id = auth.uid()
    and public.app_role() = 'saath_icon'
    and public.account_ok()
  );

create policy "icon updates own logs"
  on public.daily_logs for update
  using (icon_id = auth.uid())
  with check (icon_id = auth.uid());

create policy "icon deletes own logs"
  on public.daily_logs for delete
  using (icon_id = auth.uid());

-- Circle members see exactly what the Icon granted, split by data type:
-- "mood and daily logs" covers mood, sleep, exercise, diet, water;
-- "health entries" covers medication, blood pressure, blood sugar, weight,
-- pain. No grant, no rows â€” enforced here at the database, not the frontend.
create policy "circle member reads granted modules"
  on public.daily_logs for select
  using (
    (module in ('mood', 'sleep', 'exercise', 'diet', 'water')
      and public.has_circle_permission(icon_id, 'mood'))
    or
    (module in ('medication', 'blood_pressure', 'blood_sugar', 'weight', 'pain')
      and public.has_circle_permission(icon_id, 'health'))
  );

-- Deliberately absent: any admin or Buddy policy. Staff access goes through
-- break_glass_read_logs below; Buddies get nothing until matching exists,
-- and even then never health data.

-- ----------------------------------------------------------------------------
-- Welfare flags: consecutive low-mood days quietly flag staff for human
-- outreach. Both admin levels may call it â€” outreach is support work â€” and it
-- returns only (icon, streak length, latest date), never the notes or logs.
-- Routine calls are logged at the app level (decision #1); reading the actual
-- logs still requires break-glass.
-- ----------------------------------------------------------------------------
create or replace function public.welfare_flags(p_min_days int default 3)
returns table (icon_id uuid, low_days int, latest_low date)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with mood as (
    select l.icon_id, l.log_date, l.mood_value
    from public.daily_logs l
    where l.module = 'mood' and l.log_date >= current_date - 14
  ),
  runs as (
    -- gaps-and-islands: consecutive dates with the same low/not-low state
    -- share a group key
    select m.icon_id, m.log_date, (m.mood_value <= 2) as low,
           m.log_date - (row_number() over (
             partition by m.icon_id, (m.mood_value <= 2)
             order by m.log_date
           ))::int as grp
    from mood m
  )
  select r.icon_id, count(*)::int as low_days, max(r.log_date) as latest_low
  from runs r
  where r.low
    and public.is_admin()          -- non-admins always get zero rows
  group by r.icon_id, r.grp
  having count(*) >= p_min_days
     and max(r.log_date) >= current_date - 1;
$$;

revoke execute on function public.welfare_flags(int) from public, anon;
grant execute on function public.welfare_flags(int) to authenticated;

-- ----------------------------------------------------------------------------
-- Break-glass (decision #1): the ONLY staff path to an Icon's private logs.
-- Super-admin only, typed reason required, every call writes an audit entry
-- before any data is returned.
-- ----------------------------------------------------------------------------
create or replace function public.break_glass_read_logs(
  p_icon uuid,
  p_reason text,
  p_from date default null
)
returns setof public.daily_logs
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Break-glass access is limited to super-admins';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 10 then
    raise exception 'A typed reason (at least 10 characters) is required';
  end if;

  perform public.write_audit(
    'break_glass_read_logs',
    p_icon,
    p_reason,
    jsonb_build_object('from_date', p_from)
  );

  return query
    select * from public.daily_logs
    where icon_id = p_icon
      and (p_from is null or log_date >= p_from)
    order by log_date desc;
end;
$$;

revoke execute on function public.break_glass_read_logs(uuid, text, date) from public, anon;
grant execute on function public.break_glass_read_logs(uuid, text, date) to authenticated;


-- ############################  0007_notifications_and_admin_rpcs.sql  ############################

-- ============================================================================
-- 0007 â€” In-app notifications and the logged staff RPCs
--
-- Decision #3: an Icon's phone and email are NOT support-admin scope. When
-- support needs to reach an Icon, admin_contact_icon delivers an in-app
-- notification without ever revealing the address, and logs the contact.
-- Decision #9: pause/unpause is its own flag, changed only through a logged
-- RPC (admin_set_pause), never a silent column update.
-- ============================================================================

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  body       text,
  -- 'general' now; later: 'milestone' (the personalised admin message on a
  -- celebration), 'circle', 'system'â€¦
  kind       text not null default 'general',
  created_by uuid references public.profiles (id) on delete set null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx
  on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;

-- Each person reads their own notifications.
create policy "read own notifications"
  on public.notifications for select
  using (profile_id = auth.uid());

-- Each person can mark their own notifications read (the row stays theirs).
create policy "update own notifications"
  on public.notifications for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Each person can clear their own notifications.
create policy "delete own notifications"
  on public.notifications for delete
  using (profile_id = auth.uid());

-- No insert policy: notifications are created by staff RPCs (below) and by
-- the service role only.

-- ----------------------------------------------------------------------------
-- Support contacts an Icon without seeing their address (decision #3).
-- Any admin level may call it; every call is audit-logged with a reason.
-- ----------------------------------------------------------------------------
create or replace function public.admin_contact_icon(
  p_profile uuid,
  p_title text,
  p_body text,
  p_reason text
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Staff only';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'A reason is required';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile) then
    raise exception 'No such account';
  end if;

  insert into public.notifications (profile_id, title, body, kind, created_by)
  values (p_profile, p_title, p_body, 'general', auth.uid())
  returning id into v_id;

  perform public.write_audit(
    'admin_contact',
    p_profile,
    p_reason,
    jsonb_build_object('notification_id', v_id)
  );

  return v_id;
end;
$$;

revoke execute on function public.admin_contact_icon(uuid, text, text, text) from public, anon;
grant execute on function public.admin_contact_icon(uuid, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Pause / unpause (decision #9: separate from is_blocked). Support scope,
-- except pausing another admin, which is super-admin only. The transaction
-- flag lets this one statement pass the protected-columns trigger; the
-- audit entry records who, whom, and why.
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_pause(
  p_profile uuid,
  p_paused boolean,
  p_reason text
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Staff only';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'A reason is required';
  end if;
  if exists (select 1 from public.profiles where id = p_profile and role = 'admin')
     and not public.is_super_admin() then
    raise exception 'Only a super-admin can pause an admin account';
  end if;

  perform set_config('app.protected_profile_write', 'allow', true);
  update public.profiles set is_paused = p_paused where id = p_profile;
  if not found then
    raise exception 'No such account';
  end if;

  perform public.write_audit(
    case when p_paused then 'pause_account' else 'unpause_account' end,
    p_profile,
    p_reason
  );
end;
$$;

revoke execute on function public.admin_set_pause(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_pause(uuid, boolean, text) to authenticated;


-- ############################  0008_storage.sql  ############################

-- ============================================================================
-- 0008 â€” Storage: the private buddy-documents bucket
--
-- CNIC images and signup selfies are sensitive personal data. PRIVATE bucket,
-- never public â€” files are served only through short-lived signed URLs.
-- Paths are namespaced by user id: buddy-documents/<auth uid>/cnic.jpg etc.
-- Retention/deletion after a decision is a service-role job, not a client
-- capability.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'buddy-documents',
  'buddy-documents',
  false,                                   -- never a public bucket
  10485760,                                -- 10 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Applicants may upload only into their own folder (first path segment must
-- be their own user id).
create policy "buddy docs: upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'buddy-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The applicant can read back their own documents; admins (both levels â€”
-- documents are support scope, with app-level access logging) can read all.
create policy "buddy docs: read own or as admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'buddy-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- An applicant may replace a document in their own folder before review
-- (e.g. a blurry CNIC photo).
create policy "buddy docs: replace own file"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'buddy-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'buddy-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No delete policy for clients: retention and cleanup run under the service
-- role against a written retention policy.


-- ############################  0009_advisor_hardening.sql  ############################

-- ============================================================================
-- 0009 â€” Hardening from the Supabase security advisor
--
-- Two follow-ups after 0001â€“0008 were applied:
--   1. Pin search_path on the two plain (non-definer) trigger functions.
--   2. Postgres grants EXECUTE to PUBLIC on new functions by default, so the
--      role-helper functions were callable by anonymous clients. They leak
--      nothing (they return false/null without a session), but anon has no
--      business calling anything here â€” revoke, then grant back exactly what
--      signed-in users need: RLS policies evaluate as the querying role, so
--      `authenticated` must keep EXECUTE on every helper a policy consults.
--
-- Note: the advisor also flags the safe_profiles view as SECURITY DEFINER.
-- That is intentional and load-bearing â€” see the comment in 0002.
-- ============================================================================

alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.check_daily_log_date() set search_path = public, pg_temp;

-- Trigger functions are invoked by the system, never by clients.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.check_daily_log_date() from public, anon, authenticated;
revoke execute on function public.protect_profile_columns() from public, anon, authenticated;
revoke execute on function public.on_buddy_status_change() from public, anon, authenticated;

-- Policy helpers: nothing for anon, explicit EXECUTE for signed-in users.
revoke execute on function public.app_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.account_ok() from public, anon;
revoke execute on function public.is_org_profile(uuid) from public, anon;
revoke execute on function public.is_active_buddy(uuid) from public, anon;
revoke execute on function public.has_circle_permission(uuid, text) from public, anon;

grant execute on function public.app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.account_ok() to authenticated;
grant execute on function public.is_org_profile(uuid) to authenticated;
grant execute on function public.is_active_buddy(uuid) to authenticated;
grant execute on function public.has_circle_permission(uuid, text) to authenticated;

