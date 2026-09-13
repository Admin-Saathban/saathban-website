/* ═══════════════════════════════════════════════════════════════
   0151 — An account can be deleted with its data

   Settings tells people: write to admin@saathban.com and we will remove
   your account and everything in it. This makes that true.

   ORDER. The audit row is written FIRST, with a snapshot (name, role,
   email, joined, the counts of what is removed, and the list of stored
   files), then the auth.users row is deleted. profiles cascades from
   auth.users, and nearly every table cascades from profiles.

   WHAT DOES NOT CASCADE, handled here:
     · post_help_offers.removed_by is NO ACTION, so it would block the
       delete of anyone who ever removed a help offer → set to null.
     · community_reports ABOUT the person keep target_author_id (set
       null by FK) and a copy of their words (target_excerpt) and media
       path → the words and media reference are cleared; the fact that
       a report existed stays.
     · Columns that are SET NULL by FK (audit_log actor/target, hidden_by,
       events.created_by, outdoor_places.created_by, notifications
       created_by, reviewed_by…) keep the other row and lose the name.
       Gatherings and places they created stay.
     · The audit log itself stays: it is the staff record that the
       deletion happened.

   STORED FILES. storage.objects cannot be deleted in SQL (storage's
   protect_delete trigger), and deleting its rows would not remove the
   files anyway. So the function queues the files in
   admin_file_removals and returns the list; the admin's browser removes
   them through the Storage API, which a narrow storage policy allows
   ONLY for a super-admin and ONLY for a path queued in the last 7 days.
   admin_files_removed then checks what is really gone and audits what
   remains.

   Who may call:
     admin_account_deletion_preview   super-admin. Audited.
     admin_delete_account             super-admin; typed email must
                                      match; reason ≥ 5 chars; never self;
                                      never the last super-admin.
     admin_files_removed              super-admin. Audited.
   admin_person_footprint, admin_person_files and admin_erase_account are
   internal: no client role may execute them.
   ═══════════════════════════════════════════════════════════════ */

create table if not exists public.admin_file_removals (
  id bigint generated always as identity primary key,
  batch uuid not null,
  bucket text not null,
  path text not null,
  cause text not null,
  requested_by uuid,
  requested_at timestamptz not null default now(),
  removed_at timestamptz,
  checked_at timestamptz
);
create index if not exists admin_file_removals_lookup
  on public.admin_file_removals (bucket, path) where removed_at is null;
alter table public.admin_file_removals enable row level security;
revoke all on public.admin_file_removals from anon, authenticated;
grant select on public.admin_file_removals to authenticated;
drop policy if exists "file removals: super-admins read" on public.admin_file_removals;
create policy "file removals: super-admins read" on public.admin_file_removals
  for select using (public.is_super_admin());

create or replace function public.admin_file_removal_queued(p_bucket text, p_path text)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select public.is_super_admin()
     and exists (select 1 from public.admin_file_removals
                  where bucket = p_bucket and path = p_path
                    and removed_at is null
                    and requested_at > now() - interval '7 days');
$function$;
revoke all on function public.admin_file_removal_queued(text, text) from public, anon;
grant execute on function public.admin_file_removal_queued(text, text) to authenticated;

drop policy if exists "admin: queued removals can be read" on storage.objects;
create policy "admin: queued removals can be read" on storage.objects
  for select to authenticated
  using (public.admin_file_removal_queued(bucket_id, name));
drop policy if exists "admin: queued removals can be deleted" on storage.objects;
create policy "admin: queued removals can be deleted" on storage.objects
  for delete to authenticated
  using (public.admin_file_removal_queued(bucket_id, name));

/* What an account holds, as counts. `removed` goes with the account;
   `affects_others` is what other people lose because it cascades
   through something this person created; `stays` is kept. */
create or replace function public.admin_person_footprint(p_id uuid)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'removed', jsonb_build_object(
      'posts',             (select count(*) from community_posts where author_id = p_id),
      'comments',          (select count(*) from post_comments where author_id = p_id),
      'reactions',         (select count(*) from post_reactions where profile_id = p_id),
      'group_posts',       (select count(*) from group_posts where author_id = p_id),
      'group_messages',    (select count(*) from group_messages where sender_id = p_id),
      'groups_created',    (select count(*) from groups where created_by = p_id or family_of = p_id),
      'group_memberships', (select count(*) from group_members where member_id = p_id),
      'dm_messages',       (select count(*) from dm_messages where sender_id = p_id),
      'dm_conversations',  (select count(*) from dm_requests where p_id in (requester_id, recipient_id)),
      'daily_logs',        (select count(*) from daily_logs where icon_id = p_id),
      'logged_days',       (select count(*) from logged_days where profile_id = p_id),
      'streaks',           (select count(*) from streaks where owner_id = p_id),
      'streak_sends',      (select count(*) from streak_sends where sender_id = p_id or recipient_id = p_id),
      'reminders',         (select count(*) from reminders where icon_id = p_id),
      'calendar_entries',  (select count(*) from calendar_entries where owner_id = p_id),
      'checkins',          (select count(*) from outdoor_checkins where profile_id = p_id),
      'outings',           (select count(*) from outdoor_outings where creator_id = p_id),
      'park_board',        (select count(*) from park_board_messages where author_id = p_id),
      'game_sessions',     (select count(*) from game_sessions where created_by = p_id),
      'game_seats',        (select count(*) from game_seats where profile_id = p_id),
      'puzzle_attempts',   (select count(*) from puzzle_attempts where profile_id = p_id),
      'badges',            (select count(*) from earned_badges where profile_id = p_id),
      'circle_as_icon',    (select count(*) from circle_members where icon_id = p_id),
      'circle_as_member',  (select count(*) from circle_members where member_id = p_id),
      'friend_requests',   (select count(*) from friend_requests where p_id in (requester_id, recipient_id)),
      'event_rsvps',       (select count(*) from event_rsvps where profile_id = p_id),
      'survey_responses',  (select count(*) from survey_responses where profile_id = p_id),
      'course_progress',   (select count(*) from course_progress where profile_id = p_id),
      'questions',         (select count(*) from questions where profile_id = p_id),
      'notifications',     (select count(*) from notifications where profile_id = p_id),
      'buddy_applications',(select count(*) from buddy_applications where applicant_id = p_id),
      'reports_filed',     (select count(*) from community_reports where reporter_id = p_id)
    ),
    'affects_others', jsonb_build_object(
      'members_of_their_groups', (select count(*) from group_members gm join groups g on g.id = gm.group_id
                                   where (g.created_by = p_id or g.family_of = p_id) and gm.member_id <> p_id),
      'others_posts_in_their_groups', (select count(*) from group_posts gp join groups g on g.id = gp.group_id
                                   where (g.created_by = p_id or g.family_of = p_id) and gp.author_id <> p_id),
      'others_messages_in_their_conversations', (select count(*) from dm_messages m join dm_requests r on r.id = m.request_id
                                   where p_id in (r.requester_id, r.recipient_id) and m.sender_id <> p_id),
      'others_comments_on_their_posts', (select count(*) from post_comments c join community_posts cp on cp.id = c.post_id
                                   where cp.author_id = p_id and c.author_id <> p_id),
      'others_seats_in_their_games', (select count(*) from game_seats s join game_sessions gs on gs.id = s.session_id
                                   where gs.created_by = p_id and s.profile_id <> p_id)
    ),
    'stays', jsonb_build_object(
      'events_created',  (select count(*) from events where created_by = p_id),
      'places_created',  (select count(*) from outdoor_places where created_by = p_id),
      'reports_about_them_kept_without_words', (select count(*) from community_reports where target_author_id = p_id),
      'audit_entries',   (select count(*) from audit_log where actor_id = p_id or target_profile_id = p_id)
    )
  );
$function$;
revoke all on function public.admin_person_footprint(uuid) from public, anon, authenticated;

create or replace function public.admin_person_files(p_id uuid)
 returns table (bucket text, path text)
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select o.bucket_id::text, o.name::text
    from storage.objects o
   where (o.bucket_id in ('avatars', 'voice-notes', 'community-images', 'post-audio', 'buddy-documents')
          and (storage.foldername(o.name))[1] = p_id::text)
      or (o.bucket_id in ('dm-images', 'dm-audio')
          and (storage.foldername(o.name))[1] in
              (select r.id::text from public.dm_requests r where p_id in (r.requester_id, r.recipient_id)))
      or (o.bucket_id = 'group-covers'
          and (storage.foldername(o.name))[1] in
              (select g.id::text from public.groups g where g.created_by = p_id or g.family_of = p_id))
      or (o.bucket_id = 'report-evidence'
          and o.name in (select cr.target_media_path from public.community_reports cr
                          where cr.target_media_bucket = 'report-evidence'
                            and (cr.target_author_id = p_id or cr.reporter_id = p_id)));
$function$;
revoke all on function public.admin_person_files(uuid) from public, anon, authenticated;

/* The one place an account is erased. Callers check who is asking. */
create or replace function public.admin_erase_account(p_id uuid, p_reason text, p_batch uuid, p_action text, p_extra jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text;
  v_joined timestamptz;
  v_p public.profiles%rowtype;
  v_has boolean;
  v_files jsonb;
begin
  select email, created_at into v_email, v_joined from auth.users where id = p_id;
  if not found then
    raise exception 'No such account';
  end if;
  select * into v_p from public.profiles where id = p_id;
  v_has := found;

  select coalesce(jsonb_agg(jsonb_build_object('bucket', f.bucket, 'path', f.path)), '[]'::jsonb)
    into v_files from public.admin_person_files(p_id) f;
  insert into public.admin_file_removals (batch, bucket, path, cause, requested_by)
    select p_batch, f.bucket, f.path, 'account_deleted', auth.uid()
      from public.admin_person_files(p_id) f;

  -- The record comes first: if anything below fails, the whole call
  -- rolls back together, audit row included.
  perform public.write_audit(p_action, case when v_has then p_id end, p_reason,
    jsonb_build_object(
      'profile_id', p_id,
      'email', v_email,
      'full_name', v_p.full_name,
      'role', v_p.role,
      'admin_level', v_p.admin_level,
      'is_test', v_p.is_test,
      'joined', coalesce(v_p.created_at, v_joined),
      'footprint', public.admin_person_footprint(p_id),
      'files', v_files,
      'file_batch', p_batch
    ) || coalesce(p_extra, '{}'::jsonb));

  update public.post_help_offers set removed_by = null where removed_by = p_id;
  update public.community_reports
     set target_excerpt = null, target_media_bucket = null,
         target_media_path = null, target_media_kind = null
   where target_author_id = p_id;

  delete from auth.users where id = p_id;

  return jsonb_build_object('profile_id', p_id, 'email', v_email, 'files', v_files);
end;
$function$;
revoke all on function public.admin_erase_account(uuid, text, uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.admin_account_deletion_preview(p_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text;
  v_p public.profiles%rowtype;
  v_has boolean;
  v_files jsonb;
  v_out jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Only a super-admin can delete an account' using errcode = '42501';
  end if;
  select email into v_email from auth.users where id = p_id;
  if not found then
    raise exception 'No such account';
  end if;
  select * into v_p from public.profiles where id = p_id;
  v_has := found;
  select coalesce(jsonb_agg(jsonb_build_object('bucket', f.bucket, 'path', f.path)), '[]'::jsonb)
    into v_files from public.admin_person_files(p_id) f;

  v_out := jsonb_build_object(
    'profile_id', p_id, 'email', v_email, 'full_name', v_p.full_name,
    'role', v_p.role, 'admin_level', v_p.admin_level, 'is_self', p_id = auth.uid(),
    'footprint', public.admin_person_footprint(p_id), 'files', v_files);

  perform public.write_audit('admin_preview_deletion', case when v_has then p_id end, null,
    jsonb_build_object('profile_id', p_id));
  return v_out;
end;
$function$;

create or replace function public.admin_delete_account(p_id uuid, p_confirm text, p_reason text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text;
  v_batch uuid := gen_random_uuid();
begin
  if not public.is_super_admin() then
    raise exception 'Only a super-admin can delete an account' using errcode = '42501';
  end if;
  if p_id = auth.uid() then
    raise exception 'You cannot delete your own account here';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 5 then
    raise exception 'A reason is required';
  end if;
  select email into v_email from auth.users where id = p_id;
  if not found then
    raise exception 'No such account';
  end if;
  if lower(btrim(coalesce(p_confirm, ''))) <> lower(coalesce(v_email, '')) then
    raise exception 'The typed confirmation does not match this account';
  end if;
  if exists (select 1 from public.profiles where id = p_id and role = 'admin' and admin_level = 'super')
     and not exists (select 1 from public.profiles where role = 'admin' and admin_level = 'super'
                      and id <> p_id and not is_paused and not is_blocked) then
    raise exception 'This is the last super-admin';
  end if;

  return public.admin_erase_account(p_id, p_reason, v_batch, 'delete_account')
         || jsonb_build_object('batch', v_batch);
end;
$function$;

create or replace function public.admin_files_removed(p_batch uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_removed integer;
  v_remaining jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.admin_file_removals r
     set removed_at = now(), checked_at = now()
   where r.batch = p_batch and r.removed_at is null
     and not exists (select 1 from storage.objects o where o.bucket_id = r.bucket and o.name = r.path);
  select count(*) into v_removed from public.admin_file_removals where batch = p_batch and removed_at is not null;
  update public.admin_file_removals set checked_at = now() where batch = p_batch and removed_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'path', path)), '[]'::jsonb)
    into v_remaining from public.admin_file_removals where batch = p_batch and removed_at is null;

  perform public.write_audit('files_removed', null, null,
    jsonb_build_object('batch', p_batch, 'removed', v_removed, 'remaining', v_remaining));
  return jsonb_build_object('removed', v_removed, 'remaining', v_remaining);
end;
$function$;

revoke all on function public.admin_account_deletion_preview(uuid) from public, anon;
revoke all on function public.admin_delete_account(uuid, text, text) from public, anon;
revoke all on function public.admin_files_removed(uuid) from public, anon;
grant execute on function public.admin_account_deletion_preview(uuid) to authenticated;
grant execute on function public.admin_delete_account(uuid, text, text) to authenticated;
grant execute on function public.admin_files_removed(uuid) to authenticated;
