/* ═══════════════════════════════════════════════════════════════
   0164 — Pending points at things; Grow is read in one request

   The owner: Pending is a drawer at the top of Grow with Saathban. The
   ADMIN decides what goes in it — a course, a programme, anything from
   the other sections — for everyone or for particular roles. A thing can
   be in Pending AND in its own section at the same time; completing it
   ANYWHERE removes it from Pending and moves it to Past.

   SO PENDING HOLDS NO STATE. A pending_items row is a pointer (to one
   course, one survey, or one of the three not-yet-open skills) plus an
   audience and an order. It has no "done" column, because a done column
   is a second record that could disagree with the first. Whether a
   pointer shows for a person is computed from the thing's own state:
     course  grow_course_state(person, course) = 'new'   (0161)
     survey  grow_survey_offered(person, survey)          (0163)
     skill   the person has not yet asked to be told when it opens
             (no skill_interest row)
   The same functions decide New/Past and the survey bar, so every place
   a thing is shown agrees by construction.

   One pointer per thing (partial unique indexes): the admin moves a
   pointer's audience or order, never keeps two.

   grow_page() returns everything the Grow page draws, for the caller:
     surveys       offered surveys (the slow drop-down bar)
     pending       pointers that apply to them, in the admin's order
     new_courses   courses in state 'new'
     past_courses  courses they completed, with the badge they earned
   ═══════════════════════════════════════════════════════════════ */

create table if not exists public.pending_items (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid references public.courses (id) on delete cascade,
  survey_id  uuid references public.surveys (id) on delete cascade,
  skill      text check (skill in ('languages', 'courses', 'earning')),
  audience   text[] not null default '{}'
             check (audience <@ array['saath_icon', 'saath_buddy', 'family_member', 'admin']),
  sort       int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint pending_items_points_at_one_thing check (num_nonnulls(course_id, survey_id, skill) = 1)
);

create unique index if not exists pending_items_one_per_course on public.pending_items (course_id) where course_id is not null;
create unique index if not exists pending_items_one_per_survey on public.pending_items (survey_id) where survey_id is not null;
create unique index if not exists pending_items_one_per_skill on public.pending_items (skill) where skill is not null;

alter table public.pending_items enable row level security;
revoke all on table public.pending_items from anon, authenticated;
grant select on table public.pending_items to authenticated;

drop policy if exists "admins read pending items" on public.pending_items;
create policy "admins read pending items"
  on public.pending_items for select
  using (public.is_admin());

create or replace function public.grow_page()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.account_ok() then return null; end if;

  return jsonb_build_object(
    'surveys', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'slug', s.slug,
               'title_en', s.title_en, 'title_ur', s.title_ur,
               'desc_en', s.desc_en, 'desc_ur', s.desc_ur,
               'started', exists (select 1 from public.survey_responses r
                                  where r.survey_id = s.id and r.profile_id = me))
             order by s.published_at nulls last, s.created_at)
      from public.surveys s
      where s.status in ('published', 'closing') and public.grow_survey_offered(me, s.id)), '[]'::jsonb),

    'pending', coalesce((
      select jsonb_agg(x.item order by x.sort, x.created_at)
      from (
        select p.sort, p.created_at,
               case
                 when p.course_id is not null then (
                   select jsonb_build_object('id', p.id, 'type', 'course', 'kind', c.kind, 'target', c.id, 'slug', c.slug,
                                             'title_en', c.title_en, 'title_ur', c.title_ur,
                                             'desc_en', c.desc_en, 'desc_ur', c.desc_ur)
                   from public.courses c where c.id = p.course_id)
                 when p.survey_id is not null then (
                   select jsonb_build_object('id', p.id, 'type', 'survey', 'target', s.id, 'slug', s.slug,
                                             'title_en', s.title_en, 'title_ur', s.title_ur,
                                             'desc_en', s.desc_en, 'desc_ur', s.desc_ur)
                   from public.surveys s where s.id = p.survey_id)
                 else jsonb_build_object('id', p.id, 'type', 'skill', 'skill', p.skill)
               end as item
        from public.pending_items p
        where public.grow_audience_ok(p.audience, me)
          and case
                when p.course_id is not null then public.grow_course_state(me, p.course_id) = 'new'
                when p.survey_id is not null then public.grow_survey_offered(me, p.survey_id)
                else not exists (select 1 from public.skill_interest i
                                 where i.profile_id = me and i.skill = p.skill)
              end
      ) x), '[]'::jsonb),

    'new_courses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'slug', c.slug, 'kind', c.kind, 'status', c.status,
               'title_en', c.title_en, 'title_ur', c.title_ur,
               'desc_en', c.desc_en, 'desc_ur', c.desc_ur,
               'badge', public.grow_badge_json(c.badge_key),
               'started', cp.profile_id is not null)
             order by c.sort, c.created_at)
      from public.courses c
      left join public.course_progress cp on cp.course_id = c.id and cp.profile_id = me
      where public.grow_course_state(me, c.id) = 'new'), '[]'::jsonb),

    'past_courses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'slug', c.slug, 'kind', c.kind,
               'title_en', c.title_en, 'title_ur', c.title_ur,
               'desc_en', c.desc_en, 'desc_ur', c.desc_ur,
               'badge', public.grow_badge_json(cp.badge_key),
               'completed_at', cp.completed_at)
             order by cp.completed_at desc)
      from public.course_progress cp
      join public.courses c on c.id = cp.course_id
      where cp.profile_id = me and cp.completed_at is not null), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.grow_page() from public, anon;
grant execute on function public.grow_page() to authenticated;
