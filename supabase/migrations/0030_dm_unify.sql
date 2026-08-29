-- ============================================================================
-- 0030 — DM unification: one thread per pair, and the bell knows about DMs
--
-- The app now has ONE canonical DM surface: /app/people/<id>/chat. This
-- migration makes the data match the promise and closes two seams found
-- in the audit:
--
-- 1. send_dm_request() only looked for an existing row in its OWN
--    direction, so B requesting A while A→B sat pending created a second
--    thread for the same pair (open_dm_with checked both directions; the
--    community request path didn't). Now both directions are checked, a
--    reverse PENDING row is accepted on the spot (the caller answering a
--    request by asking is mutual intent — and only the caller's own
--    acceptance is given away, so decline-silence semantics survive), and
--    a unique pair index makes the race impossible.
--
-- 2. New DM messages never reached the bell: notifications were written
--    only by staff RPCs, so the header badge and the thread's unread
--    state could disagree. An AFTER INSERT trigger now writes ONE unread
--    'dm' notification per thread per recipient (no stacking — a second
--    message while the first is unread stays quiet), linking to the
--    canonical surface. The client clears it when the thread is read.
--    The notification never carries message content — just who.
-- ============================================================================

-- ─── 1a. One pair, one thread — enforced, not just intended ───
create unique index if not exists dm_requests_pair_uniq
  on public.dm_requests (
    least(requester_id, recipient_id),
    greatest(requester_id, recipient_id)
  );

-- ─── 1b. send_dm_request(): direction-blind pair reuse ───
create or replace function public.send_dm_request(p_recipient uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.dm_requests%rowtype;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  if not exists (
    select 1 from public.profiles where id = p_recipient and not is_blocked
  ) or p_recipient = auth.uid() then
    raise exception 'That request cannot be sent';
  end if;
  -- The caller blocking someone and then DMing them makes no sense.
  if public.caller_hides(p_recipient) then
    raise exception 'That request cannot be sent';
  end if;

  -- One pair, one request — whichever direction it was made in.
  select * into v_req from public.dm_requests
  where (requester_id = auth.uid() and recipient_id = p_recipient)
     or (requester_id = p_recipient and recipient_id = auth.uid())
  limit 1;

  if found then
    -- They asked me first and I'm now asking them: that IS my answer.
    -- Only the caller's own acceptance is ever flipped here, so the
    -- requester still learns nothing from a decline.
    if v_req.status = 'pending' and v_req.recipient_id = auth.uid() then
      update public.dm_requests
        set status = 'accepted', decided_at = now()
        where id = v_req.id;
    end if;
    return v_req.id;
  end if;

  if (
    select count(*) from public.dm_requests
    where requester_id = auth.uid() and created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'Too many requests today — please try again tomorrow';
  end if;

  insert into public.dm_requests (requester_id, recipient_id)
  values (auth.uid(), p_recipient)
  returning * into v_req;
  return v_req.id;
end;
$$;

revoke execute on function public.send_dm_request(uuid) from public, anon;
grant execute on function public.send_dm_request(uuid) to authenticated;

-- ─── 2. The bell learns about DMs ───
-- One unread 'dm' notification per thread per recipient; the link is the
-- canonical surface keyed by the SENDER's profile id (what the recipient
-- taps to answer). Content never leaks into the notification — a sticker,
-- a game move and a paragraph all read the same from the outside.
create or replace function public.notify_dm_message()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
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

  -- No stacking: while one dm notification for this thread is unread,
  -- further messages stay quiet.
  if exists (
    select 1 from public.notifications
    where profile_id = v_other and kind = 'dm'
      and link = v_link and read_at is null
  ) then
    return new;
  end if;

  select split_part(coalesce(full_name, ''), ' ', 1)
    into v_first from public.profiles where id = new.sender_id;

  insert into public.notifications (profile_id, title, body, kind, link)
  values (
    v_other,
    '💬 ' || coalesce(nullif(v_first, ''), 'Someone') || ' sent you a message',
    null,
    'dm',
    v_link
  );
  return new;
end;
$$;

drop trigger if exists dm_messages_notify on public.dm_messages;
create trigger dm_messages_notify
  after insert on public.dm_messages
  for each row execute function public.notify_dm_message();
