/* ═══════════════════════════════════════════════════════════════
   0125 — moderators can moderate, and every moderation is on the record

   WHAT WAS WRONG.
   · The moderator level could READ reports ("moderators read reports",
     can_moderate) but deciding one required is_admin(), which excludes
     moderators. Hiding content went through "… admin moderates" UPDATE
     policies, also is_admin(). moderator_suspend set is_paused without
     the protected-write bypass, so protect_profile_columns rejected it —
     and it wrote no audit entry.
   · Hiding content was not audited at all: the queue wrote hidden_at
     directly, and nothing recorded who hid what, or when.
   · Those UPDATE policies had no field restriction: any admin could
     rewrite any field of somebody's post, comment, board message, group
     or group post — not just hide it.
   · Nothing stopped an AUTHOR un-hiding their own hidden post through
     "posts: author edits own".

   WHAT IT IS NOW.
   · Deciding a report: can_moderate() (moderator, support, super). The
     existing on_report_status_change trigger already audits it with the
     actor and time.
   · Hiding and un-hiding: ONLY moderate_content(kind, id, hide, reason,
     report). can_moderate(); a reason is required; writes an audit row
     (content_hidden / content_unhidden) naming the actor, the author,
     the thing and the report. The "… admin moderates" UPDATE policies
     are dropped, so no admin can change any other field of anyone's
     content, and a trigger refuses any change to hidden_at/hidden_by that
     does not come through this function — from anyone, authors included.
   · Moderators can see hidden content (to judge it and to un-hide it)
     and report evidence files.
   · Suspending: moderator_set_pause(profile, paused, reason). A
     moderator may pause or unpause ordinary accounts; only a super-admin
     may pause any admin-role account (including moderators). Uses the
     protected-write bypass, writes pause_account / unpause_account with
     the actor. admin_set_pause and moderator_suspend now go through it,
     so every path is audited the same way.
   ═══════════════════════════════════════════════════════════════ */

-- ── deciding reports ───────────────────────────────────────────────
alter policy "reports: admins decide" on public.community_reports
  using (public.can_moderate()) with check (public.can_moderate());

-- ── moderators see what they are judging ───────────────────────────
alter policy "posts: read" on public.community_posts
  using (public.can_moderate() or (public.can_use_community() and hidden_at is null and not public.caller_hides(author_id)
         and (visibility = 'public' or author_id = auth.uid() or (visibility = 'friends' and public.are_friends(auth.uid(), author_id)))));
alter policy "comments: read" on public.post_comments
  using (public.can_moderate() or (public.can_use_community() and hidden_at is null and not public.caller_hides(author_id)));
alter policy "board: read" on public.park_board_messages
  using (public.can_moderate() or (public.can_use_community() and hidden_at is null and not public.caller_hides(author_id)));
alter policy "group posts: read" on public.group_posts
  using (public.can_moderate() or (public.is_group_member(group_id) and hidden_at is null and not public.caller_hides(author_id)));
alter policy "groups: read" on public.groups
  using (public.can_moderate() or (public.can_see_group(id) and not public.caller_hides(created_by) and (hidden_at is null or public.is_group_member(id))));

-- ── no arbitrary edits by admins ───────────────────────────────────
drop policy if exists "posts: admin moderates" on public.community_posts;
drop policy if exists "comments: admin moderates" on public.post_comments;
drop policy if exists "board: admin moderates" on public.park_board_messages;
drop policy if exists "groups: admin moderates" on public.groups;
drop policy if exists "group posts: admin moderates" on public.group_posts;

-- ── the hidden state changes only through moderation ───────────────
create or replace function public.hidden_state_is_moderated()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if (new.hidden_at is distinct from old.hidden_at or new.hidden_by is distinct from old.hidden_by)
     and coalesce(current_setting('app.moderation_write', true), '') <> 'allow' then
    raise exception 'Only moderation can change whether this is hidden'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.hidden_state_is_moderated() from public, anon, authenticated;

drop trigger if exists hidden_state_is_moderated on public.community_posts;
create trigger hidden_state_is_moderated before update on public.community_posts
  for each row execute function public.hidden_state_is_moderated();
drop trigger if exists hidden_state_is_moderated on public.post_comments;
create trigger hidden_state_is_moderated before update on public.post_comments
  for each row execute function public.hidden_state_is_moderated();
drop trigger if exists hidden_state_is_moderated on public.park_board_messages;
create trigger hidden_state_is_moderated before update on public.park_board_messages
  for each row execute function public.hidden_state_is_moderated();
drop trigger if exists hidden_state_is_moderated on public.groups;
create trigger hidden_state_is_moderated before update on public.groups
  for each row execute function public.hidden_state_is_moderated();
drop trigger if exists hidden_state_is_moderated on public.group_posts;
create trigger hidden_state_is_moderated before update on public.group_posts
  for each row execute function public.hidden_state_is_moderated();

create or replace function public.moderate_content(p_kind text, p_id uuid, p_hide boolean, p_reason text, p_report uuid default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_table text;
  v_author_col text;
  v_author uuid;
  v_found boolean;
begin
  if not public.can_moderate() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 3 then
    raise exception 'A reason is required';
  end if;

  v_table := case p_kind
    when 'post' then 'community_posts'
    when 'comment' then 'post_comments'
    when 'park_board' then 'park_board_messages'
    when 'group' then 'groups'
    when 'group_post' then 'group_posts'
  end;
  if v_table is null then
    raise exception 'Unknown kind %', p_kind;
  end if;
  v_author_col := case when p_kind = 'group' then 'created_by' else 'author_id' end;

  perform set_config('app.moderation_write', 'allow', true);
  execute format(
    'update public.%I set hidden_at = case when $1 then coalesce(hidden_at, now()) else null end,
                          hidden_by = case when $1 then auth.uid() else null end
     where id = $2 returning %I', v_table, v_author_col)
    using p_hide, p_id into v_author;
  get diagnostics v_found = row_count;
  perform set_config('app.moderation_write', '', true);
  if not v_found then
    raise exception 'Nothing to moderate';
  end if;

  perform public.write_audit(
    case when p_hide then 'content_hidden' else 'content_unhidden' end,
    v_author,
    p_reason,
    jsonb_build_object('kind', p_kind, 'target_id', p_id, 'report_id', p_report)
  );
end;
$$;
revoke all on function public.moderate_content(text, uuid, boolean, text, uuid) from public, anon;
grant execute on function public.moderate_content(text, uuid, boolean, text, uuid) to authenticated;

-- ── suspending, one audited path ───────────────────────────────────
create or replace function public.moderator_set_pause(p_profile uuid, p_paused boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.can_moderate() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 5 then
    raise exception 'A reason is required';
  end if;
  if p_profile = auth.uid() then
    raise exception 'You cannot pause your own account';
  end if;
  if exists (select 1 from public.profiles where id = p_profile and role = 'admin')
     and not public.is_super_admin() then
    raise exception 'Only a super-admin can pause an admin or moderator account';
  end if;

  perform set_config('app.protected_profile_write', 'allow', true);
  update public.profiles set is_paused = p_paused where id = p_profile;
  if not found then
    raise exception 'No such account';
  end if;
  perform set_config('app.protected_profile_write', '', true);

  perform public.write_audit(
    case when p_paused then 'pause_account' else 'unpause_account' end,
    p_profile,
    p_reason
  );
end;
$$;
revoke all on function public.moderator_set_pause(uuid, boolean, text) from public, anon;
grant execute on function public.moderator_set_pause(uuid, boolean, text) to authenticated;

create or replace function public.admin_set_pause(p_profile uuid, p_paused boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.moderator_set_pause(p_profile, p_paused, p_reason);
end;
$$;

create or replace function public.moderator_suspend(p_profile uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_actor uuid := auth.uid(); v_name text; rec record;
begin
  perform public.moderator_set_pause(p_profile, true, p_reason);
  select full_name into v_name from public.profiles where id = v_actor;
  for rec in select id from public.profiles
    where role = 'admin' and coalesce(admin_level::text, 'support') <> 'moderator' and id <> v_actor
  loop
    insert into public.notifications (profile_id, title, body, kind, link)
    values (rec.id, 'An account was suspended',
      coalesce(v_name, 'A moderator') || ' suspended an account. Reason: ' || p_reason,
      'admin', '/app/admin');
  end loop;
end;
$$;

-- ── evidence files for whoever decides the report ──────────────────
do $$
begin
  execute 'alter policy "evidence: admins only" on storage.objects using ((bucket_id = ''report-evidence'') and public.can_moderate())';
exception when others then
  raise notice 'evidence policy not altered: %', sqlerrm;
end $$;
