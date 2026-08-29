-- ============================================================================
-- 0033 — Daily-log overhaul (daily-log lane): prefs go server-side, a
-- circle member can be trusted to set the log up, and voice notes get
-- a private home.
--
-- 1. daily_log_prefs — the Icon's module choices, medicine list, meal
--    item library (label + tag chips: protein/carbs/veg/fruit/dairy/
--    sweet — never nutrition math), custom trackers and display units
--    (water glasses/l/ml, weight kg/lbs; LOGS store canonical ml/kg).
--    Until now this lived in localStorage (QUESTIONS.md #1: device-
--    local, shared across accounts on one phone) — a Fam member could
--    never help set it up. One row per Icon.
--
-- 2. circle_members.can_configure_daily_log — a DISTINCT permission
--    from can_manage_reminders, default off like every grant. With it
--    a member may read and write the Icon's prefs row. A write by
--    anyone other than the Icon is stamped configured_by/at and the
--    Icon is told (kind 'circle', → /app/settings); the Icon's own
--    write clears the stamp — they always have the last word.
--
-- 3. 'voice-notes' — a PRIVATE bucket, path <icon_id>/<file>. The
--    owner reads/writes/deletes; a circle member may read only with
--    can_see_mood (SPEC: a voice note inherits its log's sharing
--    rules, and mood/exercise notes are the mood class). Nothing is
--    public; playback goes through signed URLs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Prefs table
-- ----------------------------------------------------------------------------
create table public.daily_log_prefs (
  profile_id      uuid primary key references public.profiles (id) on delete cascade,
  enabled_modules text[] not null default array['mood'],
  medications     jsonb not null default '[]'::jsonb,
  meal_items      jsonb not null default '[]'::jsonb,
  trackers        jsonb not null default '[]'::jsonb,
  units           jsonb not null default '{"water": "glasses", "weight": "kg"}'::jsonb,
  configured_by   uuid references public.profiles (id) on delete set null,
  configured_at   timestamptz,
  updated_at      timestamptz not null default now()
);

alter table public.daily_log_prefs enable row level security;
revoke all on public.daily_log_prefs from anon;
grant select, insert, update on public.daily_log_prefs to authenticated;

-- ----------------------------------------------------------------------------
-- 2. The new permission + the shared permission helper learns it
-- ----------------------------------------------------------------------------
alter table public.circle_members
  add column can_configure_daily_log boolean not null default false;

create or replace function public.has_circle_permission(p_icon uuid, p_kind text)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.circle_members
    where icon_id = p_icon
      and member_id = auth.uid()
      and case p_kind
            when 'mood'      then can_see_mood
            when 'health'    then can_see_health
            when 'reminders' then can_manage_reminders
            when 'configure' then can_configure_daily_log
            else false
          end
  );
$$;

create policy "prefs: own row" on public.daily_log_prefs
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "prefs: configurer reads" on public.daily_log_prefs
  for select using (public.has_circle_permission(profile_id, 'configure'));

create policy "prefs: configurer creates" on public.daily_log_prefs
  for insert with check (public.has_circle_permission(profile_id, 'configure'));

create policy "prefs: configurer updates" on public.daily_log_prefs
  for update
  using (public.has_circle_permission(profile_id, 'configure'))
  with check (public.has_circle_permission(profile_id, 'configure'));

-- Stamp + tell. Security definer because notifications has no insert
-- policy by design (0007) — only server code writes there.
create or replace function public.on_daily_log_prefs_write()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_first text;
begin
  -- Mood can never be switched off, whatever a client sends.
  if not ('mood' = any (new.enabled_modules)) then
    new.enabled_modules := array_prepend('mood', new.enabled_modules);
  end if;
  new.updated_at := now();

  if auth.uid() is distinct from new.profile_id then
    new.configured_by := auth.uid();
    new.configured_at := now();
    -- One unread note per helper at a time; rapid edits don't pile up.
    if not exists (
      select 1 from public.notifications
      where profile_id = new.profile_id
        and kind = 'circle'
        and link = '/app/settings'
        and created_by = auth.uid()
        and read_at is null
    ) then
      select split_part(coalesce(full_name, ''), ' ', 1) into v_first
      from public.profiles where id = auth.uid();
      insert into public.notifications (profile_id, title, body, kind, link, created_by)
      values (
        new.profile_id,
        '🛠️ ' || coalesce(nullif(v_first, ''), 'Someone in your circle') || ' set up your daily log',
        'Their changes are on your log now. Everything can be adjusted in Settings — it is your log.',
        'circle',
        '/app/settings',
        auth.uid()
      );
    end if;
  else
    -- The Icon's own hand: the "set up by" mark comes off.
    new.configured_by := null;
    new.configured_at := null;
  end if;
  return new;
end;
$$;

create trigger daily_log_prefs_write
  before insert or update on public.daily_log_prefs
  for each row execute function public.on_daily_log_prefs_write();

-- ----------------------------------------------------------------------------
-- 3. Voice notes bucket (private) + object policies
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-notes', 'voice-notes', false, 5242880,
  array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/x-m4a']
)
on conflict (id) do nothing;

create policy "voice: owner or mood-permitted circle reads" on storage.objects
  for select using (
    bucket_id = 'voice-notes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_circle_permission(((storage.foldername(name))[1])::uuid, 'mood')
    )
  );

create policy "voice: owner uploads to own folder" on storage.objects
  for insert with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "voice: owner replaces own file" on storage.objects
  for update
  using (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "voice: owner deletes own file" on storage.objects
  for delete using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
