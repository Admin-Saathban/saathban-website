/* ═══════════════════════════════════════════════════════════════
   0150 — An admin can find a person

   The owner runs the app alone, and until now there was no screen that
   answered "who is this account?". Everything here is a SECURITY DEFINER
   function that checks the caller first and writes the audit log itself,
   so what the People screen can do is decided here, not in the browser.

     profiles.is_test        a flag, not a role. Protected like role and
                             admin_level (a person cannot mark themself).
     admin_list_people       every account (auth.users, so an unfinished
                             signup with no profile shows too); name/email
                             search server-side. Support or super.
                             Audited: admin_list_people {query, rows}.
     admin_person            one account: profile, sign-in, and COUNTS of
                             activity — never the content of a log, post
                             or message. Support or super.
                             Audited: admin_view_person.
     admin_set_role          super-admin only. The last active super-admin
                             can never be moved off super. Audited:
                             change_role {from_role, from_level, to_*}.
     admin_set_test          support or super. Audited: mark_test /
                             unmark_test.
     admin_record_signin_link support or super. Records the send BEFORE
                             the browser asks Supabase to email the link,
                             and hands back the address to send it to.
                             Audited: send_signin_link.

   Pausing is not new: the screen calls moderator_set_pause (0125).
   ═══════════════════════════════════════════════════════════════ */

alter table public.profiles add column if not exists is_test boolean not null default false;

create or replace function public.protect_profile_columns()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.id          is distinct from old.id
  or new.role        is distinct from old.role
  or new.tier        is distinct from old.tier
  or new.admin_level is distinct from old.admin_level
  or new.is_org      is distinct from old.is_org
  or new.is_paused   is distinct from old.is_paused
  or new.is_blocked  is distinct from old.is_blocked
  or new.is_test     is distinct from old.is_test
  then
    if auth.uid() is not null
       and not public.is_super_admin()
       and coalesce(current_setting('app.protected_profile_write', true), '') <> 'allow'
    then
      raise exception 'This field can only be changed by Saathban staff';
    end if;
  end if;
  return new;
end;
$function$;

/* A profile id is only a valid audit target while the profile exists
   (audit_log.target_profile_id references profiles). An auth account
   with no profile is recorded by id in the detail instead. */
create or replace function public.admin_audit_target(p_id uuid)
 returns uuid
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select id from public.profiles where id = p_id;
$function$;
revoke all on function public.admin_audit_target(uuid) from public, anon, authenticated;

create or replace function public.admin_list_people(p_query text default null, p_limit integer default 300)
 returns table (
   id uuid, full_name text, email text, role text, admin_level text,
   joined_at timestamptz, last_seen_at timestamptz, last_sign_in_at timestamptz,
   is_paused boolean, is_blocked boolean, is_test boolean, has_profile boolean
 )
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_q text := lower(nullif(btrim(coalesce(p_query, '')), ''));
  v_n integer;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
    select u.id, p.full_name, u.email::text, p.role::text, p.admin_level::text,
           coalesce(p.created_at, u.created_at), p.last_seen_at, u.last_sign_in_at,
           coalesce(p.is_paused, false), coalesce(p.is_blocked, false),
           coalesce(p.is_test, false), p.id is not null
      from auth.users u
      left join public.profiles p on p.id = u.id
     where v_q is null
        or strpos(lower(coalesce(p.full_name, '')), v_q) > 0
        or strpos(lower(coalesce(u.email::text, '')), v_q) > 0
     order by coalesce(p.created_at, u.created_at) desc
     limit least(greatest(coalesce(p_limit, 300), 1), 1000);
  get diagnostics v_n = row_count;

  perform public.write_audit('admin_list_people', null, null,
    jsonb_build_object('query', v_q, 'rows', v_n));
end;
$function$;

create or replace function public.admin_person(p_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_u auth.users%rowtype;
  v_p public.profiles%rowtype;
  v_has boolean;
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_u from auth.users where id = p_id;
  if not found then
    raise exception 'No such account';
  end if;
  select * into v_p from public.profiles where id = p_id;
  v_has := found;

  v_out := jsonb_build_object(
    'id', v_u.id,
    'email', v_u.email,
    'account_created_at', v_u.created_at,
    'email_confirmed_at', v_u.email_confirmed_at,
    'last_sign_in_at', v_u.last_sign_in_at,
    'has_profile', v_has,
    'full_name', v_p.full_name,
    'role', v_p.role,
    'admin_level', v_p.admin_level,
    'tier', v_p.tier,
    'city', v_p.city,
    'country', v_p.country,
    'timezone', v_p.timezone,
    'preferred_language', v_p.preferred_language,
    'created_at', v_p.created_at,
    'last_seen_at', v_p.last_seen_at,
    'is_paused', coalesce(v_p.is_paused, false),
    'is_blocked', coalesce(v_p.is_blocked, false),
    'is_test', coalesce(v_p.is_test, false),
    'active_super_admins', (select count(*) from public.profiles
                             where role = 'admin' and admin_level = 'super'
                               and not is_paused and not is_blocked),
    'activity', jsonb_build_object(
      'days_logged',       (select count(*) from public.logged_days where profile_id = p_id),
      'last_logged_day',   (select max(day) from public.logged_days where profile_id = p_id),
      'last_log_at',       (select max(updated_at) from public.daily_logs where icon_id = p_id),
      'posts',             (select count(*) from public.community_posts where author_id = p_id),
      'comments',          (select count(*) from public.post_comments where author_id = p_id),
      'group_posts',       (select count(*) from public.group_posts where author_id = p_id),
      'group_memberships', (select count(*) from public.group_members where member_id = p_id),
      'streaks',           (select count(*) from public.streaks where owner_id = p_id and archived_at is null),
      'circle_members',    (select count(*) from public.circle_members where icon_id = p_id),
      'circles_joined',    (select count(*) from public.circle_members where member_id = p_id),
      'reports_about',     (select count(*) from public.community_reports where target_author_id = p_id),
      'reports_open_about',(select count(*) from public.community_reports where target_author_id = p_id and status = 'open'),
      'reports_by',        (select count(*) from public.community_reports where reporter_id = p_id)
    )
  );

  perform public.write_audit('admin_view_person', case when v_has then p_id end, null,
    jsonb_build_object('profile_id', p_id));
  return v_out;
end;
$function$;

create or replace function public.admin_set_role(p_id uuid, p_role text, p_level text, p_reason text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old_role public.user_role;
  v_old_level public.admin_level;
  v_role public.user_role;
  v_level public.admin_level;
begin
  if not public.is_super_admin() then
    raise exception 'Only a super-admin can change a role' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 5 then
    raise exception 'A reason is required';
  end if;
  select role, admin_level into v_old_role, v_old_level from public.profiles where id = p_id;
  if not found then
    raise exception 'No such account';
  end if;

  v_role := p_role::public.user_role;
  v_level := case when v_role = 'admin' then coalesce(nullif(p_level, ''), 'support')::public.admin_level end;

  if v_old_role = v_role and v_old_level is not distinct from v_level then
    return;
  end if;

  if v_old_role = 'admin' and v_old_level = 'super'
     and not (v_role = 'admin' and v_level = 'super')
     and not exists (select 1 from public.profiles
                      where role = 'admin' and admin_level = 'super' and id <> p_id
                        and not is_paused and not is_blocked) then
    raise exception 'This is the last super-admin. Make someone else a super-admin first.';
  end if;

  perform set_config('app.protected_profile_write', 'allow', true);
  update public.profiles set role = v_role, admin_level = v_level where id = p_id;
  perform set_config('app.protected_profile_write', '', true);

  perform public.write_audit('change_role', p_id, p_reason,
    jsonb_build_object('from_role', v_old_role, 'from_level', v_old_level,
                       'to_role', v_role, 'to_level', v_level));
end;
$function$;

create or replace function public.admin_set_test(p_id uuid, p_is_test boolean, p_reason text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 3 then
    raise exception 'A reason is required';
  end if;
  perform set_config('app.protected_profile_write', 'allow', true);
  update public.profiles set is_test = p_is_test where id = p_id;
  if not found then
    raise exception 'No such account';
  end if;
  perform set_config('app.protected_profile_write', '', true);
  perform public.write_audit(case when p_is_test then 'mark_test' else 'unmark_test' end,
    p_id, p_reason);
end;
$function$;

create or replace function public.admin_record_signin_link(p_id uuid, p_reason text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select email into v_email from auth.users where id = p_id;
  if v_email is null then
    raise exception 'No such account';
  end if;
  perform public.write_audit('send_signin_link', public.admin_audit_target(p_id),
    nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object('profile_id', p_id, 'email', v_email));
  return v_email;
end;
$function$;

revoke all on function public.admin_list_people(text, integer) from public, anon;
revoke all on function public.admin_person(uuid) from public, anon;
revoke all on function public.admin_set_role(uuid, text, text, text) from public, anon;
revoke all on function public.admin_set_test(uuid, boolean, text) from public, anon;
revoke all on function public.admin_record_signin_link(uuid, text) from public, anon;
grant execute on function public.admin_list_people(text, integer) to authenticated;
grant execute on function public.admin_person(uuid) to authenticated;
grant execute on function public.admin_set_role(uuid, text, text, text) to authenticated;
grant execute on function public.admin_set_test(uuid, boolean, text) to authenticated;
grant execute on function public.admin_record_signin_link(uuid, text) to authenticated;
