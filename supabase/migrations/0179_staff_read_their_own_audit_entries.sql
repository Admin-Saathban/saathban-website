-- ============================================================================
-- 0179 — Who may read the audit log, and the log is append-only for real.
--
-- OWNER DECISIONS (2026-09-15)
--   · Super-admins read every row.
--   · Support admins read the rows where THEY are the actor, never another
--     admin's.
--   · Moderators write audit rows (moderate_content, moderator_set_pause and
--     the report-status trigger all record the moderator as the actor), so
--     they get the same rule as support: their own actions only.
--   · A paused or blocked admin reads nothing (the helpers exclude them).
--   · Rows are kept indefinitely: no delete, no retention job, no export.
--
-- The screen reads through admin_audit_entries (0180), which applies the
-- same rule; this policy keeps a direct select on the table in step so the
-- rule does not depend on which door is used.
--
-- APPEND-ONLY. 0003 revoked insert/update/delete, but the Supabase default
-- grants left TRUNCATE, TRIGGER and REFERENCES with `authenticated`.
-- TRUNCATE is not subject to row-level security, so any signed-in account
-- could have emptied the log. Nothing in the app needs any of the three:
-- every writer is a SECURITY DEFINER function or trigger owned by postgres,
-- and no client creates foreign keys or triggers. MAINTAIN (Postgres 17)
-- is revoked too where it exists.
-- ============================================================================

drop policy if exists "super admin reads audit log" on public.audit_log;

create policy "audit log is read by super admins, and by staff for their own actions"
  on public.audit_log for select
  to authenticated
  using (
    public.is_super_admin()
    or (actor_id = (select auth.uid()) and (public.is_admin() or public.is_moderator()))
  );

revoke truncate, trigger, references on public.audit_log from authenticated, anon, public;

do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on public.audit_log from authenticated, anon, public';
  end if;
end $$;

-- Newest first, paged on (created_at, id).
create index if not exists audit_log_newest_idx on public.audit_log (created_at desc, id desc);
