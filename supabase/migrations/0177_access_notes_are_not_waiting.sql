/* ═══════════════════════════════════════════════════════════════
   0177 — Access notes are not waiting on anyone

   The owner, on the front screen 0176 built: "17 unchecked notes
   nobody intends to check are wallpaper, and a front screen that can
   never say 'nothing waiting' trains the owner to ignore it."

   An unchecked access note is real work, but nobody is waiting on it:
   a guess is simply withheld from every place row until somebody has
   looked (0065). Counting it as waiting meant the front screen could
   not say "Nothing is waiting for a decision" for as long as a single
   seeded guess stayed seeded.

   So admin_dashboard() no longer reports them at all. The field is
   removed rather than kept at a number the screen ignores: a field in
   a "what needs you" payload reads as something that needs you, and
   the next person to touch the screen would count it again.

   The notes keep their own list — the Access notes screen
   (/app/admin/places) — which already reads every note, says how many
   are unchecked, and confirms them per place.

   Everything else in 0176 is unchanged: the caller is checked first,
   a moderator gets reports only, counts only, no audit row.
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
