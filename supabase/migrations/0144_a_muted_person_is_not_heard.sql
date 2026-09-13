/* ═══════════════════════════════════════════════════════════════
   0144 — a muted person is not heard

   The promise of Mute is "no notification reaches you from that person"
   — not for messages, not for anything else they do. Before this, no
   user_blocks row silenced a single notification.

   WHO CAUSED A NOTIFICATION. public.notifications.created_by records it,
   and almost every notify path already stamps it (social_notify,
   game_notify, group invites, dm, circle, milestone, staff RPCs). Five
   did not: social_notify_kind (outing invitations), nudge_streak,
   send_streak, reply_streak and share_score_with_people. Each of those
   runs as the person acting, so the actor IS auth.uid() at the insert.
   Rather than rewrite five functions, the BEFORE INSERT trigger fills
   created_by from auth.uid() when the function left it empty (additive:
   an explicit created_by is never overwritten, and a system insert with
   no session stays null). It never stamps the recipient as their own
   actor.

   THEN IT DROPS the row (returns null — nothing is written, nothing is
   pushed) when the recipient has muted OR blocked that actor.

   WHAT A MUTE CANNOT SILENCE. Some notifications tell a person something
   was done to their own account or days, or come from the Saathban team.
   Silencing those would hide exactly what the product promises to show:
     circle   — "{Name} can now see your days" (required at acceptance),
                quiet-day alerts, "set up your daily log"
     reminder — "A reminder was added for you"
     proposal — "Someone suggested a change to your settings"
     staff    — broadcast, general, question_reply, document_request,
                document_response, milestone
   Those kinds pass through, and the bell does not offer "Mute" on them.

   notify_dm_message also checks user_blocks directly, so a message from a
   muted (or blocked) sender never writes its row at all.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.notification_kind_mutable(p_kind text)
 returns boolean
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(p_kind, 'general') not in (
    'circle', 'reminder', 'proposal',
    'broadcast', 'general', 'question_reply',
    'document_request', 'document_response', 'milestone'
  );
$function$;

grant execute on function public.notification_kind_mutable(text) to authenticated;

create or replace function public.notifications_skip_muted()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.created_by is null
     and auth.uid() is not null
     and auth.uid() is distinct from new.profile_id then
    new.created_by := auth.uid();
  end if;

  if new.created_by is not null
     and new.created_by <> new.profile_id
     and public.notification_kind_mutable(new.kind)
     and exists (
       select 1 from public.user_blocks
       where blocker_id = new.profile_id and blocked_id = new.created_by
     ) then
    return null;
  end if;

  return new;
end;
$function$;

revoke all on function public.notifications_skip_muted() from public, anon, authenticated;

drop trigger if exists notifications_skip_muted on public.notifications;
create trigger notifications_skip_muted
  before insert on public.notifications
  for each row execute function public.notifications_skip_muted();

create or replace function public.notify_dm_message()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_other uuid;
  v_first text;
  v_link  text;
begin
  select case when requester_id = new.sender_id then recipient_id
              else requester_id end
    into v_other
    from public.dm_requests where id = new.request_id;
  if v_other is null then
    return new;
  end if;

  -- 0144: the reader muted (or blocked) the sender. The message still
  -- lands; the bell stays quiet. One Mute, for a person.
  if exists (
    select 1 from public.user_blocks
    where blocker_id = v_other and blocked_id = new.sender_id
  ) then
    return new;
  end if;

  -- 0135: the conversation's mute. Kept in step with the person mute by
  -- 0145, so this is belt and braces rather than a second setting.
  if exists (
    select 1 from public.dm_muted
    where profile_id = v_other and request_id = new.request_id
  ) then
    return new;
  end if;

  v_link := '/app/people/' || new.sender_id || '/chat';

  if exists (
    select 1 from public.notifications
    where profile_id = v_other and kind = 'dm'
      and link = v_link and read_at is null
  ) then
    return new;
  end if;

  select split_part(coalesce(full_name, ''), ' ', 1)
    into v_first from public.profiles where id = new.sender_id;

  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (
    v_other,
    '💬 ' || coalesce(nullif(v_first, ''), 'Someone') || ' sent you a message',
    null,
    'dm',
    v_link,
    new.sender_id
  );
  return new;
end;
$function$;
