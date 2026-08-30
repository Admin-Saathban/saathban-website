-- 0071 — personal invite links.  APPLIED 2026-08-30.
--
-- PRODUCT_DECISIONS §7, "Inviting people from outside": a link plus a ready
-- message for WhatsApp. "The recipient taps it, signs up, and lands on the
-- inviter's profile, where they choose to connect. NEVER AUTO-CONNECTED."
-- And: "a group-shareable version lets people REQUEST the connection."
--
-- The whole design follows from that one word "never". A link that connected
-- on arrival would be a way to put yourself into somebody's list of people by
-- getting them to tap something in WhatsApp. So the link carries no power at
-- all: it names who invited you and takes you to their profile. Everything
-- that follows is a tap the arriving person makes, on a screen that says
-- whose profile it is.
--
-- The two kinds differ in exactly one way, and it is a question of evidence:
--
--   personal — minted fresh for one person and BOUND to whoever opens it
--     first. Because it was sent to them directly, their tap completes a
--     connection: the invitation IS the inviter's half of it, so accepting
--     it is the same act as accepting a request they had already sent.
--     Once bound, nobody else can use it — a link forwarded around a family
--     group buys at most the one connection the sender meant.
--
--   group — one stable, reusable link for a WhatsApp group or a poster.
--     There is no evidence the inviter chose any particular reader, so a tap
--     produces a REQUEST the inviter answers, through the ordinary
--     friend-request path and the ordinary inbox.
--
-- NOTHING HERE REIMPLEMENTS THE SOCIAL LAW. Blocks, the community gate, the
-- paused/blocked account checks and the daily ceiling all live in
-- send_friend_request and its helpers already; an invite that wrote its own
-- copy of them would be a second, weaker set that drifts out of step. The
-- group path calls send_friend_request outright. The personal path re-uses
-- the same helpers and refuses in the same cases — and where the ordinary
-- path stays silent (a block), so does this one: a blocked person is told the
-- link has expired, which is what every dead link says.
--
-- §7 also says: "No rewards for inviting. A warm acknowledgement only." There
-- is no count, no total and no badge in this migration. The inviter gets one
-- notification saying who arrived.

create table if not exists public.personal_invites (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('personal', 'group')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days',
  claimed_by  uuid references public.profiles(id) on delete set null,
  used_at     timestamptz
);

create index if not exists personal_invites_owner_idx
  on public.personal_invites (created_by, kind, created_at desc);

alter table public.personal_invites enable row level security;

-- The owner can see their own links (the share screen lists them). There is
-- deliberately no insert, update or delete policy: every write goes through
-- the definer functions below, so the binding rule and the "never
-- auto-connected" rule cannot be sidestepped by writing the table directly.
drop policy if exists "an inviter sees their own links" on public.personal_invites;
create policy "an inviter sees their own links"
  on public.personal_invites for select
  using (created_by = auth.uid());

grant select on public.personal_invites to authenticated;

-- Codes are copied off a phone screen into WhatsApp, never typed from memory,
-- so they are long enough not to be guessable and drawn from an alphabet with
-- no 0/o/1/l/i confusion for the person who does end up reading one out.
create or replace function public.gen_personal_invite_code()
returns text
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..10 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.personal_invites where code = v_code);
  end loop;
  return v_code;
end;
$fn$;

-- 'personal' mints a NEW link every time, because each one belongs to the one
-- person it is sent to. 'group' returns the SAME link every time, refreshed:
-- it is the link already pasted into a WhatsApp group, and handing back a new
-- one on each visit would quietly kill the one people are still tapping.
create or replace function public.create_personal_invite(p_kind text default 'personal')
returns text
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_code text;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  if p_kind not in ('personal', 'group') then
    raise exception 'Unknown kind of invitation';
  end if;

  if p_kind = 'group' then
    update public.personal_invites
       set expires_at = now() + interval '30 days'
     where created_by = auth.uid() and kind = 'group' and expires_at > now()
    returning code into v_code;
    if v_code is not null then
      return v_code;
    end if;
  else
    -- The same ceiling send_friend_request uses, for the same reason and in
    -- the same words: reaching out to twenty new people in one day is not
    -- what this is for.
    if (select count(*) from public.personal_invites
         where created_by = auth.uid() and kind = 'personal'
           and created_at > now() - interval '1 day') >= 20 then
      raise exception 'That is plenty of invitations for one day — try again tomorrow';
    end if;
  end if;

  v_code := public.gen_personal_invite_code();
  insert into public.personal_invites (code, created_by, kind)
  values (v_code, auth.uid(), p_kind);
  return v_code;
end;
$fn$;

-- Opening a link. This BINDS a personal link to whoever opens it first, and
-- otherwise changes nothing: no connection, no request, no notification. Its
-- whole job is to answer "whose profile am I being taken to?".
create or replace function public.open_personal_invite(p_code text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v public.personal_invites%rowtype;
  v_name text;
begin
  select * into v from public.personal_invites
   where code = lower(trim(coalesce(p_code, ''))) for update;

  if not found or v.expires_at <= now() then
    return jsonb_build_object('result', 'gone');
  end if;
  if v.created_by = auth.uid() then
    return jsonb_build_object('result', 'own');
  end if;
  if not public.can_use_community() then
    return jsonb_build_object('result', 'blocked');
  end if;
  if not public.can_use_community_profile(v.created_by) then
    return jsonb_build_object('result', 'gone');
  end if;
  -- A block says nothing, the way it says nothing everywhere else.
  if exists (
    select 1 from public.user_blocks
    where kind = 'block'
      and ((blocker_id = auth.uid() and blocked_id = v.created_by)
        or (blocker_id = v.created_by and blocked_id = auth.uid()))
  ) then
    return jsonb_build_object('result', 'gone');
  end if;

  if v.kind = 'personal' then
    if v.claimed_by is not null and v.claimed_by <> auth.uid() then
      return jsonb_build_object('result', 'gone');   -- spent, by someone else
    end if;
    if v.claimed_by is null then
      update public.personal_invites set claimed_by = auth.uid() where id = v.id;
    end if;
  end if;

  select full_name into v_name from public.profiles where id = v.created_by;

  return jsonb_build_object(
    'result', 'ok',
    'kind', v.kind,
    'inviter_id', v.created_by,
    'inviter_name', v_name,
    'connected', public.are_friends(auth.uid(), v.created_by)
  );
end;
$fn$;

-- The tap on the inviter's profile. Personal connects; group asks.
create or replace function public.accept_personal_invite(p_code text)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v public.personal_invites%rowtype;
  v_open jsonb;
  v_existing public.friend_requests%rowtype;
  v_name text;
begin
  -- Every refusal in one place, and the same one, rather than a second
  -- opinion written out again down here.
  v_open := public.open_personal_invite(p_code);
  if v_open ->> 'result' <> 'ok' then
    return v_open ->> 'result';
  end if;

  select * into v from public.personal_invites
   where code = lower(trim(p_code)) for update;

  if v.kind = 'group' then
    perform public.send_friend_request(v.created_by);
    return 'requested';
  end if;

  select * into v_existing from public.friend_requests
   where (requester_id = auth.uid() and recipient_id = v.created_by)
      or (requester_id = v.created_by and recipient_id = auth.uid())
   limit 1;

  if v_existing.id is not null and v_existing.status = 'accepted' then
    return 'connected';
  elsif v_existing.id is not null then
    update public.friend_requests
       set status = 'accepted', decided_at = now()
     where id = v_existing.id;
  else
    -- The inviter is the requester: sending the link WAS their asking.
    insert into public.friend_requests (requester_id, recipient_id, status, decided_at)
    values (v.created_by, auth.uid(), 'accepted', now());
  end if;

  update public.personal_invites
     set used_at = coalesce(used_at, now()), claimed_by = auth.uid()
   where id = v.id;

  select full_name into v_name from public.profiles where id = auth.uid();
  perform public.social_notify(
    v.created_by,
    'You are connected',
    coalesce(v_name, 'Someone') || ' came in through your invitation, and you are now connected.',
    '/app/people/' || auth.uid()::text
  );
  return 'connected';
end;
$fn$;

revoke execute on function public.create_personal_invite(text) from public, anon;
revoke execute on function public.open_personal_invite(text) from public, anon;
revoke execute on function public.accept_personal_invite(text) from public, anon;
grant execute on function public.create_personal_invite(text) to authenticated;
grant execute on function public.open_personal_invite(text) to authenticated;
grant execute on function public.accept_personal_invite(text) to authenticated;
