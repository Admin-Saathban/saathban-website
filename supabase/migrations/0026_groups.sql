-- ============================================================================
-- 0026 — Friend groups
--
-- Any Saath-Icon makes a group freely (no admin approval). Members are invited
-- from the inviter's connections — circle members (0005) or community friends
-- (an accepted DM, 0014/0019) — and mixed roles are welcome (Icons, Fam, active
-- Buddies): exactly can_use_community(), the same gate the games invites use.
-- Invites ride the notification rails (one-tap accept). Each group has a feed
-- (any member posts) and a chat, a member list anyone can leave, and the
-- creator can remove a member with one tap and no notification — mirroring the
-- circle's removal rule (0005).
--
-- Moderation reuses the community machinery: report-a-group and
-- report-group-content land in community_reports (0014) with new target kinds,
-- and the admin queue's Hide soft-hides via hidden_at/hidden_by on these tables.
-- Blocks carry over: content from someone you've blocked stays hidden, and a
-- group whose creator you've blocked drops out of your list.
-- ============================================================================

-- Connections reuse the canonical predicate public.game_connected(a,b) from
-- 0025 (circle both directions; friends/matching plug in there later) OR-ed
-- with an accepted DM here, since "community friends" (an accepted DM) is not
-- yet part of game_connected. When it absorbs friends, the OR is redundant.

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  created_by  uuid not null references public.profiles (id) on delete cascade,
  hidden_at   timestamptz,   -- moderation soft-hide
  hidden_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index groups_creator_idx on public.groups (created_by);

create trigger groups_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

create table public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'member' check (role in ('creator', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, member_id)
);

create index group_members_person_idx on public.group_members (member_id);

create table public.group_invites (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (group_id, invitee_id)
);

create index group_invites_invitee_idx on public.group_invites (invitee_id) where status = 'pending';

create table public.group_posts (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  hidden_at  timestamptz,
  hidden_by  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index group_posts_feed_idx on public.group_posts (group_id, created_at desc);

create table public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index group_messages_thread_idx on public.group_messages (group_id, created_at);

-- ----------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER — policies never recurse through RLS).
-- ----------------------------------------------------------------------------
create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and member_id = auth.uid()
  );
$$;

create or replace function public.is_group_creator(p_group uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.groups where id = p_group and created_by = auth.uid()
  );
$$;

-- Can the caller see this group at all? A member, an invitee (so the invite
-- shows a name), or an admin.
create or replace function public.can_see_group(p_group uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_admin()
    or public.is_group_member(p_group)
    or exists (
      select 1 from public.group_invites
      where group_id = p_group and invitee_id = auth.uid() and status = 'pending'
    );
$$;

-- ----------------------------------------------------------------------------
-- Row-level security
-- ----------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_posts enable row level security;
alter table public.group_messages enable row level security;
revoke all on public.groups from anon;
revoke all on public.group_members from anon;
revoke all on public.group_invites from anon;
revoke all on public.group_posts from anon;
revoke all on public.group_messages from anon;

-- groups: members/invitees/admins read; a group whose creator the caller has
-- blocked drops out (block semantics). Admins see hidden ones (they moderate).
create policy "groups: read" on public.groups
  for select using (
    public.is_admin()
    or (public.can_see_group(id) and not public.caller_hides(created_by)
        and (hidden_at is null or public.is_group_member(id)))
  );
-- Writes go through the RPCs; the admin moderates (hide/unhide).
create policy "groups: admin moderates" on public.groups
  for update using (public.is_admin());

-- group_members: a member sees the whole roster; admins too.
create policy "group members: read" on public.group_members
  for select using (public.is_group_member(group_id) or public.is_admin());

-- group_invites: the invitee and the inviter see them.
create policy "group invites: read" on public.group_invites
  for select using (invitee_id = auth.uid() or inviter_id = auth.uid());

-- group_posts: members read the visible feed (minus blocked authors); admins
-- read all (moderation). Members post as themselves; authors delete their own.
create policy "group posts: read" on public.group_posts
  for select using (
    public.is_admin()
    or (public.is_group_member(group_id) and hidden_at is null and not public.caller_hides(author_id))
  );
create policy "group posts: members write" on public.group_posts
  for insert with check (
    author_id = auth.uid() and public.account_ok() and public.is_group_member(group_id)
  );
create policy "group posts: author deletes own" on public.group_posts
  for delete using (author_id = auth.uid());
create policy "group posts: admin moderates" on public.group_posts
  for update using (public.is_admin());

-- group_messages: members read + write; blocked senders stay hidden.
create policy "group messages: read" on public.group_messages
  for select using (
    public.is_group_member(group_id) and not public.caller_hides(sender_id)
  );
create policy "group messages: members write" on public.group_messages
  for insert with check (
    sender_id = auth.uid() and public.account_ok() and public.is_group_member(group_id)
  );

-- ----------------------------------------------------------------------------
-- RPCs
-- ----------------------------------------------------------------------------

-- Create a group (Icon only, no approval); the creator becomes its first member.
create or replace function public.create_group(p_name text, p_description text default null)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if public.app_role() is distinct from 'saath_icon' or not public.account_ok() then
    raise exception 'Only a Saath-Icon can start a group';
  end if;
  if coalesce(char_length(btrim(p_name)), 0) < 1 then
    raise exception 'Please give the group a name';
  end if;

  insert into public.groups (name, description, created_by)
  values (btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), auth.uid())
  returning id into v_id;

  insert into public.group_members (group_id, member_id, role)
  values (v_id, auth.uid(), 'creator');
  return v_id;
end;
$$;

revoke execute on function public.create_group(text, text) from public, anon;
grant execute on function public.create_group(text, text) to authenticated;

-- Invite a connection into a group. Any member may invite; the invitee must be
-- one of the INVITER's connections (circle or accepted DM), must be able to use
-- the community (Icons/Fam/active Buddies), and must not be on either block
-- side. Rides the notification rails with a deep link.
create or replace function public.invite_to_group(p_group uuid, p_invitee uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id      uuid;
  v_gname   text;
  v_inviter text;
begin
  if not public.is_group_member(p_group) or not public.account_ok() then
    raise exception 'Only a member can invite to this group';
  end if;
  if p_invitee = auth.uid() then
    raise exception 'You are already in this group';
  end if;
  -- Connection required: circle (canonical game_connected) or a community
  -- friend (an accepted DM between the two).
  if not (
    public.game_connected(auth.uid(), p_invitee)
    or exists (
      select 1 from public.dm_requests
      where status = 'accepted'
        and ((requester_id = auth.uid() and recipient_id = p_invitee)
          or (requester_id = p_invitee and recipient_id = auth.uid()))
    )
  ) then
    raise exception 'You can only invite your circle or your community friends';
  end if;
  -- Invitee must be community-eligible (this is the mixed-role rule).
  if not exists (
    select 1 from public.profiles p
    where p.id = p_invitee and not p.is_paused and not p.is_blocked
      and (p.role in ('saath_icon','family_member','admin') or p.is_org
           or (p.role = 'saath_buddy' and public.is_active_buddy(p.id)))
  ) then
    raise exception 'That person cannot be invited';
  end if;
  -- Respect blocks in either direction (silent — same as everywhere).
  if public.caller_hides(p_invitee) or exists (
    select 1 from public.user_blocks
    where kind = 'block' and blocker_id = p_invitee and blocked_id = auth.uid()
  ) then
    raise exception 'That person cannot be invited';
  end if;
  if exists (select 1 from public.group_members where group_id = p_group and member_id = p_invitee) then
    raise exception 'They are already a member';
  end if;

  insert into public.group_invites (group_id, inviter_id, invitee_id)
  values (p_group, auth.uid(), p_invitee)
  on conflict (group_id, invitee_id) do update set status = 'pending', decided_at = null
  returning id into v_id;

  select name into v_gname from public.groups where id = p_group;
  select full_name into v_inviter from public.profiles where id = auth.uid();
  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (
    p_invitee, 'A group invitation',
    coalesce(v_inviter, 'A friend') || ' invited you to the group ' || chr(8220) || v_gname || chr(8221) || '.',
    'group', '/app/groups/' || p_group, auth.uid()
  );
  return v_id;
end;
$$;

revoke execute on function public.invite_to_group(uuid, uuid) from public, anon;
grant execute on function public.invite_to_group(uuid, uuid) to authenticated;

-- One-tap accept/decline of a group invitation.
create or replace function public.respond_group_invite(p_invite uuid, p_accept boolean)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  inv public.group_invites%rowtype;
begin
  select * into inv from public.group_invites where id = p_invite for update;
  if inv.invitee_id is distinct from auth.uid() or inv.status <> 'pending' then
    raise exception 'That invitation is not yours to answer';
  end if;
  update public.group_invites
  set status = case when p_accept then 'accepted' else 'declined' end, decided_at = now()
  where id = p_invite;
  if p_accept then
    insert into public.group_members (group_id, member_id)
    values (inv.group_id, auth.uid())
    on conflict (group_id, member_id) do nothing;
  end if;
  return inv.group_id;
end;
$$;

revoke execute on function public.respond_group_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_group_invite(uuid, boolean) to authenticated;

-- The creator removes a member — one tap, no notification (circle's rule). The
-- creator cannot remove themselves this way (that's leave_group).
create or replace function public.remove_group_member(p_group uuid, p_member uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_group_creator(p_group) then
    raise exception 'Only the group''s creator can remove someone';
  end if;
  if p_member = auth.uid() then
    raise exception 'To leave your own group, use leave';
  end if;
  delete from public.group_members where group_id = p_group and member_id = p_member;
end;
$$;

revoke execute on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

-- Leave a group at any time. If the creator leaves, the group is closed
-- (cascade removes everyone and all content) — no orphaned groups in v1.
create or replace function public.leave_group(p_group uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_group_member(p_group) then
    raise exception 'You are not in this group';
  end if;
  if public.is_group_creator(p_group) then
    delete from public.groups where id = p_group; -- cascades members/posts/chat
  else
    delete from public.group_members where group_id = p_group and member_id = auth.uid();
  end if;
end;
$$;

revoke execute on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Moderation: report a group or group content into the community queue (0014).
-- The community_reports insert policy (reporter = auth.uid() + account_ok)
-- already governs writes; we only widen the allowed target kinds. The admin
-- queue's Hide soft-hides via hidden_at/hidden_by on groups / group_posts.
-- ----------------------------------------------------------------------------
alter table public.community_reports drop constraint community_reports_target_kind_check;
alter table public.community_reports add constraint community_reports_target_kind_check
  check (target_kind in ('post', 'comment', 'dm_message', 'park_board', 'group', 'group_post'));
