-- 0075 — recurring entries, and more than one time in a day.
-- APPLIED 2026-08-30.
--
-- TONIGHT.md LANE 3.5: "Calendar is unusable — no recurring entries. Add
-- them: daily, weekly, monthly, weekdays, and a custom pattern. No multiple
-- times within a day. A single entry must be able to hold several times."
--
-- Both are the same missing idea: an entry could describe ONE moment, and a
-- life is not made of one-off moments. Physiotherapy every Tuesday, drops
-- three times a day, the grandson's call every Sunday — none of them could be
-- written down, so the calendar could only ever be half true.
--
-- WHY A RULE AND NOT A THOUSAND ROWS. Writing out every occurrence would mean
-- deciding today how far into the future somebody's Tuesdays go, and editing
-- one would mean finding all of them. The rule is one row; the occurrences
-- are computed for whatever window is being looked at. Changing "every
-- Tuesday" to "every Wednesday" is then one edit, not a search.
--
-- repeats_yearly IS NOT REPLACED. It already carries every birthday, and
-- nextOccurrence() in the events lane reads it. So repeat_rule is backfilled
-- from it rather than fighting it: 'yearly' is one of the rules, existing
-- rows get it for free, and the birthday path keeps the column it has always
-- read. One truth, two names, and the older name still answers.
--
-- entry_times is an ARRAY and entry_time stays. Everything already written
-- reads entry_time, and a migration that took it away would break the log
-- card, the reminder strip and the Fam view in the same breath. So the array
-- is the fuller answer and the scalar remains the first of it — a row with
-- three times has entry_time = the earliest, which is exactly what a screen
-- showing one time should show.

alter table public.calendar_entries
  add column if not exists repeat_rule  text,
  add column if not exists repeat_days  smallint[],
  add column if not exists repeat_until date,
  add column if not exists entry_times  time[];

alter table public.calendar_entries drop constraint if exists calendar_entries_repeat_rule_check;
alter table public.calendar_entries add constraint calendar_entries_repeat_rule_check
  check (repeat_rule is null or repeat_rule in
         ('daily', 'weekdays', 'weekly', 'monthly', 'yearly', 'custom'));

-- A custom pattern is a set of weekdays, ISO numbering (1 = Monday).
-- Anything outside that is not a pattern, it is a typo with consequences.
alter table public.calendar_entries drop constraint if exists calendar_entries_repeat_days_check;
alter table public.calendar_entries add constraint calendar_entries_repeat_days_check
  check (
    repeat_days is null
    or (array_length(repeat_days, 1) between 1 and 7
        and repeat_days <@ array[1,2,3,4,5,6,7]::smallint[])
  );

-- At most a handful of times in one day: this is "drops at 8, 2 and 8",
-- not a schedule engine, and an entry with forty times in it is a mistake
-- somebody will have to undo by hand.
alter table public.calendar_entries drop constraint if exists calendar_entries_entry_times_check;
alter table public.calendar_entries add constraint calendar_entries_entry_times_check
  check (entry_times is null or array_length(entry_times, 1) between 1 and 8);

comment on column public.calendar_entries.repeat_rule is
  'S13 - daily | weekdays | weekly | monthly | yearly | custom. NULL means once.';
comment on column public.calendar_entries.repeat_days is
  'S13 - for the custom rule: ISO weekdays, 1=Monday.';
comment on column public.calendar_entries.repeat_until is
  'S13 - optional last day of the repetition. NULL means it keeps going.';
comment on column public.calendar_entries.entry_times is
  'S13 - every time of day this entry happens. entry_time stays as the first of them so older readers keep working.';

-- Existing birthdays already repeat; say so in the new column rather than
-- leaving them looking like one-off entries to anything reading the rule.
update public.calendar_entries
   set repeat_rule = 'yearly'
 where repeats_yearly and repeat_rule is null;

-- And give every existing row its times array, so readers can use one shape.
update public.calendar_entries
   set entry_times = array[entry_time]
 where entry_time is not null and entry_times is null;
