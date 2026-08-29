-- ============================================================================
-- 0001 — Enums and shared helpers
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
