-- 0074 — voice notes in a DM, in a bucket scoped to the two people in it.
-- APPLIED 2026-08-30.
--
-- PRODUCT_DECISIONS §6: "Three labelled buttons under the composer: Photo ·
-- Voice · Sticker", and "a voice note is a playable waveform".
--
-- WHY NOT THE BUCKET THAT ALREADY EXISTS. voice-notes is real and holds audio
-- already, but its folder is the OWNER and its read policy is
--
--     folder = auth.uid()  OR  has_circle_permission(folder, 'mood')
--
-- which is exactly right for a daily-log voice note and exactly wrong for a
-- private message: a note recorded for one person would become readable by
-- everyone in the sender's circle who has the mood grant. Reusing it would
-- have been one line of code and a privacy breach that nothing on any screen
-- would have shown.
--
-- So dm-audio mirrors dm-images instead, folder-per-THREAD, with the same two
-- policies and the same reasoning:
--   read   — is_dm_participant(folder): the two people in the conversation.
--   upload — dm_open(folder): only into a thread that is actually open, so a
--            pending request cannot carry audio any more than it can carry a
--            second message (0073), and a blocked pair cannot write at all.
--
-- SPEC.md caps a voice note at two minutes. That is enforced where the
-- recording happens; the size limit here is the backstop, and audio_seconds
-- is stored so the player can show a length before anything is downloaded.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dm-audio', 'dm-audio', false, 5242880,
  array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/aac', 'audio/x-m4a']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dm audio: participants read" on storage.objects;
create policy "dm audio: participants read"
  on storage.objects for select
  using (
    bucket_id = 'dm-audio'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_dm_participant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "dm audio: participants upload to thread folder" on storage.objects;
create policy "dm audio: participants upload to thread folder"
  on storage.objects for insert
  with check (
    bucket_id = 'dm-audio'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.dm_open(((storage.foldername(name))[1])::uuid)
    and public.account_ok()
  );

alter table public.dm_messages
  add column if not exists audio_path text,
  add column if not exists audio_seconds integer;

comment on column public.dm_messages.audio_path is
  'S6 - a voice note in the dm-audio bucket, under the thread id as its folder.';
comment on column public.dm_messages.audio_seconds is
  'S6 - length in seconds, stored so the player can say how long it is before downloading it.';
