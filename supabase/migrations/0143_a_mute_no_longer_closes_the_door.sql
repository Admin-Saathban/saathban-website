/* ═══════════════════════════════════════════════════════════════
   0143 — a mute no longer closes the door

   ONE MUTE, FOR A PERSON (owner's ruling, 2026-09-13): "Fold it into the
   new Mute. Anyone who set it believed they had silenced someone and had
   not." The old feed "Show less from {name}" / bell "Stop telling me about
   them" wrote user_blocks kind 'mute'. caller_hides() counted ANY
   user_blocks row, so that mute:
     · hid the person's posts (intended — "see less"),
     · CLOSED the chat with them and hid their requests (not intended),
     · silenced no notification at all (the thing people believed it did).

   This migration splits "hides" by kind. A BLOCK keeps closing everything,
   exactly as before. A MUTE keeps hiding what a person PUTS ON A BOARD
   (feed content) and stops touching anything whose purpose is reaching
   or talking to them.

   caller_hides(p)   — block OR mute. Unchanged. Feed content only.
   caller_blocked(p) — block only. New. Doors: chats, requests, invites,
                       joining, the people list.

   Per surface:
     KEEP caller_hides (mute hides it):
       community_posts, post_comments, park_board_messages, group_posts,
       outdoor_checkins, outdoor_outings, outdoor_moments (read policies);
       join_activity (an activity is a feed post — it is already hidden).
     SWITCH to block only (mute leaves it alone):
       dm_requests read, friend_requests read, group_messages read,
       groups read; open_dm_with, send_dm_request, invite_to_group,
       request_to_join_group, join_public_group, my_people.
     ALREADY block only, unchanged:
       dm_open, connections_of, send_friend_request, announce_activity,
       respond_game_invite, riddle_touch, person_warmth, claim_seat_link,
       open_personal_invite, public_profile, profile_cards, search_people,
       received_streaks.
     ANY kind, deliberately unchanged:
       profile_related — having muted someone keeps their name readable,
       which is what lets "Blocked and muted" show who is on it.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.caller_blocked(p_other uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.user_blocks
    where blocker_id = auth.uid() and blocked_id = p_other and kind = 'block'
  );
$function$;

/* Same grants as caller_hides: the read policies below apply to every
   role, so any role that can reach them must be able to evaluate this. */
grant execute on function public.caller_blocked(uuid) to anon, authenticated;

/* ── Read policies: the doors ── */

drop policy if exists "dm requests: participants read" on public.dm_requests;
create policy "dm requests: participants read" on public.dm_requests
  for select using (
    requester_id = auth.uid()
    or (recipient_id = auth.uid() and not public.caller_blocked(requester_id))
  );

drop policy if exists "friend requests: participants read" on public.friend_requests;
create policy "friend requests: participants read" on public.friend_requests
  for select using (
    requester_id = auth.uid()
    or (recipient_id = auth.uid() and not public.caller_blocked(requester_id))
  );

/* A group conversation is a conversation: muting one member must not cut
   the thread into a version with holes in it. */
drop policy if exists "group messages: read" on public.group_messages;
create policy "group messages: read" on public.group_messages
  for select using (
    public.is_group_member(group_id) and not public.caller_blocked(sender_id)
  );

/* A group is a place with many people in it, not something its creator
   posted. Muting the creator must not make the place disappear. */
drop policy if exists "groups: read" on public.groups;
create policy "groups: read" on public.groups
  for select using (
    public.can_moderate()
    or (public.can_see_group(id)
        and not public.caller_blocked(created_by)
        and (hidden_at is null or public.is_group_member(id)))
  );

/* ── Functions whose purpose is reaching a person ── */

create or replace function public.open_dm_with(p_other uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_req    public.dm_requests%rowtype;
  v_circle boolean;
begin
  if auth.uid() is null or not public.account_ok() then
    raise exception 'Sign in required';
  end if;
  if p_other = auth.uid() or not exists (
    select 1 from public.profiles where id = p_other and not is_blocked
  ) then
    raise exception 'That thread cannot be opened';
  end if;
  -- 0143: a BLOCK closes the thread; a mute keeps it open and quiet.
  if public.caller_blocked(p_other) then
    raise exception 'That thread cannot be opened';
  end if;

  select exists (
    select 1 from public.circle_members
    where (icon_id = auth.uid() and member_id = p_other)
       or (icon_id = p_other and member_id = auth.uid())
  ) into v_circle;

  select * into v_req from public.dm_requests
  where (requester_id = auth.uid() and recipient_id = p_other)
     or (requester_id = p_other and recipient_id = auth.uid())
  limit 1;

  if found then
    if v_req.status <> 'accepted' and v_circle then
      update public.dm_requests set status = 'accepted' where id = v_req.id;
    end if;
    return v_req.id;
  end if;

  if v_circle then
    insert into public.dm_requests (requester_id, recipient_id, status, decided_at)
    values (auth.uid(), p_other, 'accepted', now())
    returning id into v_req.id;
    return v_req.id;
  end if;

  return public.send_dm_request(p_other);
end;
$function$;

create or replace function public.send_dm_request(p_recipient uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_req       public.dm_requests%rowtype;
  v_setting   text;
  v_connected boolean;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  if not exists (
    select 1 from public.profiles where id = p_recipient and not is_blocked
  ) or p_recipient = auth.uid() then
    raise exception 'That request cannot be sent';
  end if;
  -- 0143: block only. Muting someone does not stop me writing to them.
  if public.caller_blocked(p_recipient) then
    raise exception 'That request cannot be sent';
  end if;

  select * into v_req from public.dm_requests
  where (requester_id = auth.uid() and recipient_id = p_recipient)
     or (requester_id = p_recipient and recipient_id = auth.uid())
  limit 1;

  if found then
    -- A DECLINE IS PERMANENT (§6). This used to return the declined row as
    -- though the request had gone through.
    if v_req.status = 'declined' then
      raise exception 'That request cannot be sent';
    end if;
    if v_req.status = 'pending' and v_req.recipient_id = auth.uid() then
      update public.dm_requests
        set status = 'accepted', decided_at = now()
        where id = v_req.id;
    end if;
    return v_req.id;
  end if;

  -- Below here is FIRST CONTACT with someone there is no row for.
  select coalesce(who_can_message, 'met') into v_setting
  from public.profiles where id = p_recipient;

  v_connected :=
    exists (select 1 from public.circle_members cm
             where (cm.icon_id = p_recipient and cm.member_id = auth.uid())
                or (cm.icon_id = auth.uid() and cm.member_id = p_recipient))
    or exists (select 1 from public.friend_requests f
                where f.status = 'accepted'
                  and ((f.requester_id = auth.uid() and f.recipient_id = p_recipient)
                    or (f.requester_id = p_recipient and f.recipient_id = auth.uid())));

  if not v_connected then
    if v_setting = 'connected' then
      raise exception 'This person only takes messages from people they are connected to';
    elsif v_setting = 'met' and not public.have_met(auth.uid(), p_recipient) then
      raise exception 'You have not met this person anywhere on Saathban yet';
    end if;

    if not public.profile_is_complete(auth.uid()) then
      raise exception 'Please finish your profile before writing to someone new';
    end if;
  end if;

  if (
    select count(*) from public.dm_requests
    where requester_id = auth.uid() and created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'Too many requests today - please try again tomorrow';
  end if;

  insert into public.dm_requests (requester_id, recipient_id)
  values (auth.uid(), p_recipient)
  returning * into v_req;
  return v_req.id;
end;
$function$;

create or replace function public.invite_to_group(p_group uuid, p_invitee uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_id uuid; v_gname text; v_inviter text;
begin
  if not public.is_group_member(p_group) or not public.account_ok() then
    raise exception 'Only a member can invite to this group';
  end if;
  if p_invitee = auth.uid() then raise exception 'You are already in this group'; end if;
  if not (
    public.game_connected(auth.uid(), p_invitee)
    or exists (select 1 from public.dm_requests where status = 'accepted'
      and ((requester_id = auth.uid() and recipient_id = p_invitee) or (requester_id = p_invitee and recipient_id = auth.uid())))
  ) then raise exception 'You can only invite your circle or your community friends'; end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_invitee and not p.is_paused and not p.is_blocked
      and (p.role in ('saath_icon','family_member','admin') or p.is_org or (p.role = 'saath_buddy' and public.is_active_buddy(p.id)))
  ) then raise exception 'That person cannot be invited'; end if;
  -- 0143: block only, both ways. A mute on either side is not a closed door;
  -- the invitee who muted the inviter simply is not notified (0144).
  if public.caller_blocked(p_invitee) or exists (
    select 1 from public.user_blocks where kind = 'block' and blocker_id = p_invitee and blocked_id = auth.uid()
  ) then raise exception 'That person cannot be invited'; end if;
  if exists (select 1 from public.group_members where group_id = p_group and member_id = p_invitee) then
    raise exception 'They are already a member'; end if;

  insert into public.group_invites (group_id, inviter_id, invitee_id) values (p_group, auth.uid(), p_invitee)
  on conflict (group_id, invitee_id) do update set status = 'pending', decided_at = null
  returning id into v_id;

  select name into v_gname from public.groups where id = p_group;
  select full_name into v_inviter from public.profiles where id = auth.uid();
  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (p_invitee, 'A group invitation',
    coalesce(v_inviter, 'A friend') || ' invited you to the group ' || chr(8220) || v_gname || chr(8221) || '.',
    'group', '/app/groups/' || p_group, auth.uid());
  return v_id;
end; $function$;

create or replace function public.request_to_join_group(p_group uuid, p_message text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid; v_privacy text; v_creator uuid; v_msg text;
begin
  if not public.account_ok() then
    raise exception 'account not in good standing';
  end if;

  select privacy, created_by into v_privacy, v_creator
    from public.groups where id = p_group and hidden_at is null;
  if v_privacy is null then raise exception 'no such group'; end if;

  if public.is_group_member(p_group) then raise exception 'already a member'; end if;

  -- 0143: blocks, silent in both directions. A mute is not a block.
  if public.caller_blocked(v_creator) or exists (
    select 1 from public.user_blocks
     where kind = 'block' and blocker_id = v_creator and blocked_id = auth.uid()
  ) then
    return null;
  end if;

  v_msg := nullif(btrim(coalesce(p_message, '')), '');

  insert into public.group_join_requests (group_id, requester_id, message)
  values (p_group, auth.uid(), v_msg)
  on conflict (group_id, requester_id) where status = 'pending'
    do update set message = coalesce(excluded.message, public.group_join_requests.message)
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.join_public_group(p_group uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_privacy text; v_creator uuid;
begin
  if not public.account_ok() then
    raise exception 'account not in good standing';
  end if;

  select privacy, created_by into v_privacy, v_creator
    from public.groups where id = p_group and hidden_at is null;
  if v_privacy is null then raise exception 'no such group'; end if;

  /* PUBLIC ONLY. A private group is asked, never joined — that is the
     whole of §5's distinction, and the refusal has to live in the
     database rather than in the button, or the button is the only
     thing standing between a stranger and a private group. */
  if v_privacy is distinct from 'anyone' then
    raise exception 'this group is invite only';
  end if;

  /* Blocks, silent in both directions, exactly as the ask path.
     0143: kind 'block' only — a mute is not a closed door. */
  if public.caller_blocked(v_creator) or exists (
    select 1 from public.user_blocks
     where kind = 'block' and blocker_id = v_creator and blocked_id = auth.uid()
  ) then
    return;
  end if;

  /* Idempotent: tapping twice is not a mistake worth an error. */
  insert into public.group_members (group_id, member_id, role)
  values (p_group, auth.uid(), 'member')
  on conflict (group_id, member_id) do nothing;
end;
$function$;

/* My People: muting someone does not remove them from the people I know. */
create or replace function public.my_people()
 returns table(id uuid, full_name text, city text, avatar_url text, role user_role, is_org boolean, away boolean, in_circle boolean, is_friend boolean, group_names text[], connected_since timestamp with time zone, last_interaction timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
with circle_pairs as (
  select case when cm.icon_id = auth.uid() then cm.member_id else cm.icon_id end as pid,
         min(cm.created_at) as since
  from public.circle_members cm
  where cm.icon_id = auth.uid() or cm.member_id = auth.uid()
  group by 1
),
friend_pairs as (
  select case when fr.requester_id = auth.uid() then fr.recipient_id else fr.requester_id end as pid,
         min(coalesce(fr.decided_at, fr.created_at)) as since
  from public.friend_requests fr
  where fr.status = 'accepted'
    and (fr.requester_id = auth.uid() or fr.recipient_id = auth.uid())
  group by 1
),
my_groups as (
  select gm.group_id from public.group_members gm where gm.member_id = auth.uid()
),
group_pairs as (
  select gm.member_id as pid,
         array_agg(distinct g.name order by g.name) as gnames,
         min(gm.joined_at) as since
  from public.group_members gm
  join public.groups g on g.id = gm.group_id and g.hidden_at is null
  where gm.group_id in (select group_id from my_groups)
    and gm.member_id <> auth.uid()
  group by gm.member_id
),
candidates as (
  select pid from circle_pairs
  union select pid from friend_pairs
  union select pid from group_pairs
),
dm_latest as (
  select case when r.requester_id = auth.uid() then r.recipient_id else r.requester_id end as pid,
         max(m.created_at) as at
  from public.dm_messages m
  join public.dm_requests r on r.id = m.request_id
  where r.requester_id = auth.uid() or r.recipient_id = auth.uid()
  group by 1
),
gm_latest as (
  select gms.sender_id as pid, max(gms.created_at) as at
  from public.group_messages gms
  where gms.group_id in (select group_id from my_groups)
    and gms.sender_id <> auth.uid()
  group by gms.sender_id
)
select
  p.id,
  p.full_name,
  p.city,
  p.avatar_url,
  p.role,
  p.is_org,
  p.is_paused as away,
  (cp.pid is not null) as in_circle,
  (fp.pid is not null) as is_friend,
  coalesce(gp.gnames, '{}') as group_names,
  least(cp.since, fp.since, gp.since) as connected_since,
  greatest(
    coalesce(dl.at, 'epoch'::timestamptz),
    coalesce(gl.at, 'epoch'::timestamptz),
    coalesce(least(cp.since, fp.since, gp.since), 'epoch'::timestamptz)
  ) as last_interaction
from candidates c
join public.profiles p on p.id = c.pid
left join circle_pairs cp on cp.pid = c.pid
left join friend_pairs fp on fp.pid = c.pid
left join group_pairs  gp on gp.pid = c.pid
left join dm_latest    dl on dl.pid = c.pid
left join gm_latest    gl on gl.pid = c.pid
where auth.uid() is not null
  and not p.is_blocked
  and not public.caller_blocked(p.id)
order by last_interaction desc nulls last, p.full_name;
$function$;
