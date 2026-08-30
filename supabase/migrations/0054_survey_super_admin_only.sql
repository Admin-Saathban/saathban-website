/* ═══════════════════════════════════════════════════════════════
   0054 — the research survey (PRODUCT_DECISIONS §16)

   "Storage: survey answers are SUPER-ADMIN-ONLY, stored separately
   from daily logs, never visible to Fam, Buddies, moderators or
   ordinary admins."

   Every clause of that sentence is a policy below, and none of it is
   enforced by hiding a screen. §0.9: a rule about who may see
   something has to hold at the database, proved by a negative test.

   ── Separately from daily logs, and why it matters ──

   A person answering "what would make you comfortable with a
   companion?" is telling Saathban something about their life, not
   logging their sleep. Putting those answers in the same table as
   daily logs would mean every policy that ever widens access to logs
   — a Fam member's shared view, a break-glass welfare read — silently
   widens access to the survey too. A separate table means a separate
   decision, every time.

   ── What the consent screen promises, kept here ──

   "They're seen only by the Saathban team, never by anyone else here,
   and you can stop at any point."

   "Only by the Saathban team" is `is_super_admin()`. Not `is_admin()`:
   §18 gives ordinary admins events, vetting and broadcasts, and an
   ordinary admin reading research answers would break the promise the
   person was shown. "You can stop at any point" is why a response is
   a single row the person owns and may DELETE — stopping means the
   answers go, not that a flag is set.

   ── Answers are a blob on purpose ──

   `answers jsonb`, not a column per question. §16 says every question
   must feed a feature, and the question set will change as features
   land. A schema migration per question would make changing the
   survey expensive, which is the surest way to end up with the wrong
   questions being asked for a year.
   ═══════════════════════════════════════════════════════════════ */

create table if not exists public.survey_responses (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null unique references public.profiles (id) on delete cascade,
  answers      jsonb not null default '{}',
  /* Consent is recorded as a time, not a boolean: "they agreed" is
     less useful than "they agreed at this moment", and a survey whose
     consent screen changes later needs to know which version somebody
     saw. */
  consented_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.survey_responses enable row level security;
revoke all on table public.survey_responses from anon;

/* ── The person themselves ──
   They may write their own answers and delete them. They may NOT read
   them back after submitting — deliberately? No: they may. Somebody
   who wants to see what they said should be able to. What they cannot
   do is read anyone else's. */
drop policy if exists "own survey: read" on public.survey_responses;
create policy "own survey: read"
  on public.survey_responses for select
  using (profile_id = auth.uid() or public.is_super_admin());

drop policy if exists "own survey: write" on public.survey_responses;
create policy "own survey: write"
  on public.survey_responses for insert
  with check (profile_id = auth.uid());

drop policy if exists "own survey: update" on public.survey_responses;
create policy "own survey: update"
  on public.survey_responses for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

/* "You can stop at any point" — stopping removes the answers. */
drop policy if exists "own survey: delete" on public.survey_responses;
create policy "own survey: delete"
  on public.survey_responses for delete
  using (profile_id = auth.uid());

/* NOTE what is absent: there is no policy granting admins,
   moderators, Fam or Buddies anything. `is_super_admin()` appears
   once, in the read policy, and nowhere else. An ordinary admin is
   refused by the same rule that refuses a stranger — not by a
   different, weaker one. */

create index if not exists survey_responses_submitted_idx
  on public.survey_responses (submitted_at) where submitted_at is not null;

/* ── The aggregate a super admin actually wants ──
   Counts, never a list of who said what. Even for a super admin the
   default view of research is aggregate: reading an individual's
   answers should require deliberately selecting the row, not fall out
   of opening a dashboard. */
create or replace function public.survey_summary()
returns table (question text, answer text, people integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select k.key as question,
         coalesce(v.value #>> '{}', '') as answer,
         count(*)::int as people
  from public.survey_responses r
  cross join lateral jsonb_each(r.answers) as k(key, val)
  cross join lateral (
    select case when jsonb_typeof(k.val) = 'array'
                then jsonb_array_elements(k.val)
                else k.val end as value
  ) v
  where r.submitted_at is not null
    and public.is_super_admin()
  group by 1, 2
  order by 1, 3 desc;
$function$;

revoke execute on function public.survey_summary() from public, anon, authenticated;
/* Granted to authenticated because RLS-style gating happens INSIDE the
   function (the is_super_admin() predicate): a non-super caller gets
   zero rows rather than an error, which is the same shape the rest of
   the admin surface uses. */
grant execute on function public.survey_summary() to authenticated;
