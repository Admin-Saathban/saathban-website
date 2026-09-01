/* "Hide this post" hid nothing.

   The menu row called onAction("hide", post). onAction has branches
   for offerHelp, withdrawHelp, reopenHelp, helpDone, report,
   reportComment, mute, block, delete, dm, joinWalk, joinActivity,
   openGameTable and claimGameSeat — and none for hide. The tap fell
   through the chain, wrote nothing, said nothing, and the post stayed
   exactly where it was. There was no table behind it either.

   This is the third thing found this round whose failure was silence
   rather than an error, after the groups UPDATE that matched no policy
   and the share sheet that toasted without writing.

   Hiding is per person and private: it is one reader deciding they
   have seen enough of one post, and it is nobody else's business —
   not the author's, not another reader's. Hence the same shape as
   post_saves (0077): a two-column table, "mine only", and no notion of
   who hid what beyond the person themselves. */

create table if not exists public.post_hides (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);

create index if not exists post_hides_person_idx on public.post_hides (profile_id);

alter table public.post_hides enable row level security;

drop policy if exists "hides: mine only" on public.post_hides;
create policy "hides: mine only"
  on public.post_hides for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

/* The grant matters as much as the policy: without it the write fails
   on privilege before RLS is ever consulted. */
grant select, insert, delete on public.post_hides to authenticated;
