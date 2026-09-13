/* ═══════════════════════════════════════════════════════════════
   0161 — a course is finished in one place

   ONE COMPLETION STATE. course_progress.completed_at (per person, per
   course) is the only fact that says a course is done. New courses,
   Past courses and Pending are all computed from it — grow_course_state
   below — so there is never a second record that could disagree with
   it. Completing a course from Pending, from New, or from a link is the
   same call and lands in the same row.

   THE SERVER DECIDES, as 0062 said it must: "a credential decided in
   the browser is not a credential". Now the server also checks the
   answers themselves — the client is never sent the correct answers
   (course_for_me strips them), and progress is written only here.

   COMPLETION RULE (course_settle): every module in the course's
   content is done AND, if the course has an exam, the exam is passed.
   "You may skip straight to the exam — but skipping earns nothing"
   (§16) survives exactly: passing the exam with modules missing is
   recorded, and completion happens the moment the last module is
   finished, not before.

   THE BADGE is the one the course names at the moment of completion
   (courses.badge_key, chosen by the admin). It is copied onto the
   progress row and into earned_badges. An admin changing a course's
   badge later changes what FUTURE completions earn; nobody's earned
   badge is taken away or swapped.

   AVAILABILITY (grow_course_state → 'new' | 'past' | 'hidden'):
     past    completed_at is set — always, whatever the course's status
             now; a finished course and its badge are never taken back
     new     status 'published' and the person is in the audience, or
             status 'closing' and they already have progress (they may
             finish; nobody new may start)
     hidden  everything else (drafts, 'closed', not in the audience).
             A 'closed' course keeps everyone's part-way progress in the
             table untouched, so publishing it again resumes them.
   ═══════════════════════════════════════════════════════════════ */

/* Empty audience = everyone. */
create or replace function public.grow_audience_ok(p_audience text[], p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(cardinality(p_audience), 0) = 0
      or exists (select 1 from public.profiles where id = p_profile and role::text = any (p_audience));
$function$;

create or replace function public.grow_badge_json(p_key text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object('key', b.key, 'emoji', b.emoji, 'name_en', b.name_en, 'name_ur', b.name_ur,
                            'desc_en', b.desc_en, 'desc_ur', b.desc_ur, 'family', b.family)
  from public.badges b where b.key = p_key;
$function$;

create or replace function public.grow_course_state(p_profile uuid, p_course uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  c public.courses%rowtype;
  cp public.course_progress%rowtype;
begin
  select * into c from public.courses where id = p_course;
  if c.id is null then return 'hidden'; end if;
  select * into cp from public.course_progress where profile_id = p_profile and course_id = p_course;
  if cp.completed_at is not null then return 'past'; end if;
  if not public.grow_audience_ok(c.audience, p_profile) then return 'hidden'; end if;
  if c.status = 'published' then return 'new'; end if;
  if c.status = 'closing' and cp.profile_id is not null then return 'new'; end if;
  return 'hidden';
end;
$function$;

/* A slug or an id. */
create or replace function public.grow_course_ref(p_ref text)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select id from public.courses
  where (p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and id = p_ref::uuid)
     or slug = p_ref
  limit 1;
$function$;

/* Settles completion for one person and one course. Idempotent. */
create or replace function public.course_settle(p_profile uuid, p_course uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  c public.courses%rowtype;
  cp public.course_progress%rowtype;
  v_required text[];
begin
  select * into c from public.courses where id = p_course;
  select * into cp from public.course_progress where profile_id = p_profile and course_id = p_course for update;
  if c.id is null or cp.profile_id is null then return false; end if;
  if cp.completed_at is not null then return true; end if;

  v_required := array(select m->>'key' from jsonb_array_elements(coalesce(c.content->'modules', '[]')) m);
  if not (cp.modules_done @> v_required) then return false; end if;
  if jsonb_array_length(coalesce(c.content->'exam', '[]')) > 0 and cp.exam_passed_at is null then
    return false;
  end if;

  update public.course_progress
  set completed_at = now(),
      badge_key = c.badge_key,
      badge_at = case when c.badge_key is not null then now() end,
      updated_at = now()
  where profile_id = p_profile and course_id = p_course;

  if c.badge_key is not null then
    insert into public.earned_badges (profile_id, badge_key)
    values (p_profile, c.badge_key)
    on conflict (profile_id, badge_key) do nothing;
  end if;
  return true;
end;
$function$;

/* What the course screen needs, without the answers. Null when the
   course is not available to the caller. */
create or replace function public.course_for_me(p_ref text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  me uuid := auth.uid();
  v_id uuid;
  v_state text;
  c public.courses%rowtype;
  cp public.course_progress%rowtype;
begin
  if me is null or not public.account_ok() then return null; end if;
  v_id := public.grow_course_ref(p_ref);
  if v_id is null then return null; end if;
  v_state := public.grow_course_state(me, v_id);
  if v_state = 'hidden' then return null; end if;
  select * into c from public.courses where id = v_id;
  select * into cp from public.course_progress where profile_id = me and course_id = v_id;

  return jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'kind', c.kind, 'status', c.status, 'state', v_state,
    'title_en', c.title_en, 'title_ur', c.title_ur, 'desc_en', c.desc_en, 'desc_ur', c.desc_ur,
    'badge', public.grow_badge_json(case when v_state = 'past' then cp.badge_key else c.badge_key end),
    'modules', coalesce((
      select jsonb_agg(case when jsonb_typeof(m->'question') = 'object'
                            then m || jsonb_build_object('question', (m->'question') - 'answer')
                            else m - 'question' end order by ord)
      from jsonb_array_elements(coalesce(c.content->'modules', '[]')) with ordinality e(m, ord)), '[]'),
    'exam', coalesce((
      select jsonb_agg(q - 'answer' order by ord)
      from jsonb_array_elements(coalesce(c.content->'exam', '[]')) with ordinality e(q, ord)), '[]'),
    'progress', jsonb_build_object(
      'modules_done', to_jsonb(coalesce(cp.modules_done, '{}')),
      'exam_passed_at', cp.exam_passed_at,
      'completed_at', cp.completed_at,
      'started', cp.profile_id is not null)
  );
end;
$function$;

/* A module: checks the answer to its question (a module without one
   is simply read) and, when right, records it. Returns whether the
   answer was right. On a finished course nothing is written. */
create or replace function public.course_answer_module(p_course uuid, p_module text, p_answer text default null)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  me uuid := auth.uid();
  v_state text;
  c public.courses%rowtype;
  m jsonb;
  v_ok boolean;
begin
  if me is null or not public.account_ok() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_state := public.grow_course_state(me, p_course);
  if v_state = 'hidden' then
    raise exception 'course not open' using errcode = 'P0001';
  end if;
  select * into c from public.courses where id = p_course;
  select value into m from jsonb_array_elements(coalesce(c.content->'modules', '[]')) where value->>'key' = p_module;
  if m is null then
    raise exception 'no such module' using errcode = 'P0001';
  end if;

  v_ok := coalesce(jsonb_typeof(m->'question'), 'null') <> 'object'
          or coalesce(p_answer = (m->'question'->>'answer'), false);
  if v_ok and v_state = 'new' then
    insert into public.course_progress (profile_id, course_id, modules_done, updated_at)
    values (me, p_course, array[p_module], now())
    on conflict (profile_id, course_id) do update
      set modules_done = array(select distinct x from unnest(public.course_progress.modules_done || array[p_module]) x),
          updated_at = now();
    perform public.course_settle(me, p_course);
  end if;
  return v_ok;
end;
$function$;

/* The exam. Returns {passed, completed, badge}. A failed attempt writes
   nothing. Passing with modules missing records the pass and earns
   nothing yet. */
create or replace function public.course_submit_exam(p_course uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  me uuid := auth.uid();
  v_state text;
  c public.courses%rowtype;
  v_passed boolean;
  v_done boolean := false;
  v_badge text;
begin
  if me is null or not public.account_ok() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_state := public.grow_course_state(me, p_course);
  if v_state = 'hidden' then
    raise exception 'course not open' using errcode = 'P0001';
  end if;
  select * into c from public.courses where id = p_course;
  if jsonb_array_length(coalesce(c.content->'exam', '[]')) = 0 then
    raise exception 'this course has no exam' using errcode = 'P0001';
  end if;

  select bool_and(coalesce(p_answers->>(q->>'key'), '') = q->>'answer') into v_passed
  from jsonb_array_elements(c.content->'exam') q;

  if v_state = 'past' then
    select badge_key into v_badge from public.course_progress where profile_id = me and course_id = p_course;
    return jsonb_build_object('passed', v_passed, 'completed', true, 'badge', public.grow_badge_json(v_badge));
  end if;

  if v_passed then
    insert into public.course_progress (profile_id, course_id, exam_passed_at, updated_at)
    values (me, p_course, now(), now())
    on conflict (profile_id, course_id) do update
      set exam_passed_at = coalesce(public.course_progress.exam_passed_at, now()),
          updated_at = now();
    v_done := public.course_settle(me, p_course);
  end if;

  select badge_key into v_badge from public.course_progress where profile_id = me and course_id = p_course;
  return jsonb_build_object('passed', v_passed, 'completed', v_done,
                            'badge', case when v_done then public.grow_badge_json(v_badge) end);
end;
$function$;

/* 0062's function, kept for any client still calling it: it now only
   reports whether the Saathban course is complete, settling first. */
create or replace function public.course_award(p_modules text[])
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_course uuid := (select id from public.courses where slug = 'saathban-course');
begin
  if auth.uid() is null or v_course is null then return false; end if;
  return public.course_settle(auth.uid(), v_course);
end;
$function$;

revoke all on function public.grow_audience_ok(text[], uuid) from public, anon, authenticated;
revoke all on function public.grow_badge_json(text) from public, anon, authenticated;
revoke all on function public.grow_course_state(uuid, uuid) from public, anon, authenticated;
revoke all on function public.grow_course_ref(text) from public, anon, authenticated;
revoke all on function public.course_settle(uuid, uuid) from public, anon, authenticated;
revoke all on function public.grow_options_ok(jsonb, text, boolean) from public, anon;
revoke all on function public.grow_course_content_ok(jsonb) from public, anon;

revoke all on function public.course_for_me(text) from public, anon;
revoke all on function public.course_answer_module(uuid, text, text) from public, anon;
revoke all on function public.course_submit_exam(uuid, jsonb) from public, anon;
revoke all on function public.course_award(text[]) from public, anon;
grant execute on function public.course_for_me(text) to authenticated;
grant execute on function public.course_answer_module(uuid, text, text) to authenticated;
grant execute on function public.course_submit_exam(uuid, jsonb) to authenticated;
grant execute on function public.course_award(text[]) to authenticated;
