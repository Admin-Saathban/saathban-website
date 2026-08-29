-- ============================================================================
-- 0011 — Reminders & routines
--
-- Gentle nudges inside an Icon's app — positioned as part of the log, never
-- alarms to rely on (SPEC.md, Daily logs; iOS PWA push is best-effort).
--
-- Who writes here: the Icon themselves, and circle members the Icon granted
-- can_manage_reminders (migration 0005) — that permission's whole purpose.
-- Everyone else, including admins, gets nothing.
--
-- days_label is a short display string ("Every day", "Sundays") in v1. When
-- reminders start firing real notifications, a structured schedule column
-- can be added alongside without breaking this one.
-- ============================================================================

create table public.reminders (
  id          uuid primary key default gen_random_uuid(),
  icon_id     uuid not null references public.profiles (id) on delete cascade,
  -- Who set it up (the Icon or a permitted circle member); kept for the
  -- "added by your daughter" framing later. Never gates access.
  created_by  uuid references public.profiles (id) on delete set null,
  label       text not null check (char_length(label) between 1 and 200),
  emoji       text not null default '⏰' check (char_length(emoji) <= 8),
  remind_time time not null,
  days_label  text not null default 'Every day' check (char_length(days_label) <= 60),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index reminders_icon_idx on public.reminders (icon_id, remind_time);

create trigger reminders_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row-level security. The Icon owns their reminders outright; a circle
-- member acts only through the can_manage_reminders grant, which the Icon
-- can revoke at any moment — revocation cuts access instantly because every
-- policy consults has_circle_permission() live.
-- ----------------------------------------------------------------------------
alter table public.reminders enable row level security;
revoke all on public.reminders from anon;

create policy "icon or permitted member reads reminders"
  on public.reminders for select
  using (
    icon_id = auth.uid()
    or public.has_circle_permission(icon_id, 'reminders')
  );

create policy "icon or permitted member adds reminders"
  on public.reminders for insert
  with check (
    created_by = auth.uid()
    and public.account_ok()
    and (
      icon_id = auth.uid()
      or public.has_circle_permission(icon_id, 'reminders')
    )
  );

create policy "icon or permitted member edits reminders"
  on public.reminders for update
  using (
    icon_id = auth.uid()
    or public.has_circle_permission(icon_id, 'reminders')
  )
  with check (
    icon_id = auth.uid()
    or public.has_circle_permission(icon_id, 'reminders')
  );

-- One tap, no confirmation maze — mirrors the circle's own removal rule.
create policy "icon or permitted member removes reminders"
  on public.reminders for delete
  using (
    icon_id = auth.uid()
    or public.has_circle_permission(icon_id, 'reminders')
  );
