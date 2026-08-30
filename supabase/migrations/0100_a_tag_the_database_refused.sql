-- 0100 — the tag policy asked a question the tagger could not answer.
-- APPLIED 2026-08-30.  (First in this lane's SECOND range, 0100-0109;
-- 0070-0079 was exhausted. The range is claimed in MIGRATIONS.md.)
--
-- 0077's insert policy on post_tags read public.profiles directly:
--
--   and exists (select 1 from public.profiles t
--               where t.id = person_id and t.allow_tagging)
--
-- profiles is RLS'd and a person cannot read somebody else's row — that is
-- the entire reason safe_profiles exists. So the EXISTS was false for every
-- tag of anybody but yourself, the policy refused every insert, and
-- createPost swallowed the failure so the post still appeared. Tagging was
-- refused at the database and looked, from the screen, like it had worked.
--
-- Measured before fixing, as the Icon, against a real post of theirs:
--   clause 1, the post is mine                 -> 1
--   clause 2, read their profiles row          -> 0     <- refused here
--   the same person through safe_profiles      -> 1
--
-- The fix is the pattern the rest of the schema already uses for exactly
-- this: a SECURITY DEFINER helper, so the policy asks the DATABASE whether
-- tagging is allowed instead of requiring the caller to prove they can read
-- a row they are not entitled to. can_use_community_profile() and
-- have_met() are the same shape.
--
-- The switch keeps working the way POSTS_SPEC §5 promises: allow_tagging
-- false still refuses the insert, now for the right reason rather than by
-- accident. Verified both ways round after applying — a person who allows
-- tagging is tagged and notified, a person who has switched it off refuses
-- the insert.

create or replace function public.tagging_allowed(p_person uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select coalesce((select allow_tagging from public.profiles where id = p_person), false);
$fn$;

revoke execute on function public.tagging_allowed(uuid) from public, anon;
grant execute on function public.tagging_allowed(uuid) to authenticated;

drop policy if exists "tags: the author tags" on public.post_tags;
create policy "tags: the author tags"
  on public.post_tags for insert
  with check (
    exists (
      select 1 from public.community_posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
    and public.tagging_allowed(person_id)
  );
