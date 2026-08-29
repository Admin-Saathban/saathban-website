-- ============================================================================
-- 0027 — Community social: "Who's up for…?" activities, friend
-- connections, DM game attachments (games/community lane; number
-- reserved via MIGRATIONS.md / integration session).
--
-- Three pieces:
--
-- A. ACTIVITY POSTS. "Who's up for a walk?" generalizes to "Who's up
--    for…?" — free-text activity (walk, chai, ludo, anything), place
--    and time both OPTIONAL, and an optional people limit fixed at
--    creation. Joins move from implicit outing rows to a real
--    post_joins table so a limit can close the activity GRACEFULLY:
--    the join RPC reports {joined, count, full} instead of erroring,
--    and re-joining is idempotent. Old 'walk' posts keep working —
--    'walk' stays a valid post_type and joins apply to both.
--
-- B. FRIENDS. Until now "connections" meant circle membership only
--    (see 0025's game_connected note — this is the planned plug-in).
--    friend_requests is direction-al (requester → recipient) with the
--    same privacy stance as DMs and circle invites: blocks make a
--    request silently vanish (the sender can't probe), declines are
--    never announced, and a declined pair is not re-notified.
--
-- C. DM GAME ATTACHMENTS (ask A4). A dm_message may carry a
--    game_session_id; the thread renders the game inline (carrom's
--    board first). Only a session the SENDER participates in may be
--    attached — checked in the insert policy.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Shared: social notifications (client cannot insert notifications;
-- definer functions are the only path — 0007/0022 precedent).
-- ----------------------------------------------------------------------------
create or replace function public.social_notify(p_profile uuid, p_title text, p_body text, p_link text)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  insert into public.notifications (profile_id, title, body, kind, link)
  values (p_profile, p_title, p_body, 'social', p_link);
$$;

revoke execute on function public.social_notify(uuid, text, text, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- A. Activities
-- ----------------------------------------------------------------------------
alter table public.community_posts drop constraint community_posts_post_type_check;
alter table public.community_posts add constraint community_posts_post_type_check
  check (post_type in ('text', 'badge', 'score', 'walk', 'activity', 'event', 'game_open', 'puzzle_result'));

create table public.post_joins (
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

alter table public.post_joins enable row level security;
revoke all on public.post_joins from anon;

-- Anyone who can read the feed can see who's coming (counts + the
-- joined state on the card). Writes only via the RPC below.
create policy "post joins: community reads" on public.post_joins
  for select using (public.can_use_community());

-- Join an activity. Graceful by design: returns {joined, count, full}
-- and never errors for "full" or "already joined" — the card just
-- shows the closed state. count includes the host (a "limit 4" ludo
-- table means four people at it, host included).
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
  v_name text;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;

  -- Lock the post row so two simultaneous joins can't both take the
  -- last place.
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
  select count(*) into v_count from public.post_joins where post_id = p_post;

  if exists (select 1 from public.post_joins where post_id = p_post and profile_id = auth.uid()) then
    v_joined := true;                       -- idempotent re-tap
  elsif v_limit is not null and v_count + 1 >= v_limit then
    -- +1 is the host. Full: close gracefully, no error.
    null;
  else
    insert into public.post_joins (post_id, profile_id) values (p_post, auth.uid());
    v_count := v_count + 1;
    v_joined := true;
    select full_name into v_name from public.profiles where id = auth.uid();
    perform public.social_notify(
      post.author_id,
      'Someone is coming along',
      coalesce(v_name, 'A neighbour') || ': ' || coalesce(post.payload ->> 'activity', 'your invitation'),
      '/app/community'
    );
  end if;

  v_full := v_limit is not null and v_count + 1 >= v_limit;
  return jsonb_build_object('joined', v_joined, 'count', v_count, 'full', v_full);
end;
$$;

revoke execute on function public.join_activity(uuid) from public, anon;
grant execute on function public.join_activity(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- B. Friends
-- ----------------------------------------------------------------------------
create table public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  unique (requester_id, recipient_id),
  check (requester_id <> recipient_id)
);

alter table public.friend_requests enable row level security;
revoke all on public.friend_requests from anon;

-- The requester sees their own; the recipient sees incoming EXCEPT
-- from people they've blocked (those sit pending, invisible — the
-- sender can't tell; the 0014 DM-request stance).
create policy "friend requests: participants read" on public.friend_requests
  for select using (
    requester_id = auth.uid()
    or (recipient_id = auth.uid() and not public.caller_hides(requester_id))
  );

-- No direct writes: everything goes through the RPCs below.

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.friend_requests
    where status = 'accepted'
      and ((requester_id = p_a and recipient_id = p_b)
        or (requester_id = p_b and recipient_id = p_a))
  );
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Send a connection request. Always "request sent" to the caller:
-- blocks in either direction make it a silent no-op (a fresh id comes
-- back, nothing is written, nobody is notified) so blocking is never
-- probeable. A pair the recipient declined is NOT re-notified — the
-- request id returns but the row stays declined.
create or replace function public.send_friend_request(p_recipient uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.friend_requests%rowtype;
  v_id uuid;
  v_name text;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  if p_recipient = auth.uid() then
    raise exception 'That would be yourself';
  end if;
  if not public.can_use_community_profile(p_recipient) then
    raise exception 'Not available';
  end if;

  -- Rate limit outgoing requests (SPEC.md: rate limits on requests).
  if (select count(*) from public.friend_requests
      where requester_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'That is plenty of invitations for one day — try again tomorrow';
  end if;

  -- Silent no-op on a block in either direction.
  if exists (
    select 1 from public.user_blocks
    where kind = 'block'
      and ((blocker_id = auth.uid() and blocked_id = p_recipient)
        or (blocker_id = p_recipient and blocked_id = auth.uid()))
  ) then
    return gen_random_uuid();
  end if;

  -- Anything already on file for this pair (either direction) stands.
  select * into v_existing from public.friend_requests
  where (requester_id = auth.uid() and recipient_id = p_recipient)
     or (requester_id = p_recipient and recipient_id = auth.uid())
  limit 1;
  if v_existing.id is not null then
    return v_existing.id;
  end if;

  insert into public.friend_requests (requester_id, recipient_id)
  values (auth.uid(), p_recipient)
  returning id into v_id;

  select full_name into v_name from public.profiles where id = auth.uid();
  perform public.social_notify(
    p_recipient,
    'A connection request',
    coalesce(v_name, 'A neighbour') || ' would like to connect with you on Saathban.',
    '/app/community/connect'
  );
  return v_id;
end;
$$;

revoke execute on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

-- Accept or decline. Declines are never announced.
create or replace function public.respond_friend_request(p_request uuid, p_accept boolean)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  req public.friend_requests%rowtype;
  v_name text;
begin
  select * into req from public.friend_requests where id = p_request for update;
  if req.recipient_id is distinct from auth.uid() or req.status <> 'pending' then
    raise exception 'Not yours to answer';
  end if;
  update public.friend_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      decided_at = now()
  where id = p_request;
  if p_accept then
    select full_name into v_name from public.profiles where id = auth.uid();
    perform public.social_notify(
      req.requester_id,
      'You are connected',
      coalesce(v_name, 'A neighbour') || ' accepted your connection request.',
      '/app/community/connect'
    );
  end if;
end;
$$;

revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- The 0025 plug-point, as promised there: "connections" for games now
-- means circle membership OR an accepted friendship.
create or replace function public.game_connected(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.circle_members
    where (icon_id = p_a and member_id = p_b)
       or (icon_id = p_b and member_id = p_a)
  ) or public.are_friends(p_a, p_b);
$$;

-- ----------------------------------------------------------------------------
-- C. DM game attachments (ask A4)
-- ----------------------------------------------------------------------------
alter table public.dm_messages
  add column game_session_id uuid references public.game_sessions (id) on delete set null;

-- A message is words, a game, or both. (The 1..2000 length check
-- passes vacuously on null body, so it stays as-is.)
alter table public.dm_messages alter column body drop not null;
alter table public.dm_messages
  add constraint dm_messages_content_check
  check (body is not null or game_session_id is not null);

-- Recreate the insert policy: same gates as 0014, plus you may only
-- attach a game YOU are seated at (or invited to — the session is
-- created before the invitee accepts).
drop policy "dm messages: send in open thread" on public.dm_messages;
create policy "dm messages: send in open thread" on public.dm_messages
  for insert with check (
    sender_id = auth.uid()
    and public.dm_open(request_id)
    and public.account_ok()
    and (game_session_id is null or public.can_view_game(game_session_id))
  );
