-- 0073 — the one message a stranger gets to send.  APPLIED 2026-08-30.
--
-- PRODUCT_DECISIONS §6, "Message requests from people you don't know":
-- the request screen shows their name, city, how they found you, "the FIRST
-- MESSAGE ONLY", and three large buttons. Guards: "ONE SHOT ONLY — no
-- follow-ups before acceptance", and "decline is permanent".
--
-- WHAT WAS MISSING was the message itself. dm_messages INSERT is gated on
-- dm_open(), which requires status = 'accepted', so a stranger could not put
-- a single word anywhere: send_dm_request created a bare row, and the screen
-- §6 describes had nothing to show. A request with no message is also a worse
-- thing to judge — "somebody wants to talk to you, decide" tells you less
-- than the sentence they actually wrote.
--
-- ONE SHOT IS A SLOT, NOT A COUNTER. The first message lives in ONE nullable
-- column on the request, and set_dm_first_message fills it only while it is
-- null. There is no second place to put a message before acceptance and no
-- limit to get wrong: the guarantee is the shape of the table rather than an
-- arithmetic check somebody could later relax by one. dm_messages stays shut
-- until the recipient opens it, exactly as it was.
--
-- On acceptance the message is MOVED into the thread, carrying its original
-- timestamp, so the conversation begins with the sentence that started it
-- instead of an empty room the recipient has to fill. The column is cleared
-- in the same statement — one message, one copy.
--
-- how_we_met answers §6's "how they found you" from the same three sources
-- have_met() already trusts: a shared group, a shared event, a shared park
-- board. It returns them as a list rather than a boolean so the screen can
-- say WHICH, and an empty list is the honest answer §6 asks for — "that you
-- have nothing in common" is information, not an absence to hide.

alter table public.dm_requests
  add column if not exists first_message text;

comment on column public.dm_requests.first_message is
  'S6 - the one message a stranger may send before acceptance. Moved into dm_messages on accept, and cleared. NULL means unsent or already moved.';

-- The one shot. Only the requester, only while pending, only once.
create or replace function public.set_dm_first_message(p_request uuid, p_body text)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  r public.dm_requests%rowtype;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if length(v_body) < 1 then
    raise exception 'Please write your message first';
  end if;
  if length(v_body) > 1000 then
    v_body := left(v_body, 1000);
  end if;

  select * into r from public.dm_requests where id = p_request for update;
  if not found or r.requester_id <> auth.uid() then
    raise exception 'That request is not yours';
  end if;
  if r.status <> 'pending' then
    raise exception 'That conversation is already open';
  end if;
  -- §6: ONE SHOT ONLY. The slot is full, so there is nowhere for a
  -- follow-up to go.
  if r.first_message is not null then
    raise exception 'You have already sent your message — they will reply if they would like to';
  end if;

  update public.dm_requests set first_message = v_body where id = p_request;

  perform public.social_notify(
    r.recipient_id,
    'A message request',
    'Someone you have not met would like to write to you. You can accept, decline, or report.',
    '/app/community/messages/requests'
  );
end;
$fn$;

-- Accept or decline. Both go through here so that acceptance always moves
-- the first message into the thread — a direct UPDATE to 'accepted' would
-- open a room and leave the sentence that opened it behind.
create or replace function public.decide_dm_request(p_request uuid, p_accept boolean)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  r public.dm_requests%rowtype;
begin
  select * into r from public.dm_requests where id = p_request for update;
  if not found or r.recipient_id <> auth.uid() then
    raise exception 'That request is not yours to answer';
  end if;
  if r.status <> 'pending' then
    return r.status;
  end if;

  if not p_accept then
    -- Permanent: send_dm_request refuses forever once a declined row exists.
    update public.dm_requests
       set status = 'declined', decided_at = now(), first_message = null
     where id = p_request;
    return 'declined';
  end if;

  update public.dm_requests
     set status = 'accepted', decided_at = now()
   where id = p_request;

  if r.first_message is not null then
    insert into public.dm_messages (request_id, sender_id, body, created_at)
    values (p_request, r.requester_id, r.first_message, r.created_at);
    update public.dm_requests set first_message = null where id = p_request;
  end if;

  perform public.social_notify(
    r.requester_id,
    'They accepted',
    'You can write to each other now.',
    '/app/people/' || r.recipient_id::text || '/chat'
  );
  return 'accepted';
end;
$fn$;

-- §6: "how they found you (shared group / event / park board, or that you
-- have nothing in common)". The same three sources have_met() trusts.
create or replace function public.how_we_met(p_other uuid)
returns text[]
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select coalesce(array_agg(w), '{}')
  from (
    select 'group' as w where exists (
      select 1 from public.group_members ga
      join public.group_members gb on gb.group_id = ga.group_id
      where ga.member_id = auth.uid() and gb.member_id = p_other)
    union all
    select 'event' where exists (
      select 1 from public.event_rsvps ra
      join public.event_rsvps rb on rb.event_id = ra.event_id
      where ra.profile_id = auth.uid() and rb.profile_id = p_other)
    union all
    select 'board' where exists (
      select 1 from public.park_board_messages pa
      join public.park_board_messages pb on pb.place_id = pa.place_id
      where pa.author_id = auth.uid() and pb.author_id = p_other)
  ) s;
$fn$;

revoke execute on function public.set_dm_first_message(uuid, text) from public, anon;
revoke execute on function public.decide_dm_request(uuid, boolean) from public, anon;
revoke execute on function public.how_we_met(uuid) from public, anon;
grant execute on function public.set_dm_first_message(uuid, text) to authenticated;
grant execute on function public.decide_dm_request(uuid, boolean) to authenticated;
grant execute on function public.how_we_met(uuid) to authenticated;
