-- ============================================================================
-- 0028 — Activity RSVP refinements (games/community lane; user-testing
-- feedback on 0027's "Who's up for…?").
--
-- 1. Payload gains two creation-time choices the client now writes:
--      rsvp: true/false — whether joining is a firm "I'm coming"
--        (button + count wording change; the server only uses it to
--        word notifications)
--      place_name is free text since 0028 — place_id is set only when
--        the host picked a known outdoor place from the suggestions.
--    No DDL: both ride the existing payload jsonb.
--
-- 2. join_activity() replaced:
--      - notification wording follows the rsvp choice
--      - the join that FILLS the activity also tells the host so they
--        can stop wondering ("Your invitation is full — {n} coming")
--    Everything else (idempotency, graceful close, limit includes the
--    host) is unchanged from 0027.
--
-- 3. announce_activity(p_post): the author calls it once after
--    posting; every connection (circle members + accepted friends)
--    gets a notification with a link to the feed. Author-only,
--    once per post (re-calls are silent no-ops via a payload marker),
--    capped at 50 recipients so a huge graph can't fan out unbounded.
-- ============================================================================

create or replace function public.join_activity(p_post uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  post public.community_posts%rowtype;
  v_limit int;
  v_count int;
  v_full boolean;
  v_joined boolean := false;
  v_was_full_before boolean;
  v_rsvp boolean;
  v_name text;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;

  select * into post from public.community_posts
  where id = p_post and hidden_at is null
    and post_type in ('walk', 'activity')
  for update;
  if post.id is null or public.caller_hides(post.author_id) then
    raise exception 'No such activity';
  end if;
  if post.author_id = auth.uid() then
    raise exception 'This is your own invitation';
  end if;
  if (post.payload ->> 'starts_at') is not null
     and (post.payload ->> 'starts_at')::timestamptz < now() then
    raise exception 'This has already happened';
  end if;

  v_limit := nullif(post.payload ->> 'limit', '')::int;
  v_rsvp := coalesce((post.payload ->> 'rsvp')::boolean, false);
  select count(*) into v_count from public.post_joins where post_id = p_post;
  v_was_full_before := v_limit is not null and v_count + 1 >= v_limit;

  if exists (select 1 from public.post_joins where post_id = p_post and profile_id = auth.uid()) then
    v_joined := true;                       -- idempotent re-tap
  elsif v_was_full_before then
    null;                                   -- full: close gracefully
  else
    insert into public.post_joins (post_id, profile_id) values (p_post, auth.uid());
    v_count := v_count + 1;
    v_joined := true;
    select full_name into v_name from public.profiles where id = auth.uid();
    v_full := v_limit is not null and v_count + 1 >= v_limit;
    perform public.social_notify(
      post.author_id,
      case when v_rsvp then 'Someone is coming' else 'Someone is coming along' end,
      coalesce(v_name, 'A neighbour')
        || case when v_rsvp then ' says "I''m coming": ' else ': ' end
        || coalesce(post.payload ->> 'activity', 'your invitation'),
      '/app/community'
    );
    if v_full then
      perform public.social_notify(
        post.author_id,
        'Your invitation is full',
        coalesce(post.payload ->> 'activity', 'Your invitation')
          || ': all ' || v_limit || ' places are spoken for. Enjoy!',
        '/app/community'
      );
    end if;
  end if;

  v_full := v_limit is not null and v_count + 1 >= v_limit;
  return jsonb_build_object('joined', v_joined, 'count', v_count, 'full', v_full);
end;
$$;

revoke execute on function public.join_activity(uuid) from public, anon;
grant execute on function public.join_activity(uuid) to authenticated;

-- Tell the author's connections a new invitation is up. Author-only,
-- once (marked in the payload), at most 50 recipients.
create or replace function public.announce_activity(p_post uuid)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  post public.community_posts%rowtype;
  v_name text;
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
    return 0; -- already announced; silent no-op
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();

  for rec in
    select distinct pid from (
      select case when icon_id = post.author_id then member_id else icon_id end as pid
      from public.circle_members
      where icon_id = post.author_id or member_id = post.author_id
      union
      select case when requester_id = post.author_id then recipient_id else requester_id end
      from public.friend_requests
      where status = 'accepted'
        and (requester_id = post.author_id or recipient_id = post.author_id)
    ) c
    where pid <> post.author_id
      -- never notify across a block, in either direction
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
      '/app/community'
    );
    v_sent := v_sent + 1;
  end loop;

  update public.community_posts
  set payload = post.payload || '{"announced": true}'::jsonb
  where id = p_post;

  return v_sent;
end;
$$;

revoke execute on function public.announce_activity(uuid) from public, anon;
grant execute on function public.announce_activity(uuid) to authenticated;
