/* ═══════════════════════════════════════════════════════════════
   0170 — a streak can be left

   A streak you cannot leave is a trap, especially if it comes from
   someone you no longer want to hear from. Leaving is one person's own
   decision about one person's streak for one item.

   streak_leaves: (owner, person, item). Keyed on the ITEM, not the
   streak row, so deleting a streak and making it again does not reopen
   the door — the owner cannot silently add the person back.

   LEAVING (leave_streak(owner, item)), all in one transaction:
     · the person is taken off that owner's streak for that item, so it
       is no longer sent to them;
     · everything it already sent them is hidden from them (received
       list, the focused window, the counts on their own streaks) — the
       send rows themselves stay, because they are part of the owner's
       month and nobody else's record should shrink;
     · their own notifications for those sends and nudges are removed;
     · nothing else changes: the owner's run is counted from the owner's
       log, other recipients keep every send, and the owner is not told.
       The only thing the owner can ever see is that the streak no
       longer goes to that person (the name is not choosable any more).

   WHILE A LEAVE STANDS the owner cannot choose that person for that item
   again: create_streak, set_streak_people, send_streak and reply_streak
   all skip or refuse them, streak_send_list and streak_group no longer
   show them.

   REJOINING is the leaver's own press and nothing else
   (rejoin_streak(owner, item), from the "streaks you stepped away from"
   list or the undo straight after leaving). It removes the leave, shows
   the old sends again, and — only if they were on that same live streak
   when they left — puts them back on it. Sending your own streak to that
   person does NOT lift the leave: leaving is about theirs coming to
   you, and one kind of contact must not quietly reopen another.

   Everything is SECURITY DEFINER and checks auth.uid(). The table has
   RLS on, no policies and no grants: it is read only through
   my_streak_leaves(), which answers the leaver alone.
   ═══════════════════════════════════════════════════════════════ */

create table if not exists public.streak_leaves (
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  person_id  uuid not null references public.profiles(id) on delete cascade,
  item_key   text not null,
  item_name  text,
  streak_id  uuid references public.streaks(id) on delete set null,
  was_chosen boolean not null default false,
  left_at    timestamptz not null default now(),
  primary key (owner_id, person_id, item_key),
  check (owner_id <> person_id)
);
create index if not exists streak_leaves_person on public.streak_leaves(person_id);
alter table public.streak_leaves enable row level security;
revoke all on public.streak_leaves from anon, authenticated;

create or replace function public.streak_left(p_owner uuid, p_person uuid, p_item text)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from public.streak_leaves
                 where owner_id = p_owner and person_id = p_person and item_key = p_item);
$$;
revoke all on function public.streak_left(uuid, uuid, text) from public, anon, authenticated;

-- ── leave / rejoin / the list of what you left ──────────────────────
create or replace function public.leave_streak(p_owner uuid, p_item text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_streaks uuid[];
  v_live public.streaks%rowtype;
  v_chosen boolean;
begin
  if v_me is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_owner is null or p_owner = v_me or p_item is null then
    raise exception 'No such streak';
  end if;
  if public.streak_left(p_owner, v_me, p_item) then
    return jsonb_build_object('left', true);
  end if;

  select coalesce(array_agg(id), '{}') into v_streaks
  from public.streaks where owner_id = p_owner and item_key = p_item;
  v_chosen := exists (select 1 from public.streak_people where streak_id = any (v_streaks) and person_id = v_me);
  -- Only a streak that was chosen for you, or has reached you, can be left.
  if not v_chosen
     and not exists (select 1 from public.streak_sends where streak_id = any (v_streaks) and recipient_id = v_me) then
    raise exception 'No such streak';
  end if;

  select * into v_live from public.streaks where owner_id = p_owner and item_key = p_item and archived_at is null;

  insert into public.streak_leaves (owner_id, person_id, item_key, item_name, streak_id, was_chosen)
  values (p_owner, v_me, p_item, v_live.item_name, v_live.id,
          exists (select 1 from public.streak_people where streak_id = v_live.id and person_id = v_me))
  on conflict (owner_id, person_id, item_key) do nothing;

  delete from public.streak_people where streak_id = any (v_streaks) and person_id = v_me;
  update public.streaks s
  set is_private = true
  where s.id = any (v_streaks) and not s.is_private
    and not exists (select 1 from public.streak_people sp where sp.streak_id = s.id);

  -- The leaver's own notifications for what that streak sent them.
  delete from public.notifications n
  where n.profile_id = v_me and n.kind = 'streak'
    and (n.link in (select '/app/streak/' || x.id from public.streak_sends x
                    where x.streak_id = any (v_streaks) and x.recipient_id = v_me)
         or (n.link = '/app/home/log'
             and n.created_at in (select g.created_at from public.streak_nudges g
                                  where g.streak_id = any (v_streaks) and g.to_id = v_me)));

  return jsonb_build_object('left', true);
end;
$$;

create or replace function public.rejoin_streak(p_owner uuid, p_item text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  l public.streak_leaves%rowtype;
  v_live uuid;
  v_back boolean := false;
begin
  if v_me is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.streak_leaves
  where owner_id = p_owner and person_id = v_me and item_key = p_item
  returning * into l;
  if not found then raise exception 'No such streak'; end if;

  if l.was_chosen and l.streak_id is not null then
    select id into v_live from public.streaks
    where id = l.streak_id and owner_id = p_owner and archived_at is null;
    if v_live is not null and public.streak_eligible(p_owner, v_me) then
      insert into public.streak_people (streak_id, person_id) values (v_live, v_me) on conflict do nothing;
      update public.streaks set is_private = false where id = v_live;
      v_back := true;
    end if;
  end if;
  return jsonb_build_object('rejoined', true, 'back_on_list', v_back);
end;
$$;

create or replace function public.my_streak_leaves()
returns table (owner_id uuid, owner_name text, avatar_url text, avatar_sample smallint,
               item_key text, item_name text, left_at timestamptz)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select l.owner_id, p.full_name, p.avatar_url, p.avatar_sample, l.item_key,
         coalesce((select s.item_name from public.streaks s
                   where s.owner_id = l.owner_id and s.item_key = l.item_key
                   order by (s.archived_at is null) desc, s.created_at desc limit 1),
                  l.item_name, l.item_key),
         l.left_at
  from public.streak_leaves l
  join public.profiles p on p.id = l.owner_id
  where l.person_id = auth.uid()
    and not p.is_blocked
    and not exists (select 1 from public.user_blocks b where b.kind = 'block'
                    and ((b.blocker_id = auth.uid() and b.blocked_id = l.owner_id)
                      or (b.blocker_id = l.owner_id and b.blocked_id = auth.uid())))
  order by l.left_at desc;
$$;

-- ── the existing functions, now respecting a leave ──────────────────

create or replace function public.create_streak(
  p_item_key text, p_item_name text, p_kind text,
  p_min numeric default null, p_max numeric default null, p_unit text default null,
  p_private boolean default false, p_people uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
  v_person uuid;
begin
  if auth.uid() is null or not public.account_ok() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_kind = 'range' and p_item_key not in ('water','sleep','exercise') and p_item_key not like 'tracker:%' then
    raise exception 'This item has no number to set a range on';
  end if;
  if exists (select 1 from public.streaks where owner_id = auth.uid() and item_key = p_item_key and archived_at is null) then
    raise exception 'streak_exists';
  end if;

  insert into public.streaks (owner_id, item_key, item_name, kind, range_min, range_max, unit, is_private, created_on)
  values (auth.uid(), p_item_key, btrim(p_item_name), p_kind,
          case when p_kind = 'range' then p_min end, case when p_kind = 'range' then p_max end,
          case when p_kind = 'range' then p_unit end,
          coalesce(p_private, false) or coalesce(cardinality(p_people), 0) = 0,
          public.local_today(auth.uid()))
  returning id into v_id;

  if not coalesce(p_private, false) then
    foreach v_person in array coalesce(p_people, '{}') loop
      if public.streak_eligible(auth.uid(), v_person)
         and not public.streak_left(auth.uid(), v_person, p_item_key) then
        insert into public.streak_people (streak_id, person_id) values (v_id, v_person) on conflict do nothing;
      end if;
    end loop;
    update public.streaks set is_private = not exists (select 1 from public.streak_people where streak_id = v_id)
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.set_streak_people(p_streak uuid, p_people uuid[])
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_person uuid;
  v_n integer;
  v_item text;
begin
  select item_key into v_item from public.streaks where id = p_streak and owner_id = auth.uid() and archived_at is null;
  if v_item is null then
    raise exception 'No such streak';
  end if;
  delete from public.streak_people where streak_id = p_streak and not (person_id = any (coalesce(p_people, '{}')));
  foreach v_person in array coalesce(p_people, '{}') loop
    if public.streak_eligible(auth.uid(), v_person)
       and not public.streak_left(auth.uid(), v_person, v_item) then
      insert into public.streak_people (streak_id, person_id) values (p_streak, v_person) on conflict do nothing;
    end if;
  end loop;
  select count(*) into v_n from public.streak_people where streak_id = p_streak;
  update public.streaks set is_private = (v_n = 0) where id = p_streak;
  return v_n;
end;
$$;

drop function if exists public.streak_people_options(uuid);
create or replace function public.streak_people_options(p_streak uuid default null, p_item text default null)
returns table (id uuid, full_name text, avatar_url text, avatar_sample smallint, how text, chosen boolean, stepped_away boolean)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with item as (
    select coalesce((select s.item_key from public.streaks s where s.id = p_streak and s.owner_id = auth.uid()), p_item) as k
  )
  select p.id, p.full_name, p.avatar_url, p.avatar_sample,
         case c.how when 'circle' then 'family' else 'friend' end,
         exists (select 1 from public.streak_people sp join public.streaks s on s.id = sp.streak_id
                 where sp.streak_id = p_streak and s.owner_id = auth.uid() and sp.person_id = p.id),
         coalesce(public.streak_left(auth.uid(), p.id, (select k from item)), false)
  from public.connections_of(auth.uid()) c
  join public.profiles p on p.id = c.pid
  where auth.uid() is not null and c.how in ('circle','friend') and not p.is_blocked
  order by case c.how when 'circle' then 0 else 1 end, p.full_name;
$$;

create or replace function public.streak_send_list(p_streak uuid)
returns table (id uuid, full_name text, avatar_url text, avatar_sample smallint, how text, already_sent boolean)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select p.id, p.full_name, p.avatar_url, p.avatar_sample,
         case when exists (select 1 from public.circle_members c
                           where (c.icon_id = s.owner_id and c.member_id = p.id) or (c.member_id = s.owner_id and c.icon_id = p.id))
              then 'family' else 'friend' end,
         exists (select 1 from public.streak_sends ss
                 where ss.streak_id = s.id and ss.recipient_id = p.id and ss.day = public.local_today(s.owner_id))
  from public.streaks s
  join public.streak_people sp on sp.streak_id = s.id
  join public.profiles p on p.id = sp.person_id
  where s.id = p_streak and s.owner_id = auth.uid() and s.archived_at is null
    and not p.is_blocked and public.streak_eligible(s.owner_id, p.id)
    and not public.streak_left(s.owner_id, p.id, s.item_key)
  order by sp.added_at;
$$;

create or replace function public.send_streak(p_streak uuid, p_recipients uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.streaks%rowtype;
  v_today date;
  v_run integer;
  v_person uuid;
  v_sent uuid[] := '{}';
  v_already uuid[] := '{}';
  v_id uuid;
  v_name text;
begin
  select * into s from public.streaks where id = p_streak and owner_id = auth.uid() and archived_at is null;
  if not found then raise exception 'No such streak'; end if;
  v_today := public.local_today(s.owner_id);
  if not public.streak_day_ok(s.id, v_today) then
    raise exception 'not_counted_today';
  end if;
  v_run := public.streak_run(s.id);
  select split_part(coalesce(full_name, ''), ' ', 1) into v_name from public.profiles where id = s.owner_id;

  foreach v_person in array coalesce(p_recipients, '{}') loop
    continue when not public.streak_eligible(s.owner_id, v_person)
               or public.streak_left(s.owner_id, v_person, s.item_key);
    insert into public.streak_sends (streak_id, sender_id, recipient_id, day, run_count, via)
    values (s.id, s.owner_id, v_person, v_today, v_run, 'send')
    on conflict on constraint streak_sends_once_a_day do nothing
    returning id into v_id;
    if v_id is null then
      v_already := v_already || v_person;
    else
      v_sent := v_sent || v_person;
      if public.notify_allowed(v_person, 'streak') then
        insert into public.notifications (profile_id, title, body, kind, link)
        values (v_person, v_name || ' 🔥 ' || v_run, s.item_name, 'streak', '/app/streak/' || v_id);
      end if;
    end if;
    v_id := null;
  end loop;

  return jsonb_build_object('sent', to_jsonb(v_sent), 'already', to_jsonb(v_already), 'run', v_run);
end;
$$;

create or replace function public.received_streaks(p_days integer default 14)
returns table (
  send_id uuid, sender_id uuid, sender_name text, sender_avatar_url text, sender_avatar_sample smallint,
  item_key text, item_name text, run_count integer, day date, created_at timestamptz, replied boolean)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select ss.id, ss.sender_id, p.full_name, p.avatar_url, p.avatar_sample,
         s.item_key, s.item_name, ss.run_count, ss.day, ss.created_at,
         exists (select 1 from public.streak_sends back join public.streaks mine on mine.id = back.streak_id
                 where back.sender_id = auth.uid() and back.recipient_id = ss.sender_id
                   and mine.item_key = s.item_key and back.day = public.local_today(auth.uid()))
  from public.streak_sends ss
  join public.streaks s on s.id = ss.streak_id
  join public.profiles p on p.id = ss.sender_id
  where ss.recipient_id = auth.uid()
    and ss.day >= public.local_today(auth.uid()) - greatest(coalesce(p_days, 14), 1)
    and not p.is_blocked
    and not public.streak_left(s.owner_id, auth.uid(), s.item_key)
    and not exists (select 1 from public.user_blocks b where b.kind = 'block'
                    and ((b.blocker_id = auth.uid() and b.blocked_id = ss.sender_id) or (b.blocker_id = ss.sender_id and b.blocked_id = auth.uid())))
  order by ss.created_at desc;
$$;

create or replace function public.streak_window(p_send uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  ss public.streak_sends%rowtype;
  s public.streaks%rowtype;
  mine public.streaks%rowtype;
  v_today date := public.local_today(auth.uid());
  v_sender text;
begin
  select * into ss from public.streak_sends where id = p_send and recipient_id = auth.uid();
  if not found then return null; end if;
  select * into s from public.streaks where id = ss.streak_id;
  -- Left: what it sent is not shown any more.
  if public.streak_left(s.owner_id, auth.uid(), s.item_key) then return null; end if;
  select split_part(coalesce(full_name, ''), ' ', 1) into v_sender from public.profiles where id = ss.sender_id;
  select * into mine from public.streaks where owner_id = auth.uid() and item_key = s.item_key and archived_at is null;

  return jsonb_build_object(
    'send_id', ss.id,
    'sender_id', ss.sender_id,
    'sender_first_name', v_sender,
    'item_key', s.item_key,
    'item_name', s.item_name,
    'sender_run', ss.run_count,
    'sender_kind', s.kind, 'sender_range_min', s.range_min, 'sender_range_max', s.range_max, 'sender_unit', s.unit,
    'sent_day', ss.day,
    'already_sent_back', exists (select 1 from public.streak_sends back join public.streaks b on b.id = back.streak_id
                                 where back.sender_id = auth.uid() and back.recipient_id = ss.sender_id
                                   and b.item_key = s.item_key and back.day = v_today),
    -- The sender stepped away from YOUR streak for this item: it cannot go back to them.
    'cannot_send_back', public.streak_left(auth.uid(), ss.sender_id, s.item_key),
    'mine', case when mine.id is null then null else jsonb_build_object(
      'streak_id', mine.id, 'kind', mine.kind, 'range_min', mine.range_min, 'range_max', mine.range_max, 'unit', mine.unit,
      'run', public.streak_run(mine.id),
      'today_value', public.streak_item_value(auth.uid(), mine.item_key, v_today),
      'today_ok', public.streak_day_ok(mine.id, v_today)) end
  );
end;
$$;

create or replace function public.reply_streak(p_send uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  ss public.streak_sends%rowtype;
  s public.streaks%rowtype;
  v_mine uuid;
  v_today date := public.local_today(auth.uid());
  v_run integer;
  v_id uuid;
  v_name text;
begin
  select * into ss from public.streak_sends where id = p_send and recipient_id = auth.uid();
  if not found then raise exception 'No such streak'; end if;
  select * into s from public.streaks where id = ss.streak_id;
  if public.streak_left(s.owner_id, auth.uid(), s.item_key) then raise exception 'No such streak'; end if;
  -- They stepped away from your streak for this item: it is not sent to them, not even as a reply.
  if public.streak_left(auth.uid(), ss.sender_id, s.item_key) then raise exception 'streak_left'; end if;

  select id into v_mine from public.streaks where owner_id = auth.uid() and item_key = s.item_key and archived_at is null;
  if v_mine is null then
    insert into public.streaks (owner_id, item_key, item_name, kind, range_min, range_max, unit, is_private, created_on)
    values (auth.uid(), s.item_key,
            -- A module's name is the replier's usual one, never the sender's own wording.
            case s.item_key when 'water' then 'Water' when 'sleep' then 'Sleep' when 'exercise' then 'Movement'
                            when 'diet' then 'Meals' when 'medication' then 'Medicines' when 'mood' then 'Mood'
                            else s.item_name end,
            s.kind, s.range_min, s.range_max, s.unit, false, v_today)
    returning id into v_mine;
  end if;
  if public.streak_eligible(auth.uid(), ss.sender_id) then
    insert into public.streak_people (streak_id, person_id) values (v_mine, ss.sender_id) on conflict do nothing;
    update public.streaks set is_private = false where id = v_mine;
  else
    raise exception 'Not connected';
  end if;

  if not public.streak_day_ok(v_mine, v_today) then
    raise exception 'not_counted_today';
  end if;
  v_run := public.streak_run(v_mine);
  select split_part(coalesce(full_name, ''), ' ', 1) into v_name from public.profiles where id = auth.uid();

  insert into public.streak_sends (streak_id, sender_id, recipient_id, day, run_count, via, in_reply_to)
  values (v_mine, auth.uid(), ss.sender_id, v_today, v_run, 'reply', ss.id)
  on conflict on constraint streak_sends_once_a_day do nothing
  returning id into v_id;

  if v_id is not null and public.notify_allowed(ss.sender_id, 'streak') then
    insert into public.notifications (profile_id, title, body, kind, link)
    values (ss.sender_id, v_name || ' 🔥 ' || v_run, s.item_name, 'streak', '/app/streak/' || v_id);
  end if;

  return jsonb_build_object('streak_id', v_mine, 'sent', v_id is not null, 'already', v_id is null, 'run', v_run);
end;
$$;

create or replace function public.streak_group(p_streak uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.streaks%rowtype;
  v_today date;
  v_month date;
  v_members jsonb;
begin
  select * into s from public.streaks where id = p_streak and owner_id = auth.uid() and archived_at is null;
  if not found then return null; end if;
  v_today := public.local_today(s.owner_id);
  v_month := date_trunc('month', v_today)::date;

  select jsonb_agg(m order by m_order) into v_members from (
    select 0::numeric as m_order,
           jsonb_build_object(
             'id', s.owner_id, 'is_me', true, 'name', null,
             'sent_today', exists (select 1 from public.streak_sends x where x.streak_id = s.id and x.day = v_today),
             'sent_at', (select min(x.created_at) from public.streak_sends x where x.streak_id = s.id and x.day = v_today),
             'run', public.streak_run(s.id),
             'days_sent_month', (select count(distinct x.day) from public.streak_sends x where x.streak_id = s.id and x.day >= v_month)
           ) as m
    union all
    select extract(epoch from sp.added_at)::numeric,
           jsonb_build_object(
             'id', p.id, 'is_me', false, 'name', p.full_name, 'avatar_url', p.avatar_url, 'avatar_sample', p.avatar_sample,
             'sent_today', not lf.i_left and exists (select 1 from public.streak_sends x join public.streaks o on o.id = x.streak_id
                                   where x.sender_id = p.id and x.recipient_id = s.owner_id and o.item_key = s.item_key
                                     and x.day = public.local_today(p.id)),
             'sent_at', case when not lf.i_left then (select min(x.created_at) from public.streak_sends x join public.streaks o on o.id = x.streak_id
                         where x.sender_id = p.id and x.recipient_id = s.owner_id and o.item_key = s.item_key
                           and x.day = public.local_today(p.id)) end,
             'run', case when not lf.i_left then (select x.run_count from public.streak_sends x join public.streaks o on o.id = x.streak_id
                     where x.sender_id = p.id and x.recipient_id = s.owner_id and o.item_key = s.item_key
                     order by x.created_at desc limit 1) end,
             'days_sent_month', case when lf.i_left then 0 else (select count(distinct x.day) from public.streak_sends x join public.streaks o on o.id = x.streak_id
                                 where x.sender_id = p.id and x.recipient_id = s.owner_id and o.item_key = s.item_key and x.day >= v_month) end,
             'nudged_today', exists (select 1 from public.streak_nudges n where n.streak_id = s.id and n.to_id = p.id and n.day = v_today),
             -- Their streak for this item comes to me (chosen, or has sent): it can be left from here.
             'sends_me', not lf.i_left and (
                exists (select 1 from public.streaks o join public.streak_people op on op.streak_id = o.id
                        where o.owner_id = p.id and o.item_key = s.item_key and o.archived_at is null and op.person_id = s.owner_id)
                or exists (select 1 from public.streak_sends x join public.streaks o on o.id = x.streak_id
                           where x.sender_id = p.id and x.recipient_id = s.owner_id and o.item_key = s.item_key)),
             'i_left', lf.i_left
           )
    from public.streak_people sp
    join public.profiles p on p.id = sp.person_id
    cross join lateral (select public.streak_left(p.id, s.owner_id, s.item_key) as i_left) lf
    where sp.streak_id = s.id and not p.is_blocked
      and not public.streak_left(s.owner_id, p.id, s.item_key)
  ) q;

  return jsonb_build_object('streak_id', s.id, 'item_key', s.item_key, 'item_name', s.item_name, 'today', v_today,
                            'month', v_month, 'members', coalesce(v_members, '[]'::jsonb));
end;
$$;

create or replace function public.my_streaks()
returns table (
  id uuid, item_key text, item_name text, kind text, range_min numeric, range_max numeric, unit text,
  is_private boolean, run integer, longest integer, today_ok boolean, today_value numeric,
  people_count integer, sent_today integer, received_today integer,
  missed_day date, rest_day_available boolean)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select s.id, s.item_key, s.item_name, s.kind, s.range_min, s.range_max, s.unit, s.is_private,
         public.streak_run(s.id),
         public.streak_longest(s.id),
         public.streak_day_ok(s.id, public.local_today(s.owner_id)),
         public.streak_item_value(s.owner_id, s.item_key, public.local_today(s.owner_id)),
         (select count(*)::int from public.streak_people sp where sp.streak_id = s.id),
         (select count(*)::int from public.streak_sends ss where ss.streak_id = s.id and ss.day = public.local_today(s.owner_id)),
         (select count(distinct ss.sender_id)::int from public.streak_sends ss join public.streaks o on o.id = ss.streak_id
            where ss.recipient_id = s.owner_id and o.item_key = s.item_key and ss.day >= public.local_today(s.owner_id) - 1
              and ss.created_at >= (now() - interval '36 hours')
              and not public.streak_left(o.owner_id, s.owner_id, s.item_key)),
         public.streak_missed_day(s.id),
         not exists (select 1 from public.streak_rest_days r
                     where r.streak_id = s.id
                       and r.day > coalesce(public.streak_missed_day(s.id), public.local_today(s.owner_id)) - 7)
  from public.streaks s
  where s.owner_id = auth.uid() and s.archived_at is null
  order by s.created_at;
$$;

revoke all on function public.leave_streak(uuid, text) from public, anon;
revoke all on function public.rejoin_streak(uuid, text) from public, anon;
revoke all on function public.my_streak_leaves() from public, anon;
revoke all on function public.streak_people_options(uuid, text) from public, anon;
grant execute on function public.leave_streak(uuid, text) to authenticated;
grant execute on function public.rejoin_streak(uuid, text) to authenticated;
grant execute on function public.my_streak_leaves() to authenticated;
grant execute on function public.streak_people_options(uuid, text) to authenticated;
