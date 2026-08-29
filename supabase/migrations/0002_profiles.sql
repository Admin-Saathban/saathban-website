-- ============================================================================
-- 0002 — Profiles, role helpers, safe_profiles view
--
-- One profile row per auth user, holding role, tier, and the two independent
-- admin flags: is_paused (reversible pause/unpause) and is_blocked (permanent
-- bar, e.g. a Buddy rejected for cause who must never reapply).
--
-- Email lives only in auth.users. Phone lives here. Both are sensitive:
-- support admins never see them — they see safe_profiles and use logged RPCs.
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
  -- slot for Icons with an empty circle). Set by staff only — see note below.
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
-- cannot: an Icon's phone and email are outside support scope — support works
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
-- safe_profiles — the non-sensitive projection everyone else uses.
--
-- This view intentionally runs with its owner's rights (default, NOT
-- security_invoker), which bypasses profiles RLS — that is the point: it
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
