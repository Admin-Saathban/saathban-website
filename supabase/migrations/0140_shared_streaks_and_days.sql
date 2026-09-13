/* ═══════════════════════════════════════════════════════════════
   0140 — shared streaks, days with Saathban, and the person's own day

   ADDITIVE. Points are removed in a later migration, together with the
   app build that stops reading them, so the live app never breaks.

   1. THE PERSON'S OWN DAY. The server ran on UTC: "today" was asked in
      UTC and counted on the phone's local date, so between midnight and
      5am in Pakistan the app showed yesterday's numbers and refused logs
      as "in the future". local_today(profile) uses the person's timezone
      (profiles.timezone, set from the device; Asia/Karachi when unknown;
      an invalid name is dropped rather than trusted). The log-date check
      now refuses only a date that is in the future EVERYWHERE on earth,
      and the 48-hour window is measured from the person's own today.

   2. DAYS WITH SAATHBAN — one headline number. logged_days holds one row
      per person per day on which anything was logged, written by a
      trigger on daily_logs and never deleted, so the count only ever
      goes up. my_days() is the one source of truth for it (and for the
      riddle's days solved); a family member can ask only whether the
      person logged TODAY (person_logged_today), never a number.

   3. STREAKS. Reuse daily_logs for what was recorded — nothing is copied.
      · streaks: owner, the log item (water / sleep / exercise / diet /
        medication / mood / tracker:<id>), its name as shown, kind
        ('range' with min–max and unit, or 'yes_no'), private or shared,
        and two markers for a missed day (run_started_on after "let it
        rest and start again"; settled_through so a missed day is asked
        about once). One live streak per person per item.
      · streak_people: who a streak goes to, chosen once, editable.
        Only family (circle) and friends (accepted) can be chosen.
      · streak_sends: ONE ROW PER STREAK PER RECIPIENT PER DAY, by a
        unique constraint — a bulk send and a reply from a message can
        never reach the same person twice for the same streak that day.
      · streak_rest_days: at most one rest day in any seven days per
        streak, by an exclusion constraint; private (only the owner can
        read them).
      · streak_nudges: one per streak per person per day; the words are
        the sender's own, edited before sending.
      A day counts for a streak when the log for that item that day
      exists (yes/no) or its number is inside the range (range), or a
      rest day covers it. The run counts back from today (or from
      yesterday while today is not logged yet) and stops at the first day
      that does not count, never before run_started_on.

   4. SHARING. community_posts gains post types days_total, streak and
      good_day for the composer pattern.

   Everything a person reads goes through SECURITY DEFINER functions that
   check who is asking; the tables have read policies for their own rows
   only and no write policies at all.
   ═══════════════════════════════════════════════════════════════ */

create extension if not exists btree_gist;

-- ── 1. the person's own day ─────────────────────────────────────────
create or replace function public.profile_timezone_valid()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.timezone is not null
     and not exists (select 1 from pg_timezone_names where name = new.timezone) then
    new.timezone := null;
  end if;
  return new;
end;
$$;
drop trigger if exists profile_timezone_valid on public.profiles;
create trigger profile_timezone_valid
  before insert or update of timezone on public.profiles
  for each row execute function public.profile_timezone_valid();

create or replace function public.local_today(p_profile uuid)
returns date
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select (now() at time zone coalesce((select timezone from public.profiles where id = p_profile), 'Asia/Karachi'))::date;
$$;

create or replace function public.check_daily_log_date()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_today date := public.local_today(new.icon_id);
begin
  /* The latest calendar date anywhere on earth: a genuine local today is
     never later than this, whatever the phone's timezone. */
  if new.log_date > (now() at time zone 'Pacific/Kiritimati')::date then
    raise exception 'A log cannot be dated in the future';
  end if;
  if new.log_date < v_today - 2 then
    raise exception 'Logs can only be added for the last 48 hours';
  end if;
  if tg_op = 'INSERT' then
    new.is_backfilled := new.log_date < v_today;
  end if;
  return new;
end;
$$;

create or replace function public.circle_logged_today()
returns table(profile_id uuid, full_name text)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select p.id, p.full_name
  from public.circle_members c
  join public.profiles p on p.id = c.member_id
  where c.icon_id = auth.uid()
    and c.member_shares_log
    and not p.is_blocked
    and exists (select 1 from public.daily_logs l where l.icon_id = p.id and l.log_date = public.local_today(p.id))
  union
  select p.id, p.full_name
  from public.circle_members c
  join public.profiles p on p.id = c.icon_id
  where c.member_id = auth.uid()
    and c.can_see_mood
    and not p.is_blocked
    and exists (select 1 from public.daily_logs l where l.icon_id = p.id and l.log_date = public.local_today(p.id));
$$;

-- ── 2. days with Saathban ───────────────────────────────────────────
create table if not exists public.logged_days (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  first_at   timestamptz not null default now(),
  primary key (profile_id, day)
);
alter table public.logged_days enable row level security;
revoke all on public.logged_days from anon;
drop policy if exists "logged days: own" on public.logged_days;
create policy "logged days: own" on public.logged_days for select using (profile_id = auth.uid());

insert into public.logged_days (profile_id, day, first_at)
select icon_id, log_date, min(created_at) from public.daily_logs group by icon_id, log_date
on conflict do nothing;

create or replace function public.on_log_mark_day()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  insert into public.logged_days (profile_id, day) values (new.icon_id, new.log_date)
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_log_mark_day on public.daily_logs;
create trigger on_log_mark_day after insert or update of log_date on public.daily_logs
  for each row execute function public.on_log_mark_day();

create or replace function public.my_days()
returns jsonb
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'days', (select count(*) from public.logged_days where profile_id = auth.uid()),
    'logged_today', exists (select 1 from public.logged_days where profile_id = auth.uid() and day = public.local_today(auth.uid())),
    'today', public.local_today(auth.uid()),
    'riddle_days_solved', (select count(*) from public.puzzle_attempts where profile_id = auth.uid() and solved_at is not null)
  )
  where auth.uid() is not null;
$$;

create or replace function public.person_logged_today(p_profile uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select case
    when auth.uid() is null then null
    when p_profile = auth.uid()
      or exists (select 1 from public.circle_members c
                 where (c.icon_id = p_profile and c.member_id = auth.uid())
                    or (c.member_id = p_profile and c.icon_id = auth.uid()))
    then exists (select 1 from public.logged_days where profile_id = p_profile and day = public.local_today(p_profile))
    else null
  end;
$$;

-- ── 3. streaks ──────────────────────────────────────────────────────
create table if not exists public.streaks (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  item_key        text not null check (item_key in ('water','sleep','exercise','diet','medication','mood') or item_key ~ '^tracker:[0-9a-f-]{36}$'),
  item_name       text not null check (char_length(item_name) between 1 and 80),
  kind            text not null check (kind in ('range','yes_no')),
  range_min       numeric,
  range_max       numeric,
  unit            text,
  is_private      boolean not null default false,
  created_on      date not null,
  run_started_on  date,
  settled_through date,
  created_at      timestamptz not null default now(),
  archived_at     timestamptz,
  check (kind = 'yes_no' or (range_min is not null and range_max is not null and range_min >= 0 and range_min <= range_max))
);
create unique index if not exists streaks_one_live_per_item on public.streaks(owner_id, item_key) where archived_at is null;

create table if not exists public.streak_people (
  streak_id uuid not null references public.streaks(id) on delete cascade,
  person_id uuid not null references public.profiles(id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (streak_id, person_id)
);

create table if not exists public.streak_sends (
  id           uuid primary key default gen_random_uuid(),
  streak_id    uuid not null references public.streaks(id) on delete cascade,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  day          date not null,
  run_count    integer not null check (run_count >= 0),
  via          text not null default 'send' check (via in ('send','reply')),
  in_reply_to  uuid references public.streak_sends(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (sender_id <> recipient_id),
  constraint streak_sends_once_a_day unique (streak_id, recipient_id, day)
);
create index if not exists streak_sends_recipient on public.streak_sends(recipient_id, day desc);

create table if not exists public.streak_rest_days (
  streak_id uuid not null references public.streaks(id) on delete cascade,
  day       date not null,
  used_at   timestamptz not null default now(),
  primary key (streak_id, day),
  constraint one_rest_day_in_seven exclude using gist (streak_id with =, daterange(day, day + 7) with &&)
);

create table if not exists public.streak_nudges (
  id         uuid primary key default gen_random_uuid(),
  streak_id  uuid not null references public.streaks(id) on delete cascade,
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  body       text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now(),
  constraint streak_nudge_once_a_day unique (streak_id, to_id, day)
);

alter table public.streaks enable row level security;
alter table public.streak_people enable row level security;
alter table public.streak_sends enable row level security;
alter table public.streak_rest_days enable row level security;
alter table public.streak_nudges enable row level security;
revoke all on public.streaks, public.streak_people, public.streak_sends, public.streak_rest_days, public.streak_nudges from anon;

drop policy if exists "streaks: owner reads" on public.streaks;
create policy "streaks: owner reads" on public.streaks for select using (owner_id = auth.uid());
drop policy if exists "streak people: owner reads" on public.streak_people;
create policy "streak people: owner reads" on public.streak_people for select
  using (exists (select 1 from public.streaks s where s.id = streak_id and s.owner_id = auth.uid()));
drop policy if exists "streak sends: sender or recipient" on public.streak_sends;
create policy "streak sends: sender or recipient" on public.streak_sends for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "rest days: owner only" on public.streak_rest_days;
create policy "rest days: owner only" on public.streak_rest_days for select
  using (exists (select 1 from public.streaks s where s.id = streak_id and s.owner_id = auth.uid()));
drop policy if exists "nudges: from or to" on public.streak_nudges;
create policy "nudges: from or to" on public.streak_nudges for select
  using (from_id = auth.uid() or to_id = auth.uid());

-- internal helpers (not callable by clients)
create or replace function public.jnum(p text)
returns numeric
language sql
immutable
as $$
  select case when p is null then null else (substring(p from '[0-9]+(?:\.[0-9]+)?'))::numeric end;
$$;

create or replace function public.streak_item_value(p_owner uuid, p_item text, p_day date)
returns numeric
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb;
  v_n numeric;
  v_tracker text;
begin
  if p_item like 'tracker:%' then
    v_tracker := substr(p_item, 9);
    select payload into v from public.daily_logs where icon_id = p_owner and log_date = p_day and module = 'tracker';
    if v is null then return null; end if;
    if (v -> 'entries' -> p_item ->> 'count') is not null then
      v_n := public.jnum(v -> 'entries' -> p_item ->> 'count');
      return case when v_n > 0 then v_n end;
    end if;
    if coalesce((v -> 'done') ? v_tracker, false) or coalesce((v -> 'entries' -> p_item ->> 'done')::boolean, false) then
      return 1;
    end if;
    return null;
  end if;

  select payload into v from public.daily_logs where icon_id = p_owner and log_date = p_day and module = p_item::public.log_module;
  if v is null then return null; end if;

  if p_item = 'water' then
    v_n := coalesce(public.jnum(v ->> 'ml') / 250.0, public.jnum(v ->> 'glasses'));
    return case when v_n > 0 then round(v_n, 1) end;
  elsif p_item = 'sleep' then
    return public.jnum(v ->> 'hours');
  elsif p_item = 'exercise' then
    v_n := public.jnum(v ->> 'minutes');
    return case when v_n is not null then v_n when v ? 'type' then 0 end;
  elsif p_item = 'medication' then
    return case when jsonb_typeof(v -> 'taken') = 'array' and jsonb_array_length(v -> 'taken') > 0 then 1 end;
  elsif p_item = 'diet' then
    return case when exists (select 1 from jsonb_each(coalesce(v -> 'answers', '{}'::jsonb)) a where (a.value ->> 'had') = 'true')
                  or exists (select 1 from jsonb_each(coalesce(v -> 'entries', '{}'::jsonb)) e where jsonb_typeof(e.value) = 'array' and jsonb_array_length(e.value) > 0)
                then 1 end;
  end if;
  return 1; -- mood and anything else: a row for the day means it happened
end;
$$;

create or replace function public.streak_day_ok(p_streak uuid, p_day date)
returns boolean
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.streaks%rowtype;
  v numeric;
begin
  select * into s from public.streaks where id = p_streak;
  if not found then return false; end if;
  if exists (select 1 from public.streak_rest_days r where r.streak_id = p_streak and r.day = p_day) then
    return true;
  end if;
  v := public.streak_item_value(s.owner_id, s.item_key, p_day);
  if v is null then return false; end if;
  if s.kind = 'range' then
    return v >= s.range_min and v <= s.range_max;
  end if;
  return true;
end;
$$;

create or replace function public.streak_run(p_streak uuid)
returns integer
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.streaks%rowtype;
  v_today date;
  d date;
  n integer := 0;
  v_floor date;
begin
  select * into s from public.streaks where id = p_streak;
  if not found then return 0; end if;
  v_today := public.local_today(s.owner_id);
  v_floor := coalesce(s.run_started_on, v_today - 3650);
  d := v_today;
  if not public.streak_day_ok(p_streak, d) then
    d := d - 1;
  end if;
  while d >= v_floor and public.streak_day_ok(p_streak, d) loop
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end;
$$;

create or replace function public.streak_longest(p_streak uuid)
returns integer
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.streaks%rowtype;
  v_today date;
  d date;
  cur integer := 0;
  best integer := 0;
begin
  select * into s from public.streaks where id = p_streak;
  if not found then return 0; end if;
  v_today := public.local_today(s.owner_id);
  for d in select generate_series(v_today - 400, v_today, interval '1 day')::date loop
    if public.streak_day_ok(p_streak, d) then
      cur := cur + 1;
      best := greatest(best, cur);
    else
      cur := 0;
    end if;
  end loop;
  return best;
end;
$$;

create or replace function public.streak_missed_day(p_streak uuid)
returns date
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.streaks%rowtype;
  v_y date;
begin
  select * into s from public.streaks where id = p_streak;
  if not found or s.archived_at is not null then return null; end if;
  v_y := public.local_today(s.owner_id) - 1;
  if v_y <= s.created_on then return null; end if;
  if s.settled_through is not null and v_y <= s.settled_through then return null; end if;
  if s.run_started_on is not null and v_y < s.run_started_on then return null; end if;
  if public.streak_day_ok(p_streak, v_y) then return null; end if;
  if not public.streak_day_ok(p_streak, v_y - 1) then return null; end if;
  return v_y;
end;
$$;

create or replace function public.streak_eligible(p_owner uuid, p_person uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from public.connections_of(p_owner) c where c.pid = p_person and c.how in ('circle','friend'));
$$;

revoke all on function public.local_today(uuid) from public, anon, authenticated;
revoke all on function public.jnum(text) from public, anon, authenticated;
revoke all on function public.streak_item_value(uuid, text, date) from public, anon, authenticated;
revoke all on function public.streak_day_ok(uuid, date) from public, anon, authenticated;
revoke all on function public.streak_run(uuid) from public, anon, authenticated;
revoke all on function public.streak_longest(uuid) from public, anon, authenticated;
revoke all on function public.streak_missed_day(uuid) from public, anon, authenticated;
revoke all on function public.streak_eligible(uuid, uuid) from public, anon, authenticated;
revoke all on function public.on_log_mark_day() from public, anon, authenticated;
revoke all on function public.profile_timezone_valid() from public, anon, authenticated;

-- ── the functions the app calls ────────────────────────────────────

/* Family and friends, one list; `chosen` marks the people already on a streak. */
create or replace function public.streak_people_options(p_streak uuid default null)
returns table (id uuid, full_name text, avatar_url text, avatar_sample smallint, how text, chosen boolean)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select p.id, p.full_name, p.avatar_url, p.avatar_sample,
         case c.how when 'circle' then 'family' else 'friend' end,
         exists (select 1 from public.streak_people sp join public.streaks s on s.id = sp.streak_id
                 where sp.streak_id = p_streak and s.owner_id = auth.uid() and sp.person_id = p.id)
  from public.connections_of(auth.uid()) c
  join public.profiles p on p.id = c.pid
  where auth.uid() is not null and c.how in ('circle','friend') and not p.is_blocked
  order by case c.how when 'circle' then 0 else 1 end, p.full_name;
$$;

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
      if public.streak_eligible(auth.uid(), v_person) then
        insert into public.streak_people (streak_id, person_id) values (v_id, v_person) on conflict do nothing;
      end if;
    end loop;
  end if;
  return v_id;
end;
$$;

create or replace function public.update_streak(
  p_streak uuid, p_kind text, p_min numeric default null, p_max numeric default null, p_unit text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.streaks
  set kind = p_kind,
      range_min = case when p_kind = 'range' then p_min end,
      range_max = case when p_kind = 'range' then p_max end,
      unit = case when p_kind = 'range' then p_unit end
  where id = p_streak and owner_id = auth.uid() and archived_at is null;
  if not found then raise exception 'No such streak'; end if;
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
begin
  if not exists (select 1 from public.streaks where id = p_streak and owner_id = auth.uid() and archived_at is null) then
    raise exception 'No such streak';
  end if;
  delete from public.streak_people where streak_id = p_streak and not (person_id = any (coalesce(p_people, '{}')));
  foreach v_person in array coalesce(p_people, '{}') loop
    if public.streak_eligible(auth.uid(), v_person) then
      insert into public.streak_people (streak_id, person_id) values (p_streak, v_person) on conflict do nothing;
    end if;
  end loop;
  select count(*) into v_n from public.streak_people where streak_id = p_streak;
  update public.streaks set is_private = (v_n = 0) where id = p_streak;
  return v_n;
end;
$$;

create or replace function public.archive_streak(p_streak uuid)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  update public.streaks set archived_at = now() where id = p_streak and owner_id = auth.uid() and archived_at is null;
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
              and ss.created_at >= (now() - interval '36 hours')),
         public.streak_missed_day(s.id),
         not exists (select 1 from public.streak_rest_days r
                     where r.streak_id = s.id
                       and r.day > coalesce(public.streak_missed_day(s.id), public.local_today(s.owner_id)) - 7)
  from public.streaks s
  where s.owner_id = auth.uid() and s.archived_at is null
  order by s.created_at;
$$;

/* The daily send list: the chosen people, with anyone already reached today locked. */
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
    continue when not public.streak_eligible(s.owner_id, v_person);
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

/* What arrived: for the Messages world. */
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
    and not exists (select 1 from public.user_blocks b where b.kind = 'block'
                    and ((b.blocker_id = auth.uid() and b.blocked_id = ss.sender_id) or (b.blocker_id = ss.sender_id and b.blocked_id = auth.uid())))
  order by ss.created_at desc;
$$;

/* The focused window: one received streak and the recipient's own counter for that one item. Nothing else. */
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
    'mine', case when mine.id is null then null else jsonb_build_object(
      'streak_id', mine.id, 'kind', mine.kind, 'range_min', mine.range_min, 'range_max', mine.range_max, 'unit', mine.unit,
      'run', public.streak_run(mine.id),
      'today_value', public.streak_item_value(auth.uid(), mine.item_key, v_today),
      'today_ok', public.streak_day_ok(mine.id, v_today)) end
  );
end;
$$;

/* Record-and-send-back: the recipient's own streak for this item goes to the sender (created on this explicit press if they had none). */
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

  select id into v_mine from public.streaks where owner_id = auth.uid() and item_key = s.item_key and archived_at is null;
  if v_mine is null then
    insert into public.streaks (owner_id, item_key, item_name, kind, range_min, range_max, unit, is_private, created_on)
    values (auth.uid(), s.item_key, s.item_name, s.kind, s.range_min, s.range_max, s.unit, false, v_today)
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

/* A streak group: who sent today, who hasn't, and days sent this month — members in the order they were added, never ranked. */
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
             'sent_today', exists (select 1 from public.streak_sends x join public.streaks o on o.id = x.streak_id
                                   where x.sender_id = p.id and x.recipient_id = s.owner_id and o.item_key = s.item_key
                                     and x.day = public.local_today(p.id)),
             'sent_at', (select min(x.created_at) from public.streak_sends x join public.streaks o on o.id = x.streak_id
                         where x.sender_id = p.id and x.recipient_id = s.owner_id and o.item_key = s.item_key
                           and x.day = public.local_today(p.id)),
             'run', (select x.run_count from public.streak_sends x join public.streaks o on o.id = x.streak_id
                     where x.sender_id = p.id and x.recipient_id = s.owner_id and o.item_key = s.item_key
                     order by x.created_at desc limit 1),
             'days_sent_month', (select count(distinct x.day) from public.streak_sends x join public.streaks o on o.id = x.streak_id
                                 where x.sender_id = p.id and x.recipient_id = s.owner_id and o.item_key = s.item_key and x.day >= v_month),
             'nudged_today', exists (select 1 from public.streak_nudges n where n.streak_id = s.id and n.to_id = p.id and n.day = v_today)
           )
    from public.streak_people sp
    join public.profiles p on p.id = sp.person_id
    where sp.streak_id = s.id and not p.is_blocked
  ) q;

  return jsonb_build_object('streak_id', s.id, 'item_key', s.item_key, 'item_name', s.item_name, 'today', v_today,
                            'month', v_month, 'members', coalesce(v_members, '[]'::jsonb));
end;
$$;

create or replace function public.nudge_streak(p_streak uuid, p_person uuid, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.streaks%rowtype;
  v_today date;
begin
  select * into s from public.streaks where id = p_streak and owner_id = auth.uid() and archived_at is null;
  if not found then raise exception 'No such streak'; end if;
  if not exists (select 1 from public.streak_people where streak_id = s.id and person_id = p_person) then
    raise exception 'Not in this streak';
  end if;
  if coalesce(char_length(btrim(p_body)), 0) = 0 then raise exception 'Say something first'; end if;
  if exists (select 1 from public.streak_sends x join public.streaks o on o.id = x.streak_id
             where x.sender_id = p_person and x.recipient_id = s.owner_id and o.item_key = s.item_key
               and x.day = public.local_today(p_person)) then
    raise exception 'already_sent';
  end if;
  v_today := public.local_today(s.owner_id);
  insert into public.streak_nudges (streak_id, from_id, to_id, day, body)
  values (s.id, s.owner_id, p_person, v_today, btrim(p_body));
  if public.notify_allowed(p_person, 'streak') then
    insert into public.notifications (profile_id, title, body, kind, link)
    values (p_person, left(coalesce(nullif(btrim(p_title), ''), s.item_name), 140), left(btrim(p_body), 280), 'streak', '/app/home/log');
  end if;
exception when unique_violation then
  raise exception 'already_nudged';
end;
$$;

create or replace function public.use_rest_day(p_streak uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_day date;
begin
  if not exists (select 1 from public.streaks where id = p_streak and owner_id = auth.uid() and archived_at is null) then
    raise exception 'No such streak';
  end if;
  v_day := public.streak_missed_day(p_streak);
  if v_day is null then raise exception 'Nothing to rest'; end if;
  insert into public.streak_rest_days (streak_id, day) values (p_streak, v_day);
  update public.streaks set settled_through = v_day where id = p_streak;
exception when exclusion_violation then
  raise exception 'no_rest_day_left';
end;
$$;

create or replace function public.restart_streak(p_streak uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_day date := public.streak_missed_day(p_streak);
begin
  update public.streaks
  set run_started_on = public.local_today(owner_id),
      settled_through = coalesce(v_day, public.local_today(owner_id) - 1)
  where id = p_streak and owner_id = auth.uid() and archived_at is null;
  if not found then raise exception 'No such streak'; end if;
end;
$$;

revoke all on function public.streak_people_options(uuid) from public, anon;
revoke all on function public.create_streak(text, text, text, numeric, numeric, text, boolean, uuid[]) from public, anon;
revoke all on function public.update_streak(uuid, text, numeric, numeric, text) from public, anon;
revoke all on function public.set_streak_people(uuid, uuid[]) from public, anon;
revoke all on function public.archive_streak(uuid) from public, anon;
revoke all on function public.my_streaks() from public, anon;
revoke all on function public.streak_send_list(uuid) from public, anon;
revoke all on function public.send_streak(uuid, uuid[]) from public, anon;
revoke all on function public.received_streaks(integer) from public, anon;
revoke all on function public.streak_window(uuid) from public, anon;
revoke all on function public.reply_streak(uuid) from public, anon;
revoke all on function public.streak_group(uuid) from public, anon;
revoke all on function public.nudge_streak(uuid, uuid, text, text) from public, anon;
revoke all on function public.use_rest_day(uuid) from public, anon;
revoke all on function public.restart_streak(uuid) from public, anon;
revoke all on function public.my_days() from public, anon;
revoke all on function public.person_logged_today(uuid) from public, anon;
grant execute on function public.streak_people_options(uuid) to authenticated;
grant execute on function public.create_streak(text, text, text, numeric, numeric, text, boolean, uuid[]) to authenticated;
grant execute on function public.update_streak(uuid, text, numeric, numeric, text) to authenticated;
grant execute on function public.set_streak_people(uuid, uuid[]) to authenticated;
grant execute on function public.archive_streak(uuid) to authenticated;
grant execute on function public.my_streaks() to authenticated;
grant execute on function public.streak_send_list(uuid) to authenticated;
grant execute on function public.send_streak(uuid, uuid[]) to authenticated;
grant execute on function public.received_streaks(integer) to authenticated;
grant execute on function public.streak_window(uuid) to authenticated;
grant execute on function public.reply_streak(uuid) to authenticated;
grant execute on function public.streak_group(uuid) to authenticated;
grant execute on function public.nudge_streak(uuid, uuid, text, text) to authenticated;
grant execute on function public.use_rest_day(uuid) to authenticated;
grant execute on function public.restart_streak(uuid) to authenticated;
grant execute on function public.my_days() to authenticated;
grant execute on function public.person_logged_today(uuid) to authenticated;

-- ── 4. sharing ──────────────────────────────────────────────────────
alter table public.community_posts drop constraint if exists community_posts_post_type_check;
alter table public.community_posts add constraint community_posts_post_type_check
  check (post_type = any (array['text','badge','score','walk','activity','event','game_open','puzzle_result','days_total','streak','good_day']));
