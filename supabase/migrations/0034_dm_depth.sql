-- ============================================================================
-- 0034 — Chat depth on the canonical DM thread + milestone progress
--
-- A. dm_messages grows three columns:
--    reply_to_id — quote-reply, same thread only (trigger-checked);
--    deleted_at  — "delete for everyone": sender-only, within 15 minutes,
--                  through delete_dm_message() below. The row stays (a
--                  "message removed" stub); body/image are nulled. Moderation
--                  snapshots already taken into community_reports.target_excerpt
--                  are untouched by design — a report is a report;
--    image_path  — a photo in a PRIVATE per-thread bucket folder
--                  (dm-images/<request_id>/<file>), never a public URL.
-- B. dm_message_hides — "delete for me": hides a message for one person only.
-- C. storage bucket dm-images (private) with participant-only policies.
-- D. milestone_progress() — per-badge "how far along" using the SAME rules
--    compute_badge_awards (0017) uses to award. Self-referential only.
--
-- Untouched: the 0030 dm bell trigger (kind='dm'), the 0014 read/send
-- policies, and the freeze rule — which is only carved open for the single
-- deleted_at transition.
-- ============================================================================

-- ─── A. columns ───
alter table public.dm_messages
  add column reply_to_id uuid references public.dm_messages (id) on delete set null,
  add column deleted_at  timestamptz,
  add column image_path  text;

-- A message is words, a game, a photo — or a removed stub.
alter table public.dm_messages drop constraint if exists dm_messages_content_check;
alter table public.dm_messages add constraint dm_messages_content_check
  check (body is not null or game_session_id is not null or image_path is not null or deleted_at is not null);

-- Reply must point inside the same thread; a photo path must live in this
-- thread's own folder. (Insert is a direct client write under the 0014/0027
-- policy, so the shape is enforced here, not in an RPC.)
create or replace function public.check_dm_message_shape()
returns trigger
language plpgsql
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.dm_messages p
    where p.id = new.reply_to_id and p.request_id = new.request_id
  ) then
    raise exception 'A reply must point at a message in the same conversation';
  end if;
  if new.image_path is not null
     and split_part(new.image_path, '/', 1) <> new.request_id::text then
    raise exception 'A photo must belong to this conversation';
  end if;
  return new;
end;
$$;

create trigger dm_messages_shape
  before insert on public.dm_messages
  for each row execute function public.check_dm_message_shape();

-- The freeze rule (0014) stays — except for ONE transition: setting
-- deleted_at (from null) may null the body and image at the same time.
create or replace function public.freeze_dm_columns()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'dm_requests' then
    if new.requester_id is distinct from old.requester_id
       or new.recipient_id is distinct from old.recipient_id then
      raise exception 'The two sides of a request cannot change';
    end if;
    if new.status is distinct from old.status then
      new.decided_at := now();
    end if;
  else
    if new.request_id is distinct from old.request_id
       or new.sender_id is distinct from old.sender_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Messages cannot be edited';
    end if;
    if new.deleted_at is not null and old.deleted_at is null then
      -- the removal transition: content goes, nothing else may change
      if new.body is not null or new.image_path is not null then
        raise exception 'A removed message keeps no content';
      end if;
    elsif new.body is distinct from old.body
       or new.image_path is distinct from old.image_path
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'Messages cannot be edited';
    end if;
  end if;
  return new;
end;
$$;

-- Delete for everyone: sender only, within 15 minutes, once.
create or replace function public.delete_dm_message(p_message uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  m public.dm_messages%rowtype;
begin
  select * into m from public.dm_messages where id = p_message for update;
  if m.id is null or m.sender_id is distinct from auth.uid() then
    raise exception 'Only the sender can remove a message';
  end if;
  if m.deleted_at is not null then
    return;
  end if;
  if m.created_at < now() - interval '15 minutes' then
    raise exception 'A message can be removed for everyone within 15 minutes of sending';
  end if;
  update public.dm_messages
  set deleted_at = now(), body = null, image_path = null
  where id = p_message;
  if m.image_path is not null then
    delete from storage.objects where bucket_id = 'dm-images' and name = m.image_path;
  end if;
end;
$$;

revoke execute on function public.delete_dm_message(uuid) from public, anon;
grant execute on function public.delete_dm_message(uuid) to authenticated;

-- ─── B. delete for me ───
create table public.dm_message_hides (
  message_id uuid not null references public.dm_messages (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);

alter table public.dm_message_hides enable row level security;
revoke all on public.dm_message_hides from anon;

create policy "hides: own" on public.dm_message_hides
  for select using (profile_id = auth.uid());
create policy "hides: hide for me" on public.dm_message_hides
  for insert with check (
    profile_id = auth.uid()
    and exists (select 1 from public.dm_messages dm
                where dm.id = message_id and public.is_dm_participant(dm.request_id))
  );
create policy "hides: unhide own" on public.dm_message_hides
  for delete using (profile_id = auth.uid());

-- ─── C. private per-thread photo bucket ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dm-images', 'dm-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Path: <request_id>/<file>. Only a participant of an OPEN thread may put a
-- photo in its folder; only participants may read it (signed URLs client-side).
create policy "dm images: participants upload to thread folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dm-images'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.dm_open(((storage.foldername(name))[1])::uuid)
    and public.account_ok()
  );

create policy "dm images: participants read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'dm-images'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_dm_participant(((storage.foldername(name))[1])::uuid)
  );
-- No client update/delete: removal happens through delete_dm_message().

-- ─── D. milestone progress — the award rules, read back as "how far" ───
-- Mirrors compute_badge_awards (0017) measure for measure; a badge's
-- progress is the caller's own count against that badge's target. Never
-- reads another person.
create or replace function public.milestone_progress()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_logs      int;
  v_notes     int;
  v_rests     int;
  v_days      int;
  v_best7     int;
  v_best30    int;
  v_return    boolean;
  v_posts     int;
  v_outings   int := 0;
begin
  if auth.uid() is null then return '{}'::jsonb; end if;

  select count(*),
         count(*) filter (where coalesce(payload->>'note', '') <> ''),
         count(*) filter (where module = 'rest_day')
  into v_logs, v_notes, v_rests
  from public.daily_logs where icon_id = auth.uid();

  with days as (select distinct log_date from public.daily_logs where icon_id = auth.uid())
  select
    (select count(*) from days),
    coalesce((select max(c) from (
      select (select count(*) from days d2 where d2.log_date between d.log_date - 7 and d.log_date) as c
      from days d) w), 0),
    coalesce((select max(c) from (
      select (select count(*) from days d2 where d2.log_date between d.log_date - 32 and d.log_date) as c
      from days d) w), 0),
    exists (select 1 from (
      select log_date, lag(log_date) over (order by log_date) as prev from days) g
      where g.prev is not null and g.log_date - g.prev >= 8)
  into v_days, v_best7, v_best30, v_return;

  select count(*) into v_posts from public.community_posts where author_id = auth.uid();

  if to_regclass('public.outdoor_checkins') is not null then
    execute 'select count(*) from public.outdoor_checkins where profile_id = $1'
      into v_outings using auth.uid();
  end if;

  return jsonb_build_object(
    'first_log',            jsonb_build_object('current', least(v_logs, 1),    'target', 1),
    'first_note',           jsonb_build_object('current', least(v_notes, 1),   'target', 1),
    'first_rest_day',       jsonb_build_object('current', least(v_rests, 1),   'target', 1),
    'presence_7',           jsonb_build_object('current', least(v_best7, 7),   'target', 7),
    'presence_30',          jsonb_build_object('current', least(v_best30, 30), 'target', 30),
    'presence_100',         jsonb_build_object('current', least(v_days, 100),  'target', 100),
    'return_after_absence', jsonb_build_object('current', case when v_return then 1 else 0 end, 'target', 1),
    'first_post',           jsonb_build_object('current', least(v_posts, 1),   'target', 1),
    'first_outing',         jsonb_build_object('current', least(v_outings, 1), 'target', 1)
  );
end;
$$;

revoke execute on function public.milestone_progress() from public, anon;
grant execute on function public.milestone_progress() to authenticated;
