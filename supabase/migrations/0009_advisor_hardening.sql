-- ============================================================================
-- 0009 — Hardening from the Supabase security advisor
--
-- Two follow-ups after 0001–0008 were applied:
--   1. Pin search_path on the two plain (non-definer) trigger functions.
--   2. Postgres grants EXECUTE to PUBLIC on new functions by default, so the
--      role-helper functions were callable by anonymous clients. They leak
--      nothing (they return false/null without a session), but anon has no
--      business calling anything here — revoke, then grant back exactly what
--      signed-in users need: RLS policies evaluate as the querying role, so
--      `authenticated` must keep EXECUTE on every helper a policy consults.
--
-- Note: the advisor also flags the safe_profiles view as SECURITY DEFINER.
-- That is intentional and load-bearing — see the comment in 0002.
-- ============================================================================

alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.check_daily_log_date() set search_path = public, pg_temp;

-- Trigger functions are invoked by the system, never by clients.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.check_daily_log_date() from public, anon, authenticated;
revoke execute on function public.protect_profile_columns() from public, anon, authenticated;
revoke execute on function public.on_buddy_status_change() from public, anon, authenticated;

-- Policy helpers: nothing for anon, explicit EXECUTE for signed-in users.
revoke execute on function public.app_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.account_ok() from public, anon;
revoke execute on function public.is_org_profile(uuid) from public, anon;
revoke execute on function public.is_active_buddy(uuid) from public, anon;
revoke execute on function public.has_circle_permission(uuid, text) from public, anon;

grant execute on function public.app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.account_ok() to authenticated;
grant execute on function public.is_org_profile(uuid) to authenticated;
grant execute on function public.is_active_buddy(uuid) to authenticated;
grant execute on function public.has_circle_permission(uuid, text) to authenticated;
