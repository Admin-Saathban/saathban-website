-- ============================================================================
-- 0047 — An Icon can add a place
--
-- outdoor_places was seeded and then closed: `places: admins write` meant
-- the only way a park existed was for staff to type it in. So a person
-- whose whole life happens at a maidan two streets away could not plan
-- anything there, and "Out & about" quietly became a list of somewhere
-- else. Icons add places now, and a place is usable by everyone the
-- moment it exists.
--
-- WHAT IS ADDED
--   created_by  — who added it, so a community place can say so and an
--                 admin can see whose it was. NULL for the seeded rows.
--   is_hidden   — the admin's handle for abuse. Hiding is reversible and
--                 keeps the row, so anything already planned there still
--                 resolves rather than breaking.
--
-- WHO MAY DO WHAT
--   read    everyone who may use the community, EXCEPT hidden rows —
--           which admins still see, because they must to unhide them.
--   insert  Saath-Icons only, and only as themselves (created_by must be
--           the caller). Not Fam, not Buddies: initiation out in the
--           world is the Icon's, exactly as SPEC has it for gatherings.
--   update  admins, unchanged from before — this is where hiding lives.
--
-- Deliberately NOT done: no dedupe rule, no approval queue. A duplicate
-- park is a smaller harm than a person unable to name their own
-- neighbourhood, and an approval queue would make "usable immediately"
-- a lie. Admins hide what needs hiding.
-- ============================================================================

alter table public.outdoor_places
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists is_hidden  boolean not null default false;

create index if not exists outdoor_places_visible_idx
  on public.outdoor_places (city, area) where not is_hidden;

-- ─── Read: hidden rows disappear for everyone but admins ───
drop policy if exists "places: community reads" on public.outdoor_places;
create policy "places: community reads" on public.outdoor_places
  for select using (
    public.can_use_community() and (not is_hidden or public.is_admin())
  );

-- ─── Insert: an Icon, adding a place as themselves ───
drop policy if exists "places: icons add" on public.outdoor_places;
create policy "places: icons add" on public.outdoor_places
  for insert with check (
    public.can_use_community()
    and created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'saath_icon' and not is_blocked
    )
  );

-- The admin write policy from 0016 stays as it is: staff seeding and
-- staff hiding both go through it.
