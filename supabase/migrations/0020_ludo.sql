-- ============================================================================
-- 0020 — Ludo: sessions, seats, chat, and a fully server-validated engine.
--
-- There is no games-rails contract yet (src/app/lib/games.js does not
-- exist; see GAMES_CONTRACT_ASKS.md) — this migration is written so the
-- rails can grow around it: game_sessions carries a `game` discriminator,
-- state/house_rules are jsonb, and every table is game-agnostic; only the
-- ludo_* functions are Ludo-specific.
--
-- Board model (per piece, "progress" p):
--   0        in the yard
--   1..51    on the shared track; absolute square = (seat*13 + p - 1) % 52
--   52..56   the seat's home column
--   57       home (finished)
-- Entering from the yard always needs a 6. Landing on an opponent on a
-- non-safe track square sends every opponent piece there back to the yard.
--
-- House rules (session.house_rules jsonb, chosen in the lobby, immutable
-- once play starts):
--   extra_roll_on_six    bool   (default true)  — a 6 grants another roll
--   capture_before_home  bool   (default false) — no home column until you
--                                                 have captured at least once
--   exact_home           bool   (default true)  — home needs the exact roll;
--                                                 off = overshoot finishes
--   safe_squares         text   'standard' | 'none' — standard = the four
--                                start squares + the four star squares
--
-- Every write goes through the RPCs; the tables accept no direct client
-- writes (game_messages inserts excepted). Dice are rolled server-side
-- only. Bots (empty seats, and any seat whose 60s turn timer expires) play
-- inside the same transaction with the same heuristic:
-- capture > escape threat > advance furthest > unstack.
-- ============================================================================

create table public.game_sessions (
  id            uuid primary key default gen_random_uuid(),
  game          text not null default 'ludo' check (game in ('ludo')),
  status        text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  join_code     text not null,
  target_seats  smallint not null default 4 check (target_seats between 2 and 4),
  house_rules   jsonb not null default '{}',
  state         jsonb not null default '{}',
  current_seat  smallint,
  turn_deadline timestamptz,
  winner_seat   smallint,
  rematch_id    uuid references public.game_sessions (id) on delete set null,
  created_by    uuid not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index game_sessions_active_code
  on public.game_sessions (join_code) where status = 'lobby';

create trigger game_sessions_updated_at
  before update on public.game_sessions
  for each row execute function public.set_updated_at();

create table public.game_seats (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  seat       smallint not null check (seat between 0 and 3),
  profile_id uuid references public.profiles (id) on delete cascade,  -- null = bot
  is_bot     boolean not null default false,
  unique (session_id, seat),
  unique (session_id, profile_id),
  check (is_bot = (profile_id is null))
);

create index game_seats_profile_idx on public.game_seats (profile_id);

create table public.game_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index game_messages_session_idx on public.game_messages (session_id, created_at);

-- ----------------------------------------------------------------------------
-- RLS. Participants read; nobody writes tables directly except chat inserts.
-- ----------------------------------------------------------------------------
create or replace function public.is_game_participant(p_session uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.game_seats
    where session_id = p_session and profile_id = auth.uid()
  );
$$;

alter table public.game_sessions enable row level security;
alter table public.game_seats    enable row level security;
alter table public.game_messages enable row level security;
revoke all on public.game_sessions from anon;
revoke all on public.game_seats    from anon;
revoke all on public.game_messages from anon;

create policy "participants read sessions"
  on public.game_sessions for select
  using (public.is_game_participant(id) or created_by = auth.uid());

create policy "participants read seats"
  on public.game_seats for select
  using (public.is_game_participant(session_id));

create policy "participants read chat"
  on public.game_messages for select
  using (public.is_game_participant(session_id));

create policy "participants write chat"
  on public.game_messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_game_participant(session_id)
    and public.account_ok()
  );

-- ----------------------------------------------------------------------------
-- House-rule validation / defaults.
-- ----------------------------------------------------------------------------
create or replace function public.ludo_rules(p jsonb)
returns jsonb
language sql immutable
as $$
  select jsonb_build_object(
    'extra_roll_on_six',   coalesce((p->>'extra_roll_on_six')::boolean, true),
    'capture_before_home', coalesce((p->>'capture_before_home')::boolean, false),
    'exact_home',          coalesce((p->>'exact_home')::boolean, true),
    'safe_squares',        case when p->>'safe_squares' = 'none' then 'none' else 'standard' end
  );
$$;

-- Absolute track square for a seat's progress (p in 1..51), else null.
create or replace function public.ludo_abs(p_seat int, p int)
returns int
language sql immutable
as $$
  select case when p between 1 and 51 then (p_seat * 13 + p - 1) % 52 end;
$$;

create or replace function public.ludo_is_safe(p_abs int, p_rules jsonb)
returns boolean
language sql immutable
as $$
  select p_rules->>'safe_squares' = 'standard'
     and p_abs in (0, 13, 26, 39, 8, 21, 34, 47);
$$;

-- ----------------------------------------------------------------------------
-- Legal moves for one seat and one die. Returns piece indexes (0..3).
-- ----------------------------------------------------------------------------
create or replace function public.ludo_legal(p_state jsonb, p_seat int, p_dice int)
returns int[]
language plpgsql immutable
as $$
declare
  v_rules    jsonb := public.ludo_rules(p_state->'rules');
  v_pieces   jsonb := p_state->'pieces'->p_seat;
  v_captured boolean := coalesce((p_state->'captured_by'->>p_seat)::boolean, false);
  v_out      int[] := '{}';
  v_p        int;
  v_target   int;
  i          int;
begin
  for i in 0..3 loop
    v_p := (v_pieces->>i)::int;
    if v_p = 57 then
      continue; -- already home
    elsif v_p = 0 then
      if p_dice = 6 then v_out := v_out || i; end if;
    else
      v_target := v_p + p_dice;
      -- capture-required-before-home: the column door stays shut
      if (v_rules->>'capture_before_home')::boolean and not v_captured
         and v_p <= 51 and v_target >= 52 then
        continue;
      end if;
      if v_target > 57 then
        if (v_rules->>'exact_home')::boolean then
          continue; -- needs the exact roll
        end if;
        -- overshoot finishes when exactness is off
      end if;
      v_out := v_out || i;
    end if;
  end loop;
  return v_out;
end;
$$;

-- ----------------------------------------------------------------------------
-- Apply one validated move. Returns the new state; sets captured flag and
-- whether the seat finished all four pieces.
-- ----------------------------------------------------------------------------
create or replace function public.ludo_apply(
  p_state jsonb,
  p_seat int,
  p_piece int,
  p_dice int,
  out o_state jsonb,
  out o_capture boolean,
  out o_finished boolean
)
language plpgsql immutable
as $$
declare
  v_rules  jsonb := public.ludo_rules(p_state->'rules');
  v_p      int := (p_state->'pieces'->p_seat->>p_piece)::int;
  v_target int;
  v_abs    int;
  os       int;
  oj       int;
  oq       int;
  v_seats  int := jsonb_array_length(p_state->'pieces');
  v_home   int := 0;
  i        int;
begin
  o_capture := false;
  v_target := case when v_p = 0 then 1 else v_p + p_dice end;
  if v_target > 57 then v_target := 57; end if; -- only reachable with exact_home off

  o_state := jsonb_set(p_state, array['pieces', p_seat::text, p_piece::text], to_jsonb(v_target));

  -- Captures on the shared track only
  v_abs := public.ludo_abs(p_seat, v_target);
  if v_abs is not null and not public.ludo_is_safe(v_abs, v_rules) then
    for os in 0..(v_seats - 1) loop
      if os = p_seat then continue; end if;
      for oj in 0..3 loop
        oq := (o_state->'pieces'->os->>oj)::int;
        if oq between 1 and 51 and public.ludo_abs(os, oq) = v_abs then
          o_state := jsonb_set(o_state, array['pieces', os::text, oj::text], to_jsonb(0));
          o_capture := true;
        end if;
      end loop;
    end loop;
    if o_capture then
      o_state := jsonb_set(o_state, array['captured_by', p_seat::text], to_jsonb(true));
    end if;
  end if;

  for i in 0..3 loop
    if (o_state->'pieces'->p_seat->>i)::int = 57 then v_home := v_home + 1; end if;
  end loop;
  o_finished := v_home = 4;

  o_state := jsonb_set(o_state, '{last}', jsonb_build_object(
    'seat', p_seat, 'dice', p_dice, 'piece', p_piece,
    'capture', o_capture, 'skipped', false
  ));
end;
$$;

-- ----------------------------------------------------------------------------
-- The bot's choice among legal pieces:
-- capture > escape threat > advance furthest > unstack (as tiebreak).
-- ----------------------------------------------------------------------------
create or replace function public.ludo_bot_pick(p_state jsonb, p_seat int, p_dice int, p_legal int[])
returns int
language plpgsql immutable
as $$
declare
  v_rules jsonb := public.ludo_rules(p_state->'rules');
  v_seats int := jsonb_array_length(p_state->'pieces');
  best_i  int; best_rank int := -1;
  i int; v_p int; v_target int; v_abs int;
  is_cap boolean; is_escape boolean; is_stacked boolean;
  os int; oj int; oq int; gap int;
  rank int;
begin
  foreach i in array p_legal loop
    v_p := (p_state->'pieces'->p_seat->>i)::int;
    v_target := case when v_p = 0 then 1 else least(v_p + p_dice, 57) end;
    v_abs := public.ludo_abs(p_seat, v_target);

    -- capture available on the landing square?
    is_cap := false;
    if v_abs is not null and not public.ludo_is_safe(v_abs, v_rules) then
      for os in 0..(v_seats - 1) loop
        if os = p_seat then continue; end if;
        for oj in 0..3 loop
          oq := (p_state->'pieces'->os->>oj)::int;
          if oq between 1 and 51 and public.ludo_abs(os, oq) = v_abs then is_cap := true; end if;
        end loop;
      end loop;
    end if;

    -- is this piece currently under threat (an opponent 1..6 behind it)?
    is_escape := false;
    if v_p between 1 and 51 and not public.ludo_is_safe(public.ludo_abs(p_seat, v_p), v_rules) then
      for os in 0..(v_seats - 1) loop
        if os = p_seat then continue; end if;
        for oj in 0..3 loop
          oq := (p_state->'pieces'->os->>oj)::int;
          if oq between 1 and 51 then
            gap := (public.ludo_abs(p_seat, v_p) - public.ludo_abs(os, oq) + 52) % 52;
            if gap between 1 and 6 then is_escape := true; end if;
          end if;
        end loop;
      end loop;
    end if;

    -- stacked with another of our own pieces?
    is_stacked := false;
    if v_p between 1 and 51 then
      for oj in 0..3 loop
        if oj <> i and (p_state->'pieces'->p_seat->>oj)::int = v_p then is_stacked := true; end if;
      end loop;
    end if;

    rank := (case when is_cap then 1000000 else 0 end)
          + (case when is_escape then 10000 else 0 end)
          + v_p * 10
          + (case when is_stacked then 1 else 0 end);
    if rank > best_rank then
      best_rank := rank;
      best_i := i;
    end if;
  end loop;
  return best_i;
end;
$$;

-- ----------------------------------------------------------------------------
-- Internal: advance to the next seat, or play whole bot turns until a
-- human's turn (or the game ends). Also used to auto-play a timed-out
-- human seat. Assumes the caller holds the session row lock.
-- ----------------------------------------------------------------------------
create or replace function public.ludo_advance(p_id uuid, p_extra_roll boolean)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s      public.game_sessions%rowtype;
  v_bot  boolean;
  v_dice int;
  v_legal int[];
  v_pick int;
  a      record;
  guard  int := 0;
begin
  select * into s from public.game_sessions where id = p_id;

  if not p_extra_roll then
    update public.game_sessions
    set current_seat = (current_seat + 1) % target_seats,
        state = state - 'dice' - 'legal',
        turn_deadline = now() + interval '60 seconds'
    where id = p_id;
  else
    update public.game_sessions
    set state = state - 'dice' - 'legal',
        turn_deadline = now() + interval '60 seconds'
    where id = p_id;
  end if;

  -- Bot turns run to completion, one after another, until a human is up.
  loop
    guard := guard + 1;
    exit when guard > 200;

    select * into s from public.game_sessions where id = p_id;
    exit when s.status <> 'playing';

    select gs.is_bot into v_bot from public.game_seats gs
    where gs.session_id = p_id and gs.seat = s.current_seat;
    exit when not coalesce(v_bot, false);

    v_dice := 1 + floor(random() * 6)::int;
    v_legal := public.ludo_legal(s.state, s.current_seat, v_dice);

    if coalesce(array_length(v_legal, 1), 0) = 0 then
      update public.game_sessions
      set state = jsonb_set(state, '{last}', jsonb_build_object(
            'seat', s.current_seat, 'dice', v_dice, 'piece', null,
            'capture', false, 'skipped', true)),
          current_seat = (current_seat + 1) % target_seats,
          turn_deadline = now() + interval '60 seconds'
      where id = p_id;
      continue;
    end if;

    v_pick := public.ludo_bot_pick(s.state, s.current_seat, v_dice, v_legal);
    select * into a from public.ludo_apply(s.state, s.current_seat, v_pick, v_dice);

    if a.o_finished then
      update public.game_sessions
      set state = a.o_state, status = 'finished', winner_seat = s.current_seat,
          turn_deadline = null
      where id = p_id;
      exit;
    end if;

    if v_dice = 6 and (public.ludo_rules(s.state->'rules')->>'extra_roll_on_six')::boolean then
      update public.game_sessions
      set state = a.o_state, turn_deadline = now() + interval '60 seconds'
      where id = p_id;
      -- same seat rolls again next loop iteration
    else
      update public.game_sessions
      set state = a.o_state,
          current_seat = (current_seat + 1) % target_seats,
          turn_deadline = now() + interval '60 seconds'
      where id = p_id;
    end if;
  end loop;
end;
$$;

revoke execute on function public.ludo_advance(uuid, boolean) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Public RPCs.
-- ----------------------------------------------------------------------------

-- Create a lobby. Caller takes seat 0. Returns the session id.
create or replace function public.ludo_create(p_target_seats int, p_house_rules jsonb)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id   uuid;
  v_code text;
begin
  if auth.uid() is null or not public.account_ok() then
    raise exception 'Sign in required';
  end if;
  if p_target_seats not between 2 and 4 then
    raise exception 'A game seats two to four';
  end if;

  loop
    v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (
      select 1 from public.game_sessions where join_code = v_code and status = 'lobby'
    );
  end loop;

  insert into public.game_sessions (game, join_code, target_seats, house_rules, created_by)
  values ('ludo', v_code, p_target_seats, public.ludo_rules(p_house_rules), auth.uid())
  returning id into v_id;

  insert into public.game_seats (session_id, seat, profile_id, is_bot)
  values (v_id, 0, auth.uid(), false);

  return v_id;
end;
$$;

-- Join a lobby by its code. Returns the session id.
create or replace function public.ludo_join(p_code text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_seat int;
begin
  if auth.uid() is null or not public.account_ok() then
    raise exception 'Sign in required';
  end if;

  select * into s from public.game_sessions
  where join_code = trim(p_code) and status = 'lobby'
  for update;
  if not found then
    raise exception 'That code did not match an open game';
  end if;

  if exists (select 1 from public.game_seats where session_id = s.id and profile_id = auth.uid()) then
    return s.id; -- already seated
  end if;

  select min(x) into v_seat from generate_series(0, s.target_seats - 1) x
  where not exists (select 1 from public.game_seats gs where gs.session_id = s.id and gs.seat = x);
  if v_seat is null then
    raise exception 'That game is full';
  end if;

  insert into public.game_seats (session_id, seat, profile_id, is_bot)
  values (s.id, v_seat, auth.uid(), false);
  return s.id;
end;
$$;

-- Start: creator only; empty seats fill with bots; seat 0 begins.
create or replace function public.ludo_start(p_session uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_pieces jsonb := '[]';
  v_flags  jsonb := '[]';
  i int;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.created_by <> auth.uid() then
    raise exception 'Only the host can start the game';
  end if;
  if s.status <> 'lobby' then
    raise exception 'The game has already started';
  end if;

  -- Bot-fill every empty seat.
  for i in 0..(s.target_seats - 1) loop
    if not exists (select 1 from public.game_seats gs where gs.session_id = s.id and gs.seat = i) then
      insert into public.game_seats (session_id, seat, profile_id, is_bot)
      values (s.id, i, null, true);
    end if;
    v_pieces := v_pieces || jsonb_build_array(jsonb_build_array(0, 0, 0, 0));
    v_flags := v_flags || to_jsonb(false);
  end loop;

  update public.game_sessions
  set status = 'playing',
      current_seat = 0,
      turn_deadline = now() + interval '60 seconds',
      state = jsonb_build_object(
        'pieces', v_pieces,
        'captured_by', v_flags,
        'rules', house_rules,
        'last', null
      )
  where id = s.id;

  -- If seat 0 is a bot (host filled every other seat), it plays now.
  perform public.ludo_advance(s.id, true);
end;
$$;

-- Roll: current seat's human only, once per turn. Auto-skips (and passes
-- the turn) when the roll leaves no legal move.
create or replace function public.ludo_roll(p_session uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_dice int;
  v_legal int[];
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.status <> 'playing' then
    raise exception 'No game to roll in';
  end if;
  if not exists (
    select 1 from public.game_seats gs
    where gs.session_id = s.id and gs.seat = s.current_seat and gs.profile_id = auth.uid()
  ) then
    raise exception 'Not your turn';
  end if;
  if s.state ? 'dice' then
    raise exception 'You already rolled — choose a piece';
  end if;

  v_dice := 1 + floor(random() * 6)::int;
  v_legal := public.ludo_legal(s.state, s.current_seat, v_dice);

  if coalesce(array_length(v_legal, 1), 0) = 0 then
    update public.game_sessions
    set state = jsonb_set(state, '{last}', jsonb_build_object(
          'seat', s.current_seat, 'dice', v_dice, 'piece', null,
          'capture', false, 'skipped', true))
    where id = s.id;
    perform public.ludo_advance(s.id, false);
    return jsonb_build_object('dice', v_dice, 'legal', '[]'::jsonb, 'skipped', true);
  end if;

  update public.game_sessions
  set state = state
      || jsonb_build_object('dice', v_dice, 'legal', to_jsonb(v_legal))
  where id = s.id;
  return jsonb_build_object('dice', v_dice, 'legal', to_jsonb(v_legal), 'skipped', false);
end;
$$;

-- Move: current seat's human, against the stored roll only.
create or replace function public.ludo_move(p_session uuid, p_piece int)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_dice int;
  v_legal int[];
  a record;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.status <> 'playing' then
    raise exception 'No game to move in';
  end if;
  if not exists (
    select 1 from public.game_seats gs
    where gs.session_id = s.id and gs.seat = s.current_seat and gs.profile_id = auth.uid()
  ) then
    raise exception 'Not your turn';
  end if;
  if not (s.state ? 'dice') then
    raise exception 'Roll first';
  end if;

  v_dice := (s.state->>'dice')::int;
  select array_agg(x::int) into v_legal from jsonb_array_elements_text(s.state->'legal') x;
  if p_piece is null or not (p_piece = any (v_legal)) then
    raise exception 'That piece has no legal move';
  end if;

  select * into a from public.ludo_apply(s.state, s.current_seat, p_piece, v_dice);

  if a.o_finished then
    update public.game_sessions
    set state = (a.o_state - 'dice' - 'legal'),
        status = 'finished', winner_seat = s.current_seat, turn_deadline = null
    where id = s.id;
    return;
  end if;

  update public.game_sessions set state = (a.o_state - 'dice' - 'legal') where id = s.id;

  perform public.ludo_advance(
    s.id,
    v_dice = 6 and (public.ludo_rules(s.state->'rules')->>'extra_roll_on_six')::boolean
  );
end;
$$;

-- Tick: any participant may call once the deadline passes; the current
-- seat's turn is then played by the bot (away-seat auto-play) — the same
-- heuristic bots use.
create or replace function public.ludo_tick(p_session uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_dice int;
  v_legal int[];
  v_pick int;
  a record;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.status <> 'playing' then
    return false;
  end if;
  if not public.is_game_participant(s.id) then
    raise exception 'Not your game';
  end if;
  if s.turn_deadline is null or s.turn_deadline > now() then
    return false;
  end if;

  -- Play the stalled seat exactly as a bot would (finishing a pending
  -- roll if one exists, otherwise rolling fresh).
  if s.state ? 'dice' then
    v_dice := (s.state->>'dice')::int;
    select array_agg(x::int) into v_legal from jsonb_array_elements_text(s.state->'legal') x;
    v_pick := public.ludo_bot_pick(s.state, s.current_seat, v_dice, v_legal);
    select * into a from public.ludo_apply(s.state, s.current_seat, v_pick, v_dice);
    if a.o_finished then
      update public.game_sessions
      set state = (a.o_state - 'dice' - 'legal'),
          status = 'finished', winner_seat = s.current_seat, turn_deadline = null
      where id = s.id;
      return true;
    end if;
    update public.game_sessions set state = (a.o_state - 'dice' - 'legal') where id = s.id;
    perform public.ludo_advance(
      s.id,
      v_dice = 6 and (public.ludo_rules(s.state->'rules')->>'extra_roll_on_six')::boolean
    );
    return true;
  end if;

  v_dice := 1 + floor(random() * 6)::int;
  v_legal := public.ludo_legal(s.state, s.current_seat, v_dice);
  if coalesce(array_length(v_legal, 1), 0) = 0 then
    update public.game_sessions
    set state = jsonb_set(state, '{last}', jsonb_build_object(
          'seat', s.current_seat, 'dice', v_dice, 'piece', null,
          'capture', false, 'skipped', true))
    where id = s.id;
    perform public.ludo_advance(s.id, false);
    return true;
  end if;
  v_pick := public.ludo_bot_pick(s.state, s.current_seat, v_dice, v_legal);
  select * into a from public.ludo_apply(s.state, s.current_seat, v_pick, v_dice);
  if a.o_finished then
    update public.game_sessions
    set state = a.o_state, status = 'finished', winner_seat = s.current_seat, turn_deadline = null
    where id = s.id;
    return true;
  end if;
  update public.game_sessions set state = a.o_state where id = s.id;
  perform public.ludo_advance(
    s.id,
    v_dice = 6 and (public.ludo_rules(s.state->'rules')->>'extra_roll_on_six')::boolean
  );
  return true;
end;
$$;

-- Rematch: same seats, same rules. Any seated human, finished games only.
-- Starts immediately (everyone is already seated) and links back so every
-- client can follow.
create or replace function public.ludo_rematch(p_session uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_id uuid;
  v_pieces jsonb := '[]';
  v_flags jsonb := '[]';
  i int;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.status <> 'finished' then
    raise exception 'Only a finished game can be replayed';
  end if;
  if not public.is_game_participant(s.id) then
    raise exception 'Not your game';
  end if;
  if s.rematch_id is not null then
    return s.rematch_id; -- someone already asked; everyone follows the same one
  end if;

  insert into public.game_sessions
    (game, join_code, target_seats, house_rules, created_by, status, current_seat, turn_deadline)
  values
    ('ludo', s.join_code, s.target_seats, s.house_rules, s.created_by,
     'playing', 0, now() + interval '60 seconds')
  returning id into v_id;

  insert into public.game_seats (session_id, seat, profile_id, is_bot)
  select v_id, seat, profile_id, is_bot from public.game_seats where session_id = s.id;

  for i in 0..(s.target_seats - 1) loop
    v_pieces := v_pieces || jsonb_build_array(jsonb_build_array(0, 0, 0, 0));
    v_flags := v_flags || to_jsonb(false);
  end loop;

  update public.game_sessions
  set state = jsonb_build_object(
    'pieces', v_pieces, 'captured_by', v_flags, 'rules', house_rules, 'last', null)
  where id = v_id;

  update public.game_sessions set rematch_id = v_id where id = s.id;

  perform public.ludo_advance(v_id, true);
  return v_id;
end;
$$;

-- Add a bot to a specific lobby seat is implicit in ludo_start's bot-fill;
-- lobbies show "will be filled by a bot" for empty seats instead.

revoke execute on function public.ludo_create(int, jsonb) from public, anon;
revoke execute on function public.ludo_join(text) from public, anon;
revoke execute on function public.ludo_start(uuid) from public, anon;
revoke execute on function public.ludo_roll(uuid) from public, anon;
revoke execute on function public.ludo_move(uuid, int) from public, anon;
revoke execute on function public.ludo_tick(uuid) from public, anon;
revoke execute on function public.ludo_rematch(uuid) from public, anon;
grant execute on function public.ludo_create(int, jsonb) to authenticated;
grant execute on function public.ludo_join(text) to authenticated;
grant execute on function public.ludo_start(uuid) to authenticated;
grant execute on function public.ludo_roll(uuid) to authenticated;
grant execute on function public.ludo_move(uuid, int) to authenticated;
grant execute on function public.ludo_tick(uuid) to authenticated;
grant execute on function public.ludo_rematch(uuid) to authenticated;
