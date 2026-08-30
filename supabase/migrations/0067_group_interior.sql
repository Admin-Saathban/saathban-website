/* ═══════════════════════════════════════════════════════════════
   0067 — the group interior: co-admins, a pinned post, and the rule
   that keeps private groups out of the main feed
   (GROUPS_SPEC §3, §6, §7, §8)

   ── §7.3 co-admins ──

   `group_members.role` was ('creator','member'), so there was no way
   to express "helps run this" and the manage screen had nothing to
   promote anybody INTO. Adding 'co_admin' to the check constraint is
   the whole schema change; the interesting part is what a co-admin
   may NOT do.

   §7.3: "The OWNER is the only one who can delete the group or hand
   ownership over." So `is_group_admin()` (creator or co-admin) is a
   NEW predicate and `is_group_creator()` is left exactly as it is —
   every existing policy that asks "is this the creator" keeps meaning
   the creator. Widening an existing predicate is how a permission
   change becomes invisible: a rule written when 'creator' meant one
   person would silently start admitting co-admins.

   A co-admin also cannot promote or demote another co-admin. Only the
   owner changes who runs the group, otherwise the first co-admin can
   appoint the rest and the owner is no longer the owner.

   ── §8 the pinned post ──

   One pinned post per group, enforced by a partial unique index
   rather than by the RPC alone, because "at most one" that lives only
   in a function is one concurrent call away from being two.

   ── §6 public group posts in the main feed ──

   "Yes for public groups you have joined. No for private ones.
    Private group content never leaves the group."

   Note what this is NOT: it is not a read-permission rule. A member
   may read their own private group's posts — that is what membership
   is. It is a FEED COMPOSITION rule, and the danger of composition
   rules is that they live in whichever query happens to build the
   feed, so the next feed built forgets. `group_post_in_main_feed()`
   is therefore a named predicate the feed must ask, in the same shape
   as 0063's `group_event_readable()`, so there is one answer to point
   at rather than one per caller.
   ═══════════════════════════════════════════════════════════════ */

alter table public.group_members drop constraint if exists group_members_role_check;
alter table public.group_members
  add constraint group_members_role_check
  check (role in ('creator', 'co_admin', 'member'));

/* Creator OR co-admin. Deliberately a NEW name: is_group_creator()
   keeps its old, narrower meaning so nothing already written changes
   who it lets in. */
create or replace function public.is_group_admin(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.group_members
    where group_id = p_group
      and member_id = auth.uid()
      and role in ('creator', 'co_admin')
  );
$function$;

revoke execute on function public.is_group_admin(uuid) from public, anon;
grant execute on function public.is_group_admin(uuid) to authenticated;

/* Promote / demote. Owner only — see the header. */
create or replace function public.set_group_co_admin(p_group uuid, p_member uuid, p_make boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_group_creator(p_group) then
    raise exception 'Only the person who started this group can change who helps run it';
  end if;
  if p_member = auth.uid() then
    raise exception 'You already run this group';
  end if;
  update public.group_members
     set role = case when p_make then 'co_admin' else 'member' end
   where group_id = p_group
     and member_id = p_member
     and role <> 'creator';
  if not found then
    raise exception 'That person is not in this group';
  end if;
end;
$function$;

revoke execute on function public.set_group_co_admin(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_group_co_admin(uuid, uuid, boolean) to authenticated;

/* ── §8 the pinned welcome post ── */
alter table public.group_posts
  add column if not exists pinned_at timestamptz;

create unique index if not exists group_posts_one_pin_idx
  on public.group_posts (group_id) where pinned_at is not null;

comment on column public.group_posts.pinned_at is
  'GROUPS_SPEC 8: a group can pin ONE post; the seeded first post is pinned by default. At-most-one is a partial unique index, not just RPC logic, because "at most one" enforced in a function is one concurrent call away from being two.';

create or replace function public.pin_group_post(p_post uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_group uuid;
begin
  select group_id into v_group from public.group_posts where id = p_post;
  if v_group is null then raise exception 'No such post'; end if;
  if not public.is_group_admin(v_group) then
    raise exception 'Only the people who run this group can pin a post';
  end if;
  update public.group_posts set pinned_at = null
   where group_id = v_group and pinned_at is not null;
  update public.group_posts set pinned_at = now() where id = p_post;
end;
$function$;

create or replace function public.unpin_group_post(p_post uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_group uuid;
begin
  select group_id into v_group from public.group_posts where id = p_post;
  if v_group is null then raise exception 'No such post'; end if;
  if not public.is_group_admin(v_group) then
    raise exception 'Only the people who run this group can unpin a post';
  end if;
  update public.group_posts set pinned_at = null where id = p_post;
end;
$function$;

revoke execute on function public.pin_group_post(uuid) from public, anon;
revoke execute on function public.unpin_group_post(uuid) from public, anon;
grant execute on function public.pin_group_post(uuid) to authenticated;
grant execute on function public.unpin_group_post(uuid) to authenticated;

/* The §1 seeded first post, pinned. Separate from create_group so
   that adding it cannot change create_group's arity — 0049's overload
   trap, and create_group has already been through it once. */
create or replace function public.seed_group_welcome(p_group uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_id uuid;
begin
  if not public.is_group_admin(p_group) then
    raise exception 'Only the people who run this group can post the welcome';
  end if;
  if coalesce(char_length(btrim(p_body)), 0) < 1 then
    raise exception 'The welcome post needs something in it';
  end if;
  if exists (select 1 from public.group_posts where group_id = p_group and pinned_at is not null) then
    return null;
  end if;
  insert into public.group_posts (group_id, author_id, body, pinned_at)
  values (p_group, auth.uid(), btrim(p_body), now())
  returning id into v_id;
  return v_id;
end;
$function$;

revoke execute on function public.seed_group_welcome(uuid, text) from public, anon;
grant execute on function public.seed_group_welcome(uuid, text) to authenticated;

/* ── §6 — may this group's posts appear in the MAIN feed? ── */
create or replace function public.group_post_in_main_feed(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.groups g
    where g.id = p_group
      and g.privacy = 'anyone'
      and public.is_group_member(g.id)
  );
$function$;

revoke execute on function public.group_post_in_main_feed(uuid) from public, anon;
grant execute on function public.group_post_in_main_feed(uuid) to authenticated;

comment on function public.group_post_in_main_feed(uuid) is
  'GROUPS_SPEC 6: public groups you have joined reach the main feed; private ones never do. A composition rule, not a permission rule - a member may still READ their private group posts inside the group. Named so every feed asks the same question.';
