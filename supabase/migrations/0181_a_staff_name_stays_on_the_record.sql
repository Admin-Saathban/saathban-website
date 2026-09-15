-- ============================================================================
-- 0181 — A staff member's name stays on their audit rows.
--
-- audit_log.actor_id is "on delete set null", so before this a deleted staff
-- account's actions read as "the system". Now every row carries a snapshot
-- of who acted, taken when the row is written:
--
--   actor_name   text  the actor's profiles.full_name at the time
--                      ('' = the profile existed but had no name;
--                       null = no actor, or an actor with no profile)
--   actor_level  text  'support' | 'super' | 'moderator' at the time,
--                      null when the actor was not an admin
--
-- COLUMNS, NOT A KEY IN detail. write_audit callers control p_detail, so a
-- reserved key there could be forged or collide; they cannot reach these
-- columns. The BEFORE INSERT trigger is the only source: it overwrites
-- whatever an insert supplies, including from SECURITY DEFINER functions
-- that insert directly. Clients still have no insert/update/delete (0003,
-- 0179), and the trigger is BEFORE INSERT only — no update path exists.
--
-- BACKFILL. Existing rows get the actor's CURRENT name and level (the only
-- record there is); rows whose actor is already gone stay null and read as
-- "the system". This is the one UPDATE ever run over audit_log, in this
-- migration, touching only the two new columns.
--
-- admin_audit_entries (0180) now names the actor from the profile when it
-- exists, else from the snapshot, and marks the latter gone; the level shown
-- is the level AT THE TIME. Only a row with neither actor_id nor a snapshot
-- is "the system". Otherwise identical to 0180.
-- ============================================================================

alter table public.audit_log
  add column if not exists actor_name text,
  add column if not exists actor_level text;

create or replace function public.audit_log_stamp_actor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.actor_name := null;
  new.actor_level := null;
  if new.actor_id is not null then
    select coalesce(nullif(btrim(p.full_name), ''), ''),
           case when p.role = 'admin' then coalesce(p.admin_level::text, 'support') end
      into new.actor_name, new.actor_level
      from public.profiles p
     where p.id = new.actor_id;
  end if;
  return new;
end;
$$;
revoke all on function public.audit_log_stamp_actor() from public, anon, authenticated;

drop trigger if exists audit_log_stamp_actor on public.audit_log;
create trigger audit_log_stamp_actor
  before insert on public.audit_log
  for each row execute function public.audit_log_stamp_actor();

update public.audit_log a
   set actor_name = coalesce(nullif(btrim(p.full_name), ''), ''),
       actor_level = case when p.role = 'admin' then coalesce(p.admin_level::text, 'support') end
  from public.profiles p
 where p.id = a.actor_id
   and a.actor_name is null;

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
               'actor', case when a.actor_id is null and a.actor_name is null then null else jsonb_build_object(
                          'id', a.actor_id,
                          'name', coalesce(ap.full_name, nullif(a.actor_name, '')),
                          'level', coalesce(a.actor_level, ap.admin_level::text),
                          'gone', a.actor_id is null) end,
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
