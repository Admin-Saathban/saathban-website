/* ═══════════════════════════════════════════════════════════════
   0155 — Only files that exist are counted

   admin_remove_content (0153) queued a post's image_path / audio_path
   whether or not a file was ever stored there. A post can name a path
   whose upload failed; admin_files_removed then found "nothing in
   storage" and reported that file as removed — a deletion that never
   happened, written into the audit log as if it had.

   Now only paths that exist in storage.objects are queued and returned.
   The snapshot in the audit entry still records the paths the row named.
   Same signature, same callers, same checks (super-admin only).
   ═══════════════════════════════════════════════════════════════ */

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

  -- A path the row names is only a file if storage holds it.
  select coalesce(jsonb_agg(f), '[]'::jsonb) into v_files
    from jsonb_array_elements(coalesce(v_files, '[]'::jsonb)) f
   where exists (select 1 from storage.objects o
                  where o.bucket_id = f->>'bucket' and o.name = f->>'path');

  insert into public.admin_file_removals (batch, bucket, path, cause, requested_by)
    select v_batch, f->>'bucket', f->>'path', 'content_removed', auth.uid()
      from jsonb_array_elements(v_files) f;

  perform public.write_audit('content_removed', public.admin_audit_target(v_author), p_reason,
    jsonb_build_object('kind', p_kind, 'target_id', p_id, 'report_id', p_report,
                       'snapshot', v_snapshot, 'files', v_files, 'file_batch', v_batch));

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

  return jsonb_build_object('batch', v_batch, 'files', v_files);
end;
$function$;

revoke all on function public.admin_remove_content(text, uuid, text, uuid) from public, anon;
grant execute on function public.admin_remove_content(text, uuid, text, uuid) to authenticated;
