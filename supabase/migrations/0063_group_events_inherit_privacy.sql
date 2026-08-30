/* ═══════════════════════════════════════════════════════════════
   0063 — a group event inherits its group's privacy
   (GROUPS_SPEC §4, §1 screen 3, §6)

   "A group event IS an Out & about happening. There is not a second
    events system. It inherits the group's privacy. A private group's
    event is visible only to members and must never appear in the
    city-wide Out & about list.

    This is the sentence a lane will get wrong. Built the simple way,
    'one system' leaks a private group's meeting place and time to the
    whole city."

   ── Why the simple way leaks ──

   The outings read policy already says:

     visibility = 'board'  →  any caller with community access

   and the community writer hardcodes `visibility: 'board'`. So a group
   event written as an ordinary happening is readable city-wide BY
   DEFAULT. The leak is not an edge case to remember; it is what
   happens if nobody does anything.

   The fix cannot be "the group screen filters them out", because the
   city-wide list is a different query in a different file, and a
   direct URL is neither. It has to be the row itself refusing.

   ── privacy defaults to invite_only, and that widens nothing ──

   `can_see_group()` today is: admin OR member OR pending invitee. So
   EVERY existing group is already members-only. Defaulting the new
   column to 'invite_only' therefore preserves current behaviour
   exactly — no group becomes more visible because this migration ran.
   'anyone' is opt-in, chosen on §1's third screen, worded there as a
   consequence ("Shows up in search") rather than as a label.
   ═══════════════════════════════════════════════════════════════ */

alter table public.groups
  add column if not exists privacy text not null default 'invite_only';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'groups_privacy_check') then
    alter table public.groups
      add constraint groups_privacy_check check (privacy in ('anyone', 'invite_only'));
  end if;
end
$$;

comment on column public.groups.privacy is
  'anyone = shows up in search, people join themselves; invite_only = hidden, the owner approves each person (GROUPS_SPEC §1 screen 3). Defaults to invite_only because every pre-existing group was already members-only.';

/* The event's tie to its group. Nullable: an ordinary happening
   belongs to no group and must keep working untouched. */
alter table public.outdoor_outings
  add column if not exists group_id uuid references public.groups (id) on delete cascade;

create index if not exists outdoor_outings_group_idx
  on public.outdoor_outings (group_id) where group_id is not null;

comment on column public.outdoor_outings.group_id is
  'The group this happening belongs to, if any. When set, the row inherits that group''s privacy (GROUPS_SPEC §4) — see group_event_readable().';

/* ── The one predicate that decides it ──

   Kept as a named function rather than inlined into the policy so
   that there is exactly ONE place this rule lives. A rule spelled out
   twice is a rule that will disagree with itself.

   SECURITY DEFINER because the caller must not need to read `groups`
   to be refused by it: a non-member cannot select the group row at
   all, and a policy that silently evaluated to NULL for them would
   fail open on some formulations. */
create or replace function public.group_event_readable(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    p_group is null                                   -- not a group event at all
    or exists (
      select 1 from public.groups g
      where g.id = p_group
        and (g.privacy = 'anyone' or public.is_group_member(g.id))
    );
$function$;

revoke execute on function public.group_event_readable(uuid) from public, anon;
grant execute on function public.group_event_readable(uuid) to authenticated;

/* ── The policy, amended not replaced in spirit ──

   Every existing condition is preserved exactly; the group gate is
   ANDed on top. An outing with no group_id is therefore unaffected,
   which is every outing that exists today.

   Note the gate applies to the creator branch too — deliberately, the
   creator keeps their own row (`creator_id = auth.uid()` is OR'd
   first), because somebody must be able to see what they made even if
   they later leave the group. */
drop policy if exists "outings: read" on public.outdoor_outings;
create policy "outings: read"
  on public.outdoor_outings for select
  using (
    creator_id = auth.uid()
    or (
      public.can_use_community()
      and canceled_at is null
      and not public.caller_hides(creator_id)
      and (
        visibility = 'board'
        or (visibility = 'connections' and public.member_of_circle(creator_id))
      )
      -- GROUPS_SPEC §4: and, if it belongs to a group, that group lets
      -- this caller see it.
      and public.group_event_readable(group_id)
    )
  );

/* ── Discovery for public groups (§1 screen 3: "Shows up in search") ──
   can_see_group was admin OR member OR pending invitee. A group whose
   privacy is 'anyone' is now visible to anyone who may use community
   — which is what "shows up in search" means. Private groups are
   untouched by this clause. */
create or replace function public.can_see_group(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.is_admin()
     or public.is_group_member(p_group)
     or exists (
       select 1 from public.group_invites
       where group_id = p_group and invitee_id = auth.uid() and status = 'pending'
     )
     or exists (
       select 1 from public.groups g
       where g.id = p_group and g.privacy = 'anyone' and public.can_use_community()
     );
$function$;

/* ── create_group takes the privacy choice (§1 screen 3) ──

   THE OVERLOAD TRAP (learned the hard way in 0049): `create or
   replace function` with a DIFFERENT parameter count does not replace
   anything — it creates a second function of the same name. Both then
   match the old two-argument call, PostgREST cannot choose, and every
   call fails as "not unique" with a misleading bare 404. So the old
   signature is dropped EXPLICITLY, and only after the new one exists.

   Note where the privacy default lands: anything unrecognised falls to
   'invite_only'. A typo, a stale client, a renamed constant — none of
   them may publish somebody's group to the city. The failure direction
   is closed. */
create or replace function public.create_group(p_name text, p_description text, p_privacy text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_id uuid; v_privacy text;
begin
  if public.app_role() is distinct from 'saath_icon' or not public.account_ok() then
    raise exception 'Only a Saath-Icon can start a group';
  end if;
  if coalesce(char_length(btrim(p_name)), 0) < 1 then raise exception 'Please give the group a name'; end if;
  -- Anything unrecognised falls to the CLOSED choice, never the open
  -- one: a typo must not publish somebody's group.
  v_privacy := case when p_privacy = 'anyone' then 'anyone' else 'invite_only' end;
  insert into public.groups (name, description, created_by, privacy)
  values (btrim(p_name), nullif(btrim(coalesce(p_description,'')), ''), auth.uid(), v_privacy)
  returning id into v_id;
  insert into public.group_members (group_id, member_id, role) values (v_id, auth.uid(), 'creator');
  return v_id;
end; $function$;

drop function if exists public.create_group(text, text);

revoke execute on function public.create_group(text, text, text) from public, anon;
grant execute on function public.create_group(text, text, text) to authenticated;
