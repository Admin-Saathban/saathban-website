/* ═══════════════════════════════════════════════════════════════
   0160 — courses are content, and progress is kept per course

   The owner: "Courses and training" has NEW and PAST. A course the
   person has not completed is in New; once completed and its badge
   earned it moves to Past. The Saathban course is a course like any
   other. Badges are attached to content by the admin panel only — the
   admin chooses which badge a course awards, with a sensible default.

   WHAT THIS DOES
   1. Three credential badges a course can award: the Saathban course's
      own, and a generic one each for a course and a programme (the
      defaults). compute_badge_awards() never awards these kinds (its
      CASE falls to false) — only a finished course does.
   2. public.courses — title, description, kind, content (modules with an
      optional check question, and an optional exam), the badge it
      awards, its audience (empty = everyone, else roles), and a status:
        draft → published → closing ("let people part-way finish")
                          → closed  ("remove now")
      A course that is not a draft must be complete in both languages
      and have at least one module or exam question (CHECK, below).
   3. The Saathban course moves out of the client (CoursePage.jsx
      MODULES/EXAM and the grow.course.* locale keys) into a row, with
      its English and Urdu wording unchanged.
   4. course_progress becomes one row per person PER COURSE: course_id
      added and backfilled onto the Saathban course, the primary key
      becomes (profile_id, course_id), and completed_at / badge_key
      record the ONE completion state that New, Past and Pending all
      read. The one person who had earned the course badge (badge_at)
      is backfilled as completed and given the badge in earned_badges,
      marked seen at the time they earned it (they were told then).
   5. Writes to course_progress are closed to clients. The old policy
      was FOR ALL, so a client could write badge_at itself — the
      credential was only as honest as the browser. From here progress
      is written only by the course functions in 0161.
   ═══════════════════════════════════════════════════════════════ */

/* ── 1. The badges a course can award ── */
alter table public.badges drop constraint if exists badges_trigger_kind_check;
alter table public.badges add constraint badges_trigger_kind_check check (
  trigger_kind = any (array[
    'first_log', 'first_note', 'first_rest_day', 'presence_7', 'presence_30',
    'presence_100', 'return_after_absence', 'first_post', 'first_outing',
    'profile_complete', 'course_saathban', 'course_complete', 'programme_complete'
  ])
);

insert into public.badges (key, sort, emoji, name_en, name_ur, desc_en, desc_ur, trigger_kind, family) values
  ('saathban-course', 30, '🏅', 'The Saathban Course', 'ساتھ‌بن کورس',
   'You finished the Saathban course — how Saathban works, keeping people safe, and good company.',
   'آپ نے ساتھ‌بن کا کورس مکمل کیا — ساتھ‌بن کیسے کام کرتا ہے، لوگوں کی حفاظت، اور اچھا ساتھ۔',
   'course_saathban', 'credential'),
  ('course-finished', 31, '📘', 'A Course Finished', 'کورس مکمل',
   'You saw a course through to the end.',
   'آپ نے ایک کورس آخر تک مکمل کیا۔',
   'course_complete', 'credential'),
  ('programme-finished', 32, '🧵', 'A Programme Finished', 'پروگرام مکمل',
   'You saw a programme through to the end.',
   'آپ نے ایک پروگرام آخر تک مکمل کیا۔',
   'programme_complete', 'credential')
on conflict (key) do nothing;

/* ── 2. Validation, shared by courses (here) and surveys (0162) ──
   plpgsql rather than one SQL expression so the type checks run
   before anything is unnested: a malformed value returns false, it
   never raises from inside a CHECK. Keys are lower-case so they are
   safe as CSV column names and stable across wording edits. */
create or replace function public.grow_options_ok(p_options jsonb, p_answer text default null, p_need_answer boolean default false)
returns boolean
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
declare
  o jsonb;
  keys text[] := '{}';
begin
  if p_options is null or jsonb_typeof(p_options) <> 'array'
     or jsonb_array_length(p_options) < 2 or jsonb_array_length(p_options) > 15 then
    return false;
  end if;
  for o in select value from jsonb_array_elements(p_options) loop
    if jsonb_typeof(o) <> 'object'
       or coalesce(o->>'key', '') !~ '^[a-z0-9_]{1,40}$'
       or (o->>'key') = any (keys)
       or btrim(coalesce(o->>'en', '')) = ''
       or btrim(coalesce(o->>'ur', '')) = '' then
      return false;
    end if;
    keys := keys || (o->>'key');
  end loop;
  if p_need_answer and (p_answer is null or not (p_answer = any (keys))) then
    return false;
  end if;
  return true;
end;
$function$;

create or replace function public.grow_course_content_ok(p jsonb)
returns boolean
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
declare
  m jsonb;
  q jsonb;
  keys text[] := '{}';
  n int := 0;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return false; end if;
  if jsonb_typeof(coalesce(p->'modules', '[]')) <> 'array'
     or jsonb_typeof(coalesce(p->'exam', '[]')) <> 'array' then
    return false;
  end if;

  for m in select value from jsonb_array_elements(coalesce(p->'modules', '[]')) loop
    if jsonb_typeof(m) <> 'object'
       or coalesce(m->>'key', '') !~ '^[a-z0-9_]{1,40}$'
       or (m->>'key') = any (keys)
       or btrim(coalesce(m->>'title_en', '')) = '' or btrim(coalesce(m->>'title_ur', '')) = ''
       or btrim(coalesce(m->>'body_en', '')) = ''  or btrim(coalesce(m->>'body_ur', '')) = '' then
      return false;
    end if;
    if m ? 'question' and jsonb_typeof(m->'question') <> 'null' then
      q := m->'question';
      if jsonb_typeof(q) <> 'object'
         or btrim(coalesce(q->>'en', '')) = '' or btrim(coalesce(q->>'ur', '')) = ''
         or not public.grow_options_ok(q->'options', q->>'answer', true) then
        return false;
      end if;
    end if;
    keys := keys || (m->>'key');
    n := n + 1;
  end loop;

  for q in select value from jsonb_array_elements(coalesce(p->'exam', '[]')) loop
    if jsonb_typeof(q) <> 'object'
       or coalesce(q->>'key', '') !~ '^[a-z0-9_]{1,40}$'
       or (q->>'key') = any (keys)
       or btrim(coalesce(q->>'en', '')) = '' or btrim(coalesce(q->>'ur', '')) = ''
       or not public.grow_options_ok(q->'options', q->>'answer', true) then
      return false;
    end if;
    keys := keys || (q->>'key');
    n := n + 1;
  end loop;

  return n >= 1;
end;
$function$;

/* ── 3. Courses ── */
create table if not exists public.courses (
  id           uuid primary key default gen_random_uuid(),
  /* Only for courses a route names directly (/app/skills/course). */
  slug         text unique,
  kind         text not null default 'course' check (kind in ('course', 'programme')),
  title_en     text not null default '',
  title_ur     text not null default '',
  desc_en      text not null default '',
  desc_ur      text not null default '',
  content      jsonb not null default '{"modules": [], "exam": []}',
  /* ON DELETE RESTRICT: a badge somebody could earn from a course is not
     removed from under it. */
  badge_key    text default 'course-finished' references public.badges (key) on update cascade on delete restrict,
  audience     text[] not null default '{}'
               check (audience <@ array['saath_icon', 'saath_buddy', 'family_member', 'admin']),
  status       text not null default 'draft' check (status in ('draft', 'published', 'closing', 'closed')),
  sort         int not null default 100,
  published_at timestamptz,
  closed_at    timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint courses_complete_when_offered check (
    status = 'draft' or (
      btrim(title_en) <> '' and btrim(title_ur) <> ''
      and btrim(desc_en) <> '' and btrim(desc_ur) <> ''
      and public.grow_course_content_ok(content)
    )
  )
);

alter table public.courses enable row level security;
revoke all on table public.courses from anon, authenticated;
grant select on table public.courses to authenticated;

/* People never read this table: they read what grow_page() and
   course_for_me() give them, which hides exam answers and courses
   they are not offered. Admins may read it directly. */
drop policy if exists "admins read courses" on public.courses;
create policy "admins read courses"
  on public.courses for select
  using (public.is_admin());

/* The Saathban course, word for word from CoursePage.jsx and the
   grow.course.* locale keys. */
insert into public.courses (slug, kind, title_en, title_ur, desc_en, desc_ur, content, badge_key, audience, status, sort, published_at)
values (
  'saathban-course', 'course',
  'The Saathban course', 'ساتھ‌بن کا کورس',
  'How Saathban works, how people are kept safe, and what makes good company. Ten minutes, and it waits for you if you stop.',
  'ساتھ‌بن کیسے کام کرتا ہے، لوگوں کی حفاظت کیسے ہوتی ہے، اور اچھا ساتھ کیا ہے۔ دس منٹ، اور رُک جائیں تو یہ انتظار کرتا ہے۔',
  $json${
    "modules": [
      {
        "key": "what_saathban_is",
        "title_en": "What Saathban is", "title_ur": "ساتھ‌بن کیا ہے",
        "body_en": "Saathban is a place for company. People meet, play, and keep each other's days.",
        "body_ur": "ساتھ‌بن ساتھ کے لیے ہے۔ لوگ ملتے ہیں، کھیلتے ہیں، اور ایک دوسرے کے دن کا خیال رکھتے ہیں۔",
        "question": {
          "en": "What is Saathban for?", "ur": "ساتھ‌بن کس لیے ہے؟",
          "options": [
            {"key": "company", "en": "Company", "ur": "ساتھ"},
            {"key": "a_hospital", "en": "A hospital", "ur": "ہسپتال"},
            {"key": "a_shop", "en": "A shop", "ur": "دکان"}
          ],
          "answer": "company"
        }
      },
      {
        "key": "keeping_people_safe",
        "title_en": "Keeping people safe", "title_ur": "لوگوں کی حفاظت",
        "body_en": "Saathban will never ask you for money, and neither should anyone here. If someone does, report it.",
        "body_ur": "ساتھ‌بن کبھی آپ سے پیسے نہیں مانگے گا، اور نہ ہی یہاں کسی کو مانگنے چاہییں۔ کوئی مانگے تو اطلاع دیں۔",
        "question": {
          "en": "What does Saathban say about money?", "ur": "پیسوں کے بارے میں ساتھ‌بن کیا کہتا ہے؟",
          "options": [
            {"key": "never_money", "en": "Saathban never asks for money", "ur": "ساتھ‌بن کبھی پیسے نہیں مانگتا"},
            {"key": "always_money", "en": "Saathban asks for money", "ur": "ساتھ‌بن پیسے مانگتا ہے"},
            {"key": "sometimes", "en": "Sometimes", "ur": "کبھی کبھی"}
          ],
          "answer": "never_money"
        }
      },
      {
        "key": "being_good_company",
        "title_en": "Being good company", "title_ur": "اچھا ساتھ ہونا",
        "body_en": "Most of the time, good company is listening. Nobody needs to be fixed.",
        "body_ur": "زیادہ تر اچھا ساتھ سننا ہوتا ہے۔ کسی کو ٹھیک کرنے کی ضرورت نہیں۔",
        "question": {
          "en": "What does good company mostly look like?", "ur": "اچھا ساتھ زیادہ تر کیسا ہوتا ہے؟",
          "options": [
            {"key": "listen", "en": "Listening", "ur": "سننا"},
            {"key": "advise", "en": "Giving advice", "ur": "نصیحت کرنا"},
            {"key": "correct", "en": "Correcting people", "ur": "دوسروں کو درست کرنا"}
          ],
          "answer": "listen"
        }
      }
    ],
    "exam": [
      {
        "key": "exam_money",
        "en": "Someone you met here asks you for money. What do you do?",
        "ur": "یہاں ملا کوئی شخص آپ سے پیسے مانگتا ہے۔ آپ کیا کریں گے؟",
        "options": [
          {"key": "refuse_and_report", "en": "Refuse, and report it", "ur": "انکار کریں، اور اطلاع دیں"},
          {"key": "send_once", "en": "Send it once", "ur": "ایک بار بھیج دیں"},
          {"key": "ask_family", "en": "Ask their family first", "ur": "پہلے ان کے گھر والوں سے پوچھیں"}
        ],
        "answer": "refuse_and_report"
      },
      {
        "key": "exam_quiet",
        "en": "A friend here has been quiet for a week. What do you do?",
        "ur": "یہاں کا کوئی دوست ہفتے بھر سے خاموش ہے۔ آپ کیا کریں گے؟",
        "options": [
          {"key": "check_in_warmly", "en": "Send a warm message", "ur": "محبت سے پیغام بھیجیں"},
          {"key": "ignore", "en": "Leave it alone", "ur": "رہنے دیں"},
          {"key": "tell_everyone", "en": "Tell everyone", "ur": "سب کو بتا دیں"}
        ],
        "answer": "check_in_warmly"
      }
    ]
  }$json$::jsonb,
  'saathban-course',
  '{}',          -- §16: open to Icons, Fam and Buddies (and staff)
  'published',
  10,
  '2026-08-30T00:00:00Z'
)
on conflict (slug) do nothing;

/* ── 4. Progress per course ── */
alter table public.course_progress add column if not exists course_id uuid;
alter table public.course_progress add column if not exists started_at timestamptz;
alter table public.course_progress add column if not exists completed_at timestamptz;
alter table public.course_progress add column if not exists badge_key text;

update public.course_progress
set course_id = (select id from public.courses where slug = 'saathban-course')
where course_id is null;

update public.course_progress set started_at = updated_at where started_at is null;

/* Earned the badge = completed (course_award only set badge_at once
   every module was done and the exam passed). */
update public.course_progress
set completed_at = badge_at, badge_key = 'saathban-course'
where badge_at is not null and completed_at is null;

alter table public.course_progress alter column course_id set not null;
alter table public.course_progress alter column started_at set not null;
alter table public.course_progress alter column started_at set default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'course_progress_course_id_fkey') then
    alter table public.course_progress
      add constraint course_progress_course_id_fkey
      foreign key (course_id) references public.courses (id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'course_progress_badge_key_fkey') then
    alter table public.course_progress
      add constraint course_progress_badge_key_fkey
      foreign key (badge_key) references public.badges (key) on update cascade on delete restrict;
  end if;
  if exists (select 1 from pg_constraint where conname = 'course_progress_pkey'
             and pg_get_constraintdef(oid) = 'PRIMARY KEY (profile_id)') then
    alter table public.course_progress drop constraint course_progress_pkey;
    alter table public.course_progress add constraint course_progress_pkey primary key (profile_id, course_id);
  end if;
end $$;

create index if not exists course_progress_course_idx on public.course_progress (course_id);

insert into public.earned_badges (profile_id, badge_key, earned_at, seen_at)
select profile_id, 'saathban-course', completed_at, completed_at
from public.course_progress
where completed_at is not null and badge_key = 'saathban-course'
on conflict (profile_id, badge_key) do nothing;

/* ── 5. Clients read their own progress; only the course functions write ── */
drop policy if exists "own course progress" on public.course_progress;
drop policy if exists "own course progress: read" on public.course_progress;
create policy "own course progress: read"
  on public.course_progress for select
  using (profile_id = auth.uid());

revoke all on table public.course_progress from anon, authenticated;
grant select on table public.course_progress to authenticated;
