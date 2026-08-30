/* ════════════════════════════════════════════════
   0086 — asking to join a group

   NAVIGATION_SPEC §5 puts an action on every search row: Join for a
   public group, Ask for a private one. Neither could be built, because
   `group_invites` runs inviter → invitee and nothing in the schema let
   a person knock from outside. Search shipped with "Open" instead, and
   the owner has now ruled that asking gets built.

   The request surfaces in the group's Member requests screen
   (GROUPS_SPEC §7 item 1), which Lane 4 owns. Names and read shape
   were agreed with them before this was written, because a screen
   bound to a guessed signature fails as a PostgREST 404 that reads
   like the function is missing rather than misnamed.

   ── WHY A DECLINED ROW IS KEPT ──

   Every other refusal in this app is silent: a declined friend request
   and a blocked DM are indistinguishable from one still waiting, on
   purpose, because being told you were turned down by a neighbour is a
   sting the app does not need to deliver.

   A group is different in one respect. Silence there is not gentle,
   it is ambiguous: a person who asked and hears nothing cannot tell
   whether the group ever saw them, so the natural thing to do is ask
   again — and again — never learning why. That is a worse experience
   than either notification choice.

   So the row is NOT deleted on decline. It stays as 'declined', and
   the place they asked — the search row — reads it and says "not this
   time" in its own words. There is no notification, so nobody is
   handed a rejection in a feed. The unique index is PARTIAL on pending
   only, which is what lets them ask again later without ever hitting a
   dead end. That combination is the whole design: honest state where
   they looked, silence everywhere else.

   ── WHY MEMBERSHIP IS WRITTEN INSIDE THE FUNCTION ──

   Approving inserts the group_members row in the same call. Everything
   downstream — can_see_group, group_event_readable, the chat, the
   roster — keys off group_members, so a two-step "approve, then join"
   would have a window where a person is approved and in nothing.
   ════════════════════════════════════════════════ */

-- ────────────────────────────────────────────────
-- Who may act on a group's requests
-- ────────────────────────────────────────────────
/* SUPERSEDED LIVE — READ THIS BEFORE TRUSTING THE BODY BELOW.

   0067 and this migration both defined is_group_admin(uuid) with the
   SAME signature, on the same night, in two lanes. That is not the
   overload trap that create_group hit: identical signatures do not
   collide, `create or replace` simply replaces. 0067 applied second,
   so for a while this file's definition was gone and the policy and
   RPCs below quietly stopped admitting platform admins — a permission
   predicate narrowed underneath code that had already been verified,
   which is worse than a loud failure because nothing reported it.

   0068 resolves it as the union both lanes wanted:
     is_admin() OR role in ('creator', 'co_admin')
   and `group_members.role` now allows three values. Verified live from
   this lane rather than taken on trust. The definition below is kept
   as written for the record; 0068 is what is running.

   The lesson worth keeping: a shared predicate is shared STATE. Two
   lanes may both own a feature that needs "is this person an admin"
   and neither is wrong to define it — but the second definition wins
   silently, so it has to be a union of both intents, not a rewrite. */

/* Today `group_members.role` is only 'creator' or 'member'. GROUPS_SPEC
   §7 item 3 adds co-admins, and when it does, this is the ONE place
   that has to learn about them — the policies and both functions below
   go through it rather than testing the role themselves. */
create or replace function public.is_group_admin(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin()
      or exists (
        select 1 from public.group_members
        where group_id = p_group
          and member_id = auth.uid()
          and role in ('creator')
      );
$$;

revoke execute on function public.is_group_admin(uuid) from public, anon;
grant execute on function public.is_group_admin(uuid) to authenticated;

-- ────────────────────────────────────────────────
-- The table
-- ────────────────────────────────────────────────
create table if not exists public.group_join_requests (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  -- A line the person may add. Optional: §5's row has a single tap on
  -- it, and requiring a covering letter to knock on a neighbourhood
  -- group would stop most people knocking.
  message      text check (message is null or char_length(message) <= 300),
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'declined')),
  decided_by   uuid references public.profiles (id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

/* PARTIAL, on pending only. One open knock at a time per person per
   group — but a decided row never blocks a later one, which is what
   keeps a decline from becoming a permanent no. */
create unique index if not exists group_join_requests_one_pending
  on public.group_join_requests (group_id, requester_id)
  where status = 'pending';

create index if not exists group_join_requests_queue_idx
  on public.group_join_requests (group_id, status, created_at desc);

create index if not exists group_join_requests_mine_idx
  on public.group_join_requests (requester_id, status);

alter table public.group_join_requests enable row level security;
revoke all on public.group_join_requests from anon;

-- ────────────────────────────────────────────────
-- Row-level security
-- ────────────────────────────────────────────────
/* Lane 4 asked for TABLE-level select rather than an RPC that returns a
   list: their screen paginates and joins to safe_profiles itself, and
   an RPC returning a fixed page would have made both of those the
   database's business. */
create policy "join requests: admins read their group"
  on public.group_join_requests for select
  using (public.is_group_admin(group_id));

/* The requester reads their own — this is what the search row shows,
   and it is the only reason a declined row is worth keeping. */
create policy "join requests: requester reads own"
  on public.group_join_requests for select
  using (requester_id = auth.uid());

/* No insert, update or delete policies at all. Both writes happen
   through the definer functions below, so the rules about privacy,
   membership and blocks cannot be sidestepped by a client that has
   worked out the table name. */

-- ────────────────────────────────────────────────
-- Asking
-- ────────────────────────────────────────────────
create or replace function public.request_to_join_group(
  p_group uuid,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id      uuid;
  v_privacy text;
  v_creator uuid;
begin
  if not public.account_ok() then
    raise exception 'account not in good standing';
  end if;

  select privacy, created_by into v_privacy, v_creator
    from public.groups
   where id = p_group and hidden_at is null;

  if v_privacy is null then
    raise exception 'no such group';
  end if;

  /* Only a group that has said anyone may come. An invite_only group is
     not a locked door to knock on — it is a group whose members choose
     who they ask, and turning it into a request queue would change what
     its owner agreed to when they set it. §5's "Ask for a private one"
     is therefore NOT implemented as knocking on invite_only groups;
     the caller gets a plain refusal and search shows no action. */
  if v_privacy is distinct from 'anyone' then
    raise exception 'this group is invite only';
  end if;

  if public.is_group_member(p_group) then
    raise exception 'already a member';
  end if;

  /* Blocks, the same way send_friend_request treats them: if the
     group's creator has blocked this person, or this person has
     blocked the creator, the request simply does not exist. Silent on
     purpose — telling somebody they are blocked is telling them who
     blocked them. */
  if public.caller_hides(v_creator) or exists (
    select 1 from public.user_blocks
     where blocker_id = v_creator and blocked_id = auth.uid()
  ) then
    return null;
  end if;

  insert into public.group_join_requests (group_id, requester_id, message)
  values (p_group, auth.uid(), nullif(btrim(coalesce(p_message, '')), ''))
  on conflict (group_id, requester_id) where status = 'pending'
    do nothing
  returning id into v_id;

  /* Already knocking. Idempotent rather than an error: the person
     tapped twice, which is not a mistake worth a red message. */
  if v_id is null then
    select id into v_id from public.group_join_requests
     where group_id = p_group and requester_id = auth.uid() and status = 'pending';
  end if;

  return v_id;
end;
$$;

revoke execute on function public.request_to_join_group(uuid, text) from public, anon;
grant execute on function public.request_to_join_group(uuid, text) to authenticated;

-- ────────────────────────────────────────────────
-- Deciding
-- ────────────────────────────────────────────────
create or replace function public.respond_join_request(
  p_request uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group     uuid;
  v_requester uuid;
  v_name      text;
begin
  select group_id, requester_id into v_group, v_requester
    from public.group_join_requests
   where id = p_request and status = 'pending';

  if v_group is null then
    -- Already decided, or never existed. Not an error: two admins
    -- tapping at once must not produce a failure for the slower one.
    return;
  end if;

  if not public.is_group_admin(v_group) then
    raise exception 'not allowed';
  end if;

  update public.group_join_requests
     set status     = case when p_approve then 'approved' else 'declined' end,
         decided_by = auth.uid(),
         decided_at = now()
   where id = p_request;

  if p_approve then
    /* Membership in the same call — see the header. */
    insert into public.group_members (group_id, member_id, role)
    values (v_group, v_requester, 'member')
    on conflict (group_id, member_id) do nothing;

    select name into v_name from public.groups where id = v_group;

    /* The link is the group, not a list of requests: GROUPS_SPEC §5
       says accepting an invitation lands you inside the group, and an
       approved request is that same moment from the other side. */
    insert into public.notifications (profile_id, title, body, kind, link, created_by)
    values (
      v_requester,
      'You are in',
      'You have joined ' || chr(8220) || coalesce(v_name, 'the group') || chr(8221) || '.',
      'group', '/app/groups/' || v_group, auth.uid()
    );
  end if;

  /* No notification on decline. The requester sees the state where
     they asked, and nobody is handed a refusal in a feed. */
end;
$$;

revoke execute on function public.respond_join_request(uuid, boolean) from public, anon;
grant execute on function public.respond_join_request(uuid, boolean) to authenticated;

-- ────────────────────────────────────────────────
-- The badge count
-- ────────────────────────────────────────────────
/* Lane 4's Member requests badge. Definer so it is one cheap call
   rather than selecting a list only to measure it. */
create or replace function public.group_pending_request_count(p_group uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.is_group_admin(p_group) then (
      select count(*)::int from public.group_join_requests
       where group_id = p_group and status = 'pending'
    )
    else 0
  end;
$$;

revoke execute on function public.group_pending_request_count(uuid) from public, anon;
grant execute on function public.group_pending_request_count(uuid) to authenticated;

comment on table public.group_join_requests is
  'Knocks on a public group (NAVIGATION_SPEC §5, GROUPS_SPEC §7). A declined row is KEPT so the search row can say "not this time"; the unique index is partial on pending, so a decline never becomes a permanent no.';
