/* ═══════════════════════════════════════════════════════════════
   0069 — an owner can close a group, or hand it over
   (GROUPS_SPEC §7.3)

   "The OWNER is the only one who can delete the group or hand
    ownership over."

   Neither was possible. `groups` has a read policy and an admin
   update policy and NOTHING for delete, so nobody — not even the
   person who started it — could close a group they had made.

   ── How this was found, which is the part worth recording ──

   Not by reading the spec. My test fixtures were deleting their
   groups through PostgREST and I never checked the result. With no
   delete policy the statement matches zero rows and returns 204: a
   success shape for an operation that did nothing. Forty-seven
   fixture groups accumulated, one per run, and because they are
   `privacy = 'anyone'` they became the entire contents of "Groups
   near you" on the search screen. A peer found real users being
   offered S7TEST and DUPTEST.

   So this is the fourth instance tonight of an absent thing wearing
   the shape of a working one, and the most expensive: the missing
   policy silently produced both a product gap and a data leak into a
   user-facing list, and the test that should have caught it was the
   thing generating it.

   ── Owner only, and deliberately not is_group_admin() ──

   A co-admin helps run a group; they do not get to end it. 0068
   established is_group_admin() as the union for the things co-admins
   legitimately do, and this file pointedly does NOT use it. Deleting
   somebody's group is the single most destructive act available in
   this area and it stays with the person whose group it is.

   Platform admins are excluded too. They already have `groups: admin
   moderates` for hiding a group (`hidden_at`), which is reversible
   and leaves the evidence in place — the right tool for moderation.
   Deletion is not moderation.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.delete_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_group_creator(p_group) then
    raise exception 'Only the person who started this group can close it';
  end if;
  /* Members, posts, invites, join requests and any group events all
     carry `on delete cascade`, so the group leaves nothing behind. */
  delete from public.groups where id = p_group;
end;
$function$;

revoke execute on function public.delete_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid) to authenticated;

/* ── Handing it over (§7.3) ──

   The new owner must already be a member: handing a group to a
   stranger would be a way to make somebody responsible for a room
   they have never been in. The old owner stays as a co-admin rather
   than being dropped — they built the thing, and silently demoting
   them to an ordinary member would be a worse surprise than the
   hand-over itself. */
create or replace function public.transfer_group_ownership(p_group uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_old uuid;
begin
  if not public.is_group_creator(p_group) then
    raise exception 'Only the person who started this group can hand it over';
  end if;
  if p_to = auth.uid() then
    raise exception 'This group is already yours';
  end if;
  if not exists (
    select 1 from public.group_members where group_id = p_group and member_id = p_to
  ) then
    raise exception 'That person is not in this group';
  end if;

  v_old := auth.uid();
  update public.groups set created_by = p_to where id = p_group;
  update public.group_members set role = 'creator' where group_id = p_group and member_id = p_to;
  update public.group_members set role = 'co_admin' where group_id = p_group and member_id = v_old;
end;
$function$;

revoke execute on function public.transfer_group_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated;

comment on function public.delete_group(uuid) is
  'GROUPS_SPEC 7.3: the owner alone may close a group. Deliberately uses is_group_creator, NOT is_group_admin - a co-admin helps run a group, they do not get to end it, and a platform admin has hidden_at for moderation, which is reversible.';
