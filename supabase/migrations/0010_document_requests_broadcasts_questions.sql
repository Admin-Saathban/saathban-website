-- ============================================================================
-- 0010 — Buddy document requests, admin broadcasts, questions
--
-- 1. buddy_document_requests: the dedicated table the admin lane's
--    document-request UI writes to (it previously piggybacked on
--    admin_contact_icon). Inserting one still notifies the applicant and
--    audit-logs the request — now via trigger, atomically.
-- 2. admin_broadcast(): one notification to every active profile, optionally
--    filtered by role. Audited with recipient count.
-- 3. questions: any signed-in account may ask; admins answer through
--    admin_answer_question(), which stores the reply, flips status, notifies
--    the asker, and audit-logs. Askers read their own thread.
--
-- Support-admin note: 0002 gives only super-admins SELECT on other profiles,
-- so both new user-facing tables denormalize what the support queue needs
-- (asker_name/asker_role) at insert time via SECURITY DEFINER triggers —
-- the same reason buddy_applications carries legal_name.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Buddy document requests
-- ────────────────────────────────────────────────────────────────────────────
create table public.buddy_document_requests (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.buddy_applications (id) on delete cascade,
  requested_by   uuid references public.profiles (id) on delete set null,
  doc_type       text not null check (char_length(doc_type) between 2 and 120),
  note           text,
  status         text not null default 'awaiting' check (status in ('awaiting', 'received')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index buddy_document_requests_app_idx
  on public.buddy_document_requests (application_id, created_at);

create trigger buddy_document_requests_updated_at
  before update on public.buddy_document_requests
  for each row execute function public.set_updated_at();

-- Stamp who asked, notify the applicant, audit — one atomic insert.
create or replace function public.on_document_request_insert()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_applicant uuid;
begin
  if new.requested_by is null then
    new.requested_by := auth.uid();
  end if;
  select applicant_id into v_applicant
    from public.buddy_applications where id = new.application_id;

  insert into public.notifications (profile_id, title, body, kind, created_by)
  values (
    v_applicant,
    'Document needed: ' || new.doc_type,
    coalesce(new.note || E'\n\n', '') ||
      'Please add this document to your volunteer application.',
    'document_request',
    auth.uid()
  );

  perform public.write_audit(
    'document_request',
    v_applicant,
    'Buddy vetting: requested ' || new.doc_type,
    jsonb_build_object('application_id', new.application_id, 'request_id', new.id)
  );
  return new;
end;
$$;

create trigger buddy_document_requests_notify
  before insert on public.buddy_document_requests
  for each row execute function public.on_document_request_insert();

alter table public.buddy_document_requests enable row level security;
revoke all on public.buddy_document_requests from anon;

-- Applicants see what has been asked of them.
create policy "applicant reads own document requests"
  on public.buddy_document_requests for select
  using (
    exists (
      select 1 from public.buddy_applications a
      where a.id = application_id and a.applicant_id = auth.uid()
    )
  );

-- Documents are support scope (SPEC.md, Admin): both admin levels read/write.
create policy "admins read document requests"
  on public.buddy_document_requests for select
  using (public.is_admin());

create policy "admins create document requests"
  on public.buddy_document_requests for insert
  with check (public.is_admin());

create policy "admins update document requests"
  on public.buddy_document_requests for update
  using (public.is_admin())
  with check (public.is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Admin broadcasts
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_broadcast(
  p_title text,
  p_body text,
  p_reason text,
  p_role public.user_role default null
)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Staff only';
  end if;
  if coalesce(length(trim(p_title)), 0) < 2 then
    raise exception 'A title is required';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'A reason is required';
  end if;

  insert into public.notifications (profile_id, title, body, kind, created_by)
  select p.id, trim(p_title), p_body, 'broadcast', auth.uid()
  from public.profiles p
  where (p_role is null or p.role = p_role)
    and not p.is_blocked
    and not p.is_paused;
  get diagnostics v_count = row_count;

  perform public.write_audit(
    'admin_broadcast',
    null,
    p_reason,
    jsonb_build_object('role', p_role, 'recipients', v_count, 'title', trim(p_title))
  );
  return v_count;
end;
$$;

revoke execute on function public.admin_broadcast(text, text, text, public.user_role) from public, anon;
grant execute on function public.admin_broadcast(text, text, text, public.user_role) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Questions
-- ────────────────────────────────────────────────────────────────────────────
create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  -- Denormalized by trigger so support admins can answer by name without
  -- profile read access.
  asker_name  text not null default '',
  asker_role  public.user_role,
  subject     text not null check (char_length(subject) between 3 and 200),
  body        text not null check (char_length(body) between 1 and 4000),
  status      text not null default 'open' check (status in ('open', 'answered')),
  reply       text,
  replied_by  uuid references public.profiles (id) on delete set null,
  replied_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index questions_status_idx  on public.questions (status, created_at);
create index questions_profile_idx on public.questions (profile_id, created_at desc);

create trigger questions_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- Force ownership and the review fields regardless of the client payload,
-- and stamp the asker's display facts.
create or replace function public.on_question_insert()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    new.profile_id := auth.uid();
  end if;
  select full_name, role into new.asker_name, new.asker_role
    from public.profiles where id = new.profile_id;
  new.status := 'open';
  new.reply := null;
  new.replied_by := null;
  new.replied_at := null;
  return new;
end;
$$;

create trigger questions_before_insert
  before insert on public.questions
  for each row execute function public.on_question_insert();

alter table public.questions enable row level security;
revoke all on public.questions from anon;

-- Any signed-in account in good standing may ask.
create policy "ask a question"
  on public.questions for insert to authenticated
  with check (profile_id = auth.uid() and public.account_ok());

-- Askers read their own thread (including the reply, when it comes).
create policy "read own questions"
  on public.questions for select
  using (profile_id = auth.uid());

-- Both admin levels read the queue.
create policy "admins read questions"
  on public.questions for select
  using (public.is_admin());

-- No UPDATE policies: replies happen only through the RPC below, so the
-- stored reply, the notification, and the audit entry stay one unit.

create or replace function public.admin_answer_question(
  p_question uuid,
  p_reply text
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_profile uuid;
  v_subject text;
begin
  if not public.is_admin() then
    raise exception 'Staff only';
  end if;
  if coalesce(length(trim(p_reply)), 0) < 1 then
    raise exception 'A reply is required';
  end if;

  update public.questions
     set reply = p_reply,
         status = 'answered',
         replied_by = auth.uid(),
         replied_at = now()
   where id = p_question
   returning profile_id, subject into v_profile, v_subject;
  if not found then
    raise exception 'No such question';
  end if;

  insert into public.notifications (profile_id, title, body, kind, created_by)
  values (v_profile, 'Reply to: ' || v_subject, p_reply, 'question_reply', auth.uid());

  perform public.write_audit(
    'question_reply',
    v_profile,
    'Answered a question',
    jsonb_build_object('question_id', p_question)
  );
end;
$$;

revoke execute on function public.admin_answer_question(uuid, text) from public, anon;
grant execute on function public.admin_answer_question(uuid, text) to authenticated;
