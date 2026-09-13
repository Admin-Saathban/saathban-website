/* ═══════════════════════════════════════════════════════════════
   0120 — sharing shows what goes out, to whom, and lets the words be
          changed first

   The owner: a share must show the thing being shared, let it be
   edited, let the person press the final button, and then show where it
   landed. For the community feed that is the composer and the post. For
   the paths that notify PEOPLE, the server was the obstacle:

   - share_score_with_people (0115) sends to circle AND conversations
     together, so the two rows on the share sheet ("My Circle" and
     "Friends on Saathban") reached exactly the same people. It also
     returns only a count, so the sheet could never say who.
   - boast_to_people (0029) builds its title and body on the server, in
     English, so a riddle announcement could not be read before it went,
     could not be edited, and reached an Urdu reader in English.

   Three additions, none of which changes or removes anything that
   exists (older builds keep calling the old functions unchanged):

   share_audience(p_audience)   'circle' | 'friends' | 'connections'
     First names only, of the people a share would go to — the preview.
     Only the caller's own audience, only first names, which are names
     the caller already sees on their own screens.

   share_score_to_audience(...)   the score notification to ONE
     audience, with the words the person saw and edited. Returns how
     many notifications were actually written (a recipient who has
     switched these off is not counted — the same rule as 0115).

   boast_to_people_worded(...)   the "tell my people" notification with
     the person's own words. Retry-proof exactly as boast_to_people is:
     the first send for (person, kind, ref) wins. Counts rows actually
     written rather than calls made.

   has_boasted(p_kind, p_ref)   whether that first send already happened,
     so the screen can say so instead of offering a button that would
     silently do nothing.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.share_audience(p_audience text)
returns table (first_name text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with me as (select auth.uid() as id),
  people as (
    select case when cm.icon_id = (select id from me) then cm.member_id else cm.icon_id end as pid
      from public.circle_members cm
     where p_audience = 'circle'
       and (cm.icon_id = (select id from me) or cm.member_id = (select id from me))
    union
    select case when dr.requester_id = (select id from me) then dr.recipient_id else dr.requester_id end
      from public.dm_requests dr
     where p_audience = 'friends'
       and dr.status = 'accepted'
       and (dr.requester_id = (select id from me) or dr.recipient_id = (select id from me))
    union
    select c.pid
      from public.connections_of((select id from me)) c
     where p_audience = 'connections'
  )
  select split_part(coalesce(nullif(trim(sp.full_name), ''), '?'), ' ', 1)
    from (select distinct pid from people where pid is not null and pid <> (select id from me)) x
    join public.safe_profiles sp on sp.id = x.pid
   order by 1
   limit 50;
$function$;

revoke execute on function public.share_audience(text) from public, anon;
grant  execute on function public.share_audience(text) to authenticated;

create or replace function public.share_score_to_audience(
  p_audience text,
  p_title    text,
  p_body     text,
  p_link     text
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
  if p_audience not in ('circle', 'friends') then
    raise exception 'Unknown audience';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'A title is needed';
  end if;

  with audience as (
    select case when cm.icon_id = v_me then cm.member_id else cm.icon_id end as person
      from public.circle_members cm
     where p_audience = 'circle'
       and (cm.icon_id = v_me or cm.member_id = v_me)
    union
    select case when dr.requester_id = v_me then dr.recipient_id else dr.requester_id end
      from public.dm_requests dr
     where p_audience = 'friends'
       and dr.status = 'accepted'
       and (dr.requester_id = v_me or dr.recipient_id = v_me)
  ),
  targets as (
    select distinct person from audience where person is not null and person <> v_me
  ),
  written as (
    insert into public.notifications (profile_id, title, body, kind, link, created_by)
    select t.person,
           left(trim(p_title), 140),
           nullif(left(trim(coalesce(p_body, '')), 500), ''),
           'score',
           p_link,
           v_me
      from targets t
     where public.notify_allowed(t.person, 'score')
    returning 1
  )
  select count(*) into v_sent from written;

  return v_sent;
end;
$function$;

revoke execute on function public.share_score_to_audience(text, text, text, text) from public, anon;
grant  execute on function public.share_score_to_audience(text, text, text, text) to authenticated;

create or replace function public.boast_to_people_worded(
  p_kind    text,
  p_ref     text,
  p_payload jsonb,
  p_title   text,
  p_body    text
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_me   uuid := auth.uid();
  v_sent integer := 0;
  v_link text;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  if p_kind not in ('badge', 'riddle', 'win') then
    raise exception 'Unknown boast';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'A title is needed';
  end if;

  begin
    insert into public.boasts (profile_id, kind, ref_key) values (v_me, p_kind, p_ref);
  exception when unique_violation then
    return 0;
  end;

  v_link := case p_kind
    when 'riddle' then '/app/games/puzzle'
    when 'badge'  then '/app/people/' || v_me
    else coalesce(p_payload ->> 'link', '/app/games')
  end;

  with targets as (
    select pid from public.connections_of(v_me) limit 50
  ),
  written as (
    insert into public.notifications (profile_id, title, body, kind, link, created_by)
    select t.pid,
           left(trim(p_title), 140),
           nullif(left(trim(coalesce(p_body, '')), 500), ''),
           'social',
           v_link,
           v_me
      from targets t
     where public.notify_allowed(t.pid, 'social')
    returning 1
  )
  select count(*) into v_sent from written;

  return v_sent;
end;
$function$;

revoke execute on function public.boast_to_people_worded(text, text, jsonb, text, text) from public, anon;
grant  execute on function public.boast_to_people_worded(text, text, jsonb, text, text) to authenticated;

create or replace function public.has_boasted(p_kind text, p_ref text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.boasts
     where profile_id = auth.uid() and kind = p_kind and ref_key = p_ref
  );
$function$;

revoke execute on function public.has_boasted(text, text) from public, anon;
grant  execute on function public.has_boasted(text, text) to authenticated;
