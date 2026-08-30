-- ════════════════════════════════════════════════
-- 0082 — PRODUCT_DECISIONS §8: what a stranger sees.
-- Applied 2026-08-30. Registered in supabase/MIGRATIONS.md.
--
-- §8 is explicit that the STRANGER view matters most and is least
-- designed: it is how a lonely person is judged by somebody deciding
-- whether to accept them. So these fields exist to be seen, and they
-- are added to safe_profiles deliberately and by name.
--
-- about_prompt is stored beside the sentence because the PROMPT is what
-- made the sentence worth reading. "Where did you grow up?" gets a real
-- answer where "tell people about yourself" gets nothing, and showing
-- the question with the answer keeps that context instead of leaving a
-- stray remark.
--
-- LANGUAGES AND INTERESTS ARE IDS, NOT FREE TEXT. A text box turns
-- "Punjabi" into "punjabi", "Panjabi" and "پنجابی", and then nothing
-- can match on it — which defeats the one field §8 calls the
-- highest-value in the app.
--
-- NOTHING HERE IS A HEALTH FIELD OR A PHONE NUMBER (§8's never-list),
-- and date_of_birth is deliberately NOT added: the year is the age, and
-- 0059 settled that it never travels. tests/dob-privacy.mjs asserts
-- that against THIS view, and was written before this migration existed
-- precisely to catch an edit like this one.
--
-- The new columns are APPENDED rather than slotted in where they read
-- best: `create or replace view` cannot rename or reorder existing
-- columns, and dropping the view to make it pretty would take its
-- grants and any dependent object with it. Column order is not worth
-- that risk.
-- ════════════════════════════════════════════════

alter table public.profiles
  add column if not exists interests text[] not null default '{}',
  add column if not exists about text,
  add column if not exists about_prompt text;

comment on column public.profiles.interests is
  'What you enjoy - tapped, never typed (PRODUCT_DECISIONS §8). A '
  'stranger reads these to decide whether to say hello.';
comment on column public.profiles.about is
  'One optional line, written in answer to about_prompt - which is what '
  'makes it worth reading.';
comment on column public.profiles.about_prompt is
  'Which question they answered. Stored so the profile can show the '
  'question with the answer rather than a stray sentence.';

create or replace view public.safe_profiles as
  select id, role, full_name, avatar_url, city, languages, is_org, created_at,
         area, interests, about, about_prompt
  from public.profiles
  where not is_blocked;

comment on view public.safe_profiles is
  'What anybody signed in may see of somebody else. An EXPLICIT column '
  'list, deliberately - a new column on profiles cannot leak here by '
  'accident. Never date_of_birth (the year is the age, 0059), never '
  'phone, never anything about health (PRODUCT_DECISIONS §8 never-list).';
