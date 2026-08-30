-- 0078 — voice posts, and giving a moderator something to listen to.
-- APPLIED 2026-08-30.
--
-- POSTS_SPEC.md §7. Voice posts were held back for one reason: a reported
-- voice note reached the moderation queue as "(no excerpt captured)",
-- because that screen renders target_excerpt, which is text. Shipping audio
-- into a seniors' community with no way to review a complaint about it is a
-- safety gap, not a polish one. So the blocker is removed FIRST, in the same
-- migration that creates the thing that needs it.
--
-- TWO BUCKETS, AND THE REASON IS QUESTIONS.md C5.
--
--   post-audio — a voice post. Readable by anyone the POST is readable by,
--     which means the same visibility rule the post itself obeys, plus
--     is_admin(). A public post's audio is public; a "Just for me" post's
--     audio is nobody's but its author's and a super-admin's, exactly as the
--     owner has now ruled for the post body.
--
--   report-evidence — a COPY, taken by the reporter's own client at the
--     moment they report, readable ONLY by admins. This exists because
--     ModerationQueue's own header records the rule: "Reported DMs are
--     moderated from the snapshot the reporter's client took — admins have
--     NO read path into DM threads." Granting admins read on dm-audio would
--     have been one line and would have broken that promise for every DM
--     voice note ever recorded. Copying the one file that was actually
--     reported keeps the promise and still lets a moderator hear it.
--
-- The evidence bucket is write-by-anyone-signed-in and read-by-admin-only.
-- That asymmetry is deliberate: reporting must never fail because of a
-- permission, and evidence must never be browsable by the people it is
-- about.
--
-- ONE MINUTE (§7). Enforced in the recorder, and the size limit here is the
-- backstop. audio_seconds is stored so a card can say how long it is before
-- anything is downloaded — on a Pakistani mobile connection that is the
-- difference between a voice post and a surprise.

/* ─── The post ─── */

alter table public.community_posts
  add column if not exists audio_path    text,
  add column if not exists audio_seconds smallint;

alter table public.community_posts drop constraint if exists community_posts_audio_seconds_check;
alter table public.community_posts add constraint community_posts_audio_seconds_check
  check (audio_seconds is null or audio_seconds between 1 and 60);

comment on column public.community_posts.audio_path is
  'POSTS_SPEC 7 - a voice post in the post-audio bucket. Poster only; replies stay text and stickers.';
comment on column public.community_posts.audio_seconds is
  'POSTS_SPEC 7 - length, stored so the card can say how long before downloading anything. One minute maximum.';

/* ─── The report ─── */

alter table public.community_reports
  add column if not exists target_media_bucket text,
  add column if not exists target_media_path   text,
  add column if not exists target_media_kind   text;

alter table public.community_reports drop constraint if exists community_reports_media_kind_check;
alter table public.community_reports add constraint community_reports_media_kind_check
  check (target_media_kind is null or target_media_kind in ('audio', 'image'));

comment on column public.community_reports.target_media_path is
  'What the moderator has to look at or listen to. For a DM this is a COPY in report-evidence, not a path into the thread (QUESTIONS.md C5).';

/* ─── post-audio: as visible as the post it belongs to ─── */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-audio', 'post-audio', false, 3145728,
        array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/aac', 'audio/x-m4a'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post audio: as visible as its post" on storage.objects;
create policy "post audio: as visible as its post"
  on storage.objects for select
  using (
    bucket_id = 'post-audio'
    and (
      -- your own recording, including one uploaded a moment before the
      -- post row exists
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1 from public.community_posts p
        where p.audio_path = name
          and p.hidden_at is null
          and (
            p.visibility = 'public'
            or p.author_id = auth.uid()
            or (p.visibility = 'friends' and public.are_friends(auth.uid(), p.author_id))
          )
      )
    )
  );

drop policy if exists "post audio: record into your own folder" on storage.objects;
create policy "post audio: record into your own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'post-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.account_ok()
    and public.can_post_community()
  );

drop policy if exists "post audio: delete your own" on storage.objects;
create policy "post audio: delete your own"
  on storage.objects for delete
  using (
    bucket_id = 'post-audio'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

/* ─── report-evidence: written by the reporter, read only by admins ─── */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-evidence', 'report-evidence', false, 3145728,
        array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/aac', 'audio/x-m4a',
              'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Read: admins only. Not the reporter, not the author, nobody else. This is
-- the one place in the app where a copy of somebody's words is kept for
-- someone else to judge, and it must not be browsable by anyone it concerns.
drop policy if exists "evidence: admins only" on storage.objects;
create policy "evidence: admins only"
  on storage.objects for select
  using (bucket_id = 'report-evidence' and public.is_admin());

-- Write: anyone signed in who can use the community. Reporting must never
-- fail because of a permission.
drop policy if exists "evidence: a reporter may hand it over" on storage.objects;
create policy "evidence: a reporter may hand it over"
  on storage.objects for insert
  with check (
    bucket_id = 'report-evidence'
    and public.account_ok()
    and public.can_use_community()
  );

drop policy if exists "evidence: admins clear it" on storage.objects;
create policy "evidence: admins clear it"
  on storage.objects for delete
  using (bucket_id = 'report-evidence' and public.is_admin());
