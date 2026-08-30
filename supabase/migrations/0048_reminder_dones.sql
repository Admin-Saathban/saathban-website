-- ============================================================================
-- 0048 — Ticking a reminder off for today
--
-- Reminders could be listed but never answered: there was nowhere to
-- record "yes, I did that", so the home screen had to show every
-- reminder every day, for ever, with no way for the day to finish.
-- This is the smallest table that lets a day complete.
--
-- ONE ROW PER REMINDER PER DAY, enforced by a unique index rather than
-- by the client remembering — a double tap writes the same row twice
-- and the second is refused, not duplicated.
--
-- WHO: the Icon ticks their own. A Fam member who was granted
-- can_manage_reminders may READ them, because they can already see the
-- reminders themselves and a list showing "3 reminders" when two are
-- done would be a worse kind of visibility, not a better one. They may
-- NOT tick on the Icon's behalf: doing the thing is the Icon's, and a
-- record saying otherwise would be a small lie in someone else's diary.
--
-- Undo is a DELETE, so a mis-tap costs nothing and leaves nothing.
-- ============================================================================

create table if not exists public.reminder_dones (
  id          uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders (id) on delete cascade,
  icon_id     uuid not null references public.profiles (id) on delete cascade,
  done_date   date not null default (now() at time zone 'utc')::date,
  done_at     timestamptz not null default now()
);

create unique index if not exists reminder_dones_once_per_day
  on public.reminder_dones (reminder_id, done_date);

create index if not exists reminder_dones_icon_day_idx
  on public.reminder_dones (icon_id, done_date);

alter table public.reminder_dones enable row level security;

-- Read: the Icon, and a circle member the Icon trusted with reminders.
drop policy if exists "reminder dones: icon and reminder-managers read" on public.reminder_dones;
create policy "reminder dones: icon and reminder-managers read" on public.reminder_dones
  for select using (
    icon_id = auth.uid()
    or exists (
      select 1 from public.circle_members cm
      where cm.icon_id = reminder_dones.icon_id
        and cm.member_id = auth.uid()
        and cm.can_manage_reminders
    )
  );

-- Write: only the Icon, and only about their own reminders.
drop policy if exists "reminder dones: icon ticks their own" on public.reminder_dones;
create policy "reminder dones: icon ticks their own" on public.reminder_dones
  for insert with check (
    icon_id = auth.uid()
    and exists (
      select 1 from public.reminders r
      where r.id = reminder_id and r.icon_id = auth.uid()
    )
  );

-- Undo: the Icon may take their own tick back.
drop policy if exists "reminder dones: icon undoes their own" on public.reminder_dones;
create policy "reminder dones: icon undoes their own" on public.reminder_dones
  for delete using (icon_id = auth.uid());
