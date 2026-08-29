-- ============================================================================
-- 0003 — Audit log
--
-- Every admin touch of sensitive data writes who, what, when, why.
-- Rows are written only by SECURITY DEFINER functions and triggers — clients
-- (including admins) can never insert, edit, or delete an entry directly.
-- ============================================================================

create table public.audit_log (
  id                 bigint generated always as identity primary key,
  actor_id           uuid references public.profiles (id) on delete set null,
  -- e.g. 'break_glass_read_logs', 'admin_contact', 'pause_account',
  --      'buddy_status_change'
  action             text not null,
  target_profile_id  uuid references public.profiles (id) on delete set null,
  reason             text,
  detail             jsonb not null default '{}',
  created_at         timestamptz not null default now()
);

create index audit_log_target_idx on public.audit_log (target_profile_id, created_at desc);
create index audit_log_actor_idx  on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;

-- The audit trail is itself sensitive: only super-admins may read it.
create policy "super admin reads audit log"
  on public.audit_log for select
  using (public.is_super_admin());

-- No insert/update/delete policies, and privileges revoked outright:
-- entries exist only via the definer functions below. The log is append-only
-- from the API's point of view.
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- Internal helper used by staff RPCs and triggers to append an entry.
-- Not callable by clients (execute revoked); definer functions owned by
-- postgres reach it regardless.
create or replace function public.write_audit(
  p_action text,
  p_target uuid,
  p_reason text,
  p_detail jsonb default '{}'
)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_log (actor_id, action, target_profile_id, reason, detail)
  values (auth.uid(), p_action, p_target, p_reason, coalesce(p_detail, '{}'));
$$;

revoke execute on function public.write_audit(text, uuid, text, jsonb) from public, anon, authenticated;
