-- ════════════════════════════════════════════════
-- A face for everybody, and a column that is only a face.
--
-- Anybody with no photo now wears a drawn face at the table instead
-- of a coloured disc with a letter in it. The face is assigned from
-- their profile id, so it is the same one everywhere and everybody
-- sees the same one — but a person may pick a different one, and
-- that choice has to reach the other players' screens.
--
-- IT IS ITS OWN COLUMN, NOT A KEY IN settings. The obvious move was
-- profiles.settings.avatar_sample and to widen safe_profiles to
-- expose `settings` — which would publish the whole blob to every
-- signed-in member for ever after, including whatever else is put in
-- it later by somebody who never reads this file. safe_profiles has
-- an explicit column list precisely so a new column cannot leak by
-- accident, and widening it to a jsonb would hand that guarantee
-- back.
--
-- So: one smallint that means one thing, and nothing else travels.
-- ════════════════════════════════════════════════

alter table public.profiles
  add column if not exists avatar_sample smallint;

comment on column public.profiles.avatar_sample is
  'Which drawn face this person wears when they have no photo. Null '
  'means "assign one from my id", which is what almost everybody will '
  'have. Public to signed-in members via safe_profiles: it is a '
  'picture of nobody.';

create or replace view public.safe_profiles as
  select id, role, full_name, avatar_url, city, languages, is_org, created_at,
         area, interests, about, about_prompt,
         show_presence, read_receipts, last_seen_at,
         avatar_sample
  from public.profiles
  where not is_blocked;

comment on view public.safe_profiles is
  'What anybody signed in may see of somebody else. An EXPLICIT column '
  'list, deliberately - a new column on profiles cannot leak here by '
  'accident. NEW COLUMNS GO ON THE END and every existing one must be '
  'repeated in its existing order: create or replace view cannot reorder '
  'or drop, and inserting one in the middle fails with 42P16. '
  'Never date_of_birth (the year is the age, 0059), never '
  'phone, never anything about health (PRODUCT_DECISIONS §8 '
  'never-list), and never `settings`, which is a jsonb that will '
  'accumulate things nobody has thought about yet.';
