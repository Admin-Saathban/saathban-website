/* ═══════════════════════════════════════════════════════════════
   0183 — Low days are counted on the person's own day

   Replaces welfare_flags(int) from 0006, which nothing called and which
   was wrong in four ways: it used the server's date, it flagged people
   who had never been told, a day with no mood entry quietly ended a run
   (so going silent looked like getting better), and any admin could
   call it with no audit row. It is DROPPED, not replaced: the only way
   to see a flag is now the audited admin_welfare_list (0184).

   ── THE RULE (welfare_runs) ──

   For each Saath-Icon whose welfare_notice_seen_at is set (0182):

   1. Days are the person's own. "Today" is now() in profiles.timezone,
      falling back to Asia/Karachi. The day they were told and the day a
      check-in was recorded are also taken in that timezone. log_date is
      already the person's local day (the phone writes it; 0140 checks
      it against local_today).

   2. Only mood entries dated from the day they were told, up to their
      today, are looked at. After a closing check-in (spoke / not
      needed) only entries dated AFTER that check-in's day are looked at
      — the days before it were the flag somebody already answered.

   3. A low day is a mood entry with mood_value 1 or 2 ("low" or
      "heavy"; a day with several moods keeps its lowest, logStore.js).

   4. The run is the low days logged since the person's most recent
      mood entry that was NOT low. It is over only when they log a
      better mood.

      A DAY WITH NO MOOD ENTRY — a rest day, or simply nothing logged —
      is not counted and does not end the run. Owner: resting from
      logging is not evidence of feeling better. "Three in a row" means
      three mood entries in a row, among the days a mood was logged.
      So low, (nothing), low, (rest day), low is a run of three; low,
      okay, low, low is a run of two. There is no limit on the gap:
      someone who logged three low days and then went silent stays on
      the list until a check-in is recorded.

   5. Flagged when the run has 3 or more low days.

   6. After a closing check-in the person cannot be flagged again until
      seven days have passed on their own calendar (today ≥ check-in day
      + 7). Low days logged in those seven days DO count towards the
      next run, so someone still low every day comes back on day seven.

   A "no answer" check-in is recorded but does not close the flag: the
   person stays listed, with the attempt shown, so someone tries again.

   welfare_runs returns dates and counts only — never a mood value, a
   note, or a payload — and nobody can call it directly: execute is
   revoked from every client role. p_now exists so the rule can be
   proven at any instant; the audited functions always pass now().

   ── THE OUTREACH RECORD ──

   welfare_outreach: one row per check-in attempt. Staff text only (the
   note is what a staff member writes, never the person's content). RLS
   on with no policies and no grants: read and written only through
   admin_welfare_list / admin_welfare_record (0184).
   ═══════════════════════════════════════════════════════════════ */

drop function if exists public.welfare_flags(int);

create table if not exists public.welfare_outreach (
  id           uuid primary key default gen_random_uuid(),
  icon_id      uuid not null references public.profiles (id) on delete cascade,
  handled_at   timestamptz not null default now(),
  handled_by   uuid references public.profiles (id) on delete set null,
  outcome      text not null check (outcome in ('spoke', 'no_answer', 'not_needed')),
  note         text check (note is null or char_length(note) <= 500),
  -- What the list showed when this was recorded: a count and dates, never moods.
  low_days     int,
  run_since    date
);

create index if not exists welfare_outreach_icon_idx on public.welfare_outreach (icon_id, handled_at desc);

alter table public.welfare_outreach enable row level security;
revoke all on public.welfare_outreach from public, anon, authenticated;

create or replace function public.welfare_runs(p_now timestamptz)
 returns table (
   icon_id uuid,
   low_days int,
   since date,
   last_low date,
   raised_on date,
   local_today date,
   told_at timestamptz,
   closed_at timestamptz
 )
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  with told as (
    select p.id,
           coalesce(p.timezone, 'Asia/Karachi') as tz,
           p.welfare_notice_seen_at as told_at
      from public.profiles p
     where p.role = 'saath_icon'
       and p.welfare_notice_seen_at is not null
  ),
  closed as (
    select distinct on (o.icon_id) o.icon_id, o.handled_at
      from public.welfare_outreach o
     where o.outcome in ('spoke', 'not_needed')
     order by o.icon_id, o.handled_at desc
  ),
  bounds as (
    select t.id, t.told_at, c.handled_at as closed_at,
           (p_now at time zone t.tz)::date as today,
           (c.handled_at at time zone t.tz)::date as closed_day,
           greatest((t.told_at at time zone t.tz)::date,
                    coalesce((c.handled_at at time zone t.tz)::date + 1, '-infinity'::date)) as count_from
      from told t
      left join closed c on c.icon_id = t.id
  ),
  moods as (
    select b.id, l.log_date, l.mood_value
      from bounds b
      join public.daily_logs l
        on l.icon_id = b.id and l.module = 'mood'
     where l.log_date >= b.count_from
       and l.log_date <= b.today
  ),
  last_better as (
    select m.id, max(m.log_date) as d from moods m where m.mood_value > 2 group by m.id
  ),
  run as (
    select m.id, m.log_date,
           row_number() over (partition by m.id order by m.log_date) as n
      from moods m
      left join last_better g on g.id = m.id
     where m.mood_value <= 2
       and (g.d is null or m.log_date > g.d)
  ),
  runs as (
    select r.id, count(*)::int as low_days, min(r.log_date) as since, max(r.log_date) as last_low,
           max(r.log_date) filter (where r.n = 3) as third_low
      from run r
     group by r.id
  )
  select b.id, r.low_days, r.since, r.last_low,
         greatest(r.third_low, b.closed_day + 7) as raised_on,
         b.today, b.told_at, b.closed_at
    from runs r
    join bounds b on b.id = r.id
   where r.low_days >= 3
     and (b.closed_day is null or b.today >= b.closed_day + 7);
$function$;

revoke all on function public.welfare_runs(timestamptz) from public, anon, authenticated;
