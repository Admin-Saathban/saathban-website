-- ============================================================================
-- 0022 — Games platform rails + Daily Riddle (games lane)
--
-- HISTORY: written as 0020, resolved per MIGRATIONS.md after 0020_ludo
-- applied first (commit 4204d48): the ludo lane's deliberately
-- game-agnostic tables stand, and the rails land HERE as a rebase —
-- cheap renames over empty live tables, then everything new.
--
-- THE CONTRACT (full prose in GAMES_CONTRACT.md):
--   game_sessions  game_key (FK games), seats_total, status
--                  lobby|active|finished, house_rules jsonb,
--                  state jsonb (the game's own board), join_code,
--                  current_seat (1-based), turn_started_at
--   game_seats     seat_no 1..4, profile or bot, presence
--                  active|away, missed_turns, score
--   game_moves     append-only, written only by the engine
--   game_invites   deep-link notifications; ACCEPTING THE LAST SEAT
--                  AUTO-STARTS the session and notifies every player
--   game_messages  chat + stickers per session (ludo lane's table,
--                  extended)
--
-- ENGINE: per-game logic lives in game_exec_<key>() functions that
-- game lanes ship in their own migrations — the rails dispatch
-- dynamically and NOBODY edits anyone else's CASE. Executors return
-- {move, winner}. A {"pass": true} payload is handled generically by
-- the rails (records the pass, advances the turn) — that is the
-- timeout behaviour for timeout_style='pass_turn' games (carrom);
-- 'bot_plays' games (race100, ludo) get a real bot move instead.
--
-- TURN TIMING: house_rules.turn_seconds (default 60). On lapse the
-- due seat is played (or passed) by the sweep — pg_cron each minute
-- plus any viewer's client for instant countdowns. Three consecutive
-- misses flip a seat to 'away': the bot simply continues until the
-- person reclaims. Never forfeited, never removed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Registry
-- ----------------------------------------------------------------------------
create table public.games (
  key           text primary key,
  name_en       text not null,
  name_ur       text not null,
  tagline_en    text,
  tagline_ur    text,
  kind          text not null check (kind in ('turns', 'daily')),
  min_seats     smallint not null default 1,
  max_seats     smallint not null default 1,
  timeout_style text not null default 'bot_plays' check (timeout_style in ('bot_plays', 'pass_turn')),
  enabled       boolean not null default true
);

alter table public.games enable row level security;
revoke all on public.games from anon;
create policy "games: community reads" on public.games
  for select using (public.can_use_community());
create policy "games: admins write" on public.games
  for insert with check (public.is_admin());
create policy "games: admins update" on public.games
  for update using (public.is_admin());

insert into public.games (key, name_en, name_ur, tagline_en, tagline_ur, kind, min_seats, max_seats, timeout_style, enabled) values
  ('race100', 'Race to 100', 'سو تک دوڑ',
   'Roll, add, and be first past the post. Pure luck — pure fun.',
   'پانسہ پھینکیں، جمع کریں، سب سے پہلے منزل پار کریں۔ خالص قسمت — خالص مزہ۔',
   'turns', 2, 4, 'bot_plays', true),
  ('daily_puzzle', 'Daily Riddle', 'آج کی پہیلی',
   'One riddle a day, the same for everyone. No timers, no losing.',
   'روز ایک پہیلی، سب کے لیے ایک جیسی۔ نہ گھڑی، نہ ہار۔',
   'daily', 1, 1, 'bot_plays', true),
  -- Registered but disabled until the ludo lane ships game_exec_ludo()
  -- in its follow-up migration (which also flips enabled).
  ('ludo', 'Ludo', 'لوڈو',
   'The board everyone grew up with.', 'وہی بساط جس پر سب پلے بڑھے۔',
   'turns', 2, 4, 'bot_plays', false);

-- ----------------------------------------------------------------------------
-- Rebase the live 0020_ludo tables to the contract (they are empty).
-- ----------------------------------------------------------------------------
alter table public.game_sessions rename column game to game_key;
alter table public.game_sessions drop constraint game_sessions_game_check;
alter table public.game_sessions
  add constraint game_sessions_game_key_fkey
  foreign key (game_key) references public.games (key);

alter table public.game_sessions rename column target_seats to seats_total;

-- Live rows exist (the ludo lane tests against this schema): migrate
-- them to the contract vocabulary before swapping the constraints.
alter table public.game_sessions drop constraint game_sessions_status_check;
update public.game_sessions set status = 'active' where status = 'playing';
alter table public.game_sessions
  add constraint game_sessions_status_check
  check (status in ('lobby', 'active', 'finished'));

alter table public.game_sessions rename column turn_deadline to turn_started_at;
alter table public.game_sessions add column started_at timestamptz;
alter table public.game_sessions add column finished_at timestamptz;

-- Seats go 1-based (0..3 → 1..4). Two hops so the unique(session,
-- seat) constraint never sees a transient collision mid-update.
alter table public.game_seats rename column seat to seat_no;
alter table public.game_seats drop constraint game_seats_seat_check;
update public.game_seats set seat_no = seat_no + 10;
update public.game_seats set seat_no = seat_no - 9;
update public.game_sessions set current_seat = current_seat + 1 where current_seat is not null;
alter table public.game_seats
  add constraint game_seats_seat_no_check check (seat_no between 1 and 4);
alter table public.game_seats add column presence text not null default 'active'
  check (presence in ('active', 'away'));
alter table public.game_seats add column missed_turns smallint not null default 0;
alter table public.game_seats add column score integer not null default 0;
alter table public.game_seats add column joined_at timestamptz not null default now();

-- Chat gains stickers; a message is words or a sticker (or both).
alter table public.game_messages alter column body drop not null;
alter table public.game_messages add column sticker text
  check (sticker is null or sticker in ('👍', '😄', '🎉', '🌸', '☕', '🙏', '😂', '❤️'));
alter table public.game_messages
  add constraint game_messages_content_check check (body is not null or sticker is not null);

-- ----------------------------------------------------------------------------
-- New rails tables
-- ----------------------------------------------------------------------------
create table public.game_moves (
  id         bigint generated always as identity primary key,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  seat_no    smallint not null,
  by_bot     boolean not null default false,
  move       jsonb not null,
  created_at timestamptz not null default now()
);

create index game_moves_session_idx on public.game_moves (session_id, id);

create table public.game_invites (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  seat_no    smallint not null,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (session_id, invitee_id)
);

-- Invitees may see the lobby they were asked into.
create or replace function public.can_view_game(p_session uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_game_participant(p_session)
    or exists (
      select 1 from public.game_invites
      where session_id = p_session and invitee_id = auth.uid()
    );
$$;

alter table public.game_moves   enable row level security;
alter table public.game_invites enable row level security;
revoke all on public.game_moves   from anon;
revoke all on public.game_invites from anon;

drop policy "participants read sessions" on public.game_sessions;
create policy "sessions: viewers read" on public.game_sessions
  for select using (public.can_view_game(id) or created_by = auth.uid());
drop policy "participants read seats" on public.game_seats;
create policy "seats: viewers read" on public.game_seats
  for select using (public.can_view_game(session_id));
create policy "moves: viewers read" on public.game_moves
  for select using (public.can_view_game(session_id));
create policy "invites: both sides read" on public.game_invites
  for select using (inviter_id = auth.uid() or invitee_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Notifications gain a deep link (nullable; older rows unaffected).
-- ----------------------------------------------------------------------------
alter table public.notifications add column link text;

create or replace function public.game_notify(p_profile uuid, p_title text, p_body text, p_link text)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  insert into public.notifications (profile_id, title, body, kind, link)
  values (p_profile, p_title, p_body, 'game', p_link);
$$;

revoke execute on function public.game_notify(uuid, text, text, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- The engine. Executors are game_exec_<key>(session, seat, by_bot,
-- payload) → {move, winner}; game lanes ship their own in their own
-- migrations. race100's lives here as the reference implementation.
-- ----------------------------------------------------------------------------
create or replace function public.game_exec_race100(
  p_session uuid, p_seat smallint, p_by_bot boolean, p_payload jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_target int;
  v_roll int;
  v_score int;
begin
  select coalesce((house_rules ->> 'target')::int, 100) into v_target
  from public.game_sessions where id = p_session;
  -- The server IS the dice; the client payload carries nothing.
  v_roll := floor(random() * 6)::int + 1;
  update public.game_seats
  set score = score + v_roll
  where session_id = p_session and seat_no = p_seat
  returning score into v_score;
  return jsonb_build_object(
    'move', jsonb_build_object('roll', v_roll, 'score', v_score),
    'winner', v_score >= v_target
  );
end;
$$;

revoke execute on function public.game_exec_race100(uuid, smallint, boolean, jsonb) from public, anon, authenticated;

create or replace function public.exec_game_move(
  p_session uuid, p_seat smallint, p_by_bot boolean, p_payload jsonb default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_result jsonb;
  v_move jsonb;
  v_winner boolean;
  v_next smallint;
  v_next_profile uuid;
  v_game_name text;
  seat_rec record;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if s.status <> 'active' or s.current_seat is distinct from p_seat then
    raise exception 'Not this seat''s turn';
  end if;

  if coalesce(p_payload ->> 'pass', 'false') = 'true' then
    -- Generic pass: recorded, turn moves on, no game logic touched.
    v_move := jsonb_build_object('pass', true);
    v_winner := false;
  else
    -- Dispatch to the game's executor. game_key is FK-constrained to
    -- the registry, and %I quotes the identifier.
    begin
      execute format('select public.%I($1, $2, $3, $4)', 'game_exec_' || s.game_key)
      into v_result using p_session, p_seat, p_by_bot, p_payload;
    exception when undefined_function then
      raise exception 'Game % has no executor yet', s.game_key;
    end;
    v_move := v_result -> 'move';
    v_winner := coalesce((v_result ->> 'winner')::boolean, false);
  end if;

  insert into public.game_moves (session_id, seat_no, by_bot, move)
  values (p_session, p_seat, p_by_bot, v_move);

  select name_en into v_game_name from public.games where key = s.game_key;

  if v_winner then
    update public.game_sessions
    set status = 'finished', winner_seat = p_seat, finished_at = now(),
        current_seat = null, turn_started_at = null
    where id = p_session;
    for seat_rec in
      select profile_id from public.game_seats
      where session_id = p_session and profile_id is not null
    loop
      perform public.game_notify(
        seat_rec.profile_id,
        'Game over',
        v_game_name || ': the game has finished. Come see the board!',
        '/app/games/s/' || p_session
      );
    end loop;
  else
    v_next := (p_seat % s.seats_total) + 1;
    update public.game_sessions
    set current_seat = v_next, turn_started_at = now()
    where id = p_session;
    select profile_id into v_next_profile
    from public.game_seats
    where session_id = p_session and seat_no = v_next
      and profile_id is not null and presence = 'active';
    if v_next_profile is not null then
      perform public.game_notify(
        v_next_profile,
        'Your turn',
        v_game_name || ': it''s your move.',
        '/app/games/s/' || p_session
      );
    end if;
  end if;

  return v_move;
end;
$$;

revoke execute on function public.exec_game_move(uuid, smallint, boolean, jsonb) from public, anon, authenticated;

-- A person plays their own turn (payload for games that take one).
create or replace function public.play_turn(p_session uuid, p_payload jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_seat smallint;
begin
  select seat_no into v_seat
  from public.game_seats
  where session_id = p_session and profile_id = auth.uid();
  if v_seat is null then
    raise exception 'Not at this table';
  end if;
  -- Playing is also how you come back: presence and misses reset.
  update public.game_seats
  set presence = 'active', missed_turns = 0
  where session_id = p_session and seat_no = v_seat;
  return public.exec_game_move(p_session, v_seat, false, p_payload);
end;
$$;

revoke execute on function public.play_turn(uuid, jsonb) from public, anon;
grant execute on function public.play_turn(uuid, jsonb) to authenticated;

-- The sweep. pg_cron every minute + any viewer's client.
create or replace function public.game_tick(p_session uuid default null)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  seat_rec record;
  v_turn_seconds int;
  v_style text;
  v_payload jsonb;
  v_played int := 0;
  v_guard int;
begin
  for s in
    select sess.id, g.timeout_style
    from public.game_sessions sess
    join public.games g on g.key = sess.game_key
    where sess.status = 'active' and (p_session is null or sess.id = p_session)
  loop
    v_style := s.timeout_style;
    v_payload := case when v_style = 'pass_turn' then '{"pass": true}'::jsonb end;
    v_guard := 0;
    -- One broken session (e.g. its executor not shipped yet) must
    -- never stall the sweep for every other table.
    begin
    loop
      v_guard := v_guard + 1;
      exit when v_guard > 50; -- safety: never spin

      select gs.*, sess.house_rules, sess.turn_started_at as t0, sess.status as sess_status
      into seat_rec
      from public.game_sessions sess
      join public.game_seats gs
        on gs.session_id = sess.id and gs.seat_no = sess.current_seat
      where sess.id = s.id;

      exit when seat_rec is null or seat_rec.sess_status <> 'active';

      v_turn_seconds := coalesce((seat_rec.house_rules ->> 'turn_seconds')::int, 60);

      if seat_rec.is_bot or seat_rec.presence = 'away' then
        perform public.exec_game_move(s.id, seat_rec.seat_no, true, v_payload);
        v_played := v_played + 1;
      elsif now() >= seat_rec.t0 + make_interval(secs => v_turn_seconds) then
        -- A missed human turn: count it, flip to away on the third.
        -- The game keeps moving; the seat is never forfeited.
        update public.game_seats
        set missed_turns = missed_turns + 1,
            presence = case when missed_turns + 1 >= 3 then 'away' else presence end
        where session_id = s.id and seat_no = seat_rec.seat_no;
        perform public.exec_game_move(s.id, seat_rec.seat_no, true, v_payload);
        v_played := v_played + 1;
      else
        exit; -- a present human whose clock is still running
      end if;
    end loop;
    exception when others then
      raise notice 'game_tick: session % skipped (%)', s.id, sqlerrm;
    end;
  end loop;
  return v_played;
end;
$$;

revoke execute on function public.game_tick(uuid) from public, anon;
grant execute on function public.game_tick(uuid) to authenticated;

create or replace function public.reclaim_seat(p_session uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.game_seats
  set presence = 'active', missed_turns = 0
  where session_id = p_session and profile_id = auth.uid();
  if not found then
    raise exception 'Not at this table';
  end if;
end;
$$;

revoke execute on function public.reclaim_seat(uuid) from public, anon;
grant execute on function public.reclaim_seat(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Lobby lifecycle. A session STARTS THE MOMENT its last seat fills.
-- ----------------------------------------------------------------------------
create or replace function public.game_start_if_full(p_session uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_taken int;
  v_game_name text;
  seat_rec record;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if s.status <> 'lobby' then return false; end if;
  select count(*) into v_taken from public.game_seats where session_id = p_session;
  if v_taken < s.seats_total then return false; end if;

  update public.game_sessions
  set status = 'active', started_at = now(), current_seat = 1, turn_started_at = now()
  where id = p_session;

  select name_en into v_game_name from public.games where key = s.game_key;
  for seat_rec in
    select profile_id from public.game_seats
    where session_id = p_session and profile_id is not null
  loop
    perform public.game_notify(
      seat_rec.profile_id,
      'The table is ready',
      v_game_name || ': everyone is seated — the game has begun.',
      '/app/games/s/' || p_session
    );
  end loop;
  return true;
end;
$$;

revoke execute on function public.game_start_if_full(uuid) from public, anon, authenticated;

create or replace function public.create_game_session(
  p_game text,
  p_seats smallint,
  p_house_rules jsonb default '{}'
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  g public.games%rowtype;
  v_id uuid;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  select * into g from public.games where key = p_game and enabled and kind = 'turns';
  if g.key is null then raise exception 'Unknown game'; end if;
  if p_seats < g.min_seats or p_seats > g.max_seats then
    raise exception 'This game seats % to % players', g.min_seats, g.max_seats;
  end if;

  insert into public.game_sessions (game_key, seats_total, house_rules, created_by, join_code)
  values (
    p_game, p_seats, coalesce(p_house_rules, '{}'), auth.uid(),
    lpad(floor(random() * 1000000)::int::text, 6, '0')
  )
  returning id into v_id;

  insert into public.game_seats (session_id, seat_no, profile_id)
  values (v_id, 1, auth.uid());
  return v_id;
end;
$$;

revoke execute on function public.create_game_session(text, smallint, jsonb) from public, anon;
grant execute on function public.create_game_session(text, smallint, jsonb) to authenticated;

create or replace function public.invite_to_game(p_session uuid, p_invitee uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
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
  if exists (select 1 from public.game_seats where session_id = p_session and profile_id = p_invitee)
     or exists (select 1 from public.game_invites where session_id = p_session and invitee_id = p_invitee) then
    raise exception 'Already asked';
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

revoke execute on function public.invite_to_game(uuid, uuid) from public, anon;
grant execute on function public.invite_to_game(uuid, uuid) to authenticated;

create or replace function public.respond_game_invite(p_invite uuid, p_accept boolean)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  inv public.game_invites%rowtype;
begin
  select * into inv from public.game_invites where id = p_invite for update;
  if inv.invitee_id is distinct from auth.uid() or inv.status <> 'pending' then
    raise exception 'Not yours to answer';
  end if;
  update public.game_invites
  set status = case when p_accept then 'accepted' else 'declined' end,
      decided_at = now()
  where id = p_invite;
  if p_accept then
    insert into public.game_seats (session_id, seat_no, profile_id)
    values (inv.session_id, inv.seat_no, auth.uid());
    perform public.game_start_if_full(inv.session_id);
  end if;
  return inv.session_id;
end;
$$;

revoke execute on function public.respond_game_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_game_invite(uuid, boolean) to authenticated;

create or replace function public.claim_open_seat(p_session uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_taken int;
  v_seat smallint;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  select * into s from public.game_sessions where id = p_session for update;
  if s.status <> 'lobby' then
    raise exception 'This table has already started';
  end if;
  if exists (select 1 from public.game_seats where session_id = p_session and profile_id = auth.uid()) then
    return p_session;
  end if;
  select count(*) into v_taken from public.game_seats where session_id = p_session;
  if v_taken >= s.seats_total then
    raise exception 'This table has already started';
  end if;
  select coalesce(max(seat_no), 0) + 1 into v_seat
  from (
    select seat_no from public.game_seats where session_id = p_session
    union all
    select seat_no from public.game_invites where session_id = p_session and status = 'pending'
  ) taken;
  if v_seat > s.seats_total then
    raise exception 'This table has already started';
  end if;
  insert into public.game_seats (session_id, seat_no, profile_id)
  values (p_session, v_seat, auth.uid());
  perform public.game_start_if_full(p_session);
  return p_session;
end;
$$;

revoke execute on function public.claim_open_seat(uuid) from public, anon;
grant execute on function public.claim_open_seat(uuid) to authenticated;

create or replace function public.start_with_bots(p_session uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_taken int;
  i int;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if s.created_by <> auth.uid() or s.status <> 'lobby' then
    raise exception 'Only the host can start, and only in the lobby';
  end if;
  select count(*) into v_taken from public.game_seats where session_id = p_session;
  for i in (v_taken + 1) .. s.seats_total loop
    insert into public.game_seats (session_id, seat_no, profile_id, is_bot)
    values (p_session, i, null, true);
  end loop;
  perform public.game_start_if_full(p_session);
end;
$$;

revoke execute on function public.start_with_bots(uuid) from public, anon;
grant execute on function public.start_with_bots(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Daily Riddle: one shared row per day; answers in a table with NO
-- select policy (guessing goes through the RPC). Streak-forgiving by
-- construction — we count what was solved, never the gaps.
-- ----------------------------------------------------------------------------
create table public.daily_puzzles (
  puzzle_date date primary key,
  riddle_en   text not null,
  riddle_ur   text not null,
  hint_en     text,
  hint_ur     text
);

create table public.daily_puzzle_answers (
  puzzle_date date primary key references public.daily_puzzles (puzzle_date) on delete cascade,
  answers     text[] not null
);

create table public.puzzle_attempts (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  puzzle_date date not null references public.daily_puzzles (puzzle_date) on delete cascade,
  guesses     smallint not null default 0,
  solved_at   timestamptz,
  primary key (profile_id, puzzle_date)
);

alter table public.daily_puzzles enable row level security;
alter table public.daily_puzzle_answers enable row level security;
alter table public.puzzle_attempts enable row level security;
revoke all on public.daily_puzzles from anon;
revoke all on public.daily_puzzle_answers from anon, authenticated;
revoke all on public.puzzle_attempts from anon;

create policy "puzzles: community reads up to today" on public.daily_puzzles
  for select using (public.can_use_community() and puzzle_date <= current_date);
create policy "attempts: own" on public.puzzle_attempts
  for select using (profile_id = auth.uid());

create or replace function public.guess_daily_puzzle(p_date date, p_guess text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_norm text;
  v_correct boolean;
  v_attempt public.puzzle_attempts%rowtype;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  if p_date > current_date then
    raise exception 'Patience — that riddle isn''t out yet';
  end if;
  if not exists (select 1 from public.daily_puzzles where puzzle_date = p_date) then
    raise exception 'No riddle that day';
  end if;

  v_norm := lower(btrim(regexp_replace(coalesce(p_guess, ''), '[^[:alnum:]؀-ۿ ]', '', 'g')));
  select v_norm = any (answers) into v_correct
  from public.daily_puzzle_answers where puzzle_date = p_date;

  insert into public.puzzle_attempts (profile_id, puzzle_date, guesses, solved_at)
  values (auth.uid(), p_date, 1, case when v_correct then now() end)
  on conflict (profile_id, puzzle_date) do update
  set guesses = public.puzzle_attempts.guesses + 1,
      solved_at = coalesce(public.puzzle_attempts.solved_at,
                           case when v_correct then now() end)
  returning * into v_attempt;

  return jsonb_build_object(
    'correct', coalesce(v_correct, false),
    'guesses', v_attempt.guesses,
    'solved', v_attempt.solved_at is not null
  );
end;
$$;

revoke execute on function public.guess_daily_puzzle(date, text) from public, anon;
grant execute on function public.guess_daily_puzzle(date, text) to authenticated;

-- 30 riddles, seeded from today.
with seed(off, r_en, r_ur, h_en, h_ur) as (
  values
  (0,  'I have hands but cannot clap. What am I?', 'میرے ہاتھ ہیں مگر تالی نہیں بجا سکتا۔ میں کون ہوں؟', 'It hangs on the wall.', 'دیوار پر لٹکی رہتی ہے۔'),
  (1,  'The more I dry, the wetter I get. What am I?', 'جتنا سکھاؤں، اتنا بھیگتا جاؤں۔ میں کیا ہوں؟', 'You use it after a bath.', 'نہانے کے بعد کام آتا ہے۔'),
  (2,  'Full of holes, yet I hold water. What am I?', 'سوراخوں سے بھرا، پھر بھی پانی تھامے۔ میں کیا ہوں؟', 'It lives near the sink.', 'برتن دھونے میں ساتھی۔'),
  (3,  'I have a neck but no head. What am I?', 'گردن ہے مگر سر نہیں۔ میں کیا ہوں؟', 'It holds what you drink.', 'پینے کی چیز اس میں رہتی ہے۔'),
  (4,  'I always go up and never come down. What am I?', 'ہمیشہ بڑھتی ہوں، کبھی گھٹتی نہیں۔ میں کیا ہوں؟', 'Every birthday adds one.', 'ہر سالگرہ پر ایک اور۔'),
  (5,  'I have teeth but never eat. What am I?', 'دانت ہیں مگر کھاتا کچھ نہیں۔ میں کیا ہوں؟', 'It tidies your hair.', 'بالوں کو سنوارتی ہے۔'),
  (6,  'The more you take, the more you leave behind. What are they?', 'جتنے لو، اتنے پیچھے چھوڑ جاؤ۔ وہ کیا ہیں؟', 'Look down on a sandy path.', 'ریت پر پیچھے مڑ کر دیکھیں۔'),
  (7,  'It belongs to you, but others use it more. What is it?', 'ہے تو آپ کا، مگر دوسرے زیادہ استعمال کرتے ہیں۔ کیا؟', 'You answer when you hear it.', 'پکارے جانے پر مڑتے ہیں۔'),
  (8,  'One eye, but I cannot see. What am I?', 'ایک آنکھ ہے مگر دیکھ نہیں سکتی۔ میں کیا ہوں؟', 'It pulls a thread along.', 'دھاگہ اس کے پیچھے چلتا ہے۔'),
  (9,  'The more you take away, the bigger I get. What am I?', 'جتنا نکالو، اتنا بڑا ہو جاؤں۔ میں کیا ہوں؟', 'Diggers make it.', 'کھودنے سے بنتا ہے۔'),
  (10, 'Always coming, never arrives. What is it?', 'ہمیشہ آنے والا ہے، کبھی آتا نہیں۔ وہ کیا ہے؟', 'It is a day.', 'ایک دن کا نام ہے۔'),
  (11, 'Say my name and I am broken. What am I?', 'میرا نام لو تو میں ٹوٹ جاؤں۔ میں کیا ہوں؟', 'A very quiet thing.', 'بہت خاموش چیز۔'),
  (12, 'I have a bed but never sleep, I run but never walk. What am I?', 'بستر ہے پر سوتا نہیں، دوڑتا ہے پر چلتا نہیں۔ کیا؟', 'Boats ride on it.', 'کشتیاں اس پر تیرتی ہیں۔'),
  (13, 'Lighter than a feather, yet no one can hold me long. What am I?', 'پنکھ سے ہلکی، پھر بھی دیر تک کوئی نہ روک سکے۔ کیا؟', 'You take it every moment.', 'ہر لمحہ لیتے ہیں۔'),
  (14, 'Green coat, red heart, black seeds. What am I?', 'ہرا چولا، لال دل، کالے بیج۔ میں کیا ہوں؟', 'A summer treat.', 'گرمیوں کا تحفہ۔'),
  (15, 'I travel the world while staying in my corner. What am I?', 'دنیا گھوموں مگر اپنے کونے میں رہوں۔ میں کیا ہوں؟', 'It rides on an envelope.', 'لفافے پر سوار۔'),
  (16, 'A house with no doors or windows, with golden treasure inside. What is it?', 'نہ دروازہ نہ کھڑکی، اندر سنہری خزانہ۔ وہ کیا ہے؟', 'Breakfast often starts with it.', 'ناشتے کی جان۔'),
  (17, 'I fall all winter but never get hurt. What am I?', 'سردیوں بھر گرتی ہوں، چوٹ کبھی نہیں لگتی۔ کیا؟', 'The mountains wear it.', 'پہاڑوں کی چادر۔'),
  (18, 'I have a tongue but cannot talk. What am I?', 'زبان ہے مگر بول نہیں سکتا۔ میں کیا ہوں؟', 'It walks everywhere with you.', 'ہر قدم پر ساتھ۔'),
  (19, 'A white field, black seeds, read by the wise. What is it?', 'سفید کھیت، کالے بیج، پڑھے سیانا۔ وہ کیا ہے؟', 'You are holding one now, in a way.', 'علم کا گھر۔'),
  (20, 'I cry without eyes and fly without wings. What am I?', 'آنکھوں بغیر روؤں، پروں بغیر اڑوں۔ میں کیا ہوں؟', 'It shades the sun.', 'سورج کو ڈھانپ لیتا ہے۔'),
  (21, 'You can catch me, but never throw me. What am I?', 'مجھے پکڑ تو سکتے ہو، پھینک نہیں سکتے۔ کیا؟', 'It comes with sneezes.', 'چھینکوں کے ساتھ آتا ہے۔'),
  (22, 'Where does today come before yesterday?', 'کہاں «آج» «کل» سے پہلے آتا ہے؟', 'A book of words.', 'الفاظ کی کتاب۔'),
  (23, 'I pass through cities and fields but never move. What am I?', 'شہروں اور کھیتوں سے گزروں، مگر ہلوں نہیں۔ کیا؟', 'Travellers use it daily.', 'مسافروں کی ساتھی۔'),
  (24, 'I wear a yellow coat and bow politely before you enjoy me. What am I?', 'پیلا چولا پہنوں، کھانے سے پہلے جھک جاؤں۔ کیا؟', 'Monkeys agree.', 'بندروں کی پسند۔'),
  (25, 'I dance in the sky on a single string. What am I?', 'ایک ڈور پر آسمان میں ناچوں۔ میں کیا ہوں؟', 'Basant knows me well.', 'بسنت کی رونق۔'),
  (26, 'The more I work, the smaller I become. What am I?', 'جتنا کام کروں، اتنا گھٹتا جاؤں۔ میں کیا ہوں؟', 'It bubbles as it works.', 'جھاگ بنا کر کام کرتا ہے۔'),
  (27, 'Round as a plate, I light the night sky. What am I?', 'تھالی جیسا گول، رات کے آسمان کا چراغ۔ کیا؟', 'Eid begins when it is seen.', 'عید اس کے دیکھنے سے۔'),
  (28, 'I have a head and a tail but no body. What am I?', 'سر ہے، دُم ہے، مگر جسم نہیں۔ میں کیا ہوں؟', 'It jingles in a pocket.', 'جیب میں کھنکتا ہے۔'),
  (29, 'The hotter the day, the higher I climb. What am I?', 'دن جتنا گرم، میں اتنا اوپر چڑھوں۔ کیا ہوں؟', 'It measures the summer.', 'گرمی ناپنے والا۔')
)
insert into public.daily_puzzles (puzzle_date, riddle_en, riddle_ur, hint_en, hint_ur)
select current_date + off, r_en, r_ur, h_en, h_ur from seed;

with seed(off, ans) as (
  values
  (0, array['clock','watch','گھڑی']), (1, array['towel','تولیہ']),
  (2, array['sponge','اسفنج','سپنج']), (3, array['bottle','بوتل']),
  (4, array['age','عمر']), (5, array['comb','کنگھی','کنگھا']),
  (6, array['footsteps','steps','footprints','قدم','قدموں کے نشان']),
  (7, array['name','my name','نام']), (8, array['needle','سوئی']),
  (9, array['hole','گڑھا']), (10, array['tomorrow','کل']),
  (11, array['silence','خاموشی']), (12, array['river','دریا','ندی']),
  (13, array['breath','سانس']), (14, array['watermelon','تربوز']),
  (15, array['stamp','ٹکٹ','ڈاک ٹکٹ']), (16, array['egg','انڈا','انڈہ']),
  (17, array['snow','برف']), (18, array['shoe','جوتا']),
  (19, array['book','writing','کتاب','لکھائی']), (20, array['cloud','بادل']),
  (21, array['cold','a cold','زکام','نزلہ']), (22, array['dictionary','لغت','ڈکشنری']),
  (23, array['road','سڑک','راستہ']), (24, array['banana','کیلا']),
  (25, array['kite','پتنگ']), (26, array['soap','صابن']),
  (27, array['moon','چاند']), (28, array['coin','سکہ']),
  (29, array['thermometer','mercury','تھرمامیٹر','پارہ'])
)
insert into public.daily_puzzle_answers (puzzle_date, answers)
select current_date + off, ans from seed;

-- ----------------------------------------------------------------------------
-- Community post types for games.
-- ----------------------------------------------------------------------------
alter table public.community_posts drop constraint community_posts_post_type_check;
alter table public.community_posts add constraint community_posts_post_type_check
  check (post_type in ('text', 'badge', 'score', 'walk', 'event', 'game_open', 'puzzle_result'));

-- ----------------------------------------------------------------------------
-- pg_cron sweep, once a minute. If it can't be enabled, the client
-- ticks alone still uphold every rule.
-- ----------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('saathban_game_tick', '* * * * *', 'select public.game_tick()');
exception when others then
  raise notice 'pg_cron unavailable (%). Client-driven ticks only.', sqlerrm;
end $$;
