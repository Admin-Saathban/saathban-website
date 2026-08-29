-- ============================================================================
-- 0008 — Storage: the private buddy-documents bucket
--
-- CNIC images and signup selfies are sensitive personal data. PRIVATE bucket,
-- never public — files are served only through short-lived signed URLs.
-- Paths are namespaced by user id: buddy-documents/<auth uid>/cnic.jpg etc.
-- Retention/deletion after a decision is a service-role job, not a client
-- capability.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'buddy-documents',
  'buddy-documents',
  false,                                   -- never a public bucket
  10485760,                                -- 10 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Applicants may upload only into their own folder (first path segment must
-- be their own user id).
create policy "buddy docs: upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'buddy-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The applicant can read back their own documents; admins (both levels —
-- documents are support scope, with app-level access logging) can read all.
create policy "buddy docs: read own or as admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'buddy-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- An applicant may replace a document in their own folder before review
-- (e.g. a blurry CNIC photo).
create policy "buddy docs: replace own file"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'buddy-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'buddy-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No delete policy for clients: retention and cleanup run under the service
-- role against a written retention policy.
