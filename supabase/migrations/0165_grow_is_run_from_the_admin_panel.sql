/* ═══════════════════════════════════════════════════════════════
   0165 — Grow is run from the admin panel (/app/skills/admin)

   Every write an admin makes to courses, surveys and Pending goes
   through a function here. Each one checks public.is_admin() (support
   or super; a moderator is refused, as for events and broadcasts, §18)
   and writes public.write_audit(action, target, reason, detail), which
   records who and when. No client can write these tables directly
   (0160, 0162, 0164 revoke it).

   WHO MAY CALL WHAT
     admin_grow_overview()                 is_admin  counts only, not audited
     admin_save_course(id, fields)         is_admin  audited (badge from → to)
     admin_set_course_status(id, status)   is_admin  audited
     admin_save_survey(id, fields)         is_admin  audited
     admin_set_survey_status(id, status)   is_admin  audited
     admin_pending_add / _update /
       _remove / _reorder                  is_admin  audited
     admin_survey_people(survey)           is_admin  audited READ — names
                                                     with dismissal counts
                                                     and part-way flags,
                                                     never answers
     admin_reoffer_survey(survey, person)  is_admin  audited
   Survey ANSWERS stay super-admin only (§16, §18): 0166.

   BADGES. A course awards a credential badge (badges.family =
   'credential') or none. A new course defaults to 'course-finished', a
   new programme to 'programme-finished'; the admin can change it. The
   change is audited with the badge it replaced and affects completions
   from then on only (0161).

   UNPUBLISHING — THE TWO MODES, AND EXACTLY WHAT HAPPENS
     'closed'  "Remove it now"
       Course: gone from New and Pending for everyone at once, and can no
         longer be opened. Part-way progress rows are KEPT, untouched —
         nothing is deleted — so publishing it again resumes each person
         where they were. Completed courses stay in Past with the badge.
       Survey: gone from the bar and Pending, can no longer be opened or
         answered. Part-way answers are KEPT as part-way responses and
         still appear in results (counted as part-way, never as
         submitted); the person can still withdraw them. Submitted
         responses are untouched.
     'closing' "Let people part-way finish"
       Course: nobody new can start (hidden from anyone with no progress
         row); people with progress still see it in New and can finish,
         and completion moves it to Past with its badge as usual.
       Survey: nobody new can start; people with part-way answers can
         open it and finish. It is no longer put in front of anyone
         unless an admin re-offers it to a part-way person.
     'published' again from either: offered as before.
   A course or survey is never deleted from here: progress, answers and
   earned badges point at it.

   STRUCTURE IS LOCKED ONCE ANSWERED. After anyone has answered a survey,
   admin_save_survey refuses to change its question keys, types, option
   keys or their order; wording in either language can still be fixed.
   Otherwise an edit would silently change what past answers meant.

   §16's research survey stays Icons only: its audience cannot be widened.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.grow_require_admin()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$function$;

create or replace function public.grow_text_array(p jsonb)
returns text[]
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select case when p is null or jsonb_typeof(p) <> 'array' then '{}'::text[]
              else array(select distinct jsonb_array_elements_text(p)) end;
$function$;

/* The shape past answers depend on: question keys, types, option keys, in order. */
create or replace function public.grow_survey_shape(p jsonb)
returns jsonb
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'k', q->>'key', 't', q->>'type',
           'o', coalesce((select jsonb_agg(o->>'key' order by oo)
                          from jsonb_array_elements(case when jsonb_typeof(q->'options') = 'array'
                                                         then q->'options' else '[]'::jsonb end)
                               with ordinality x(o, oo)), '[]'::jsonb))
         order by qo), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
       with ordinality y(q, qo);
$function$;

create or replace function public.admin_grow_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'level', (select admin_level::text from public.profiles where id = auth.uid()),
    'badges', coalesce((select jsonb_agg(public.grow_badge_json(b.key) order by b.sort)
                        from public.badges b where b.family = 'credential'), '[]'::jsonb),
    'courses', coalesce((
      select jsonb_agg(to_jsonb(c) || jsonb_build_object(
               'part_way', (select count(*) from public.course_progress cp where cp.course_id = c.id and cp.completed_at is null),
               'completed', (select count(*) from public.course_progress cp where cp.course_id = c.id and cp.completed_at is not null),
               'pending_id', (select p.id from public.pending_items p where p.course_id = c.id))
             order by c.sort, c.created_at)
      from public.courses c), '[]'::jsonb),
    'surveys', coalesce((
      select jsonb_agg(to_jsonb(s) || jsonb_build_object(
               'submitted', (select count(*) from public.survey_responses r where r.survey_id = s.id and r.submitted_at is not null),
               'part_way', (select count(*) from public.survey_responses r where r.survey_id = s.id and r.submitted_at is null),
               'dismissed_people', (select count(*) from public.survey_dismissals d where d.survey_id = s.id and d.dismiss_count > 0),
               'has_answers', exists (select 1 from public.survey_responses r where r.survey_id = s.id),
               'pending_id', (select p.id from public.pending_items p where p.survey_id = s.id))
             order by s.created_at desc)
      from public.surveys s), '[]'::jsonb),
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'course_id', p.course_id, 'survey_id', p.survey_id, 'skill', p.skill,
               'audience', to_jsonb(p.audience), 'sort', p.sort,
               'kind', c.kind,
               'title_en', coalesce(c.title_en, s.title_en), 'title_ur', coalesce(c.title_ur, s.title_ur),
               'status', coalesce(c.status, s.status))
             order by p.sort, p.created_at)
      from public.pending_items p
      left join public.courses c on c.id = p.course_id
      left join public.surveys s on s.id = p.survey_id), '[]'::jsonb)
  );
end;
$function$;

/* ── Courses ── */
create or replace function public.admin_save_course(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old public.courses%rowtype;
  v_id uuid;
  v_kind text;
  v_badge text;
begin
  perform public.grow_require_admin();
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'nothing to save' using errcode = 'P0001';
  end if;
  if p_id is not null then
    select * into v_old from public.courses where id = p_id for update;
    if v_old.id is null then
      raise exception 'no such course' using errcode = 'P0002';
    end if;
  end if;

  v_kind := coalesce(p->>'kind', v_old.kind, 'course');
  if p ? 'badge_key' then
    v_badge := nullif(p->>'badge_key', '');
  elsif p_id is null then
    v_badge := case when v_kind = 'programme' then 'programme-finished' else 'course-finished' end;
  else
    v_badge := v_old.badge_key;
  end if;
  if v_badge is not null and not exists (select 1 from public.badges where key = v_badge and family = 'credential') then
    raise exception 'a course awards a credential badge, or none' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.courses (kind, title_en, title_ur, desc_en, desc_ur, content, badge_key, audience, sort, created_by)
    values (
      v_kind,
      coalesce(p->>'title_en', ''), coalesce(p->>'title_ur', ''),
      coalesce(p->>'desc_en', ''), coalesce(p->>'desc_ur', ''),
      coalesce(p->'content', '{"modules": [], "exam": []}'::jsonb),
      v_badge,
      public.grow_text_array(p->'audience'),
      coalesce((p->>'sort')::int, 100),
      auth.uid()
    )
    returning id into v_id;
    perform public.write_audit('grow_course_created', null, null,
      jsonb_build_object('course_id', v_id, 'title_en', p->>'title_en', 'kind', v_kind, 'badge_key', v_badge));
  else
    update public.courses set
      kind     = v_kind,
      title_en = case when p ? 'title_en' then coalesce(p->>'title_en', '') else title_en end,
      title_ur = case when p ? 'title_ur' then coalesce(p->>'title_ur', '') else title_ur end,
      desc_en  = case when p ? 'desc_en'  then coalesce(p->>'desc_en', '')  else desc_en  end,
      desc_ur  = case when p ? 'desc_ur'  then coalesce(p->>'desc_ur', '')  else desc_ur  end,
      content  = case when p ? 'content'  then p->'content' else content end,
      badge_key = v_badge,
      audience = case when p ? 'audience' then public.grow_text_array(p->'audience') else audience end,
      sort     = case when p ? 'sort' then (p->>'sort')::int else sort end,
      updated_at = now()
    where id = p_id;
    v_id := p_id;
    perform public.write_audit('grow_course_updated', null, null,
      jsonb_build_object('course_id', v_id,
                         'fields', (select jsonb_agg(k) from jsonb_object_keys(p) k),
                         'badge_from', v_old.badge_key, 'badge_to', v_badge));
  end if;
  return v_id;
end;
$function$;

create or replace function public.admin_set_course_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old public.courses%rowtype;
  v_part_way int;
begin
  perform public.grow_require_admin();
  if p_status not in ('published', 'closing', 'closed') then
    raise exception 'status must be published, closing or closed' using errcode = 'P0001';
  end if;
  select * into v_old from public.courses where id = p_id for update;
  if v_old.id is null then
    raise exception 'no such course' using errcode = 'P0002';
  end if;
  update public.courses
  set status = p_status,
      published_at = case when p_status = 'published' then now() else published_at end,
      closed_at = case when p_status = 'published' then null else now() end,
      updated_at = now()
  where id = p_id;
  select count(*) into v_part_way from public.course_progress where course_id = p_id and completed_at is null;
  perform public.write_audit(
    case when p_status = 'published' then 'grow_course_published' else 'grow_course_unpublished' end,
    null, null,
    jsonb_build_object('course_id', p_id, 'from', v_old.status, 'to', p_status,
                       'mode', case p_status when 'closed' then 'remove_now' when 'closing' then 'let_part_way_finish' end,
                       'part_way_people', v_part_way));
end;
$function$;

/* ── Surveys ── */
create or replace function public.admin_save_survey(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old public.surveys%rowtype;
  v_id uuid;
  v_audience text[];
begin
  perform public.grow_require_admin();
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'nothing to save' using errcode = 'P0001';
  end if;
  if p ? 'questions' and jsonb_typeof(p->'questions') <> 'array' then
    raise exception 'questions must be a list' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.surveys (title_en, title_ur, desc_en, desc_ur, consent_en, consent_ur, questions, audience, created_by)
    values (
      coalesce(p->>'title_en', ''), coalesce(p->>'title_ur', ''),
      coalesce(p->>'desc_en', ''), coalesce(p->>'desc_ur', ''),
      coalesce(p->>'consent_en', ''), coalesce(p->>'consent_ur', ''),
      coalesce(p->'questions', '[]'::jsonb),
      public.grow_text_array(p->'audience'),
      auth.uid()
    )
    returning id into v_id;
    perform public.write_audit('grow_survey_created', null, null,
      jsonb_build_object('survey_id', v_id, 'title_en', p->>'title_en'));
    return v_id;
  end if;

  select * into v_old from public.surveys where id = p_id for update;
  if v_old.id is null then
    raise exception 'no such survey' using errcode = 'P0002';
  end if;

  if p ? 'questions'
     and exists (select 1 from public.survey_responses where survey_id = p_id)
     and public.grow_survey_shape(p->'questions') is distinct from public.grow_survey_shape(v_old.questions) then
    raise exception 'questions are locked once people have answered'
      using errcode = 'P0001',
            hint = 'Wording can change in either language; question keys, types, options and their order cannot.';
  end if;

  v_audience := case when p ? 'audience' then public.grow_text_array(p->'audience') else v_old.audience end;
  if v_old.slug = 'research' and v_audience is distinct from array['saath_icon'] then
    raise exception 'the research survey is for Icons only' using errcode = 'P0001';
  end if;

  update public.surveys set
    title_en   = case when p ? 'title_en'   then coalesce(p->>'title_en', '')   else title_en end,
    title_ur   = case when p ? 'title_ur'   then coalesce(p->>'title_ur', '')   else title_ur end,
    desc_en    = case when p ? 'desc_en'    then coalesce(p->>'desc_en', '')    else desc_en end,
    desc_ur    = case when p ? 'desc_ur'    then coalesce(p->>'desc_ur', '')    else desc_ur end,
    consent_en = case when p ? 'consent_en' then coalesce(p->>'consent_en', '') else consent_en end,
    consent_ur = case when p ? 'consent_ur' then coalesce(p->>'consent_ur', '') else consent_ur end,
    questions  = case when p ? 'questions'  then p->'questions' else questions end,
    audience   = v_audience,
    updated_at = now()
  where id = p_id;
  perform public.write_audit('grow_survey_updated', null, null,
    jsonb_build_object('survey_id', p_id, 'fields', (select jsonb_agg(k) from jsonb_object_keys(p) k)));
  return p_id;
end;
$function$;

create or replace function public.admin_set_survey_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old public.surveys%rowtype;
  v_part_way int;
begin
  perform public.grow_require_admin();
  if p_status not in ('published', 'closing', 'closed') then
    raise exception 'status must be published, closing or closed' using errcode = 'P0001';
  end if;
  select * into v_old from public.surveys where id = p_id for update;
  if v_old.id is null then
    raise exception 'no such survey' using errcode = 'P0002';
  end if;
  update public.surveys
  set status = p_status,
      published_at = case when p_status = 'published' then now() else published_at end,
      closed_at = case when p_status = 'published' then null else now() end,
      updated_at = now()
  where id = p_id;
  select count(*) into v_part_way from public.survey_responses where survey_id = p_id and submitted_at is null;
  perform public.write_audit(
    case when p_status = 'published' then 'grow_survey_published' else 'grow_survey_unpublished' end,
    null, null,
    jsonb_build_object('survey_id', p_id, 'from', v_old.status, 'to', p_status,
                       'mode', case p_status when 'closed' then 'remove_now' when 'closing' then 'let_part_way_finish' end,
                       'part_way_people', v_part_way));
end;
$function$;

create or replace function public.admin_survey_people(p_survey uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v jsonb;
begin
  perform public.grow_require_admin();
  if not exists (select 1 from public.surveys where id = p_survey) then
    raise exception 'no such survey' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'profile_id', x.pid,
           'full_name', pr.full_name,
           'role', pr.role,
           'dismiss_count', coalesce(d.dismiss_count, 0),
           'last_dismissed_at', d.last_dismissed_at,
           'last_kind', d.last_kind,
           'reoffered_at', d.reoffered_at,
           'part_way', r.id is not null and r.submitted_at is null,
           'offered_now', public.grow_survey_offered(x.pid, p_survey))
         order by coalesce(d.dismiss_count, 0) desc, pr.full_name), '[]'::jsonb)
  into v
  from (
    select profile_id as pid from public.survey_dismissals where survey_id = p_survey
    union
    select profile_id from public.survey_responses where survey_id = p_survey and submitted_at is null
  ) x
  join public.profiles pr on pr.id = x.pid
  left join public.survey_dismissals d on d.survey_id = p_survey and d.profile_id = x.pid
  left join public.survey_responses r on r.survey_id = p_survey and r.profile_id = x.pid;

  perform public.write_audit('grow_survey_people_read', null, null,
    jsonb_build_object('survey_id', p_survey, 'people', jsonb_array_length(v)));
  return v;
end;
$function$;

create or replace function public.admin_reoffer_survey(p_survey uuid, p_profile uuid default null)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status text;
  v_n int;
begin
  perform public.grow_require_admin();
  select status into v_status from public.surveys where id = p_survey;
  if v_status is null then
    raise exception 'no such survey' using errcode = 'P0002';
  end if;
  if v_status not in ('published', 'closing') then
    raise exception 'publish the survey before re-offering it' using errcode = 'P0001';
  end if;

  if p_profile is null then
    update public.survey_dismissals
    set reoffered_at = clock_timestamp(), reoffered_by = auth.uid()
    where survey_id = p_survey
      and last_dismissed_at is not null
      and (reoffered_at is null or reoffered_at <= last_dismissed_at);
    get diagnostics v_n = row_count;
  else
    if not exists (select 1 from public.survey_dismissals where survey_id = p_survey and profile_id = p_profile and last_dismissed_at is not null)
       and not exists (select 1 from public.survey_responses where survey_id = p_survey and profile_id = p_profile and submitted_at is null) then
      raise exception 'this person has not dismissed or left this survey' using errcode = 'P0001';
    end if;
    insert into public.survey_dismissals (survey_id, profile_id, reoffered_at, reoffered_by)
    values (p_survey, p_profile, clock_timestamp(), auth.uid())
    on conflict (survey_id, profile_id) do update
      set reoffered_at = clock_timestamp(), reoffered_by = auth.uid();
    v_n := 1;
  end if;

  perform public.write_audit('grow_survey_reoffered', p_profile, null,
    jsonb_build_object('survey_id', p_survey, 'people', v_n,
                       'to', case when p_profile is null then 'everyone_who_dismissed' else 'one_person' end));
  return v_n;
end;
$function$;

/* ── Pending ── */
create or replace function public.admin_pending_add(p_course uuid, p_survey uuid, p_skill text, p_audience text[] default '{}')
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
begin
  perform public.grow_require_admin();
  begin
    insert into public.pending_items (course_id, survey_id, skill, audience, sort, created_by)
    values (p_course, p_survey, nullif(p_skill, ''), coalesce(p_audience, '{}'),
            coalesce((select max(sort) from public.pending_items), 0) + 1, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'already in Pending' using errcode = 'P0001';
  end;
  perform public.write_audit('grow_pending_added', null, null,
    jsonb_build_object('pending_id', v_id, 'course_id', p_course, 'survey_id', p_survey,
                       'skill', p_skill, 'audience', to_jsonb(coalesce(p_audience, '{}'))));
  return v_id;
end;
$function$;

create or replace function public.admin_pending_update(p_id uuid, p_audience text[])
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform public.grow_require_admin();
  update public.pending_items set audience = coalesce(p_audience, '{}') where id = p_id;
  if not found then
    raise exception 'no such pending item' using errcode = 'P0002';
  end if;
  perform public.write_audit('grow_pending_updated', null, null,
    jsonb_build_object('pending_id', p_id, 'audience', to_jsonb(coalesce(p_audience, '{}'))));
end;
$function$;

create or replace function public.admin_pending_remove(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v public.pending_items%rowtype;
begin
  perform public.grow_require_admin();
  delete from public.pending_items where id = p_id returning * into v;
  if v.id is null then
    raise exception 'no such pending item' using errcode = 'P0002';
  end if;
  perform public.write_audit('grow_pending_removed', null, null,
    jsonb_build_object('pending_id', p_id, 'course_id', v.course_id, 'survey_id', v.survey_id, 'skill', v.skill));
end;
$function$;

create or replace function public.admin_pending_reorder(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform public.grow_require_admin();
  update public.pending_items p
  set sort = x.ord
  from unnest(p_ids) with ordinality x(id, ord)
  where p.id = x.id;
  perform public.write_audit('grow_pending_reordered', null, null,
    jsonb_build_object('order', to_jsonb(p_ids)));
end;
$function$;

revoke all on function public.grow_require_admin() from public, anon, authenticated;
revoke all on function public.grow_text_array(jsonb) from public, anon, authenticated;
revoke all on function public.grow_survey_shape(jsonb) from public, anon, authenticated;

revoke all on function public.admin_grow_overview() from public, anon;
revoke all on function public.admin_save_course(uuid, jsonb) from public, anon;
revoke all on function public.admin_set_course_status(uuid, text) from public, anon;
revoke all on function public.admin_save_survey(uuid, jsonb) from public, anon;
revoke all on function public.admin_set_survey_status(uuid, text) from public, anon;
revoke all on function public.admin_survey_people(uuid) from public, anon;
revoke all on function public.admin_reoffer_survey(uuid, uuid) from public, anon;
revoke all on function public.admin_pending_add(uuid, uuid, text, text[]) from public, anon;
revoke all on function public.admin_pending_update(uuid, text[]) from public, anon;
revoke all on function public.admin_pending_remove(uuid) from public, anon;
revoke all on function public.admin_pending_reorder(uuid[]) from public, anon;

grant execute on function public.admin_grow_overview() to authenticated;
grant execute on function public.admin_save_course(uuid, jsonb) to authenticated;
grant execute on function public.admin_set_course_status(uuid, text) to authenticated;
grant execute on function public.admin_save_survey(uuid, jsonb) to authenticated;
grant execute on function public.admin_set_survey_status(uuid, text) to authenticated;
grant execute on function public.admin_survey_people(uuid) to authenticated;
grant execute on function public.admin_reoffer_survey(uuid, uuid) to authenticated;
grant execute on function public.admin_pending_add(uuid, uuid, text, text[]) to authenticated;
grant execute on function public.admin_pending_update(uuid, text[]) to authenticated;
grant execute on function public.admin_pending_remove(uuid) to authenticated;
grant execute on function public.admin_pending_reorder(uuid[]) to authenticated;
