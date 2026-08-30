-- ════════════════════════════════════════════════
-- 0085 — TONIGHT.md LANE 2 §6: a profile photo, stored privately.
-- Applied 2026-08-30. Registered in supabase/MIGRATIONS.md.
--
-- PRIVATE, not public. community-images is already public and is the
-- obvious bucket to reuse, which is exactly why it is the wrong one: a
-- face is not a post. §6 says stored privately, so reads are granted to
-- SIGNED-IN MEMBERS rather than to the world, and a stranger holding
-- the URL gets nothing.
--
-- The cost of private is signed URLs, which expire — routes/profile/
-- avatar.js caches each one for slightly under its lifetime, because an
-- avatar renders many times per screen and re-signing per render turns
-- a face into a network request.
--
-- Writes are scoped to a folder named after the owner's own uuid, so
-- nobody can put a photo on somebody else's profile even with a crafted
-- request. That is §0.9's rule held at the database rather than in the
-- upload form.
-- ════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update set public = false;

drop policy if exists "avatars readable by members" on storage.objects;
create policy "avatars readable by members"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars writable by owner" on storage.objects;
create policy "avatars writable by owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars updatable by owner" on storage.objects;
create policy "avatars updatable by owner"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars deletable by owner" on storage.objects;
create policy "avatars deletable by owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
