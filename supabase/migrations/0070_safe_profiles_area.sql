-- 0070 — safe_profiles exposes area.  APPLIED 2026-08-30.
--
-- PRODUCT_DECISIONS §7: the community feed shows your AREA first, widening
-- to city then to Pakistan only when there is not enough nearby. The band
-- cannot be computed without the author's area, and safe_profiles — the
-- RLS-safe read every feed goes through — exposed city but not area.
--
-- area is no more sensitive than city, which this view has always exposed:
-- both are the coarse "where I am" typed at signup, neither is a location,
-- and nothing about check-ins or live presence is involved.
--
-- area is appended at the END rather than in a tidy position: CREATE OR
-- REPLACE VIEW cannot reorder or rename existing columns (it refuses with
-- "cannot change name of view column"), and dropping the view would take
-- every grant and dependent policy with it.

create or replace view public.safe_profiles as
  select id, role, full_name, avatar_url, city, languages, is_org, created_at, area
  from public.profiles
  where not is_blocked;

grant select on public.safe_profiles to authenticated;
