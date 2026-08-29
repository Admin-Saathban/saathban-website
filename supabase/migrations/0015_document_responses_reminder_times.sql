-- ============================================================================
-- 0015 — Buddy document responses + multi-time reminders
--
-- A. buddy_document_requests grows a response channel: the applicant
--    uploads the file to their own private folder and marks the request
--    received. RLS lets the applicant update ONLY the response fields —
--    a guard trigger keeps doc_type/note/application untouchable — and
--    the responding update notifies the admin who asked.
-- B. reminders grow remind_times time[] (a reminder can fire more than
--    once a day); remind_time stays as the first time for back-compat.
--    Creating a reminder for someone else now notifies that Icon.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- A. Document responses
-- ────────────────────────────────────────────────────────────────────────────
alter table public.buddy_document_requests
  add column response_path text,
  add column responded_at  timestamptz;

-- The applicant may update their own requests…
create policy "applicant responds to own document request"
  on public.buddy_document_requests for update
  using (
    exists (
      select 1 from public.buddy_applications a
      where a.id = application_id and a.applicant_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.buddy_applications a
      where a.id = application_id and a.applicant_id = auth.uid()
    )
  );

-- …but only the response fields, and only forward: status may move to
-- 'received', never away from it, and the request itself is immutable
-- to them. Admin updates pass through untouched.
create or replace function public.on_document_request_update()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.doc_type   is distinct from old.doc_type
     or new.note    is distinct from old.note
     or new.application_id is distinct from old.application_id
     or new.requested_by   is distinct from old.requested_by then
    raise exception 'Only the response fields can be changed';
  end if;
  if old.status = 'received' and new.status <> 'received' then
    raise exception 'A received document stays received';
  end if;
  if new.response_path is distinct from old.response_path then
    new.responded_at := now();
    new.status := 'received';
    if old.requested_by is not null then
      insert into public.notifications (profile_id, title, body, kind, created_by)
      values (
        old.requested_by,
        'Document received: ' || new.doc_type,
        'The applicant has uploaded the requested document.',
        'document_response',
        auth.uid()
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger buddy_document_requests_guard_update
  before update on public.buddy_document_requests
  for each row execute function public.on_document_request_update();

-- ────────────────────────────────────────────────────────────────────────────
-- B. Multi-time reminders + creation notification
-- ────────────────────────────────────────────────────────────────────────────
alter table public.reminders
  add column remind_times time[] not null default '{}';

update public.reminders set remind_times = array[remind_time];

-- Keep remind_time = the first entry so old readers stay correct; the
-- app writes remind_times and mirrors the first element here.
create or replace function public.on_reminder_write()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if array_length(new.remind_times, 1) is null then
    new.remind_times := array[new.remind_time];
  else
    new.remind_time := new.remind_times[1];
  end if;

  -- "Added by your daughter": a reminder created for someone else
  -- tells the Icon, plainly, who set it up is visible in-app later.
  if tg_op = 'INSERT' and new.created_by is distinct from new.icon_id then
    insert into public.notifications (profile_id, title, body, kind, created_by)
    values (
      new.icon_id,
      'A reminder was added for you',
      new.emoji || ' ' || new.label,
      'reminder',
      new.created_by
    );
  end if;
  return new;
end;
$$;

create trigger reminders_write
  before insert or update on public.reminders
  for each row execute function public.on_reminder_write();
