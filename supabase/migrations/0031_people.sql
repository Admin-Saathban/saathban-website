-- ============================================================================
-- 0031 — My People: the unified connections read
--
-- ONE list, for every role, of the humans this account is connected to:
-- circle partners (0005, either direction), accepted friends (0027), and
-- fellow members of shared groups (0026) — deduped to one row per person,
-- with how-connected facts, sorted by recency of interaction.
--
-- A single SECURITY DEFINER read, because no client-side join could do this
-- without widening RLS. It returns ONLY safe fields (the safe_profiles
-- column set) plus:
--   - away          — profiles.is_paused, a single deliberate bit so the UI
--                     can render "away from Saathban" dimmed (nothing else
--                     about the pause is exposed);
--   - the chips     — in_circle / is_friend / shared group names;
--   - connected_since — the earliest of the connections' start dates;
--   - last_interaction — the latest DM in the pair or group message by them
--                     in a shared group (else connected_since), for sorting.
--
-- What it deliberately does NOT do: grant any visibility. A group-only
-- connection still has no circle row, so circle_members/daily_logs RLS
-- return nothing for the pair — this function adds no read paths to those
-- tables. Blocked (or muted) people never appear — caller_hides(), the same
-- predicate every feed uses. Platform-blocked accounts never appear.
-- ============================================================================

create or replace function public.my_people()
returns table (
  id               uuid,
  full_name        text,
  city             text,
  avatar_url       text,
  role             public.user_role,
  is_org           boolean,
  away             boolean,
  in_circle        boolean,
  is_friend        boolean,
  group_names      text[],
  connected_since  timestamptz,
  last_interaction timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
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
  and not p.is_blocked                      -- platform-removed accounts never appear
  and not public.caller_hides(p.id)         -- your blocks (and mutes) remove them here too
order by last_interaction desc nulls last, p.full_name;
$$;

revoke execute on function public.my_people() from public, anon;
grant execute on function public.my_people() to authenticated;
