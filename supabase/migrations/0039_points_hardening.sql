-- ============================================================================
-- 0039 — Points, made unfarmable
--
-- The audit (POINTS.md) found the good news first: points are DERIVED, never
-- stored. There is no points column, no points table and therefore no
-- client-writable points path — my_progress() counts daily_logs rows. Nothing
-- else in the app grants points: the riddle, community posts, games and
-- outdoor check-ins award none by design.
--
-- What was missing was a stated ceiling. The unique (icon_id, log_date,
-- module) key already meant one row per module per day, so the implicit cap
-- was "however many values log_module happens to have" — a number that grows
-- every time someone adds a module, silently raising the maximum score.
--
-- This migration makes the rules explicit and enforces them where they cannot
-- be argued with:
--   * one award per source per day (the unique key already; restated here);
--   * custom trackers are ONE flat award per day however many trackers or
--     taps — the new 'tracker' module plus that same unique key give this for
--     free: a person can hold one tracker row per day and no more;
--   * a daily total cap, so adding modules later cannot inflate a day;
--   * badges keep computing from PRESENCE DAYS, never points, so a farmed day
--     buys nothing (verified against compute_badge_awards, unchanged here).
-- ============================================================================

-- Custom trackers get one module of their own. Device-local tracker taps are
-- summarised by the client as a single row per day; the unique key makes
-- "flat, once a day" a database fact rather than a client promise.
alter type public.log_module add value if not exists 'tracker';

-- ----------------------------------------------------------------------------
-- The rules, in one place.
--   POINTS_PER_SOURCE — every source is worth the same. Logging honestly
--   scores exactly what logging well scores (SPEC.md).
--   DAILY_CAP — the most a single day can be worth, whatever is logged.
-- ----------------------------------------------------------------------------
create or replace function public.points_per_source() returns int
language sql immutable as $$ select 10 $$;

create or replace function public.points_daily_cap() returns int
language sql immutable as $$ select 60 $$;

-- Points for one person on one day: one award per module actually logged,
-- flattened by the unique key, then capped.
create or replace function public.points_for_day(p_profile uuid, p_date date)
returns int
language sql stable security definer
set search_path = public, pg_temp
as $$
  select least(
    coalesce(count(*), 0) * public.points_per_source(),
    public.points_daily_cap()
  )::int
  from public.daily_logs
  where icon_id = p_profile and log_date = p_date;
$$;

revoke execute on function public.points_for_day(uuid, date) from public, anon;
grant execute on function public.points_for_day(uuid, date) to authenticated;

-- ----------------------------------------------------------------------------
-- my_progress(), rebuilt on the capped rule.
--
-- Before: points = count(all rows) * 10, uncapped — a day with every module
-- logged was worth more than the app ever intended, and more modules meant
-- more ceiling.
-- After: each day is summed under the cap, then the days are added. Presence
-- days and the streak are unchanged (they were already day-based).
--
-- Still SECURITY DEFINER, still reading only the caller's own rows: the shape
-- the client already consumes is preserved exactly.
-- ----------------------------------------------------------------------------
create or replace function public.my_progress()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_points int;
  v_days   int;
  v_streak int := 0;
  v_dates  date[];
  v_prev   date;
  v_d      date;
begin
  if auth.uid() is null then
    return jsonb_build_object('points', 0, 'presence_days', 0, 'current_streak', 0);
  end if;

  -- Per day, capped, then summed — never a raw row count.
  select coalesce(sum(least(c * public.points_per_source(), public.points_daily_cap())), 0)
  into v_points
  from (
    select log_date, count(*) as c
    from public.daily_logs
    where icon_id = auth.uid()
    group by log_date
  ) d;

  select count(distinct log_date),
         array_agg(distinct log_date order by log_date desc)
  into v_days, v_dates
  from public.daily_logs where icon_id = auth.uid();

  if v_days > 0 and current_date - v_dates[1] <= 2 then
    v_streak := 1;
    v_prev := v_dates[1];
    foreach v_d in array v_dates[2:] loop
      exit when v_prev - v_d > 2;  -- a two-day hole ends the walk
      v_streak := v_streak + 1;
      v_prev := v_d;
    end loop;
  end if;

  return jsonb_build_object(
    'points', coalesce(v_points, 0),
    'presence_days', coalesce(v_days, 0),
    'current_streak', v_streak,
    -- so a screen can show today honestly without recomputing the rule
    'points_today', public.points_for_day(auth.uid(), current_date),
    'daily_cap', public.points_daily_cap()
  );
end;
$$;

revoke execute on function public.my_progress() from public, anon;
grant execute on function public.my_progress() to authenticated;

-- ----------------------------------------------------------------------------
-- Belt and braces on the one write path that exists.
--
-- daily_logs is the only table that feeds points, and its RLS already limits
-- inserts to icon_id = auth.uid() with an Icon role in good standing, while
-- the 0006 trigger holds the 48-hour window. The unique (icon_id, log_date,
-- module) key is what makes "once per source per day" true; this index is
-- restated as a named constraint check so a future migration cannot drop it
-- without noticing what it is for.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.daily_logs'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%icon_id, log_date, module%'
  ) then
    raise exception 'daily_logs lost its (icon_id, log_date, module) unique key — points would stop being once-per-day';
  end if;
end $$;
