-- ============================================================================
-- 0180 — The audit log viewer: opened on the record, read by rule.
--
-- admin_audit_open(p_person)
--   Writes ONE 'audit_log_opened' row and returns its id (the "opening").
--   Super-admin: scope 'everything'; support/moderator: scope 'own'.
--   When the viewer is opened from a person's page (super only), the person
--   is recorded on that same row — one row for one tap.
--   Super-admins also get the staff list for the "who" filter.
--
-- admin_audit_entries(p_opening, filters…, keyset…)
--   Refuses anyone who is not staff, and refuses to read without a fresh
--   opening belonging to the caller at the caller's CURRENT scope (12 hours;
--   an admin whose level changed must open it again). This is what makes
--   "opening is on the record" true at the database: there is no read
--   without an opening row.
--   Page turns and filter changes write nothing — except that a super-admin
--   narrowing to a specific person is a new sensitive view ("everything done
--   about this person" is a record of that person), so the first read of
--   each person within an opening writes one 'audit_log_person_viewed' row.
--   For support/moderator a person filter only narrows their own actions,
--   which they already see, so it writes nothing.
--   Support/moderator: actor is forced to the caller whatever is passed.
--
-- Names. The actor and the person come from profiles. A person whose account
-- was deleted keeps the name the deletion snapshot recorded
-- (delete_account / delete_test_account detail.full_name); an account that
-- exists without a profile is an unfinished sign-up; otherwise the person is
-- "an account that no longer exists" (state 'gone'). A row with no actor is
-- "the system".
-- ============================================================================

-- The person a filter or a row points at, named as well as the record allows.
create or replace function public.admin_audit_person(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when p_id is null then null else jsonb_build_object(
    'id', p_id,
    'name', coalesce(
      (select p.full_name from public.profiles p where p.id = p_id),
      (select d.detail->>'full_name' from public.audit_log d
        where d.action in ('delete_account', 'delete_test_account')
          and d.detail->>'profile_id' = p_id::text
        order by d.created_at desc limit 1)),
    'state', case
      when exists (select 1 from public.profiles p where p.id = p_id) then 'profile'
      when exists (select 1 from auth.users u where u.id = p_id) then 'signup'
      else 'gone' end
  ) end;
$$;
revoke all on function public.admin_audit_person(uuid) from public, anon, authenticated;

create or replace function public.admin_audit_open(p_person uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_super boolean := public.is_super_admin();
  v_scope text;
  v_person uuid;
  v_id bigint;
  v_staff jsonb := '[]'::jsonb;
begin
  if v_uid is null or not (v_super or public.is_admin() or public.is_moderator()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  v_scope := case when v_super then 'everything' else 'own' end;
  v_person := case when v_super then p_person end;

  insert into public.audit_log (actor_id, action, target_profile_id, reason, detail)
  values (v_uid, 'audit_log_opened', public.admin_audit_target(v_person), null,
          jsonb_strip_nulls(jsonb_build_object('scope', v_scope, 'profile_id', v_person)))
  returning id into v_id;

  if v_super then
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.full_name, 'level', s.admin_level)
                              order by lower(coalesce(s.full_name, '')), s.id), '[]'::jsonb)
      into v_staff
      from public.profiles s
     where s.role = 'admin'
        or s.id in (select distinct a.actor_id from public.audit_log a where a.actor_id is not null);
  end if;

  return jsonb_build_object(
    'opening', v_id,
    'scope', v_scope,
    'staff', v_staff,
    'person', public.admin_audit_person(v_person)
  );
end;
$$;
revoke all on function public.admin_audit_open(uuid) from public, anon;
grant execute on function public.admin_audit_open(uuid) to authenticated;

create or replace function public.admin_audit_entries(
  p_opening   bigint,
  p_actions   text[]      default null,
  p_actor     uuid        default null,
  p_person    uuid        default null,
  p_from      timestamptz default null,
  p_to        timestamptz default null,
  p_before_at timestamptz default null,
  p_before_id bigint      default null,
  p_limit     integer     default 30
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_super boolean := public.is_super_admin();
  v_scope text;
  v_open public.audit_log%rowtype;
  v_actor uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_rows jsonb;
  v_n integer;
begin
  if v_uid is null or not (v_super or public.is_admin() or public.is_moderator()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_scope := case when v_super then 'everything' else 'own' end;

  select * into v_open from public.audit_log
   where id = p_opening and actor_id = v_uid and action = 'audit_log_opened';
  if not found
     or v_open.created_at < now() - interval '12 hours'
     or (v_open.detail->>'scope') is distinct from v_scope then
    raise exception 'Open the audit log again' using errcode = 'P0001', hint = 'audit_opening';
  end if;

  v_actor := case when v_super then p_actor else v_uid end;

  if v_super and p_person is not null
     and (v_open.detail->>'profile_id') is distinct from p_person::text then
    perform pg_advisory_xact_lock(hashtextextended('audit_person:' || p_opening || ':' || p_person, 0));
    if not exists (
      select 1 from public.audit_log
       where actor_id = v_uid and action = 'audit_log_person_viewed'
         and detail->>'opening' = p_opening::text
         and detail->>'profile_id' = p_person::text
    ) then
      insert into public.audit_log (actor_id, action, target_profile_id, reason, detail)
      values (v_uid, 'audit_log_person_viewed', public.admin_audit_target(p_person), null,
              jsonb_build_object('opening', p_opening, 'profile_id', p_person));
    end if;
  end if;

  select coalesce(jsonb_agg(x.j order by x.created_at desc, x.id desc) filter (where x.rn <= v_limit), '[]'::jsonb),
         count(*)
    into v_rows, v_n
    from (
      select row_number() over (order by a.created_at desc, a.id desc) as rn,
             a.created_at, a.id,
             jsonb_build_object(
               'id', a.id,
               'at', a.created_at,
               'action', a.action,
               'reason', a.reason,
               'detail', a.detail,
               'actor', case when a.actor_id is null then null else jsonb_build_object(
                          'id', a.actor_id, 'name', ap.full_name, 'level', ap.admin_level) end,
               'person', public.admin_audit_person(
                          coalesce(a.target_profile_id,
                                   case when (a.detail->>'profile_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                        then (a.detail->>'profile_id')::uuid end)),
               'subject', jsonb_strip_nulls(jsonb_build_object(
                          'course_en', coalesce(c.title_en, case when a.detail ? 'course_id' then a.detail->>'title_en' end),
                          'course_ur', c.title_ur,
                          'survey_en', coalesce(s.title_en, case when a.detail ? 'survey_id' then a.detail->>'title_en' end),
                          'survey_ur', s.title_ur))
             ) as j
        from (
          select * from public.audit_log a
           where (v_actor is null or a.actor_id = v_actor)
             and (p_actions is null or cardinality(p_actions) = 0 or a.action = any (p_actions))
             and (p_person is null or a.target_profile_id = p_person or a.detail->>'profile_id' = p_person::text)
             and (p_from is null or a.created_at >= p_from)
             and (p_to is null or a.created_at < p_to)
             and (p_before_at is null
                  or (a.created_at, a.id) < (p_before_at, coalesce(p_before_id, 9223372036854775807)))
           order by a.created_at desc, a.id desc
           limit v_limit + 1
        ) a
        left join public.profiles ap on ap.id = a.actor_id
        left join public.courses c on c.id::text = a.detail->>'course_id'
        left join public.surveys s on s.id::text = a.detail->>'survey_id'
    ) x;

  return jsonb_build_object(
    'rows', v_rows,
    'more', v_n > v_limit,
    'scope', v_scope,
    'person', public.admin_audit_person(p_person)
  );
end;
$$;
revoke all on function public.admin_audit_entries(bigint, text[], uuid, uuid, timestamptz, timestamptz, timestamptz, bigint, integer) from public, anon;
grant execute on function public.admin_audit_entries(bigint, text[], uuid, uuid, timestamptz, timestamptz, timestamptz, bigint, integer) to authenticated;
