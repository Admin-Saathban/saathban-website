-- ============================================================================
-- 0029 — The together layer (games/community lane; number reserved via
-- the registrar). Games, the Daily Riddle, and connections stop being
-- adjacent features and start behaving like family at one table.
--
-- 1. CONNECTIONS, one definition. connections_of() = circle members ∪
--    accepted friends ∪ fellow group members, deduped with the
--    closest label winning (circle > friend > group), filtered
--    server-side for eligibility (can_use_community_profile — a
--    pending/suspended Buddy is simply absent, never shown-then-
--    failed) and for blocks in either direction. game_connected()
--    widens to match. game_people() exposes the caller's own list
--    with names for the people-first game picker.
--
-- 2. INVITES grow up. invite_to_game() becomes idempotent (a rapid
--    double-tap returns the same pending invite, no second
--    notification). respond_game_invite() returns a jsonb outcome:
--    'joined'; 'filled' when the table completed meanwhile (graceful,
--    the invite closes, nothing explodes); 'declined' — which QUIETLY
--    tells the host their seat is free again (block-checked, and only
--    on the pending→declined transition so retries never duplicate).
--
-- 3. JOIN BY CODE. join_by_code() resolves a spoken 6-digit code:
--    already-seated → open it; open lobby → take a seat (auto-start
--    on the last one); anything else → one kind 'no_table' (never
--    revealing whether a code exists). Guesses are rate-limited
--    server-side via code_tries.
--
-- 4. RIDDLE TOGETHER. riddle_people(): before the caller solves, ONLY
--    a count of connections who solved (no names — no answer-fishing);
--    after, the named strip with solved/not-solved — NEVER answers,
--    NEVER guess counts. riddle_touch(): one cheer and one nudge per
--    person per day, enforced by riddle_touches' primary key; the
--    nudge is worded as an invitation. Day key = the riddle's own
--    date, identical for everyone.
--
-- 5. WARMTH, NEVER RANKINGS. person_warmth(): celebration facts about
--    ONE connection (solved today, badges this week) — no points, no
--    streak numbers, nothing comparable. boast_to_people(): one-tap
--    share of your OWN moment to your connections, deduped by the
--    boasts table so a retry never notifies twice.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table public.riddle_touches (
  from_id     uuid not null references public.profiles (id) on delete cascade,
  to_id       uuid not null references public.profiles (id) on delete cascade,
  puzzle_date date not null,
  kind        text not null check (kind in ('cheer', 'nudge')),
  sticker     text,
  created_at  timestamptz not null default now(),
  primary key (from_id, to_id, puzzle_date, kind),
  check (from_id <> to_id)
);

alter table public.riddle_touches enable row level security;
revoke all on public.riddle_touches from anon;
-- Own sends only (the strip shows "already cheered"); writes via RPC.
create policy "riddle touches: own sends" on public.riddle_touches
  for select using (from_id = auth.uid());

create table public.code_tries (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tried_at   timestamptz not null default now()
);
create index code_tries_idx on public.code_tries (profile_id, tried_at);
alter table public.code_tries enable row level security;
revoke all on public.code_tries from anon, authenticated;
-- No policies at all: bookkeeping the RPC alone touches.

create table public.boasts (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('badge', 'riddle', 'win')),
  ref_key    text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, kind, ref_key)
);
alter table public.boasts enable row level security;
revoke all on public.boasts from anon;
create policy "boasts: own" on public.boasts
  for select using (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Connections — one definition for the whole layer.
-- ----------------------------------------------------------------------------
create or replace function public.connections_of(p uuid)
returns table (pid uuid, how text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select distinct on (x.pid) x.pid, x.how
  from (
    select case when icon_id = p then member_id else icon_id end as pid, 'circle' as how
    from public.circle_members
    where icon_id = p or member_id = p
    union all
    select case when requester_id = p then recipient_id else requester_id end, 'friend'
    from public.friend_requests
    where status = 'accepted' and (requester_id = p or recipient_id = p)
    union all
    select gm2.member_id, 'group'
    from public.group_members gm
    join public.group_members gm2 on gm2.group_id = gm.group_id
    where gm.member_id = p and gm2.member_id <> p
  ) x
  where x.pid <> p
    and public.can_use_community_profile(x.pid)
    and not exists (
      select 1 from public.user_blocks
      where kind = 'block'
        and ((blocker_id = p and blocked_id = x.pid)
          or (blocker_id = x.pid and blocked_id = p))
    )
  order by x.pid, case x.how when 'circle' then 1 when 'friend' then 2 else 3 end;
$$;

revoke execute on function public.connections_of(uuid) from public, anon, authenticated;

-- The widened plug point (0025 → 0027 → here): connected now also
-- means sharing a friend group.
create or replace function public.game_connected(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.circle_members
    where (icon_id = p_a and member_id = p_b)
       or (icon_id = p_b and member_id = p_a)
  )
  or public.are_friends(p_a, p_b)
  or exists (
    select 1 from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    where a.member_id = p_a and b.member_id = p_b
  );
$$;

-- The picker: the caller's own connections, named, eligibility- and
-- block-filtered so the client can never show someone and then fail.
create or replace function public.game_people()
returns table (id uuid, full_name text, avatar_url text, how text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.id, p.full_name, p.avatar_url, c.how
  from public.connections_of(auth.uid()) c
  join public.profiles p on p.id = c.pid
  where public.can_use_community()
  order by p.full_name;
$$;

revoke execute on function public.game_people() from public, anon;
grant execute on function public.game_people() to authenticated;

-- ----------------------------------------------------------------------------
-- Invites v2
-- ----------------------------------------------------------------------------
create or replace function public.invite_to_game(p_session uuid, p_invitee uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_existing public.game_invites%rowtype;
  v_taken int;
  v_pending int;
  v_seat smallint;
  v_id uuid;
  v_inviter text;
  v_game_name text;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if s.created_by <> auth.uid() or s.status <> 'lobby' then
    raise exception 'Only the host can invite, and only in the lobby';
  end if;
  if not public.can_use_community_profile(p_invitee) then
    raise exception 'That neighbour cannot join games right now';
  end if;
  if not public.game_connected(auth.uid(), p_invitee) then
    raise exception 'Invitations go to people connected with you';
  end if;

  -- Idempotent: a seated person or an existing invite (any status)
  -- returns quietly — a rapid double-tap never double-invites and
  -- never re-notifies, and a decline is not re-pestered.
  if exists (select 1 from public.game_seats where session_id = p_session and profile_id = p_invitee) then
    return null;
  end if;
  select * into v_existing from public.game_invites
  where session_id = p_session and invitee_id = p_invitee;
  if v_existing.id is not null then
    return v_existing.id;
  end if;

  select count(*) into v_taken from public.game_seats where session_id = p_session;
  select count(*) into v_pending from public.game_invites
    where session_id = p_session and status = 'pending';
  if v_taken + v_pending >= s.seats_total then
    raise exception 'The table is spoken for';
  end if;

  v_seat := v_taken + v_pending + 1;
  insert into public.game_invites (session_id, inviter_id, invitee_id, seat_no)
  values (p_session, auth.uid(), p_invitee, v_seat)
  returning id into v_id;

  select full_name into v_inviter from public.profiles where id = auth.uid();
  select name_en into v_game_name from public.games where key = s.game_key;
  perform public.game_notify(
    p_invitee,
    'A game invitation',
    coalesce(v_inviter, 'A neighbour') || ' has asked you to a game of ' || v_game_name || '.',
    '/app/games/s/' || p_session
  );
  return v_id;
end;
$$;

-- Outcomes instead of exceptions for the states life actually
-- produces: {result: 'joined'|'filled'|'declined', session_id, ...}.
-- (Return type changes uuid → jsonb, so the old function drops first.)
drop function public.respond_game_invite(uuid, boolean);
create function public.respond_game_invite(p_invite uuid, p_accept boolean)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  inv public.game_invites%rowtype;
  s public.game_sessions%rowtype;
  v_taken int;
  v_name text;
  v_blocked boolean;
begin
  select * into inv from public.game_invites where id = p_invite for update;
  if inv.invitee_id is distinct from auth.uid() then
    raise exception 'Not yours to answer';
  end if;
  -- Idempotent on retry: an answered invite reports what happened.
  if inv.status = 'accepted' then
    return jsonb_build_object('result', 'joined', 'session_id', inv.session_id);
  end if;
  if inv.status = 'declined' then
    return jsonb_build_object('result', 'declined', 'session_id', inv.session_id);
  end if;

  if not p_accept then
    update public.game_invites
    set status = 'declined', decided_at = now() where id = p_invite;
    -- Quietly tell the host the seat is free — unless a block has
    -- appeared between invite and answer.
    select exists (
      select 1 from public.user_blocks
      where kind = 'block'
        and ((blocker_id = inv.inviter_id and blocked_id = auth.uid())
          or (blocker_id = auth.uid() and blocked_id = inv.inviter_id))
    ) into v_blocked;
    if not v_blocked then
      select full_name into v_name from public.profiles where id = auth.uid();
      perform public.game_notify(
        inv.inviter_id,
        'A seat opened up',
        coalesce(v_name, 'A neighbour') || ' can''t make this game — the seat is free again.',
        '/app/games/s/' || inv.session_id
      );
    end if;
    return jsonb_build_object('result', 'declined', 'session_id', inv.session_id);
  end if;

  -- Accept. Standing re-checked; the table may have filled meanwhile.
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  select * into s from public.game_sessions where id = inv.session_id for update;
  select count(*) into v_taken from public.game_seats where session_id = inv.session_id;
  if s.status <> 'lobby'
     or v_taken >= s.seats_total
     or exists (select 1 from public.game_seats
                where session_id = inv.session_id and seat_no = inv.seat_no) then
    update public.game_invites
    set status = 'declined', decided_at = now() where id = p_invite;
    return jsonb_build_object(
      'result', 'filled',
      'session_id', inv.session_id,
      'game_key', s.game_key,
      'seats_total', s.seats_total
    );
  end if;

  update public.game_invites
  set status = 'accepted', decided_at = now() where id = p_invite;
  insert into public.game_seats (session_id, seat_no, profile_id)
  values (inv.session_id, inv.seat_no, auth.uid());
  perform public.game_start_if_full(inv.session_id);
  return jsonb_build_object('result', 'joined', 'session_id', inv.session_id);
end;
$$;

revoke execute on function public.respond_game_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_game_invite(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- Join by code
-- ----------------------------------------------------------------------------
create or replace function public.join_by_code(p_code text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_session uuid;
  v_tries int;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;

  -- Server-side guess rate limit: 12 tries per 5 minutes.
  delete from public.code_tries
  where profile_id = auth.uid() and tried_at < now() - interval '1 hour';
  select count(*) into v_tries from public.code_tries
  where profile_id = auth.uid() and tried_at > now() - interval '5 minutes';
  if v_tries >= 12 then
    raise exception 'That''s a lot of codes — take a breath and try again in a few minutes';
  end if;
  insert into public.code_tries (profile_id) values (auth.uid());

  v_code := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');

  -- Already at a table with this code (lobby or live)? Just open it.
  select s.id into v_session
  from public.game_sessions s
  join public.game_seats gs on gs.session_id = s.id and gs.profile_id = auth.uid()
  where s.join_code = v_code and s.status in ('lobby', 'active')
  order by s.created_at desc limit 1;
  if v_session is not null then
    return jsonb_build_object('result', 'joined', 'session_id', v_session);
  end if;

  select id into v_session from public.game_sessions
  where join_code = v_code and status = 'lobby';
  if v_session is null then
    -- Wrong, expired, or finished — one kind answer, no enumeration.
    return jsonb_build_object('result', 'no_table');
  end if;

  begin
    perform public.claim_open_seat(v_session);
  exception when others then
    return jsonb_build_object('result', 'filled');
  end;
  return jsonb_build_object('result', 'joined', 'session_id', v_session);
end;
$$;

revoke execute on function public.join_by_code(text) from public, anon;
grant execute on function public.join_by_code(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Riddle together
-- ----------------------------------------------------------------------------
create or replace function public.riddle_people(p_date date)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_solved boolean;
  v_people jsonb;
  v_count int;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;

  select (solved_at is not null) into v_solved
  from public.puzzle_attempts
  where profile_id = auth.uid() and puzzle_date = p_date;
  v_solved := coalesce(v_solved, false);

  if not v_solved then
    -- Before solving: a count only — no names, no answer-fishing.
    select count(*) into v_count
    from public.connections_of(auth.uid()) c
    where exists (
      select 1 from public.puzzle_attempts a
      where a.profile_id = c.pid and a.puzzle_date = p_date and a.solved_at is not null
    );
    return jsonb_build_object('solved', false, 'solved_count', v_count);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.full_name,
    'avatar_url', p.avatar_url,
    'how', c.how,
    'solved', exists (
      select 1 from public.puzzle_attempts a
      where a.profile_id = p.id and a.puzzle_date = p_date and a.solved_at is not null
    ),
    'cheered', exists (
      select 1 from public.riddle_touches t
      where t.from_id = auth.uid() and t.to_id = p.id and t.puzzle_date = p_date and t.kind = 'cheer'
    ),
    'nudged', exists (
      select 1 from public.riddle_touches t
      where t.from_id = auth.uid() and t.to_id = p.id and t.puzzle_date = p_date and t.kind = 'nudge'
    )
  ) order by p.full_name), '[]'::jsonb) into v_people
  from public.connections_of(auth.uid()) c
  join public.profiles p on p.id = c.pid;

  return jsonb_build_object('solved', true, 'people', v_people);
end;
$$;

revoke execute on function public.riddle_people(date) from public, anon;
grant execute on function public.riddle_people(date) to authenticated;

-- One cheer and one nudge per person per riddle-day, by primary key.
create or replace function public.riddle_touch(p_to uuid, p_date date, p_kind text, p_sticker text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_target_solved boolean;
  v_name text;
  v_rows int;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  if p_kind not in ('cheer', 'nudge') then
    raise exception 'Unknown touch';
  end if;
  -- Only after you've solved (the strip only exists then; enforcing
  -- it server-side keeps pre-solve contact impossible).
  if not exists (
    select 1 from public.puzzle_attempts
    where profile_id = auth.uid() and puzzle_date = p_date and solved_at is not null
  ) then
    raise exception 'Solve today''s riddle first';
  end if;
  if not public.game_connected(auth.uid(), p_to) then
    raise exception 'Cheers go to people connected with you';
  end if;
  if exists (
    select 1 from public.user_blocks
    where kind = 'block'
      and ((blocker_id = auth.uid() and blocked_id = p_to)
        or (blocker_id = p_to and blocked_id = auth.uid()))
  ) then
    return jsonb_build_object('sent', false); -- silent, never probeable
  end if;

  select exists (
    select 1 from public.puzzle_attempts
    where profile_id = p_to and puzzle_date = p_date and solved_at is not null
  ) into v_target_solved;
  if p_kind = 'cheer' and not v_target_solved then
    raise exception 'They haven''t solved it yet — a nudge, perhaps?';
  end if;
  if p_kind = 'nudge' and v_target_solved then
    raise exception 'They''ve already solved it — a cheer, perhaps?';
  end if;

  insert into public.riddle_touches (from_id, to_id, puzzle_date, kind, sticker)
  values (auth.uid(), p_to, p_date, p_kind, p_sticker)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('sent', false); -- cap reached / retry
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();
  if p_kind = 'cheer' then
    perform public.social_notify(
      p_to,
      'Shabash from ' || coalesce(v_name, 'a friend'),
      coalesce(v_name, 'A friend') || ' sends you ' || coalesce(p_sticker, '👏')
        || ' for cracking today''s riddle.',
      '/app/games/puzzle'
    );
  else
    perform public.social_notify(
      p_to,
      'A riddle is waiting',
      coalesce(v_name, 'A friend') || ' thought of you — today''s riddle is a good one, whenever you fancy it.',
      '/app/games/puzzle'
    );
  end if;
  return jsonb_build_object('sent', true);
end;
$$;

revoke execute on function public.riddle_touch(uuid, date, text, text) from public, anon;
grant execute on function public.riddle_touch(uuid, date, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Warmth — celebration facts about ONE connection. Never counts,
-- never points, never streak numbers: nothing that can be compared.
-- ----------------------------------------------------------------------------
create or replace function public.person_warmth(p_profile uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_badges jsonb;
  v_solved boolean;
begin
  if not public.can_use_community()
     or not public.game_connected(auth.uid(), p_profile)
     or exists (
       select 1 from public.user_blocks
       where kind = 'block'
         and ((blocker_id = auth.uid() and blocked_id = p_profile)
           or (blocker_id = p_profile and blocked_id = auth.uid()))
     ) then
    raise exception 'Not available';
  end if;

  select exists (
    select 1 from public.puzzle_attempts
    where profile_id = p_profile and puzzle_date = current_date and solved_at is not null
  ) into v_solved;

  select coalesce(jsonb_agg(jsonb_build_object(
    'emoji', b.emoji, 'name_en', b.name_en, 'name_ur', b.name_ur,
    'earned_at', e.earned_at
  ) order by e.earned_at desc), '[]'::jsonb) into v_badges
  from public.earned_badges e
  join public.badges b on b.key = e.badge_key
  where e.profile_id = p_profile and e.earned_at > now() - interval '7 days';

  return jsonb_build_object('solved_today', v_solved, 'badges', v_badges);
end;
$$;

revoke execute on function public.person_warmth(uuid) from public, anon;
grant execute on function public.person_warmth(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Boast — sharing your OWN moment, always by your own tap.
-- ----------------------------------------------------------------------------
create or replace function public.boast_to_people(p_kind text, p_ref text, p_payload jsonb default '{}')
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_sent int := 0;
  v_title text;
  v_body text;
  v_link text;
  rec record;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  if p_kind not in ('badge', 'riddle', 'win') then
    raise exception 'Unknown boast';
  end if;

  -- Retry-proof: the first tap wins, later ones are silent no-ops.
  begin
    insert into public.boasts (profile_id, kind, ref_key) values (auth.uid(), p_kind, p_ref);
  exception when unique_violation then
    return 0;
  end;

  select full_name into v_name from public.profiles where id = auth.uid();
  if p_kind = 'badge' then
    v_title := coalesce(v_name, 'A friend') || ' has a new badge';
    v_body := coalesce(v_name, 'A friend') || ' just earned "'
      || coalesce(p_payload ->> 'name_en', 'a badge') || '" '
      || coalesce(p_payload ->> 'emoji', '🏅') || ' — a kind word from you would land well.';
    v_link := '/app/people/' || auth.uid();
  elsif p_kind = 'riddle' then
    v_title := coalesce(v_name, 'A friend') || ' cracked today''s riddle';
    v_body := 'Have you had a go yet? It''s a good one.';
    v_link := '/app/games/puzzle';
  else
    v_title := coalesce(v_name, 'A friend') || ' won a game';
    v_body := coalesce(v_name, 'A friend') || ' just won at '
      || coalesce(p_payload ->> 'game', 'the table') || '. The rematch seat is open…';
    v_link := coalesce(p_payload ->> 'link', '/app/games');
  end if;

  for rec in select pid from public.connections_of(auth.uid()) limit 50 loop
    perform public.social_notify(rec.pid, v_title, v_body, v_link);
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

revoke execute on function public.boast_to_people(text, text, jsonb) from public, anon;
grant execute on function public.boast_to_people(text, text, jsonb) to authenticated;
