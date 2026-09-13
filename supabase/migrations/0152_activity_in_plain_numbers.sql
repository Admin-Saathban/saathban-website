/* ═══════════════════════════════════════════════════════════════
   0152 — Activity in plain numbers

   admin_activity(p_include_test) — support or super. Counts only, no
   names and no content, so it is not audited.

   Weeks and months for SIGNUPS are Pakistan time (Asia/Karachi), weeks
   starting Monday. LOGGING is counted by each person's own local day:
   logged_days.day is already the day on the person's calendar, and
   "today / this week / this month" is worked out in their timezone
   (profiles.timezone, falling back to Asia/Karachi).
   "Active" = last seen in the app or last signed in, whichever is later.
   Test accounts are left out unless p_include_test is true.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.admin_activity(p_include_test boolean default false)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_now_pk timestamp := now() at time zone 'Asia/Karachi';
  v_week timestamp := date_trunc('week', v_now_pk);
  v_month timestamp := date_trunc('month', v_now_pk);
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  with people as (
    select u.id, coalesce(p.created_at, u.created_at) as joined,
           p.role, p.admin_level, coalesce(p.is_test, false) as is_test,
           coalesce(p.is_paused, false) as is_paused, coalesce(p.is_blocked, false) as is_blocked,
           p.id is not null as has_profile,
           greatest(p.last_seen_at, u.last_sign_in_at) as last_active,
           (now() at time zone coalesce(p.timezone, 'Asia/Karachi'))::date as local_today
      from auth.users u left join public.profiles p on p.id = u.id
  ), counted as (
    select * from people where p_include_test or not is_test
  )
  select jsonb_build_object(
    'include_test', p_include_test,
    'as_of', now(),
    'signups', jsonb_build_object(
      'this_week',  (select count(*) from counted where joined at time zone 'Asia/Karachi' >= v_week),
      'last_week',  (select count(*) from counted where joined at time zone 'Asia/Karachi' >= v_week - interval '7 days'
                                                  and joined at time zone 'Asia/Karachi' <  v_week),
      'this_month', (select count(*) from counted where joined at time zone 'Asia/Karachi' >= v_month),
      'all_time',   (select count(*) from counted),
      'by_week', (select jsonb_agg(jsonb_build_object('week_start', w::date,
                    'count', (select count(*) from counted
                               where joined at time zone 'Asia/Karachi' >= w
                                 and joined at time zone 'Asia/Karachi' < w + interval '7 days'))
                   order by w desc)
                  from generate_series(v_week - interval '49 days', v_week, interval '7 days') w)
    ),
    'logged', jsonb_build_object(
      'today',      (select count(distinct c.id) from counted c join public.logged_days d on d.profile_id = c.id
                      where d.day = c.local_today),
      'this_week',  (select count(distinct c.id) from counted c join public.logged_days d on d.profile_id = c.id
                      where d.day >= date_trunc('week', c.local_today)::date and d.day <= c.local_today),
      'this_month', (select count(distinct c.id) from counted c join public.logged_days d on d.profile_id = c.id
                      where d.day >= date_trunc('month', c.local_today)::date and d.day <= c.local_today)
    ),
    'active', jsonb_build_object(
      'last_7_days',  (select count(*) from counted where last_active >= now() - interval '7 days'),
      'last_30_days', (select count(*) from counted where last_active >= now() - interval '30 days'),
      'never_signed_in', (select count(*) from counted where last_active is null)
    ),
    'by_role', jsonb_build_object(
      'saath_icon',    (select count(*) from counted where role = 'saath_icon'),
      'saath_buddy',   (select count(*) from counted where role = 'saath_buddy'),
      'family_member', (select count(*) from counted where role = 'family_member'),
      'admin_super',   (select count(*) from counted where role = 'admin' and admin_level = 'super'),
      'admin_support', (select count(*) from counted where role = 'admin' and coalesce(admin_level::text, 'support') = 'support'),
      'admin_moderator', (select count(*) from counted where role = 'admin' and admin_level = 'moderator'),
      'no_profile',    (select count(*) from counted where not has_profile)
    ),
    'status', jsonb_build_object(
      'paused',  (select count(*) from counted where is_paused),
      'blocked', (select count(*) from counted where is_blocked),
      'test_accounts', (select count(*) from people where is_test)
    )
  ) into v_out;

  return v_out;
end;
$function$;

revoke all on function public.admin_activity(boolean) from public, anon;
grant execute on function public.admin_activity(boolean) to authenticated;
