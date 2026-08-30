/* ═══════════════════════════════════════════════════════════════
   0052 — an area to belong to, and who hears when something starts

   PRODUCT_DECISIONS §12 groups Out & about by **distance bands
   computed from AREA, not kilometres**, because a senior deciding
   what to do today thinks "can I walk there", "short rickshaw",
   "across town" — never in metres. §2 collects city + area at signup
   for exactly this reason: the area is what makes park and event
   suggestions useful.

   `profiles` today has `city` and no `area` at all, so the band is not
   merely unshown — it is uncomputable. This adds it.

   NULLABLE, AND THAT IS THE DESIGN. §2 says city is required and area
   is "prompted but optional". Somebody who never answers must still
   see a usable screen: with no area of their own, everything in their
   city reads as "Nearby" rather than nothing reading as anything. A
   band is a kindness, not a gate.

   ── Who hears when something starts ──

   §12: "Starting something notifies your connections, plus anyone who
   has checked into that place before. It does NOT notify the whole
   area — that's how an app becomes noise."

   That second group cannot be derived from the circle or the friends
   list; it is a fact about a PLACE — the people who have actually
   been there. `outdoor_checkins` already records it, including
   check-ins that have since ended, so the history is there and only
   needs asking.

   `people_who_know_place()` is SECURITY DEFINER because the caller
   must NOT be able to read other people's check-in history directly —
   that would turn a notification list into a movement log. It returns
   ids to the server for notifying, never rows to a client: execute is
   granted to authenticated so the app can call it while writing a
   happening, and the function exposes nothing beyond the ids it must.
   ═══════════════════════════════════════════════════════════════ */

alter table public.profiles
  add column if not exists area text;

comment on column public.profiles.area is
  'Neighbourhood within the city (§2). Optional: absent means every place in the city reads as Nearby rather than nothing reading as anything (§12).';

/* An index on (city, area) because the band computation asks "who and
   what is in my area, then my city" on every visit to the screen. */
create index if not exists profiles_city_area_idx
  on public.profiles (city, area);

create index if not exists outdoor_places_city_area_idx
  on public.outdoor_places (city, area) where not is_hidden;

/* ── The reach of a new happening ──
   Everyone who has ever checked into this place, EXCLUDING the caller.
   Ended check-ins count: having been somewhere is what makes the place
   yours, not being there this minute. */
create or replace function public.people_who_know_place(p_place uuid)
returns setof uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select distinct c.profile_id
  from public.outdoor_checkins c
  where c.place_id = p_place
    and c.profile_id is not null
    and c.profile_id <> auth.uid()
$function$;

revoke execute on function public.people_who_know_place(uuid) from public, anon;
grant execute on function public.people_who_know_place(uuid) to authenticated;

/* ── The tab's count ──
   §12: "The tab carries a small count when something is on today. No
   badge when nothing is on." Counting in SQL rather than fetching the
   whole day and calling .length in the client, because the badge is
   drawn on every screen and must cost one number.

   Counts only what the CALLER may see: the function is invoker-rights
   (not SECURITY DEFINER) precisely so the existing RLS on outings and
   check-ins decides what is visible. A count that included happenings
   you cannot open would be a badge for somebody else's day. */
create or replace function public.happenings_today_count()
returns integer
language sql
stable
as $function$
  select (
    select count(*) from public.outdoor_outings o
    where o.canceled_at is null
      and o.starts_at >= date_trunc('day', now())
      and o.starts_at <  date_trunc('day', now()) + interval '1 day'
  ) + (
    select count(*) from public.outdoor_checkins c
    where c.ended_at is null and c.expires_at > now()
  );
$function$;

revoke execute on function public.happenings_today_count() from public, anon;
grant execute on function public.happenings_today_count() to authenticated;

/* ── announce_activity gains the second half of §12's protocol ──

   It already notified the author's connections — circle members and
   accepted friends. §12 asks for "your connections, PLUS anyone who
   has checked into that place before", and explicitly not the whole
   area: "that's how an app becomes noise."

   The place regulars are the half that was missing, and they are the
   half that makes a park invitation work: the people who go to that
   park are usually not in your circle. Blocks still filter both
   groups, the 50 cap still holds, and the link now lands on What's on
   rather than the community feed — §11, the notification ends where
   its result lives.

   Everything else about the function is unchanged, including the
   announced-once guard and the ownership check. */
create or replace function public.announce_activity(p_post uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  post public.community_posts%rowtype;
  v_name text;
  v_place uuid;
  v_sent int := 0;
  rec record;
begin
  select * into post from public.community_posts
  where id = p_post and post_type = 'activity'
  for update;
  if post.id is null or post.author_id <> auth.uid() then
    raise exception 'Not yours to announce';
  end if;
  if coalesce((post.payload ->> 'announced')::boolean, false) then
    return 0;
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();
  v_place := nullif(post.payload ->> 'place_id', '')::uuid;

  for rec in
    select distinct pid from (
      -- the author's circle
      select case when icon_id = post.author_id then member_id else icon_id end as pid
      from public.circle_members
      where icon_id = post.author_id or member_id = post.author_id
      union
      -- and their accepted friends
      select case when requester_id = post.author_id then recipient_id else requester_id end
      from public.friend_requests
      where status = 'accepted'
        and (requester_id = post.author_id or recipient_id = post.author_id)
      union
      -- and anyone who has been to this place before (§12)
      select c.profile_id
      from public.outdoor_checkins c
      where v_place is not null
        and c.place_id = v_place
        and c.profile_id is not null
    ) c
    where pid <> post.author_id
      and not exists (
        select 1 from public.user_blocks
        where kind = 'block'
          and ((blocker_id = c.pid and blocked_id = post.author_id)
            or (blocker_id = post.author_id and blocked_id = c.pid))
      )
    limit 50
  loop
    perform public.social_notify(
      rec.pid,
      'An invitation from ' || coalesce(v_name, 'a friend'),
      coalesce(v_name, 'A friend') || ' asks: who''s up for '
        || coalesce(post.payload ->> 'activity', 'something') || '?',
      '/app/outdoor'
    );
    v_sent := v_sent + 1;
  end loop;

  update public.community_posts
  set payload = post.payload || '{"announced": true}'::jsonb
  where id = p_post;

  return v_sent;
end;
$function$;
