/* ═══════════════════════════════════════════════════════════════
   0162 — surveys are published by the admin, and answered once each

   The owner: the admin publishes a survey — name, description,
   questions (single choice, multiple choice, written), who it targets.
   "Help Saathban's research" becomes one instance of this.

   WHAT THIS DOES
   1. public.surveys — bilingual title, description and (optional)
      consent text; questions as jsonb
        [{key, type: single|multi|text, en, ur, options: [{key, en, ur}]}]
      audience (empty = everyone, else roles) and status
        draft → published → closing ("let people part-way finish")
                          → closed  ("remove now").
      Anything not a draft must be complete in both languages (CHECK).
   2. The research survey (§16) moves out of SurveyPage.jsx QUESTIONS and
      the grow.survey.* locale keys into a row: the same 8 question keys,
      the same option keys, the same English and Urdu wording, the
      consent screen word for word, audience Icons only.
   3. survey_responses gains survey_id, backfilled onto the research
      survey (every existing response). UNIQUE(profile_id) becomes
      UNIQUE(survey_id, profile_id): one response per person PER SURVEY.
      0118's trigger stays and also holds survey_id: a submitted response
      is final, and no response can be moved to another survey.
   4. Writes to survey_responses are closed to clients; answers are
      saved, submitted and withdrawn only through the functions in 0163
      (which check the survey is open to that person and that each answer
      fits its question). Reading stays as 0054 had it: your own, or a
      super admin.
   5. public.survey_dismissals — one row per person per survey: how many
      times they dismissed (or withdrew from) it, when last, and when an
      admin last re-offered it. No client can read or write it.
   6. survey_summary() (0054, super-admin, no screen reads it) keeps its
      meaning: the research survey's answers only.

   WHY CERTAIN QUESTIONS ARE NOT IN THE RESEARCH SURVEY is §16 and is
   unchanged by this move: nothing the app already knows, nothing about
   income or willingness to pay, no direct loneliness measurement. The
   builder cannot see §16, so the admin screen repeats that guidance.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.grow_survey_questions_ok(p jsonb)
returns boolean
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
declare
  q jsonb;
  keys text[] := '{}';
begin
  if p is null or jsonb_typeof(p) <> 'array'
     or jsonb_array_length(p) < 1 or jsonb_array_length(p) > 40 then
    return false;
  end if;
  for q in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(q) <> 'object'
       or coalesce(q->>'key', '') !~ '^[a-z0-9_]{1,40}$'
       or (q->>'key') = any (keys)
       or coalesce(q->>'type', '') not in ('single', 'multi', 'text')
       or btrim(coalesce(q->>'en', '')) = '' or btrim(coalesce(q->>'ur', '')) = '' then
      return false;
    end if;
    if q->>'type' in ('single', 'multi') and not public.grow_options_ok(q->'options') then
      return false;
    end if;
    keys := keys || (q->>'key');
  end loop;
  return true;
end;
$function$;

revoke all on function public.grow_survey_questions_ok(jsonb) from public, anon;

create table if not exists public.surveys (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique,
  title_en     text not null default '',
  title_ur     text not null default '',
  desc_en      text not null default '',
  desc_ur      text not null default '',
  /* Both empty = no consent screen of its own (a plain intro is shown).
     Both filled = shown first, and the only way past it is to choose. */
  consent_en   text not null default '',
  consent_ur   text not null default '',
  questions    jsonb not null default '[]',
  audience     text[] not null default '{}'
               check (audience <@ array['saath_icon', 'saath_buddy', 'family_member', 'admin']),
  status       text not null default 'draft' check (status in ('draft', 'published', 'closing', 'closed')),
  published_at timestamptz,
  closed_at    timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint surveys_complete_when_offered check (
    status = 'draft' or (
      btrim(title_en) <> '' and btrim(title_ur) <> ''
      and btrim(desc_en) <> '' and btrim(desc_ur) <> ''
      and (btrim(consent_en) = '') = (btrim(consent_ur) = '')
      and public.grow_survey_questions_ok(questions)
    )
  )
);

alter table public.surveys enable row level security;
revoke all on table public.surveys from anon, authenticated;
grant select on table public.surveys to authenticated;

drop policy if exists "admins read surveys" on public.surveys;
create policy "admins read surveys"
  on public.surveys for select
  using (public.is_admin());

insert into public.surveys (slug, title_en, title_ur, desc_en, desc_ur, consent_en, consent_ur, questions, audience, status, published_at)
values (
  'research',
  'Help Saathban''s research', 'ساتھ‌بن کی تحقیق میں مدد کریں',
  'A few questions about what you know and what you''d like. Your answers are seen only by the Saathban team.',
  'چند سوال کہ آپ کیا جانتے ہیں اور کیا چاہتے ہیں۔ آپ کے جواب صرف ساتھ‌بن کی ٹیم دیکھتی ہے۔',
  'Your answers help Saathban''s research. They''re seen only by the Saathban team, never by anyone else here, and you can stop at any point.',
  'آپ کے جواب ساتھ‌بن کی تحقیق میں مدد دیتے ہیں۔ انہیں صرف ساتھ‌بن کی ٹیم دیکھتی ہے، یہاں کوئی اور نہیں، اور آپ جب چاہیں رُک سکتے ہیں۔',
  $json$[
    {"key": "could_share", "type": "multi",
     "en": "What do you know well enough to show someone?", "ur": "آپ کیا اتنا جانتے ہیں کہ کسی کو سکھا سکیں؟",
     "options": [
       {"key": "cooking", "en": "Cooking", "ur": "کھانا پکانا"},
       {"key": "teaching", "en": "Teaching", "ur": "پڑھانا"},
       {"key": "stitching", "en": "Stitching", "ur": "سلائی"},
       {"key": "gardening", "en": "Gardening", "ur": "باغبانی"},
       {"key": "stories", "en": "Stories", "ur": "کہانیاں"},
       {"key": "repairs", "en": "Repairs", "ur": "مرمت"}
     ]},
    {"key": "would_mentor", "type": "single",
     "en": "Would you spend time with someone younger who wanted to learn?", "ur": "کیا آپ کسی کم عمر کے ساتھ وقت گزاریں گے جو سیکھنا چاہے؟",
     "options": [
       {"key": "yes", "en": "Yes", "ur": "ہاں"},
       {"key": "maybe", "en": "Maybe", "ur": "شاید"},
       {"key": "no", "en": "No", "ur": "نہیں"}
     ]},
    {"key": "activities", "type": "multi",
     "en": "What would you like to do with other people?", "ur": "آپ دوسروں کے ساتھ کیا کرنا چاہیں گے؟",
     "options": [
       {"key": "walking", "en": "Walking", "ur": "سیر"},
       {"key": "games", "en": "Games", "ur": "کھیل"},
       {"key": "religious", "en": "Religious gatherings", "ur": "دینی محافل"},
       {"key": "music", "en": "Music", "ur": "موسیقی"},
       {"key": "outings", "en": "Outings", "ur": "باہر جانا"}
     ]},
    {"key": "would_learn", "type": "single",
     "en": "Would you join a class or a group?", "ur": "کیا آپ کسی کلاس یا گروپ میں شامل ہوں گے؟",
     "options": [
       {"key": "yes", "en": "Yes", "ur": "ہاں"},
       {"key": "maybe", "en": "Maybe", "ur": "شاید"},
       {"key": "no", "en": "No", "ur": "نہیں"}
     ]},
    {"key": "earning_interest", "type": "single",
     "en": "Would you like work that uses what you know?", "ur": "کیا آپ ایسا کام چاہیں گے جس میں آپ کا ہنر کام آئے؟",
     "options": [
       {"key": "yes", "en": "Yes", "ur": "ہاں"},
       {"key": "maybe", "en": "Maybe", "ur": "شاید"},
       {"key": "no", "en": "No", "ur": "نہیں"}
     ]},
    {"key": "time_per_week", "type": "single",
     "en": "How much time a week feels comfortable?", "ur": "ہفتے میں کتنا وقت آپ کو مناسب لگتا ہے؟",
     "options": [
       {"key": "under2", "en": "An hour or two", "ur": "ایک دو گھنٹے"},
       {"key": "two_to_five", "en": "A few hours", "ur": "چند گھنٹے"},
       {"key": "over5", "en": "More than that", "ur": "اس سے زیادہ"}
     ]},
    {"key": "companion_comfort", "type": "multi",
     "en": "What would make you comfortable with a companion?", "ur": "ساتھی کے بارے میں آپ کو کس بات سے اطمینان ہوگا؟",
     "options": [
       {"key": "same_gender", "en": "Someone of my own gender", "ur": "اپنی ہی جنس کا کوئی"},
       {"key": "similar_age", "en": "Someone near my age", "ur": "اپنی عمر کے قریب کوئی"},
       {"key": "same_language", "en": "Someone who speaks my language", "ur": "جو میری زبان بولے"},
       {"key": "no_preference", "en": "No preference", "ur": "کوئی ترجیح نہیں"}
     ]},
    {"key": "matters_most", "type": "single",
     "en": "What matters most to you here?", "ur": "یہاں آپ کے لیے سب سے اہم کیا ہے؟",
     "options": [
       {"key": "company", "en": "Company", "ur": "ساتھ"},
       {"key": "safety", "en": "Feeling safe", "ur": "تحفظ کا احساس"},
       {"key": "learning", "en": "Learning", "ur": "سیکھنا"},
       {"key": "purpose", "en": "Something useful to do", "ur": "کچھ کارآمد کرنا"}
     ]}
  ]$json$::jsonb,
  '{saath_icon}',   -- §16: Icons only, no Fam version
  'published',
  coalesce((select min(consented_at) from public.survey_responses), now())
)
on conflict (slug) do nothing;

/* ── Responses belong to a survey ── */
alter table public.survey_responses add column if not exists survey_id uuid;

update public.survey_responses
set survey_id = (select id from public.surveys where slug = 'research')
where survey_id is null;

alter table public.survey_responses alter column survey_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'survey_responses_survey_id_fkey') then
    alter table public.survey_responses
      add constraint survey_responses_survey_id_fkey
      foreign key (survey_id) references public.surveys (id) on delete restrict;
  end if;
  if exists (select 1 from pg_constraint where conname = 'survey_responses_profile_id_key') then
    alter table public.survey_responses drop constraint survey_responses_profile_id_key;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'survey_responses_one_per_person_per_survey') then
    alter table public.survey_responses
      add constraint survey_responses_one_per_person_per_survey unique (survey_id, profile_id);
  end if;
end $$;

create index if not exists survey_responses_profile_idx on public.survey_responses (profile_id);

create or replace function public.survey_response_is_final()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.survey_id is distinct from old.survey_id then
    raise exception 'a response belongs to one survey'
      using errcode = 'P0001';
  end if;
  if old.submitted_at is not null
     and (new.answers is distinct from old.answers
          or new.submitted_at is distinct from old.submitted_at
          or new.profile_id is distinct from old.profile_id) then
    raise exception 'survey already answered'
      using errcode = 'P0001',
            hint = 'A submitted response is final. It can be withdrawn (deleted), not replaced.';
  end if;
  return new;
end;
$function$;

revoke all on function public.survey_response_is_final() from public, anon, authenticated;

drop policy if exists "own survey: write" on public.survey_responses;
drop policy if exists "own survey: update" on public.survey_responses;
drop policy if exists "own survey: delete" on public.survey_responses;
revoke all on table public.survey_responses from anon, authenticated;
grant select on table public.survey_responses to authenticated;

/* ── Dismissals and re-offers ── */
create table if not exists public.survey_dismissals (
  survey_id         uuid not null references public.surveys (id) on delete cascade,
  profile_id        uuid not null references public.profiles (id) on delete cascade,
  dismiss_count     int not null default 0 check (dismiss_count >= 0),
  last_dismissed_at timestamptz,
  last_kind         text check (last_kind in ('dismissed', 'withdrew')),
  reoffered_at      timestamptz,
  reoffered_by      uuid references public.profiles (id) on delete set null,
  primary key (survey_id, profile_id)
);

alter table public.survey_dismissals enable row level security;
revoke all on table public.survey_dismissals from anon, authenticated;

/* ── 0054's summary keeps meaning the research survey ── */
create or replace function public.survey_summary()
returns table (question text, answer text, people integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with research as (
    select id from public.surveys where slug = 'research'
  ), expanded as (
    select k.key as question, e.value as val
    from public.survey_responses r
    cross join lateral jsonb_each(r.answers) as k(key, value)
    cross join lateral jsonb_array_elements(k.value) as e(value)
    where r.submitted_at is not null and jsonb_typeof(k.value) = 'array'
      and r.survey_id = (select id from research)
    union all
    select k.key, k.value
    from public.survey_responses r
    cross join lateral jsonb_each(r.answers) as k(key, value)
    where r.submitted_at is not null and jsonb_typeof(k.value) <> 'array'
      and r.survey_id = (select id from research)
  )
  select question, coalesce(val #>> '{}', '') as answer, count(*)::int as people
  from expanded
  where public.is_super_admin()
  group by 1, 2
  order by 1, 3 desc;
$function$;
