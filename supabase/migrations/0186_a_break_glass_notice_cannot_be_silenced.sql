/* ═══════════════════════════════════════════════════════════════
   0186 — A break-glass notice cannot be silenced, forged or taken back

   When a super-admin reads an Icon's private daily logs (0187), the
   Icon is told, in a notification of kind 'break_glass'. This migration
   makes that notification trustworthy before anything writes one.

   1. NO MUTE SILENCES IT.
      notifications_skip_muted (0144) drops a notification only when the
      recipient has muted or blocked its sender AND
      notification_kind_mutable(kind) is true. 'break_glass' joins the
      kinds that are not mutable (it tells a person something was done
      to their own days, like 'general' and 'reminder'). The per-kind
      settings->notify switch never applied to staff kinds: only
      social_notify_kind reads notify_allowed.
      The bell's NOT_MUTABLE set (routes/notifications/data.js) is kept
      identical.

   2. ONLY A BREAK-GLASS READ WRITES ONE.
      social_notify_kind (0058) accepts any kind from any signed-in
      account. Without a guard, anybody could send a fake "Saathban read
      your logs". A 'break_glass' row is accepted only while the
      transaction-local setting saathban.break_glass_notice names that
      row's recipient; break_glass_read_logs sets it for exactly its own
      insert. PostgREST exposes no way to set it.

   3. STAFF CANNOT EDIT OR DELETE ONE.
      Row-level security already limits UPDATE and DELETE to the
      recipient, but security-definer staff functions bypass it. This
      trigger refuses, for a 'break_glass' row:
        - any UPDATE except the recipient marking it read
          (title, body, kind, link, sender, recipient and time are fixed);
        - any DELETE except by the recipient themself.
      Turning another notification INTO 'break_glass' is refused too.
      Allowed without a signed-in person (auth.uid() is null: database
      maintenance) and inside a cascade (pg_trigger_depth() > 1): the
      Icon's account being deleted removes their notifications, and a
      staff account being deleted sets created_by to null. The staff
      name stays in the words of the notice either way.
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
    'document_request', 'document_response', 'milestone',
    'break_glass'
  );
$function$;

create or replace function public.notifications_break_glass_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_me uuid := auth.uid();
  v_cascade boolean := pg_trigger_depth() > 1;
begin
  if tg_op = 'INSERT' then
    if new.kind = 'break_glass'
       and coalesce(current_setting('saathban.break_glass_notice', true), '') <> new.profile_id::text then
      raise exception 'A break-glass notice is written only by a break-glass read'
        using errcode = '42501', hint = 'break_glass_notice_guard';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (old.kind = 'break_glass' or new.kind = 'break_glass')
       and v_me is not null and not v_cascade then
      if old.kind is distinct from new.kind
         or v_me is distinct from old.profile_id
         or new.profile_id is distinct from old.profile_id
         or new.title is distinct from old.title
         or new.body is distinct from old.body
         or new.link is distinct from old.link
         or new.created_by is distinct from old.created_by
         or new.created_at is distinct from old.created_at then
        raise exception 'A break-glass notice cannot be changed'
          using errcode = '42501', hint = 'break_glass_notice_guard';
      end if;
    end if;
    return new;
  end if;

  -- DELETE
  if old.kind = 'break_glass'
     and v_me is not null and not v_cascade
     and v_me is distinct from old.profile_id then
    raise exception 'A break-glass notice can be removed only by the person it was sent to'
      using errcode = '42501', hint = 'break_glass_notice_guard';
  end if;
  return old;
end;
$function$;

revoke all on function public.notifications_break_glass_guard() from public, anon, authenticated;

drop trigger if exists notifications_break_glass_guard on public.notifications;
create trigger notifications_break_glass_guard
  before insert or update or delete on public.notifications
  for each row execute function public.notifications_break_glass_guard();
