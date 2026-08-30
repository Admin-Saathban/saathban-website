-- 0079 — being tagged is something you are TOLD about.  APPLIED 2026-08-30.
--
-- POSTS_SPEC §5: "The tagged person gets a notification, can remove the tag,
-- and can turn tagging off entirely in Settings." 0077 built the table and
-- the permission to remove; none of the three promises above were kept,
-- because a post_tags row was inserted straight from the client and nothing
-- happened afterwards. A tag nobody is told about is not a mention, it is a
-- record of somebody's name being used.
--
-- A TRIGGER RATHER THAN AN RPC, because the insert is a plain client write
-- and always will be — the author tags from the composer. A notification
-- that depends on the writer remembering to send it is one that goes missing
-- the first time somebody adds a second way to tag.
--
-- It links to the POST, not to a settings page: §11, every action ends where
-- its result lives, and the result of being tagged is a post with your name
-- on it. From there the tag comes off in one tap.
--
-- allow_tagging is already checked in 0077's INSERT policy, so somebody who
-- has turned tagging off cannot be tagged at all and this never fires for
-- them. The switch is the earlier gate; this is the courtesy after it.

create or replace function public.on_post_tagged()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_author text;
begin
  -- Never tell somebody they tagged themselves.
  if exists (
    select 1 from public.community_posts p
    where p.id = new.post_id and p.author_id = new.person_id
  ) then
    return new;
  end if;

  select full_name into v_author
  from public.profiles p
  join public.community_posts cp on cp.author_id = p.id
  where cp.id = new.post_id;

  perform public.social_notify(
    new.person_id,
    coalesce(v_author, 'Someone') || ' mentioned you',
    'They added your name to something they posted. You can take it off if you would rather not be named.',
    '/app/community?post=' || new.post_id::text
  );
  return new;
end;
$fn$;

drop trigger if exists post_tagged_tells_them on public.post_tags;
create trigger post_tagged_tells_them
  after insert on public.post_tags
  for each row execute function public.on_post_tagged();
