-- 0103 — a voice post may have no words, and the database has to agree.
-- APPLIED 2026-08-30.
--
-- POSTS_SPEC §7 is a post that IS a recording. "A voice post may carry no
-- words at all — that is the point of it" is written in the composer, in
-- createPost and in Feed's share guard, and all three shipped against a
-- constraint that refuses exactly that:
--
--   community_posts_body_check
--     CHECK (char_length(body) <= 4000
--            AND (post_type <> 'text' OR char_length(body) >= 1))
--
-- post_type defaults to 'text', so a wordless post needed at least one
-- character. Every voice post in the suite happened to have a caption, so
-- fifteen checks passed while the feature's whole point was refused.
--
-- The constraint was right when it was written and is still right: an empty
-- post with NOTHING in it is a blank row in the feed. So this widens it by
-- exactly one case rather than removing it — no words is allowed only when
-- there is a recording instead.
--
-- A second failure worth recording: createPost uploads the audio BEFORE
-- inserting the row, because the row needs the path. Every refused insert
-- therefore left an orphan file in post-audio — storage growing while
-- nothing appeared on screen. The client now removes the upload when the
-- insert fails.

alter table public.community_posts drop constraint if exists community_posts_body_check;
alter table public.community_posts add constraint community_posts_body_check
  check (
    char_length(body) <= 4000
    and (
      post_type <> 'text'
      or char_length(body) >= 1
      or audio_path is not null
    )
  );
