-- ════════════════════════════════════════════════
-- 0080 — PRODUCT_DECISIONS §5: three questions at the start, not one.
-- Applied 2026-08-30. Registered in supabase/MIGRATIONS.md.
--
-- The column default was array['mood'] while the client now starts
-- people on mood, sleep and water. Two defaults that disagree is a bug
-- waiting for the first Icon whose prefs row is created server-side.
--
-- NEW ROWS ONLY. Existing Icons keep exactly the modules they have —
-- this is a default, not an UPDATE. Somebody who deliberately turned
-- sleep off last week must not find it back on tomorrow because a
-- default changed. §5 is about what a new person starts with, never
-- about overriding a choice already made.
-- ════════════════════════════════════════════════

alter table public.daily_log_prefs
  alter column enabled_modules set default array['mood', 'sleep', 'water'];

comment on column public.daily_log_prefs.enabled_modules is
  'Modules this Icon logs. Defaults to mood, sleep and water '
  '(PRODUCT_DECISIONS §5) - three questions rather than one, because a '
  'log with a single question is not yet a habit. Medicines, meals and '
  'movement start OFF; medicines especially, because they need setting '
  'up first and an empty medicine list on day one is a bad first '
  'impression. Mood cannot be removed - the character''s tone depends on '
  'it and a trigger re-adds it if a client ever drops it.';
