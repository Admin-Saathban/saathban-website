-- 0102 — a DM notification names its sender.  APPLIED 2026-08-30.
--
-- The other half of 0101. DM notifications are written by a TRIGGER on
-- dm_messages, not by social_notify, so setting auth.uid() in that helper did
-- not reach them — and dm is the kind where "mute this person" matters most.
--
-- Here the sender is BETTER than auth.uid(): new.sender_id is the person the
-- notification is about, and it stays correct even if the row is ever written
-- by something other than that person's own session.
--
-- Nothing else about the trigger moves: the same de-duplication (one unread
-- "X sent you a message" per thread) and the same link.

create or replace function public.notify_dm_message()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
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
$fn$;
