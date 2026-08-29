-- ============================================================================
-- 0006 — Daily logs, welfare flags, break-glass
--
-- One row per Icon, per day, per module; module details live in payload jsonb
-- (medication checklist state, sleep hours + quality, exercise sessions…).
-- mood_value is its own column because consecutive-low-mood detection — the
-- mood log's real purpose, disclosed at onboarding — needs to query it.
--
-- Admins have NO direct read access here. Reading an Icon's private logs is
-- break-glass only (decision #1): a logged RPC requiring a typed reason,
-- super-admin only, for genuine welfare concerns and SOS.
-- ============================================================================

create table public.daily_logs (
  id            uuid primary key default gen_random_uuid(),
  icon_id       uuid not null references public.profiles (id) on delete cascade,
  log_date      date not null,
  module        public.log_module not null,
  payload       jsonb not null default '{}',
  -- 1 (lowest) … 5 (best). Present exactly when module = 'mood'.
  mood_value    smallint check (mood_value between 1 and 5),
  is_backfilled boolean not null default false,  -- internal flag, never shown as judgement
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (icon_id, log_date, module),
  check ((module = 'mood') = (mood_value is not null))
);

create index daily_logs_icon_date_idx on public.daily_logs (icon_id, log_date desc);
create index daily_logs_mood_idx on public.daily_logs (log_date) where module = 'mood';

create trigger daily_logs_updated_at
  before update on public.daily_logs
  for each row execute function public.set_updated_at();

-- Backfill window: 48 hours, flagged internally, never in the future.
-- current_date here is the server (UTC) date; the two-day window is generous
-- enough to absorb the Pakistan offset. Local-midnight rollover is the
-- client's concern.
create or replace function public.check_daily_log_date()
returns trigger
language plpgsql
as $$
begin
  if new.log_date > current_date then
    raise exception 'A log cannot be dated in the future';
  end if;
  if new.log_date < current_date - 2 then
    raise exception 'Logs can only be added for the last 48 hours';
  end if;
  if tg_op = 'INSERT' then
    new.is_backfilled := new.log_date < current_date;
  end if;
  return new;
end;
$$;

create trigger daily_logs_date_window
  before insert or update on public.daily_logs
  for each row execute function public.check_daily_log_date();

-- ----------------------------------------------------------------------------
-- Row-level security
-- ----------------------------------------------------------------------------
alter table public.daily_logs enable row level security;
revoke all on public.daily_logs from anon;

-- The Icon owns their logs outright: read, write, edit, delete.
create policy "icon reads own logs"
  on public.daily_logs for select
  using (icon_id = auth.uid());

create policy "icon writes own logs"
  on public.daily_logs for insert
  with check (
    icon_id = auth.uid()
    and public.app_role() = 'saath_icon'
    and public.account_ok()
  );

create policy "icon updates own logs"
  on public.daily_logs for update
  using (icon_id = auth.uid())
  with check (icon_id = auth.uid());

create policy "icon deletes own logs"
  on public.daily_logs for delete
  using (icon_id = auth.uid());

-- Circle members see exactly what the Icon granted, split by data type:
-- "mood and daily logs" covers mood, sleep, exercise, diet, water;
-- "health entries" covers medication, blood pressure, blood sugar, weight,
-- pain. No grant, no rows — enforced here at the database, not the frontend.
create policy "circle member reads granted modules"
  on public.daily_logs for select
  using (
    (module in ('mood', 'sleep', 'exercise', 'diet', 'water')
      and public.has_circle_permission(icon_id, 'mood'))
    or
    (module in ('medication', 'blood_pressure', 'blood_sugar', 'weight', 'pain')
      and public.has_circle_permission(icon_id, 'health'))
  );

-- Deliberately absent: any admin or Buddy policy. Staff access goes through
-- break_glass_read_logs below; Buddies get nothing until matching exists,
-- and even then never health data.

-- ----------------------------------------------------------------------------
-- Welfare flags: consecutive low-mood days quietly flag staff for human
-- outreach. Both admin levels may call it — outreach is support work — and it
-- returns only (icon, streak length, latest date), never the notes or logs.
-- Routine calls are logged at the app level (decision #1); reading the actual
-- logs still requires break-glass.
-- ----------------------------------------------------------------------------
create or replace function public.welfare_flags(p_min_days int default 3)
returns table (icon_id uuid, low_days int, latest_low date)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with mood as (
    select l.icon_id, l.log_date, l.mood_value
    from public.daily_logs l
    where l.module = 'mood' and l.log_date >= current_date - 14
  ),
  runs as (
    -- gaps-and-islands: consecutive dates with the same low/not-low state
    -- share a group key
    select m.icon_id, m.log_date, (m.mood_value <= 2) as low,
           m.log_date - (row_number() over (
             partition by m.icon_id, (m.mood_value <= 2)
             order by m.log_date
           ))::int as grp
    from mood m
  )
  select r.icon_id, count(*)::int as low_days, max(r.log_date) as latest_low
  from runs r
  where r.low
    and public.is_admin()          -- non-admins always get zero rows
  group by r.icon_id, r.grp
  having count(*) >= p_min_days
     and max(r.log_date) >= current_date - 1;
$$;

revoke execute on function public.welfare_flags(int) from public, anon;
grant execute on function public.welfare_flags(int) to authenticated;

-- ----------------------------------------------------------------------------
-- Break-glass (decision #1): the ONLY staff path to an Icon's private logs.
-- Super-admin only, typed reason required, every call writes an audit entry
-- before any data is returned.
-- ----------------------------------------------------------------------------
create or replace function public.break_glass_read_logs(
  p_icon uuid,
  p_reason text,
  p_from date default null
)
returns setof public.daily_logs
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Break-glass access is limited to super-admins';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 10 then
    raise exception 'A typed reason (at least 10 characters) is required';
  end if;

  perform public.write_audit(
    'break_glass_read_logs',
    p_icon,
    p_reason,
    jsonb_build_object('from_date', p_from)
  );

  return query
    select * from public.daily_logs
    where icon_id = p_icon
      and (p_from is null or log_date >= p_from)
    order by log_date desc;
end;
$$;

revoke execute on function public.break_glass_read_logs(uuid, text, date) from public, anon;
grant execute on function public.break_glass_read_logs(uuid, text, date) to authenticated;
