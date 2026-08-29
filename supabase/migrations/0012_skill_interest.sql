-- ============================================================================
-- 0012 — Skill interest ("Tell me when this opens")
--
-- The Skills tab shows three cards — Languages, Courses, Earning — each a real
-- description with a "Tell me when this opens" button (SPEC.md, Skills). The
-- interest counts are the demand data that decides what launches; they are NOT
-- a public tally and never name who is interested.
--
-- One row per person per skill, toggled on and off by the person themselves.
-- The skill is a stable key, not a foreign row: v1 has exactly three, named in
-- the check constraint; adding a fourth is a one-line migration here plus a
-- card in the UI.
-- ============================================================================

create table public.skill_interest (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill      text not null check (skill in ('languages', 'courses', 'earning')),
  created_at timestamptz not null default now(),
  unique (profile_id, skill)
);

create index skill_interest_skill_idx on public.skill_interest (skill);

-- ----------------------------------------------------------------------------
-- Row-level security. Interest is the person's own: they see, add, and remove
-- their own rows. Nobody reads another person's individual interest — admins
-- get only aggregate counts, through the SECURITY DEFINER function below.
-- ----------------------------------------------------------------------------
alter table public.skill_interest enable row level security;
revoke all on public.skill_interest from anon;

create policy "read own interest"
  on public.skill_interest for select
  using (profile_id = auth.uid());

create policy "add own interest"
  on public.skill_interest for insert
  with check (profile_id = auth.uid() and public.account_ok());

-- Toggling off is a delete; there is nothing to update, so no update policy.
create policy "remove own interest"
  on public.skill_interest for delete
  using (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Aggregate demand for staff. Returns every known skill (even at zero, so the
-- admin view never hides an empty shelf) with its interest count. Admin only;
-- non-admins get zero rows, never individual identities.
-- ----------------------------------------------------------------------------
create or replace function public.skill_interest_counts()
returns table (skill text, interested bigint)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.skill, count(i.id) as interested
  from (values ('languages'), ('courses'), ('earning')) as s(skill)
  left join public.skill_interest i on i.skill = s.skill
  where public.is_admin()   -- non-admins get zero rows, never identities
  group by s.skill
  order by s.skill;
$$;

revoke execute on function public.skill_interest_counts() from public, anon;
grant execute on function public.skill_interest_counts() to authenticated;
