-- ============================================================================
-- 0014 — Community v1 (SPEC.md, Community)
--
-- Icons post; the official org account posts announcements; everyone
-- else reads. Chronological only — there is no algorithm to build.
-- Block, report, and mute on every post and comment. DMs are
-- request-gated: request → accept before any message lands.
--
-- Conservative readings taken here (each logged in QUESTIONS.md):
--   - Saath-Buddies see the community only once ACTIVE (a Buddy has no
--     access to Icon-authored content before vetting completes).
--   - Comments follow the posting rule: Icons + org write, others read.
--   - Reactions are open to every community reader (non-verbal).
--   - A block is one-directional and silent: it hides the blocked
--     person's content from the blocker and closes DMs both ways;
--     the blocked person is never notified. Mute hides content only.
--   - Reports carry a text snapshot taken at report time, so admins
--     can moderate reported DMs WITHOUT any ability to read DM threads.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Access helpers
-- ----------------------------------------------------------------------------

-- Who may see the community at all: Icons, Fam, admins, the org
-- account — and Buddies only once their application is active.
create or replace function public.can_use_community()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and not p.is_paused and not p.is_blocked
      and (
        p.role in ('saath_icon', 'family_member', 'admin')
        or p.is_org
        or (p.role = 'saath_buddy' and public.is_active_buddy(p.id))
      )
  );
$$;

-- Who may write posts and comments: Icons and the org account.
create or replace function public.can_post_community()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and not p.is_paused and not p.is_blocked
      and (p.role = 'saath_icon' or p.is_org)
  );
$$;

-- ----------------------------------------------------------------------------
-- Blocks and mutes — the blocker's own private list. Nobody else
-- (including the blocked person) can see these rows: no notification,
-- mirroring the circle's removal rule.
-- ----------------------------------------------------------------------------
create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  kind       text not null default 'block' check (kind in ('block', 'mute')),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id, kind),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon;

-- Only the blocker sees, creates, and removes their own entries.
create policy "own blocks: read" on public.user_blocks
  for select using (blocker_id = auth.uid());
create policy "own blocks: create" on public.user_blocks
  for insert with check (blocker_id = auth.uid() and public.account_ok());
create policy "own blocks: remove" on public.user_blocks
  for delete using (blocker_id = auth.uid());

-- Has the CALLER blocked or muted this author? (Both hide content
-- from the caller; only 'block' also closes DMs.) Defined after
-- user_blocks: SQL-language bodies are parsed at creation time.
create or replace function public.caller_hides(p_author uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_blocks
    where blocker_id = auth.uid() and blocked_id = p_author
  );
$$;

-- ----------------------------------------------------------------------------
-- Posts — chronological feed, text + optional image.
-- ----------------------------------------------------------------------------
create table public.community_posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  image_path text,               -- path inside the public community-images bucket
  hidden_at  timestamptz,        -- moderation hide (soft, reversible)
  hidden_by  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index community_posts_feed_idx on public.community_posts (created_at desc);

alter table public.community_posts enable row level security;
revoke all on public.community_posts from anon;

-- Readers see the visible feed, minus anyone they've blocked or muted.
-- Admins additionally see hidden posts (they moderate them).
create policy "posts: read" on public.community_posts
  for select using (
    public.is_admin()
    or (
      public.can_use_community()
      and hidden_at is null
      and not public.caller_hides(author_id)
    )
  );

-- Icons and the org account post as themselves.
create policy "posts: icons and org write" on public.community_posts
  for insert with check (author_id = auth.uid() and public.can_post_community());

-- Authors can take their own post down entirely.
create policy "posts: author deletes own" on public.community_posts
  for delete using (author_id = auth.uid());

-- Admins hide/unhide (moderation); authors don't edit in v1.
create policy "posts: admin moderates" on public.community_posts
  for update using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Reactions — one per person per post, from a small warm set.
-- ----------------------------------------------------------------------------
create table public.post_reactions (
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null default '👍' check (emoji in ('👍', '❤️', '🌸', '🤲')),
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

alter table public.post_reactions enable row level security;
revoke all on public.post_reactions from anon;

-- Any community reader sees counts and may react; reactions are the
-- one non-verbal way "everyone else reads" can still wave back.
create policy "reactions: read" on public.post_reactions
  for select using (public.can_use_community());
create policy "reactions: react" on public.post_reactions
  for insert with check (profile_id = auth.uid() and public.can_use_community());
create policy "reactions: unreact" on public.post_reactions
  for delete using (profile_id = auth.uid());
create policy "reactions: change" on public.post_reactions
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Comments — same visibility and same writing rule as posts.
-- ----------------------------------------------------------------------------
create table public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  hidden_at  timestamptz,
  hidden_by  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index post_comments_post_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;
revoke all on public.post_comments from anon;

create policy "comments: read" on public.post_comments
  for select using (
    public.is_admin()
    or (
      public.can_use_community()
      and hidden_at is null
      and not public.caller_hides(author_id)
    )
  );
create policy "comments: icons and org write" on public.post_comments
  for insert with check (author_id = auth.uid() and public.can_post_community());
create policy "comments: author deletes own" on public.post_comments
  for delete using (author_id = auth.uid());
create policy "comments: admin moderates" on public.post_comments
  for update using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Reports — one queue for posts, comments, and DM messages.
--
-- target_excerpt is a snapshot the reporter's client takes of what it
-- is reporting. For DMs this is load-bearing: admins moderate the
-- reported message from the snapshot and NEVER gain read access to
-- the thread itself.
-- ----------------------------------------------------------------------------
create table public.community_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  target_kind      text not null check (target_kind in ('post', 'comment', 'dm_message')),
  target_id        uuid not null,
  target_author_id uuid references public.profiles (id) on delete set null,
  target_excerpt   text,
  reason           text,
  status           text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by      uuid references public.profiles (id) on delete set null,
  resolved_at      timestamptz,
  resolution_note  text,
  created_at       timestamptz not null default now()
);

create index community_reports_queue_idx on public.community_reports (status, created_at);

alter table public.community_reports enable row level security;
revoke all on public.community_reports from anon;

-- Anyone signed in and in good standing can report; they see only
-- their own reports afterwards (so "reported" state can render).
create policy "reports: file" on public.community_reports
  for insert with check (reporter_id = auth.uid() and public.account_ok());
create policy "reports: reporter reads own" on public.community_reports
  for select using (reporter_id = auth.uid());
-- Admins run the queue.
create policy "reports: admins read" on public.community_reports
  for select using (public.is_admin());
create policy "reports: admins decide" on public.community_reports
  for update using (public.is_admin());

-- Every moderation decision writes the audit log — same shape as the
-- buddy-status trigger, so a plain UPDATE can never decide silently.
create or replace function public.on_report_status_change()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    new.resolved_by := coalesce(new.resolved_by, auth.uid());
    new.resolved_at := now();
    insert into public.audit_log (actor_id, action, target_profile_id, reason, detail)
    values (
      auth.uid(),
      'moderation_decision',
      new.target_author_id,
      new.resolution_note,
      jsonb_build_object(
        'report_id', new.id,
        'target_kind', new.target_kind,
        'target_id', new.target_id,
        'from', old.status,
        'to', new.status
      )
    );
  end if;
  return new;
end;
$$;

create trigger community_reports_status_audit
  before update on public.community_reports
  for each row execute function public.on_report_status_change();

-- ----------------------------------------------------------------------------
-- DMs — request-gated (SPEC.md: request → accept before any message
-- lands). Requests are created only through send_dm_request(), which
-- rate-limits; a request from someone the recipient has blocked stays
-- invisible to the recipient — never an error the sender could learn
-- from.
-- ----------------------------------------------------------------------------
create table public.dm_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  unique (requester_id, recipient_id),
  check (requester_id <> recipient_id)
);

create table public.dm_messages (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.dm_requests (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index dm_messages_thread_idx on public.dm_messages (request_id, created_at);

-- Participant checks live in SECURITY DEFINER helpers so the
-- dm_messages policies never recurse through dm_requests RLS.
create or replace function public.is_dm_participant(p_request uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.dm_requests r
    where r.id = p_request
      and (r.requester_id = auth.uid() or r.recipient_id = auth.uid())
  );
$$;

-- A thread is open for writing when the request was accepted and
-- NEITHER side has a 'block' against the other.
create or replace function public.dm_open(p_request uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.dm_requests r
    where r.id = p_request
      and r.status = 'accepted'
      and (r.requester_id = auth.uid() or r.recipient_id = auth.uid())
      and not exists (
        select 1 from public.user_blocks b
        where b.kind = 'block'
          and ((b.blocker_id = r.requester_id and b.blocked_id = r.recipient_id)
            or (b.blocker_id = r.recipient_id and b.blocked_id = r.requester_id))
      )
  );
$$;

alter table public.dm_requests enable row level security;
alter table public.dm_messages enable row level security;
revoke all on public.dm_requests from anon;
revoke all on public.dm_messages from anon;

-- The requester always sees their own requests; the recipient sees
-- incoming ones EXCEPT from people they've blocked (those sit
-- pending, invisible — the sender can't tell the difference).
create policy "dm requests: participants read" on public.dm_requests
  for select using (
    requester_id = auth.uid()
    or (recipient_id = auth.uid() and not public.caller_hides(requester_id))
  );

-- The recipient answers (accept/decline). A trigger freezes the pair.
create policy "dm requests: recipient decides" on public.dm_requests
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- No direct insert: requests go through send_dm_request() below.

-- Only participants read a thread, and only while its request stands.
create policy "dm messages: participants read" on public.dm_messages
  for select using (public.is_dm_participant(request_id));

-- Sending needs an accepted request and no block in either direction.
create policy "dm messages: send in open thread" on public.dm_messages
  for insert with check (
    sender_id = auth.uid() and public.dm_open(request_id) and public.account_ok()
  );

-- The other participant may mark a message read (nothing else — a
-- trigger freezes body and sender).
create policy "dm messages: mark read" on public.dm_messages
  for update using (sender_id <> auth.uid() and public.is_dm_participant(request_id));

-- Freeze immutable columns against creative UPDATEs.
create or replace function public.freeze_dm_columns()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'dm_requests' then
    if new.requester_id is distinct from old.requester_id
       or new.recipient_id is distinct from old.recipient_id then
      raise exception 'The two sides of a request cannot change';
    end if;
    if new.status is distinct from old.status then
      new.decided_at := now();
    end if;
  else
    if new.request_id is distinct from old.request_id
       or new.sender_id is distinct from old.sender_id
       or new.body is distinct from old.body
       or new.created_at is distinct from old.created_at then
      raise exception 'Messages cannot be edited';
    end if;
  end if;
  return new;
end;
$$;

create trigger dm_requests_freeze
  before update on public.dm_requests
  for each row execute function public.freeze_dm_columns();
create trigger dm_messages_freeze
  before update on public.dm_messages
  for each row execute function public.freeze_dm_columns();

-- Request creation: rate-limited (SPEC.md: rate limits on outgoing
-- requests), idempotent per pair, and silent about blocks.
create or replace function public.send_dm_request(p_recipient uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  if not exists (
    select 1 from public.profiles where id = p_recipient and not is_blocked
  ) or p_recipient = auth.uid() then
    raise exception 'That request cannot be sent';
  end if;
  -- The caller blocking someone and then DMing them makes no sense.
  if public.caller_hides(p_recipient) then
    raise exception 'That request cannot be sent';
  end if;

  -- One pair, one request; asking again just returns the same row —
  -- including after a decline, which the requester never learns about.
  select id into v_id from public.dm_requests
  where requester_id = auth.uid() and recipient_id = p_recipient;
  if v_id is not null then
    return v_id;
  end if;

  if (
    select count(*) from public.dm_requests
    where requester_id = auth.uid() and created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'Too many requests today — please try again tomorrow';
  end if;

  insert into public.dm_requests (requester_id, recipient_id)
  values (auth.uid(), p_recipient)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.send_dm_request(uuid) from public, anon;
grant execute on function public.send_dm_request(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Storage: community-images. PUBLIC-read by design (feed images are
-- public content), 5 MB, images only. Only people who can post upload,
-- into their own folder.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-images',
  'community-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "community images: posters upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.can_post_community()
  );

-- No client update/delete: cleanup of orphaned images is an admin /
-- service-role job.
