-- ════════════════════════════════════════════════
-- 0081 — PRODUCT_DECISIONS §5: company, not competition.
-- Applied 2026-08-30. Registered in supabase/MIGRATIONS.md.
--
-- "Fatima's logged today too." "Three of your people have logged today."
--
-- THE INVARIANT IS THE SHAPE OF THE RETURN. This function can only ever
-- report people who DID log. There is no argument, no flag and no column
-- by which it could be asked the opposite question, so no caller can
-- accidentally build "Fatima hasn't logged" out of it. §5 forbids the
-- app naming an absence, and the cheapest way to keep a rule across every
-- future caller is to make the data incapable of expressing what it
-- forbids.
--
-- NO TOTAL IS RETURNED, deliberately: a client holding "3 of 5" would
-- render the missing two, and somebody would eventually name them.
--
-- SHARING IS THE GATE, NOT CONNECTION. Being in someone's circle is not
-- consent to have your day reported to them; member_shares_log is.
-- ════════════════════════════════════════════════

create or replace function public.circle_logged_today()
returns table (profile_id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name
  from public.circle_members c
  join public.profiles p on p.id = c.member_id
  where c.icon_id = auth.uid()
    and c.member_shares_log
    and not p.is_blocked
    and exists (
      select 1 from public.daily_logs l
      where l.icon_id = p.id and l.log_date = current_date
    )
  union
  select p.id, p.full_name
  from public.circle_members c
  join public.profiles p on p.id = c.icon_id
  where c.member_id = auth.uid()
    and c.can_see_mood
    and not p.is_blocked
    and exists (
      select 1 from public.daily_logs l
      where l.icon_id = p.id and l.log_date = current_date
    );
$$;

revoke all on function public.circle_logged_today() from public, anon;
grant execute on function public.circle_logged_today() to authenticated;

comment on function public.circle_logged_today() is
  'People in the caller''s circle who HAVE logged today and who share '
  'their log with the caller. PRODUCT_DECISIONS §5: company, not '
  'competition. It cannot express an absence - there is no argument by '
  'which it could be asked who has NOT logged, and no total is returned, '
  'because a client holding "3 of 5" would render the missing two and '
  'somebody would eventually name them.';
