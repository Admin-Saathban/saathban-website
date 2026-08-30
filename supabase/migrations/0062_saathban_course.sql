/* ═══════════════════════════════════════════════════════════════
   0062 — the Saathban course (PRODUCT_DECISIONS §16)

   "Learning modules → a quiz after each → a final exam → a credential
   badge. You may skip straight to the exam — but skipping earns
   NOTHING. The badge requires completing the modules."

   That rule is the whole reason this is a migration and not a piece of
   component state. "Skipping earns nothing" is a claim about who holds
   a credential, and a credential decided in the browser is not a
   credential — anyone can pass an exam in devtools. So the badge is
   awarded by a function that checks the modules itself, and the client
   cannot assert it.

   ── Open to Icons, Fam and Buddies (§16) ──
   Every signed-in role may take it. There is no role check here at
   all, deliberately: the course teaches people how Saathban works, and
   a Buddy or a daughter needs that as much as an Icon does.

   ── The badge is purely a credential (§16) ──
   Recognition, no unlocks. Nothing in the app reads it as permission,
   and nothing should: the moment a credential grants access it stops
   being something a person takes for its own sake.
   ═══════════════════════════════════════════════════════════════ */

create table if not exists public.course_progress (
  profile_id     uuid primary key references public.profiles (id) on delete cascade,
  /* Which modules have been finished, by key. An array rather than a
     row per module: the set is small, always read whole, and a person
     resuming asks one question — "where was I?" */
  modules_done   text[] not null default '{}',
  exam_passed_at timestamptz,
  /* Recorded separately from exam_passed_at because they are different
     facts: somebody may pass the exam having skipped the modules, and
     that is allowed — it simply earns nothing. */
  badge_at       timestamptz,
  updated_at     timestamptz not null default now()
);

alter table public.course_progress enable row level security;
revoke all on table public.course_progress from anon;

/* Own row only. Nobody needs to see anyone else's progress through a
   course — there are no leaderboards here or anywhere (§0.4). */
drop policy if exists "own course progress" on public.course_progress;
create policy "own course progress"
  on public.course_progress for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

/* ── The credential, decided by the server ──

   Returns true only if EVERY required module is done AND the exam is
   passed. Called after the exam; awards at most once.

   The required list lives here rather than in the client so that a
   person cannot earn the badge by telling the server they finished
   modules that do not exist, and so that adding a module does not
   silently grandfather everyone who passed before it. */
create or replace function public.course_award(p_modules text[])
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  required text[] := array['what_saathban_is', 'keeping_people_safe', 'being_good_company'];
  row_now public.course_progress%rowtype;
begin
  select * into row_now from public.course_progress where profile_id = auth.uid();
  if row_now.profile_id is null then
    return false;
  end if;
  if row_now.exam_passed_at is null then
    return false;                       -- no exam, no credential
  end if;
  /* Every required module must be present. `@>` is containment, so
     extra keys are harmless and a missing one is fatal — which is
     exactly "skipping earns nothing". */
  if not (row_now.modules_done @> required) then
    return false;
  end if;
  if row_now.badge_at is not null then
    return true;                        -- already held; awarding twice is not a thing
  end if;
  update public.course_progress
  set badge_at = now(), updated_at = now()
  where profile_id = auth.uid();
  return true;
end;
$function$;

revoke execute on function public.course_award(text[]) from public, anon;
grant execute on function public.course_award(text[]) to authenticated;
