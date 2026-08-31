/* ═══════════════════════════════════════════════════════════════
   0110 — a group has a cover, and nobody has to find a photo
   (GROUPS_SPEC §1, §3)

   Range note: 0060–0069 is exhausted, so this lane claims the next
   free block, 0110–0119, and registers it in MIGRATIONS.md rather
   than reaching into somebody else's.

   ── Why a cover is not just an upload ──

   §1: choosing a type "gives a DEFAULT COVER IMAGE, so nobody has to
   find a photo", and §1 is explicit that cover and description are
   NOT steps in creation because "older users abandon at the photo
   step". A cover feature whose only path is "upload one" would
   reintroduce exactly the step that was removed.

   So `cover` holds one of two things:

     preset:<type>   a cover drawn from the group's type. Always
                     present, costs nobody a decision, needs no
                     storage and no upload.
     <storage path>  a real photograph in the private group-covers
                     bucket, if somebody chooses to add one later.

   One column rather than two, because "which of these is showing" is
   never a question anyone needs to ask separately from "what is the
   cover".

   ── Why the bucket is private ──

   A private group's cover is a photograph of a private group. Making
   the bucket public would put it on a guessable URL outside RLS
   entirely, which is the same mistake as a public bucket for CNIC
   images (SPEC.md). Reads go through a signed URL, like avatars.

   Writes are restricted to the people who run the group, checked by
   `is_group_admin` against the folder name — the object path is
   `<group_id>/<file>`, so the first path segment IS the group.
   ═══════════════════════════════════════════════════════════════ */

alter table public.groups
  add column if not exists cover text;

comment on column public.groups.cover is
  'GROUPS_SPEC 1: either preset:<type> (a cover drawn from the group type, so nobody has to find a photo) or a path in the private group-covers bucket. One column, because "which kind" is never asked separately from "what is it".';

/* §3: "A Finish setting up row appears for the owner while cover or
   description are missing. Dismissible." Dismissal is per group and
   belongs to the group, not the person, because the row is about the
   group being unfinished — a second owner should not be nagged about
   a decision the first owner already declined. */
alter table public.groups
  add column if not exists setup_dismissed_at timestamptz;

/* Setting the cover. Through an RPC because `groups` has an admin-only
   update policy (0069's header explains why that stayed narrow), so a
   plain UPDATE from the owner is refused — the same silent-refusal
   shape that let 47 fixture groups pile up. */
create or replace function public.set_group_cover(p_group uuid, p_cover text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_group_admin(p_group) then
    raise exception 'Only the people who run this group can change its cover';
  end if;
  update public.groups set cover = nullif(btrim(coalesce(p_cover, '')), '') where id = p_group;
end;
$function$;

create or replace function public.dismiss_group_setup(p_group uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_group_admin(p_group) then
    raise exception 'Only the people who run this group can dismiss this';
  end if;
  update public.groups set setup_dismissed_at = now() where id = p_group;
end;
$function$;

revoke execute on function public.set_group_cover(uuid, text) from public, anon;
revoke execute on function public.dismiss_group_setup(uuid) from public, anon;
grant execute on function public.set_group_cover(uuid, text) to authenticated;
grant execute on function public.dismiss_group_setup(uuid) to authenticated;

/* ── The bucket ── */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-covers', 'group-covers', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

/* Read: anyone who may see the group may see its cover. can_see_group
   already answers that — member, pending invitee, admin, or anybody
   at all when the group is public. */
drop policy if exists "group covers: read" on storage.objects;
create policy "group covers: read"
  on storage.objects for select
  using (
    bucket_id = 'group-covers'
    and public.can_see_group(((storage.foldername(name))[1])::uuid)
  );

/* Write: the people who run the group, into that group's folder. */
drop policy if exists "group covers: admins write" on storage.objects;
create policy "group covers: admins write"
  on storage.objects for insert
  with check (
    bucket_id = 'group-covers'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "group covers: admins replace" on storage.objects;
create policy "group covers: admins replace"
  on storage.objects for update
  using (
    bucket_id = 'group-covers'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "group covers: admins remove" on storage.objects;
create policy "group covers: admins remove"
  on storage.objects for delete
  using (
    bucket_id = 'group-covers'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid)
  );
