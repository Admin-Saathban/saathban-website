/* 0130 — THE HOME FEED IN ONE REQUEST.

   Home used to open the community feed with one query per side table:
   access, write access, posts, authors (twice), group neighbours, hides,
   reactions, joins, connections (two), offers, saves, follows, tags,
   the names of taggees and helpers, and the group posts with their own
   three queries and names. Measured on a throttled phone: 54 Supabase
   requests for Home, finishing at 11.9 seconds.

   SECURITY INVOKER, deliberately. Every read below runs as the caller,
   so the row security that already decides what a person may see — the
   posts read policy (visibility, friends, hidden_at, caller_hides,
   can_use_community), mine-only hides/saves/follows, visible-with-the-
   post tags and offers, group membership — applies to each subquery
   exactly as it applied to the separate requests. Nothing here widens
   anything; it only saves round trips.

   Names come from profile_cards (0123), the one lawful name source for
   people whose content you can already see: name, photo, city, area,
   role. Never presence, never the profiles row. */

create or replace function public.home_feed(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_me          uuid := auth.uid();
  v_limit       integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_posts       jsonb;
  v_ids         uuid[];
  v_joinable    uuid[];
  v_my_groups   uuid[];
  v_group_posts jsonb;
  v_people      uuid[];
  v_authors     jsonb := '[]'::jsonb;
  i             integer;
begin
  if v_me is null then
    return null;
  end if;

  if not public.can_use_community() then
    return jsonb_build_object('access', false);
  end if;

  -- The page of posts: the same columns and order the feed selected.
  select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]'::jsonb),
         coalesce(array_agg(p.id), '{}'::uuid[]),
         coalesce(array_agg(p.id) filter (where p.post_type in ('walk', 'activity')), '{}'::uuid[])
    into v_posts, v_ids, v_joinable
  from (
    select id, author_id, body, image_path, post_type, ref_id, payload, created_at,
           visibility, style_tag, colour, replies_off, pinned_at, edited_at,
           help_state, help_wanted, help_note, audio_path, audio_seconds
    from public.community_posts
    where hidden_at is null
    order by created_at desc
    limit v_limit
  ) p;

  select coalesce(array_agg(gm.group_id), '{}'::uuid[])
    into v_my_groups
  from public.group_members gm
  where gm.member_id = v_me;

  -- §6 posts from the open groups I have joined (groupsStore.fetchFeedGroupPosts).
  select coalesce(jsonb_agg(to_jsonb(g) order by g.created_at desc), '[]'::jsonb)
    into v_group_posts
  from (
    select gp.id, gp.group_id, gp.author_id, gp.body, gp.created_at, gr.name as group_name
    from public.group_posts gp
    join public.groups gr on gr.id = gp.group_id
    where gp.group_id = any (v_my_groups)
      and gr.privacy = 'anyone'
      and gp.hidden_at is null
    order by gp.created_at desc
    limit 40
  ) g;

  -- Everyone the page names: authors, taggees, helpers, group post authors.
  select coalesce(array_agg(distinct s.pid), '{}'::uuid[])
    into v_people
  from (
    select (e->>'author_id')::uuid as pid from jsonb_array_elements(v_posts) e
    union select (e->>'author_id')::uuid from jsonb_array_elements(v_group_posts) e
    union select t.person_id from public.post_tags t where t.post_id = any (v_ids)
    union select o.helper_id from public.post_help_offers o where o.post_id = any (v_ids)
  ) s
  where s.pid is not null;

  -- profile_cards answers at most 200 ids per call.
  i := 1;
  while i <= coalesce(array_length(v_people, 1), 0) loop
    v_authors := v_authors || coalesce(
      (select jsonb_agg(to_jsonb(c)) from public.profile_cards(v_people[i:i + 199]) c),
      '[]'::jsonb);
    i := i + 200;
  end loop;

  return jsonb_build_object(
    'access', true,
    'can_post', public.can_post_community(),
    'posts', v_posts,
    'reactions', coalesce((
      select jsonb_agg(jsonb_build_object('post_id', r.post_id, 'profile_id', r.profile_id, 'emoji', r.emoji))
      from public.post_reactions r where r.post_id = any (v_ids)), '[]'::jsonb),
    'joins', coalesce((
      select jsonb_agg(jsonb_build_object('post_id', j.post_id, 'count', j.n, 'mine', j.mine))
      from (select pj.post_id, count(*) as n, bool_or(pj.profile_id = v_me) as mine
            from public.post_joins pj where pj.post_id = any (v_joinable)
            group by pj.post_id) j), '[]'::jsonb),
    'hidden', coalesce((
      select jsonb_agg(h.post_id) from public.post_hides h
      where h.profile_id = v_me and h.post_id = any (v_ids)), '[]'::jsonb),
    'offers', coalesce((
      select jsonb_agg(jsonb_build_object('post_id', o.post_id, 'helper_id', o.helper_id,
                                          'created_at', o.created_at, 'note', o.note))
      from public.post_help_offers o where o.post_id = any (v_ids)), '[]'::jsonb),
    'saves', coalesce((
      select jsonb_agg(jsonb_build_object('post_id', sv.post_id, 'profile_id', sv.profile_id))
      from public.post_saves sv where sv.post_id = any (v_ids)), '[]'::jsonb),
    'follows', coalesce((
      select jsonb_agg(jsonb_build_object('post_id', f.post_id, 'profile_id', f.profile_id))
      from public.post_follows f where f.post_id = any (v_ids)), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('post_id', t.post_id, 'person_id', t.person_id, 'accepted', t.accepted))
      from public.post_tags t where t.post_id = any (v_ids)), '[]'::jsonb),
    'neighbours', coalesce((
      select jsonb_agg(distinct m.member_id) from public.group_members m
      where m.group_id = any (v_my_groups)), '[]'::jsonb),
    'connections', coalesce((
      select jsonb_agg(distinct x.pid) from (
        select case when c.icon_id = v_me then c.member_id else c.icon_id end as pid
        from public.circle_members c where c.icon_id = v_me or c.member_id = v_me
        union
        select case when fr.requester_id = v_me then fr.recipient_id else fr.requester_id end
        from public.friend_requests fr
        where fr.status = 'accepted' and (fr.requester_id = v_me or fr.recipient_id = v_me)
      ) x), '[]'::jsonb),
    'group_posts', v_group_posts,
    'authors', v_authors
  );
end;
$$;

revoke execute on function public.home_feed(integer) from public, anon;
grant execute on function public.home_feed(integer) to authenticated;
