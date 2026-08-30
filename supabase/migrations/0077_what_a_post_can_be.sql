-- 0077 — what a post can be.  APPLIED 2026-08-30.
--
-- POSTS_SPEC.md §2 visibility, §3 colour, §4 style tags, §5 tagging,
-- §6 help posts, §10 the menus' saving, following and pinning.
--
-- THE MISSING VERB WAS UPDATE. community_posts had exactly one update
-- policy — is_admin() — so an author could delete a post but never change
-- one. Every item in §10.1 (edit, change who can see it, turn off replies,
-- pin) and the whole of §6's Asked → Someone's coming → Done depends on an
-- author being able to update their own row, so that policy is the hinge
-- this migration turns on.
--
-- VISIBILITY IS ENFORCED IN THE READ POLICY, not in a filter. §2 offers
-- "Just for me" and renames it from "Only me" precisely so people will use
-- it for journaling; a diary kept honest by a WHERE clause in the client is
-- not a diary. So the policy itself decides, and a friends-only post is
-- invisible to a stranger at the database.
--
-- ONE THING I DID NOT DECIDE ALONE: is_admin() still bypasses this policy,
-- as it always has, which means a super-admin can read a "Just for me" post.
-- Tightening it would have been a unilateral weakening of moderation, and
-- leaving it is a real privacy question about a feature explicitly sold as
-- journaling. Unchanged here, raised in the report and for QUESTIONS.md.
--
-- HELP POSTS (§6) get three states and a wanted-count on the post, and the
-- offers get their own table. The offer is a BUTTON, separate from the talk
-- (§6.2) — a comment thread under a request for help produces sympathy and
-- no help — so an offer is a row here and not a comment. §6.7's "no counter
-- of unanswered requests, anywhere, ever" is honoured by there being nothing
-- in this schema that could produce one: no aggregate, no view, no count
-- column on the asker.
--
-- §6.3's CLOSE is a state plus an optional line, so "my nephew did it" can
-- be the truth without crediting a member who did nothing, and the offers
-- stop either way. Delete stays available; it is not the default.

/* ─── The post itself ─── */

alter table public.community_posts
  add column if not exists visibility   text not null default 'public',
  add column if not exists style_tag    text,
  add column if not exists colour       smallint,
  add column if not exists replies_off  boolean not null default false,
  add column if not exists pinned_at    timestamptz,
  add column if not exists edited_at    timestamptz,
  add column if not exists help_state   text,
  add column if not exists help_wanted  smallint not null default 1,
  add column if not exists help_note    text;

alter table public.community_posts drop constraint if exists community_posts_visibility_check;
alter table public.community_posts add constraint community_posts_visibility_check
  check (visibility in ('public', 'friends', 'private'));

-- §4's four, and nothing else. A fifth tag is a product decision, not a
-- string somebody can pass in.
alter table public.community_posts drop constraint if exists community_posts_style_tag_check;
alter table public.community_posts add constraint community_posts_style_tag_check
  check (style_tag is null or style_tag in ('milestone', 'good', 'memory', 'help'));

-- §3: six warm swatches plus plain. Plain is null.
alter table public.community_posts drop constraint if exists community_posts_colour_check;
alter table public.community_posts add constraint community_posts_colour_check
  check (colour is null or colour between 0 and 5);

alter table public.community_posts drop constraint if exists community_posts_help_state_check;
alter table public.community_posts add constraint community_posts_help_state_check
  check (help_state is null or help_state in ('asked', 'done', 'closed'));

alter table public.community_posts drop constraint if exists community_posts_help_wanted_check;
alter table public.community_posts add constraint community_posts_help_wanted_check
  check (help_wanted between 1 and 20);

comment on column public.community_posts.visibility is
  'POSTS_SPEC 2 - public | friends | private ("Just for me"). Enforced in the read policy.';
comment on column public.community_posts.style_tag is
  'POSTS_SPEC 4 - milestone | good | memory | help. Declared by the person, which is what lets a milestone earn a badge without the app inventing meaning.';
comment on column public.community_posts.colour is
  'POSTS_SPEC 3 - swatch index 0-5, NULL for plain. Applies to short text only; the client renders long or photo posts plain.';
comment on column public.community_posts.help_state is
  'POSTS_SPEC 6.1 - asked | done | closed. "Someone is coming" is derived from the offers, never stored.';

-- §2 — a post is only as visible as its author said.
drop policy if exists "posts: read" on public.community_posts;
create policy "posts: read"
  on public.community_posts for select
  using (
    is_admin()
    or (
      can_use_community()
      and hidden_at is null
      and not caller_hides(author_id)
      and (
        visibility = 'public'
        or author_id = auth.uid()
        or (visibility = 'friends' and public.are_friends(auth.uid(), author_id))
      )
    )
  );

-- The hinge: an author may change their own post. Deliberately narrow —
-- they cannot move it to another author, and moderation's hidden_at stays
-- an admin matter, so a post cannot be un-hidden by the person who wrote it.
drop policy if exists "posts: author edits own" on public.community_posts;
create policy "posts: author edits own"
  on public.community_posts for update
  using (author_id = auth.uid() and account_ok())
  with check (author_id = auth.uid());

/* ─── §6 Help offers ─── */

create table if not exists public.post_help_offers (
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  helper_id   uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  note        text,
  removed_at  timestamptz,
  removed_by  uuid references public.profiles(id),
  primary key (post_id, helper_id)
);

alter table public.post_help_offers enable row level security;

-- Anyone who can see the post can see who is coming (§6.1's tinted strip
-- names the helper to everybody, so nobody offers into a filled slot
-- unknowingly).
drop policy if exists "offers: visible with the post" on public.post_help_offers;
create policy "offers: visible with the post"
  on public.post_help_offers for select
  using (exists (select 1 from public.community_posts p where p.id = post_id));

drop policy if exists "offers: I can offer" on public.post_help_offers;
create policy "offers: I can offer"
  on public.post_help_offers for insert
  with check (
    helper_id = auth.uid()
    and account_ok()
    and can_use_community()
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id and p.style_tag = 'help'
        and coalesce(p.help_state, 'asked') = 'asked'
        and p.author_id <> auth.uid()
    )
  );

-- Take back your own offer; a moderator may remove one (§6.2), which
-- reopens the slot. The moderator tells them — silent removal means that
-- person never helps again.
drop policy if exists "offers: withdraw or moderate" on public.post_help_offers;
create policy "offers: withdraw or moderate"
  on public.post_help_offers for delete
  using (helper_id = auth.uid() or is_admin());

grant select, insert, delete on public.post_help_offers to authenticated;

/* ─── §5 Tagging — "With someone" ─── */

alter table public.profiles
  add column if not exists allow_tagging boolean not null default true;

comment on column public.profiles.allow_tagging is
  'POSTS_SPEC 5 - a person can turn tagging off entirely.';

create table if not exists public.post_tags (
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  person_id  uuid not null references public.profiles(id) on delete cascade,
  accepted   boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (post_id, person_id)
);

alter table public.post_tags enable row level security;

drop policy if exists "tags: visible with the post" on public.post_tags;
create policy "tags: visible with the post"
  on public.post_tags for select
  using (exists (select 1 from public.community_posts p where p.id = post_id));

drop policy if exists "tags: the author tags" on public.post_tags;
create policy "tags: the author tags"
  on public.post_tags for insert
  with check (
    exists (select 1 from public.community_posts p where p.id = post_id and p.author_id = auth.uid())
    and exists (select 1 from public.profiles t where t.id = person_id and t.allow_tagging)
  );

-- §5: the tagged person can REMOVE THE TAG. So can the author.
drop policy if exists "tags: the tagged person decides" on public.post_tags;
create policy "tags: the tagged person decides"
  on public.post_tags for update
  using (person_id = auth.uid())
  with check (person_id = auth.uid());

drop policy if exists "tags: remove" on public.post_tags;
create policy "tags: remove"
  on public.post_tags for delete
  using (
    person_id = auth.uid()
    or exists (select 1 from public.community_posts p where p.id = post_id and p.author_id = auth.uid())
  );

grant select, insert, update, delete on public.post_tags to authenticated;

/* ─── §10.2 Save this, and Tell me about replies ─── */

create table if not exists public.post_saves (
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
alter table public.post_saves enable row level security;
drop policy if exists "saves: mine only" on public.post_saves;
create policy "saves: mine only"
  on public.post_saves for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
grant select, insert, delete on public.post_saves to authenticated;

create table if not exists public.post_follows (
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
alter table public.post_follows enable row level security;
drop policy if exists "follows: mine only" on public.post_follows;
create policy "follows: mine only"
  on public.post_follows for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
grant select, insert, delete on public.post_follows to authenticated;
