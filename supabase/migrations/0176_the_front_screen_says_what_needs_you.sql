/* ═══════════════════════════════════════════════════════════════
   0176 — The front screen says what needs you

   admin_dashboard() — one call behind the admin panel's front screen.
   It checks the caller FIRST and returns only what that level may see:

     moderator        open reports, and how many are past the response
                      target. Nothing else: vetting, questions, gatherings
                      and access notes are refused to a moderator
                      elsewhere (0053, 0125), so they are not counted here.
     support / super  the above, plus Saath-Buddy applications waiting
                      (pending, interviewing), documents an applicant has
                      uploaded that nobody has marked received, open
                      questions, gathering suggestions awaiting a
                      decision, unchecked access notes, and today's two
                      numbers: sign-ups and people who logged.

   Anyone else — and anon, which has no execute grant at all — is refused.

   COUNTS ONLY. No names, no content, so like admin_activity (0152) it
   writes no audit row.

   The two numbers follow admin_activity exactly:
     sign-ups today   the Pakistan-time day (Asia/Karachi), joined =
                      profile created, else the auth account created
     logged today     each person's own local day (profiles.timezone,
                      falling back to Asia/Karachi) against logged_days
   and both leave test accounts out.

   The response target is 24 hours, the same line the moderation queue
   draws ("past the response target").
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
    'access_notes_unchecked', (
      select count(*) from public.outdoor_place_access where not verified),
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
