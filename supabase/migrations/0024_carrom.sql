-- ============================================================================
-- 0024 — Carrom (on the 0022 games rails)
--
-- Carrom plugs into the rails per GAMES_CONTRACT.md: a `games` registry row
-- with timeout_style='pass_turn' (a lapsed turn is a MISSED turn — the rails
-- pass it, no bot shot) and ONE executor, game_exec_carrom, dispatched by the
-- rails' exec_game_move(). The client runs simplified physics (routes/games/
-- carrom/physics.js) and submits the shot OUTCOME via play_turn(session,
-- payload); the executor validates it, writes game_sessions.state (the board)
-- and game_seats.score, and returns {move, winner, again}. It NEVER advances
-- the turn — the rails do that (holding the seat when again=true).
--
-- Seats are 1-based on the rails (seat 1 = white 'w', seat 2 = black 'b'),
-- matching the client's mover = seat_no - 1.
-- ============================================================================

insert into public.games (key, name_en, name_ur, tagline_en, tagline_ur, kind, min_seats, max_seats, timeout_style, enabled)
values (
  'carrom', 'Carrom', 'کیرم',
  'Flick, pocket, and cover the Queen. A calm table for two.',
  'ٹھوکر لگائیں، ڈالیں اور کوئین ڈھانپیں۔ دو کے لیے ایک پُرسکون میز۔',
  'turns', 2, 2, 'pass_turn', true
);

-- ----------------------------------------------------------------------------
-- carrom_init(session, state): set the opening board once. The deterministic
-- layout is computed by the client (physics.initialLayout) and written here
-- first-writer-wins — safe because the layout is fixed. A game-owned
-- intermediate-state RPC per the contract: it verifies the caller holds the
-- current seat of an active session and writes ONLY state (no move, no turn).
-- ----------------------------------------------------------------------------
create or replace function public.carrom_init(p_session uuid, p_state jsonb)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if s.game_key <> 'carrom' or s.status <> 'active' then
    raise exception 'Not an active carrom session';
  end if;
  if not exists (
    select 1 from public.game_seats
    where session_id = p_session and seat_no = s.current_seat and profile_id = auth.uid()
  ) then
    raise exception 'Only the seat on the move sets the board';
  end if;
  -- first-writer-wins: only initialise while the board is still empty
  if coalesce(s.state -> 'pieces', 'null'::jsonb) = 'null'::jsonb then
    update public.game_sessions set state = p_state where id = p_session;
  end if;
end;
$$;

revoke execute on function public.carrom_init(uuid, jsonb) from public, anon;
grant execute on function public.carrom_init(uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- The executor. Validates the submitted outcome, writes state + score, returns
-- {move, winner, again}. Server-authoritative on winner and again (recomputed
-- from the end state — the client's claims are checked, not trusted). A full
-- physics re-simulation in SQL is a future hardening step; v1 validates the
-- outcome's internal consistency and stores the raw shot for audit.
-- ----------------------------------------------------------------------------
create or replace function public.game_exec_carrom(
  p_session uuid, p_seat smallint, p_by_bot boolean, p_payload jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_end     jsonb;
  v_outcome jsonb;
  v_colour  text;
  v_scored_ids jsonb;
  v_id      text;
  v_scored  int := 0;
  v_my_left int;
  v_queen_covered boolean;
  v_foul    boolean;
  v_winner  boolean;
  v_again   boolean;
begin
  -- pass_turn timeouts are handled generically by the rails; the executor is
  -- only ever reached for a real shot. Guard anyway.
  if p_by_bot then
    return jsonb_build_object('move', jsonb_build_object('pass', true), 'winner', false);
  end if;
  if p_payload is null then raise exception 'Carrom needs a shot payload'; end if;

  v_end := p_payload -> 'endState';
  v_outcome := p_payload -> 'outcome';
  if v_end is null or jsonb_typeof(v_end -> 'pieces') <> 'array'
     or v_outcome is null then
    raise exception 'Malformed carrom payload';
  end if;

  v_colour := case when p_seat = 1 then 'w' else 'b' end;
  v_scored_ids := coalesce(v_outcome -> 'scored', '[]'::jsonb);

  -- Every claimed-scored coin must, in the end state, be pocketed and of the
  -- mover's own colour — reject anything else as garbage.
  for v_id in select jsonb_array_elements_text(v_scored_ids) loop
    if not exists (
      select 1 from jsonb_to_recordset(v_end -> 'pieces') as x(id text, owner text, pocketed boolean)
      where x.id = v_id and x.owner = v_colour and x.pocketed = true
    ) then
      raise exception 'Claimed a coin that is not yours or not pocketed: %', v_id;
    end if;
    v_scored := v_scored + 1;
  end loop;

  -- Coins of the mover's colour still on the board, and the queen's cover.
  select count(*) into v_my_left
  from jsonb_to_recordset(v_end -> 'pieces') as x(owner text, pocketed boolean)
  where x.owner = v_colour and x.pocketed = false;
  v_queen_covered := coalesce((v_end ->> 'queenCovered')::boolean, false);
  v_foul := coalesce((v_outcome ->> 'foul')::boolean, false);

  -- Server-authoritative results.
  v_winner := (v_my_left = 0 and v_queen_covered);
  v_again  := (v_scored > 0 and not v_foul and not v_winner);

  -- Persist the board and the score.
  update public.game_sessions set state = v_end where id = p_session;
  if v_scored > 0 then
    update public.game_seats set score = score + v_scored
    where session_id = p_session and seat_no = p_seat;
  end if;

  return jsonb_build_object(
    'move', jsonb_build_object(
      'shot', p_payload -> 'shot',
      'scored', v_scored_ids,
      'foul', v_foul,
      'foulReason', v_outcome -> 'foulReason',
      'queen', v_outcome -> 'queen'
    ),
    'winner', v_winner,
    'again', v_again
  );
end;
$$;

revoke execute on function public.game_exec_carrom(uuid, smallint, boolean, jsonb) from public, anon, authenticated;
