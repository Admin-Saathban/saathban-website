/* "Told N people" has to be N.

   The client was fanning out one social_notify_kind call per person
   and counting the ones that did not error. That count is not the
   number of people told: social_notify_kind returns void and its
   INSERT is conditional —

     insert into notifications (...) select ...
      where public.notify_allowed(p_profile, p_kind)

   — so a recipient who has that kind switched off produces a
   perfectly successful call that writes nothing. The sender was told
   "Told 1 people ✓" while the notifications table gained no row.

   That is the same shape as the update this sweep started with: the
   absence of an error taken for evidence of an effect.

   One round trip, and it returns how many rows it actually wrote.

   It reports only the number reached and never the size of the
   audience, so the sender cannot subtract one from the other and
   learn who has muted them. */

create or replace function public.share_score_with_people(
  p_title text,
  p_body  text,
  p_link  text
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_me   uuid := auth.uid();
  v_sent integer := 0;
begin
  if v_me is null then
    raise exception 'Not signed in';
  end if;

  /* The same audience the app offers: this person's circle in either
     direction, plus anyone they already have an accepted conversation
     with. Deliberately not "everyone nearby". */
  with audience as (
    select case when cm.icon_id = v_me then cm.member_id else cm.icon_id end as person
      from public.circle_members cm
     where cm.icon_id = v_me or cm.member_id = v_me
    union
    select case when dr.requester_id = v_me then dr.recipient_id else dr.requester_id end
      from public.dm_requests dr
     where dr.status = 'accepted'
       and (dr.requester_id = v_me or dr.recipient_id = v_me)
  ),
  targets as (
    select distinct person from audience where person is not null and person <> v_me
  ),
  written as (
    insert into public.notifications (profile_id, title, body, kind, link)
    select t.person, p_title, p_body, 'score', p_link
      from targets t
     where public.notify_allowed(t.person, 'score')
    returning 1
  )
  select count(*) into v_sent from written;

  return v_sent;
end;
$function$;

revoke execute on function public.share_score_with_people(text, text, text) from public, anon;
grant  execute on function public.share_score_with_people(text, text, text) to authenticated;
