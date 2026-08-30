-- ════════════════════════════════════════════════
-- 0059 — PRODUCT_DECISIONS §2: date of birth, asked warmly at signup.
--
-- Applied 2026-08-30. Registered in supabase/MIGRATIONS.md.
--
-- THREE DECISIONS ARE RECORDED HERE, not just a column:
--
--  1. NULLABLE at the database, mandatory in the signup UI. Mandatory is a
--     rule of the screen, not of the table — every profile created before
--     this column predates the question, and nobody invents a birthday for
--     them.
--
--  2. AGE IS NEVER STORED. The 50+ check for Saath-Icon is derived at the
--     moment it is needed. An `age` column or an `is_eligible` flag freezes a
--     number that changes every year, and the first symptom is somebody who
--     has been 49 for three years. Same argument as POINTS.md.
--
--  3. THE OPT-OUT SHIPS WITH THE FIELD. §2 asks warmly and gets the date so
--     the app can celebrate; somebody will not want the fuss. If the column
--     landed with no way to say "don't", that is the state §21's birthday
--     takeover would find it in. It needs no DDL — `profiles.settings` is
--     jsonb and already NOT NULL — so the flag is settings->>'birthday_private'
--     and the function below honours it from day one.
-- ════════════════════════════════════════════════

alter table public.profiles
  add column if not exists date_of_birth date;

comment on column public.profiles.date_of_birth is
  'Asked at signup: "When''s your birthday? So we can celebrate with you." '
  'NULLABLE by design - mandatory is a rule of the signup screen, not of the '
  'table, because every profile created before this column predates the '
  'question and nobody invents a birthday for them. AGE IS NEVER STORED: the '
  '50+ check for Saath-Icon is derived at the moment it is needed. An age '
  'column freezes a number that changes every year, and its first symptom is '
  'somebody who has been 49 for three years.';

-- ── The derived fact, so nobody has to read the field ──
-- The safe path is provided precisely so the unsafe one is not taken. Whose
-- birthday is today, among MY OWN circle, and nothing else:
--   * no date and no year, ever, to anyone but the person themselves — the
--     year IS the age, and §2 is explicit that the age check happens quietly
--     and that nobody is told they are being verified. A circle member seeing
--     "born 1948" makes the app the thing that told them;
--   * not enumerable — scoped to the caller's circle, never "everyone".
--     "Whose birthday is today" is a kindness; "give me everyone's birthday"
--     is a list that ends up in a spreadsheet;
--   * ids only. Returning a date for a match would be the same leak in a hat.
--
-- safe_profiles is an explicit column list, so date_of_birth cannot leak into
-- it by accident — it would take somebody deliberately adding it. The negative
-- test in tests/dob-privacy.mjs guards that future edit rather than today's
-- behaviour, which is exactly why it is worth having.
create or replace function public.circle_birthdays_today()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.date_of_birth is not null
    and coalesce(p.settings->>'birthday_private', 'false') <> 'true'
    and not p.is_blocked
    and extract(month from p.date_of_birth) = extract(month from current_date)
    and extract(day   from p.date_of_birth) = extract(day   from current_date)
    and (
      exists (select 1 from public.circle_members c
               where c.icon_id = auth.uid() and c.member_id = p.id)
      or exists (select 1 from public.circle_members c
                  where c.member_id = auth.uid() and c.icon_id = p.id)
    );
$$;

revoke all on function public.circle_birthdays_today() from public, anon;
grant execute on function public.circle_birthdays_today() to authenticated;

comment on function public.circle_birthdays_today() is
  'Profile ids in the CALLER''S OWN circle whose birthday is today and who '
  'have not set birthday_private. Ids only - never a date, never a year, '
  'never anyone outside the caller''s circle. Exists so that showing a '
  'birthday never requires reading profiles.date_of_birth.';
