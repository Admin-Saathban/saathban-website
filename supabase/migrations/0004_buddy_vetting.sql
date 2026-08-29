-- ============================================================================
-- 0004 — Saath-Buddy vetting
--
-- Applications are VERSIONED: each attempt is its own row, so reviewers see
-- the full history. Reapplying is allowed 90 days after a rejection (enforced
-- in submit_buddy_application). Permanent cases use profiles.is_blocked.
--
-- The pipeline status lives on the application row:
--   pending → interviewing → probation → active → suspended → rejected
-- A Buddy has no access to any Icon data before 'active' — and in this
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

  -- Motivation is free-form — the field the reviewer reads first.
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

-- Two non-family references, with phone numbers that are ACTUALLY CALLED —
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

-- Both admin levels review applications — approvals and documents are support
-- scope — and reviewers see prior attempts by design. Routine review reads
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
