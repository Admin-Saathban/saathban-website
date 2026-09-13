/* ═══════════════════════════════════════════════════════════════
   0166 — survey results are read on the record

   The owner: a screen showing each survey's responses — per-question
   counts for choices, full text for written answers, submitted vs
   part-way counts, and a CSV export generated in the browser.

   SUPER ADMIN ONLY, as 0054 had it. §16: "survey answers are
   super-admin-only … never visible to Fam, Buddies, moderators or
   ordinary admins", and §18 lists survey answers among what only a
   super admin does. A newly built survey is no less personal than the
   research one — people answer written questions in their own words —
   so the rule is kept for every survey rather than relaxed for new ones.
   Support admins build, publish and re-offer surveys (0165); they never
   read what anyone said.

   EVERY READ IS AUDITED. survey_results() writes 'survey_results_read'
   before it returns anything; the browser's CSV export calls
   survey_results_exported() so the download is on the record too. The
   export is built in the browser from the same payload — nothing is
   written to storage.

   NO NAMES. Rows carry a response status and the day (Pakistan time),
   never the person's name or id, and are ordered by the response's
   random id rather than by time, so the table cannot be lined up
   against anything else. Reading one person's answers is not what a
   results screen is for (0054: "reading an individual's answers should
   require deliberately selecting the row").

   Written answers are returned in full, each marked submitted or
   part-way. Part-way answers are counted separately from submitted ones
   everywhere, never merged.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.survey_results(p_survey uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s public.surveys%rowtype;
begin
  if not public.is_super_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into s from public.surveys where id = p_survey;
  if s.id is null then
    raise exception 'no such survey' using errcode = 'P0002';
  end if;

  perform public.write_audit('survey_results_read', null, null, jsonb_build_object('survey_id', p_survey));

  return jsonb_build_object(
    'survey', jsonb_build_object('id', s.id, 'slug', s.slug, 'status', s.status,
                                 'title_en', s.title_en, 'title_ur', s.title_ur,
                                 'questions', s.questions),
    'submitted', (select count(*) from public.survey_responses r where r.survey_id = p_survey and r.submitted_at is not null),
    'part_way', (select count(*) from public.survey_responses r where r.survey_id = p_survey and r.submitted_at is null),
    'dismissed_people', (select count(*) from public.survey_dismissals d where d.survey_id = p_survey and d.dismiss_count > 0),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', q->>'key', 'type', q->>'type',
               'answered', jsonb_build_object(
                  'submitted', (select count(*) from public.survey_responses r
                                where r.survey_id = p_survey and r.submitted_at is not null and r.answers ? (q->>'key')),
                  'part_way', (select count(*) from public.survey_responses r
                               where r.survey_id = p_survey and r.submitted_at is null and r.answers ? (q->>'key'))),
               'counts', case when q->>'type' in ('single', 'multi') then (
                  select coalesce(jsonb_object_agg(o->>'key', jsonb_build_object(
                           'submitted', (select count(*) from public.survey_responses r
                                         where r.survey_id = p_survey and r.submitted_at is not null
                                           and coalesce(r.answers->(q->>'key') ? (o->>'key'), false)),
                           'part_way', (select count(*) from public.survey_responses r
                                        where r.survey_id = p_survey and r.submitted_at is null
                                          and coalesce(r.answers->(q->>'key') ? (o->>'key'), false)))), '{}'::jsonb)
                  from jsonb_array_elements(q->'options') o) end,
               'texts', case when q->>'type' = 'text' then (
                  select coalesce(jsonb_agg(jsonb_build_object(
                           'text', r.answers->>(q->>'key'),
                           'status', case when r.submitted_at is not null then 'submitted' else 'part_way' end)
                         order by r.id), '[]'::jsonb)
                  from public.survey_responses r
                  where r.survey_id = p_survey and coalesce(r.answers->>(q->>'key'), '') <> '') end)
             order by qo)
      from jsonb_array_elements(s.questions) with ordinality x(q, qo)), '[]'::jsonb),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'status', case when r.submitted_at is not null then 'submitted' else 'part_way' end,
               'day', to_char(coalesce(r.submitted_at, r.updated_at) at time zone 'Asia/Karachi', 'YYYY-MM-DD'),
               'answers', r.answers)
             order by r.id)
      from public.survey_responses r where r.survey_id = p_survey), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.survey_results_exported(p_survey uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_super_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform public.write_audit('survey_results_exported', null, null, jsonb_build_object('survey_id', p_survey));
end;
$function$;

revoke all on function public.survey_results(uuid) from public, anon;
revoke all on function public.survey_results_exported(uuid) from public, anon;
grant execute on function public.survey_results(uuid) to authenticated;
grant execute on function public.survey_results_exported(uuid) to authenticated;
