-- 0072 — the family group, and why the Icon cannot be left out of it.
-- APPLIED 2026-08-30.
--
-- PRODUCT_DECISIONS §10, "Several Fam around one Icon":
--
--   "They form a family group — all the Fam PLUS THE ICON, in one place.
--    THERE IS NO HIDDEN CHANNEL. Children coordinating about their parent
--    behind their back is exactly what, discovered later, feels like
--    betrayal."
--
-- That is a promise about what cannot happen, so it is written here rather
-- than in a screen that declines to draw a "remove" button. A trigger refuses
-- to delete the Icon's own membership of their own family group, whichever
-- path asks — the group page, a future admin tool, a direct statement. The
-- only way the Icon leaves the room is that the room stops existing.
--
-- THE ROLL IS THE CIRCLE, not a second list. A family group whose membership
-- could drift from the Icon's circle would be a way to keep somebody in the
-- coordinating room after the Icon had removed them, which is the same
-- betrayal with extra steps. So ensure_family_group SYNCS: every Fam member
-- of the circle is in, anybody no longer in the circle is out, and the way to
-- decide who belongs stays the one tap in My Circle that already exists.
-- Buddies are not in it — §10's group is "all the Fam plus the Icon".
--
-- WHY IT APPEARS WITHOUT THE ICON APPROVING IT, when §10 otherwise says
-- nothing a family member does takes effect until the Icon says yes: this is
-- not a change to their account, their settings or their data. It is the room
-- §10 says exists, and it is the exact opposite of an action taken behind
-- their back — they are in it, and they are told the moment it opens. The
-- approval flow guards against being acted upon unseen; this is the feature
-- that guarantees being seen.
--
-- It opens only when there are TWO or more Fam members, because "several Fam
-- around one Icon" is the situation it was written for. With one, the family
-- group would be a second name for a conversation they already have.

alter table public.groups
  add column if not exists family_of uuid references public.profiles(id) on delete cascade;

comment on column public.groups.family_of is
  'S10 - this is the family group of that Saath-Icon: all their Fam plus the Icon. NULL for ordinary groups.';

-- One family group per Icon, ever.
create unique index if not exists groups_family_of_uniq
  on public.groups (family_of) where family_of is not null;

-- The promise, enforced where no screen can forget it. A cascade from the
-- group itself is allowed through: by then the groups row is already gone, so
-- there is no room left to be excluded from.
create or replace function public.family_group_keeps_its_icon()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if exists (
    select 1 from public.groups g
    where g.id = old.group_id
      and g.family_of is not null
      and g.family_of = old.member_id
  ) then
    raise exception 'The family group is not a channel behind their back — % cannot be removed from it',
      coalesce((select full_name from public.profiles where id = old.member_id), 'this person');
  end if;
  return old;
end;
$fn$;

drop trigger if exists family_group_keeps_its_icon on public.group_members;
create trigger family_group_keeps_its_icon
  before delete on public.group_members
  for each row execute function public.family_group_keeps_its_icon();

-- Opens the room if it should exist, keeps its roll equal to the circle, and
-- returns its id (null when there is no room to open). Callable by the Icon
-- or by anyone in their circle: both are people §10 puts inside it.
create or replace function public.ensure_family_group(p_icon uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_group uuid;
  v_fam int;
  v_name text;
  v_lang text;
begin
  if auth.uid() <> p_icon and not exists (
    select 1 from public.circle_members
    where icon_id = p_icon and member_id = auth.uid()
  ) then
    raise exception 'Only this family can open their own group';
  end if;

  select count(*) into v_fam
    from public.circle_members cm
    join public.profiles p on p.id = cm.member_id
   where cm.icon_id = p_icon and p.role = 'family_member';

  select id into v_group from public.groups where family_of = p_icon;

  if v_group is null then
    if v_fam < 2 then
      return null;   -- not "several Fam" yet; nothing to open
    end if;
    select full_name, coalesce(preferred_language, 'en')
      into v_name, v_lang
      from public.profiles where id = p_icon;

    insert into public.groups (name, description, created_by, family_of)
    values (
      case when v_lang = 'ur' then v_name || ' کا خاندان' else 'Family of ' || v_name end,
      null, p_icon, p_icon
    )
    returning id into v_group;

    insert into public.group_members (group_id, member_id, role)
    values (v_group, p_icon, 'creator')
    on conflict do nothing;

    -- §10: "the Icon is always told what changed, with a link to review."
    perform public.social_notify(
      p_icon,
      'Your family group is open',
      'Everyone in your circle can talk here — and so can you. Nothing in it is hidden from you.',
      '/app/groups/' || v_group::text
    );
  end if;

  -- The roll follows the circle, in both directions.
  insert into public.group_members (group_id, member_id, role)
  select v_group, cm.member_id, 'member'
    from public.circle_members cm
    join public.profiles p on p.id = cm.member_id
   where cm.icon_id = p_icon and p.role = 'family_member'
  on conflict do nothing;

  delete from public.group_members gm
   where gm.group_id = v_group
     and gm.member_id <> p_icon
     and not exists (
       select 1 from public.circle_members cm
       where cm.icon_id = p_icon and cm.member_id = gm.member_id
     );

  return v_group;
end;
$fn$;

revoke execute on function public.ensure_family_group(uuid) from public, anon;
grant execute on function public.ensure_family_group(uuid) to authenticated;
