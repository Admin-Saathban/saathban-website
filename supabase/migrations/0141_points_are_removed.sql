/* ═══════════════════════════════════════════════════════════════
   0141 — points are removed

   The owner: nothing in the app awards points any more. The one headline
   number is days with Saathban (logged_days, 0140), counted on the
   server and never going down.

   Points were never stored — they were computed on the fly from
   daily_logs by points_for_day (10 per row, capped at 60 a day) and
   summed by my_progress. The only function that used them was
   my_progress. Applied AFTER the app build that stops reading points is
   live, so no open screen loses a number mid-view.

   · my_progress keeps its name and signature for any client that has not
     reloaded, and now returns only the days count (the same value as
     my_days().days). No points, no cap, no streak — the per-streak runs
     live in my_streaks (0140).
   · points_for_day, points_daily_cap and points_per_source are dropped.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.my_progress()
returns jsonb
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'days', (select count(*) from public.logged_days where profile_id = auth.uid()),
    'presence_days', (select count(*) from public.logged_days where profile_id = auth.uid())
  )
  where auth.uid() is not null;
$$;

drop function if exists public.points_for_day(uuid, date);
drop function if exists public.points_daily_cap();
drop function if exists public.points_per_source();
