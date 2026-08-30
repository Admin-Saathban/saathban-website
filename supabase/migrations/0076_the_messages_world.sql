-- 0076 — what the Messages world needs to exist.  APPLIED 2026-08-30.
--
-- MESSAGES_SPEC.md §3, §5 and §6. The inside of a thread is untouched —
-- PRODUCT_DECISIONS §6 governs it and this migration deliberately adds
-- nothing to dm_messages' shape beyond a place to put a heart.
--
-- ONE HEART, ONE TAP (§6). A reactions table rather than a column, because
-- both people in a thread may like the same message and a column could hold
-- only one of them. The primary key is (message, person), which IS the rule:
-- the same person cannot like the same message twice, so "tap again to
-- remove" is a delete and there is no counter to get wrong. §6 is explicit
-- that reactions award no points and carry no badge, so nothing here writes
-- to points and nothing aggregates.
--
-- ARCHIVING (§5.1) is per person, not per thread: I may tidy a conversation
-- away without doing anything to yours. Hence (profile, request) and not a
-- flag on dm_requests.
--
-- PRESENCE (§5.4) is a timestamp plus a switch, and deliberately nothing
-- more. No channel, no heartbeat loop, no "typing" — a last_seen_at the
-- client touches when the app is open answers "is she about?" at a fraction
-- of the cost, and it degrades to silence rather than to a lie when the
-- network drops. The owner's ruling that presence is on by default is
-- recorded in the spec along with the concern it overrules, so the default
-- here is true and the switch is one tap away.
--
-- READ RECEIPTS (§5.5) do NOT change what is stored. dm_messages.read_at is
-- how a person's own unread dot is computed and must keep working whatever
-- they choose; the switch governs whether the OTHER person is shown it. So
-- this adds a preference and changes no write path.

alter table public.profiles
  add column if not exists show_presence boolean not null default true,
  add column if not exists read_receipts boolean not null default true,
  add column if not exists last_seen_at  timestamptz;

comment on column public.profiles.show_presence is
  'MESSAGES_SPEC 5.4 - let friends see when I am about. Owner ruling: on by default.';
comment on column public.profiles.read_receipts is
  'MESSAGES_SPEC 5.5 - let the other person see that I have read. Never changes what is stored.';
comment on column public.profiles.last_seen_at is
  'MESSAGES_SPEC 5.4 - touched while the app is open. Shown only to connections, and only when show_presence.';

-- The world reads these three through safe_profiles like everything else.
-- Appended after every column the view already has: CREATE OR REPLACE VIEW
-- cannot reorder or rename, and another lane added interests/about/
-- about_prompt since this view was last widened. Checking the live column
-- list first is cheaper than the error that taught me to.
create or replace view public.safe_profiles as
  select id, role, full_name, avatar_url, city, languages, is_org, created_at, area,
         interests, about, about_prompt,
         show_presence, read_receipts, last_seen_at
  from public.profiles
  where not is_blocked;

grant select on public.safe_profiles to authenticated;

/* ─── One heart, one tap (§6) ─── */

create table if not exists public.dm_message_likes (
  message_id uuid not null references public.dm_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);

alter table public.dm_message_likes enable row level security;

-- Readable and writable by the two people in the thread, and nobody else:
-- is_dm_participant() is the same gate the messages themselves use, so a
-- heart can never be more visible than the message it sits on.
drop policy if exists "dm likes: participants read" on public.dm_message_likes;
create policy "dm likes: participants read"
  on public.dm_message_likes for select
  using (exists (
    select 1 from public.dm_messages m
    where m.id = message_id and public.is_dm_participant(m.request_id)
  ));

drop policy if exists "dm likes: react to a message in your thread" on public.dm_message_likes;
create policy "dm likes: react to a message in your thread"
  on public.dm_message_likes for insert
  with check (
    profile_id = auth.uid()
    and public.account_ok()
    and exists (
      select 1 from public.dm_messages m
      where m.id = message_id and public.dm_open(m.request_id)
    )
  );

-- Tap again to remove: only your own heart, and no gate beyond that. A
-- person must always be able to take back a gesture even if the thread
-- has since closed.
drop policy if exists "dm likes: take it back" on public.dm_message_likes;
create policy "dm likes: take it back"
  on public.dm_message_likes for delete
  using (profile_id = auth.uid());

grant select, insert, delete on public.dm_message_likes to authenticated;

/* ─── Archived chats (§5.1) ─── */

create table if not exists public.dm_archived (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  request_id  uuid not null references public.dm_requests(id) on delete cascade,
  archived_at timestamptz not null default now(),
  primary key (profile_id, request_id)
);

alter table public.dm_archived enable row level security;

drop policy if exists "archived: mine only" on public.dm_archived;
create policy "archived: mine only"
  on public.dm_archived for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and public.is_dm_participant(request_id));

grant select, insert, delete on public.dm_archived to authenticated;

/* ─── Presence, touched by the client while the app is open ─── */

create or replace function public.touch_presence()
returns void
language sql security definer set search_path = public, pg_temp
as $fn$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$fn$;

revoke execute on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;
