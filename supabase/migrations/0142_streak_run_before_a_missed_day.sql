/* ═══════════════════════════════════════════════════════════════
   0142 — the run a missed day interrupted

   ADDITIVE: one new function, nothing changed.

   The missed-day screen says "Your run is still here, if you want it"
   over the run as it stood BEFORE the missed day. my_streaks().run cannot
   give that number: streak_run counts back from today and stops at the
   first day that does not count, which after a missed day is yesterday —
   so it reads 0 or 1 at exactly the moment the screen needs the 14.

   streak_run_before_missed(p_streak) counts back from the day before the
   missed day, by the same streak_day_ok rule and the same run_started_on
   floor as streak_run. Owner only; null when nothing is missed.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.streak_run_before_missed(p_streak uuid)
returns integer
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.streaks%rowtype;
  v_missed date;
  v_floor date;
  d date;
  n integer := 0;
begin
  select * into s from public.streaks where id = p_streak and owner_id = auth.uid() and archived_at is null;
  if not found then return null; end if;
  v_missed := public.streak_missed_day(p_streak);
  if v_missed is null then return null; end if;
  v_floor := coalesce(s.run_started_on, v_missed - 3650);
  d := v_missed - 1;
  while d >= v_floor and public.streak_day_ok(p_streak, d) loop
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.streak_run_before_missed(uuid) from public, anon;
grant execute on function public.streak_run_before_missed(uuid) to authenticated;
