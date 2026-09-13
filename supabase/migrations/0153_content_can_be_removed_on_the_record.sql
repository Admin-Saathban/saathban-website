/* ═══════════════════════════════════════════════════════════════
   0153 — Content can be removed, on the record

   admin_recent_content(p_limit) — support or super. Recent community
   posts, recent group posts, and message reports. Admins still cannot
   read direct messages: a message report carries only the snapshot the
   reporter's own client took (community_reports.target_excerpt).
   Audited: admin_view_content {limit}.

   admin_remove_content(p_kind, p_id, p_reason, p_report) — SUPER-ADMIN
   ONLY. Hiding (moderate_content, 0125) is reversible and stays with
   moderators and support; removing is not reversible, so it sits with
   the owner. Kinds: post, comment, group_post, park_board, dm_message.
   Audited BEFORE the delete as content_removed with a snapshot:
     · post / comment / group_post / park_board: author, created_at,
       body, group/post/place it belonged to, attached file paths;
     · dm_message: sender, conversation, created_at and the REPORT'S
       excerpt only — the body is never copied into the audit log.
   Attached files are queued in admin_file_removals (0151) and returned,
   so the admin's browser removes them through the Storage API. If a
   report is passed, it is resolved (its own trigger audits that).
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.admin_recent_content(p_limit integer default 40)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 200);
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'posts', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select cp.id, cp.author_id, a.full_name as author_name, a.is_test as author_is_test,
               left(cp.body, 600) as body, cp.post_type, cp.visibility, cp.created_at,
               cp.image_path is not null as has_image, cp.audio_path is not null as has_audio,
               cp.hidden_at, cp.hidden_by, h.full_name as hidden_by_name,
               (select count(*) from post_comments c where c.post_id = cp.id) as comments,
               (select count(*) from community_reports r where r.target_kind = 'post' and r.target_id = cp.id and r.status = 'open') as open_reports
          from community_posts cp
          left join profiles a on a.id = cp.author_id
          left join profiles h on h.id = cp.hidden_by
         order by cp.created_at desc limit v_limit) x), '[]'::jsonb),
    'group_posts', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select gp.id, gp.author_id, a.full_name as author_name, a.is_test as author_is_test,
               left(gp.body, 600) as body, gp.created_at, g.id as group_id, g.name as group_name, g.privacy as group_privacy,
               gp.hidden_at, gp.hidden_by, h.full_name as hidden_by_name,
               (select count(*) from community_reports r where r.target_kind = 'group_post' and r.target_id = gp.id and r.status = 'open') as open_reports
          from group_posts gp
          join groups g on g.id = gp.group_id
          left join profiles a on a.id = gp.author_id
          left join profiles h on h.id = gp.hidden_by
         order by gp.created_at desc limit v_limit) x), '[]'::jsonb),
    'message_reports', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select r.id, r.target_kind, r.target_id, r.target_author_id, a.full_name as author_name,
               r.reporter_id, rp.full_name as reporter_name, r.target_excerpt, r.reason, r.status,
               r.resolution_note, r.resolved_at, r.created_at,
               r.target_media_kind,
               (r.target_kind = 'dm_message' and exists (select 1 from dm_messages m where m.id = r.target_id)) as message_exists
          from community_reports r
          left join profiles a on a.id = r.target_author_id
          left join profiles rp on rp.id = r.reporter_id
         where r.target_kind in ('dm_message', 'dm_request', 'dm_conversation')
         order by r.created_at desc limit v_limit) x), '[]'::jsonb)
  ) into v_out;

  perform public.write_audit('admin_view_content', null, null, jsonb_build_object('limit', v_limit));
  return v_out;
end;
$function$;

create or replace function public.admin_remove_content(p_kind text, p_id uuid, p_reason text, p_report uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_batch uuid := gen_random_uuid();
  v_author uuid;
  v_snapshot jsonb;
  v_files jsonb := '[]'::jsonb;
  v_excerpt text;
begin
  if not public.is_super_admin() then
    raise exception 'Only a super-admin can remove content' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 5 then
    raise exception 'A reason is required';
  end if;

  if p_kind = 'post' then
    select author_id,
           jsonb_build_object('author_id', author_id, 'created_at', created_at, 'body', body,
             'post_type', post_type, 'visibility', visibility, 'payload', payload,
             'image_path', image_path, 'audio_path', audio_path,
             'comments', (select count(*) from post_comments c where c.post_id = p.id)),
           (select coalesce(jsonb_agg(f), '[]'::jsonb) from (
              select jsonb_build_object('bucket', 'community-images', 'path', image_path) f where image_path is not null
              union all
              select jsonb_build_object('bucket', 'post-audio', 'path', audio_path) where audio_path is not null) s)
      into v_author, v_snapshot, v_files
      from community_posts p where id = p_id;
  elsif p_kind = 'comment' then
    select author_id, jsonb_build_object('author_id', author_id, 'created_at', created_at, 'body', body, 'post_id', post_id)
      into v_author, v_snapshot from post_comments where id = p_id;
  elsif p_kind = 'group_post' then
    select author_id, jsonb_build_object('author_id', author_id, 'created_at', created_at, 'body', body, 'group_id', group_id)
      into v_author, v_snapshot from group_posts where id = p_id;
  elsif p_kind = 'park_board' then
    select author_id, jsonb_build_object('author_id', author_id, 'created_at', created_at, 'body', body, 'place_id', place_id)
      into v_author, v_snapshot from park_board_messages where id = p_id;
  elsif p_kind = 'dm_message' then
    select r.target_excerpt into v_excerpt from community_reports r
     where r.target_kind = 'dm_message' and r.target_id = p_id
     order by (r.id = p_report) desc, r.created_at desc limit 1;
    select sender_id,
           jsonb_build_object('sender_id', sender_id, 'conversation', request_id, 'created_at', created_at,
             'reported_excerpt', v_excerpt, 'had_image', image_path is not null, 'had_audio', audio_path is not null),
           (select coalesce(jsonb_agg(f), '[]'::jsonb) from (
              select jsonb_build_object('bucket', 'dm-images', 'path', image_path) f where image_path is not null
              union all
              select jsonb_build_object('bucket', 'dm-audio', 'path', audio_path) where audio_path is not null) s)
      into v_author, v_snapshot, v_files
      from dm_messages where id = p_id;
  else
    raise exception 'Unknown kind %', p_kind;
  end if;

  if v_snapshot is null then
    raise exception 'Nothing to remove — it may already be gone';
  end if;

  insert into public.admin_file_removals (batch, bucket, path, cause, requested_by)
    select v_batch, f->>'bucket', f->>'path', 'content_removed', auth.uid()
      from jsonb_array_elements(coalesce(v_files, '[]'::jsonb)) f;

  perform public.write_audit('content_removed', public.admin_audit_target(v_author), p_reason,
    jsonb_build_object('kind', p_kind, 'target_id', p_id, 'report_id', p_report,
                       'snapshot', v_snapshot, 'files', coalesce(v_files, '[]'::jsonb), 'file_batch', v_batch));

  if p_kind = 'post' then
    delete from community_posts where id = p_id;
  elsif p_kind = 'comment' then
    delete from post_comments where id = p_id;
  elsif p_kind = 'group_post' then
    delete from group_posts where id = p_id;
  elsif p_kind = 'park_board' then
    delete from park_board_messages where id = p_id;
  elsif p_kind = 'dm_message' then
    delete from dm_messages where id = p_id;
  end if;

  if p_report is not null then
    update community_reports
       set status = 'resolved', resolution_note = coalesce(resolution_note, p_reason)
     where id = p_report and status = 'open';
  end if;

  return jsonb_build_object('batch', v_batch, 'files', coalesce(v_files, '[]'::jsonb));
end;
$function$;

revoke all on function public.admin_recent_content(integer) from public, anon;
revoke all on function public.admin_remove_content(text, uuid, text, uuid) from public, anon;
grant execute on function public.admin_recent_content(integer) to authenticated;
grant execute on function public.admin_remove_content(text, uuid, text, uuid) to authenticated;
