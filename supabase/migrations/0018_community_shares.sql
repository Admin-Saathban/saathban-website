-- ============================================================================
-- 0018 — Community share types (community shares lane)
--
-- One posts table, five kinds of post. A share is a community_posts
-- row with a post_type, an optional ref_id, and a PAYLOAD SNAPSHOT
-- taken at share time:
--
--   badge  {emoji, name_en, name_ur}          — rendered in the
--          viewer's language; never a live join to earned_badges
--   score  {points, done, total}              — score-level ONLY
--          (SPEC.md: community sharing never carries medication,
--          moods, or notes; the snapshot physically can't)
--   walk   {place_id, place_name, starts_at, note} — links a planned
--          outing; Join creates the viewer's OWN outing row through
--          the existing 0016 policies (Icons only)
--   event  {title, event_date}                — tap-through to
--          /app/events to RSVP
--
-- Snapshots keep the feed renderable even when the referenced row is
-- invisible to the viewer (an outing's own visibility, an unpublished
-- event) or later deleted — the card is what the sharer chose to say,
-- frozen at the moment they said it.
--
-- Visibility, blocking, reporting, and moderation are unchanged: a
-- share is a post, and every 0014 policy already applies to it.
-- ============================================================================

alter table public.community_posts
  add column post_type text not null default 'text'
    check (post_type in ('text', 'badge', 'score', 'walk', 'event')),
  add column ref_id uuid,
  add column payload jsonb not null default '{}';

-- Shares may carry no body of their own (the card renders from the
-- payload, localized at view time); plain text posts still need one.
alter table public.community_posts drop constraint community_posts_body_check;
alter table public.community_posts add constraint community_posts_body_check
  check (
    char_length(body) <= 4000
    and (post_type <> 'text' or char_length(body) >= 1)
  );
