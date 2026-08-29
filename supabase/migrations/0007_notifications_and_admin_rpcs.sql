-- ============================================================================
-- 0007 — In-app notifications and the logged staff RPCs
--
-- Decision #3: an Icon's phone and email are NOT support-admin scope. When
-- support needs to reach an Icon, admin_contact_icon delivers an in-app
-- notification without ever revealing the address, and logs the contact.
-- Decision #9: pause/unpause is its own flag, changed only through a logged
-- RPC (admin_set_pause), never a silent column update.
-- ============================================================================

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  body       text,
  -- 'general' now; later: 'milestone' (the personalised admin message on a
  -- celebration), 'circle', 'system'…
  kind       text not null default 'general',
  created_by uuid references public.profiles (id) on delete set null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx
  on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;

-- Each person reads their own notifications.
create policy "read own notifications"
  on public.notifications for select
  using (profile_id = auth.uid());

-- Each person can mark their own notifications read (the row stays theirs).
create policy "update own notifications"
  on public.notifications for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Each person can clear their own notifications.
create policy "delete own notifications"
  on public.notifications for delete
  using (profile_id = auth.uid());

-- No insert policy: notifications are created by staff RPCs (below) and by
-- the service role only.

-- ----------------------------------------------------------------------------
-- Support contacts an Icon without seeing their address (decision #3).
-- Any admin level may call it; every call is audit-logged with a reason.
-- ----------------------------------------------------------------------------
create or replace function public.admin_contact_icon(
  p_profile uuid,
  p_title text,
  p_body text,
  p_reason text
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Staff only';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'A reason is required';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile) then
    raise exception 'No such account';
  end if;

  insert into public.notifications (profile_id, title, body, kind, created_by)
  values (p_profile, p_title, p_body, 'general', auth.uid())
  returning id into v_id;

  perform public.write_audit(
    'admin_contact',
    p_profile,
    p_reason,
    jsonb_build_object('notification_id', v_id)
  );

  return v_id;
end;
$$;

revoke execute on function public.admin_contact_icon(uuid, text, text, text) from public, anon;
grant execute on function public.admin_contact_icon(uuid, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Pause / unpause (decision #9: separate from is_blocked). Support scope,
-- except pausing another admin, which is super-admin only. The transaction
-- flag lets this one statement pass the protected-columns trigger; the
-- audit entry records who, whom, and why.
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_pause(
  p_profile uuid,
  p_paused boolean,
  p_reason text
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Staff only';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'A reason is required';
  end if;
  if exists (select 1 from public.profiles where id = p_profile and role = 'admin')
     and not public.is_super_admin() then
    raise exception 'Only a super-admin can pause an admin account';
  end if;

  perform set_config('app.protected_profile_write', 'allow', true);
  update public.profiles set is_paused = p_paused where id = p_profile;
  if not found then
    raise exception 'No such account';
  end if;

  perform public.write_audit(
    case when p_paused then 'pause_account' else 'unpause_account' end,
    p_profile,
    p_reason
  );
end;
$$;

revoke execute on function public.admin_set_pause(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_pause(uuid, boolean, text) to authenticated;
