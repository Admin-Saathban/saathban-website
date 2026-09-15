/* ═══════════════════════════════════════════════════════════════
   0185 — The front screen counts people whose days have been low

   PRODUCT_DECISIONS §18 lists "quiet-day welfare flags" among what the
   front door shows. admin_dashboard() gains one field for support and
   super-admins:

     welfare: { flagged, oldest_raised }
       flagged        how many people welfare_runs(now()) lists (0183)
       oldest_raised  the earliest day one of those flags was raised

   A count and a date — no names, no ids — so, like the rest of this
   payload, no audit row. Opening the names is admin_welfare_list,
   which is audited (0184). A moderator's payload is unchanged: reports
   only.

   Everything else is 0177, unchanged.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.admin_dashboard()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_admin boolean := public.is_admin();
  v_level text;
  v_today_start timestamp := date_trunc('day', now() at time zone 'Asia/Karachi');
  v_out jsonb;
begin
  if not (v_admin or public.can_moderate()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select case when v_admin then coalesce(admin_level::text, 'support') else 'moderator' end
    into v_level
    from public.profiles where id = auth.uid();

  v_out := jsonb_build_object(
    'as_of', now(),
    'level', v_level,
    'response_target_hours', 24,
    'reports', (
      select jsonb_build_object(
        'open', count(*),
        'past_target', count(*) filter (where created_at < now() - interval '24 hours'),
        'oldest_at', min(created_at))
      from public.community_reports where status = 'open')
  );

  if not v_admin then
    return v_out;
  end if;

  v_out := v_out || jsonb_build_object(
    'applications', (
      select jsonb_build_object(
        'pending', count(*) filter (where status = 'pending'),
        'interviewing', count(*) filter (where status = 'interviewing'),
        'oldest_at', min(created_at))
      from public.buddy_applications where status in ('pending', 'interviewing')),
    'documents_to_review', (
      select count(*) from public.buddy_document_requests
       where status = 'awaiting' and response_path is not null),
    'questions_open', (
      select count(*) from public.questions where status = 'open'),
    'proposals_pending', (
      select count(*) from public.event_proposals where status = 'pending'),
    'welfare', (
      select jsonb_build_object('flagged', count(*), 'oldest_raised', min(w.raised_on))
      from public.welfare_runs(now()) w),
    'today', (
      with people as (
        select coalesce(p.created_at, u.created_at) as joined,
               coalesce(p.is_test, false) as is_test,
               p.id as profile_id,
               (now() at time zone coalesce(p.timezone, 'Asia/Karachi'))::date as local_today
          from auth.users u left join public.profiles p on p.id = u.id
      ), counted as (
        select * from people where not is_test
      )
      select jsonb_build_object(
        'day', v_today_start::date,
        'signups', (select count(*) from counted where joined at time zone 'Asia/Karachi' >= v_today_start),
        'logged', (select count(distinct c.profile_id) from counted c
                     join public.logged_days d on d.profile_id = c.profile_id
                    where d.day = c.local_today))
    )
  );

  return v_out;
end;
$function$;

revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
