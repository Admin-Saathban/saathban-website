-- ============================================================================
-- 0042 — Desi Ludo: two dice, the jota, and the sixes chain
--
-- OWNERSHIP: 0020/0023 were the ludo lane's. That lane is gone (checked
-- against the live session list; recorded by the registrar in 3a720a8), so
-- the engine's internals change hands here. Nothing in the 0022 rails
-- contract changes: game_exec_ludo still returns {move, winner, again}, and
-- dice_count rides house_rules exactly as turn_seconds does.
--
-- OLD TABLES FINISH UNDER OLD RULES. `state.ruleset` is the marker: tables
-- created from here carry 'desi'; anything without it is 'classic' and plays
-- exactly as before — one die, no jota, no wall, no chain, an extra roll on a
-- six or a capture. Classic is this same code with the flag off, not a second
-- engine, because two engines drift within a week. Every house rule the old
-- engine honoured — capture_before_home, exact_home, safe_squares — is
-- honoured here too, so no live table changes rules mid-play.
--
-- ── THE RULES ──
--
-- TWO DICE (house_rules.dice_count = 2). Both are rolled together and each is
-- assigned INDEPENDENTLY: to the same piece (in the order you choose) or to
-- two different pieces. A six on either die brings a piece out of the yard.
-- A die with no legal use is FORFEITED — rolling 6+5, using the six, and
-- finding nothing that can use the five means the five is simply wasted, and
-- the board says so. An extra roll comes ONLY from a double six. In one-die
-- mode a capture still earns an extra roll; in two-dice mode it earns nothing.
--
-- THE JOTA. Two of your own pieces on one square are a pair.
--   * A pair formed by landing but never yet moved together is VIRGIN: it
--     walls and can be jota-killed like any other, but may split freely.
--   * Once moved as a pair it may only split on a safe/start square or inside
--     the home column.
--   * A moved pair travels on EVEN dice only, and advances HALF: 2 -> 1,
--     4 -> 2, 6 -> 3.
--   * WALL: an opponent's SINGLE may not pass a jota, nor land beyond it. It
--     MAY land exactly on the jota's square — it rests there unharmed, and may
--     continue with its other die or on any later turn. Your own singles pass
--     freely; opposing jotas pass each other freely; and a jota standing on a
--     safe/star/start square walls nobody.
--   * KILLING: only a jota kills a jota, by landing exactly, on an even die.
--     Both victims go home. A single resting on an enemy jota's square is just
--     that — resting. Nothing dies, and stacking a second single there cannot
--     kill: two singles arriving one at a time never become a killing jota on
--     an already-occupied square.
--   * HOME: a pair may enter and move within the home column together, but the
--     final square must be entered as singles — split in the column first.
--
-- THE SIXES CHAIN (both modes; in two-dice mode a DOUBLE six counts as one).
-- Sixes accumulate. A chain ending at exactly 3, 6 or 9 counts for NOTHING —
-- those sixes are void and their moves never happened. A 4th (or 7th, or
-- 10th) six redeems the whole chain and all of them count.
--
-- HOW THAT IS DONE WITHOUT REWRITING HISTORY: moves made on chained sixes are
-- never written to the committed board. They accumulate on a PROVISIONAL copy
-- (`state.prov`) which is what the player sees; `state.pieces` stays as it was
-- before the chain began. When the chain resolves, the provisional board is
-- either promoted to real or discarded, and the pieces were never touched.
-- Nothing is ever rolled back, so game_moves — an append-only log other things
-- read — never needs a compensating entry.
--
-- THERE IS NO TIMEOUT RULE FOR THE CHAIN, and my first draft was wrong to
-- claim one. A lapsed turn is not forfeited in this game — game_tick hands the
-- seat to a bot, which keeps playing it (see 0042d). So a chain interrupted by
-- someone putting their phone down is simply continued, and ends the way every
-- chain ends: at 3, 6 or 9, or when the sixes stop coming.
--
-- A JOTA CONSUMES ONE DIE and advances half THAT die — never half the sum.
-- With two dice a pair may take both, one after the other, if both are even.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Reading the state
-- ----------------------------------------------------------------------------

/* The board the player is looking at: the provisional one mid-chain, the
   committed one otherwise. Everything below reads through this, so the chain
   is invisible to the rules — they simply play on "the board". */
create or replace function public.ludo_board(p_state jsonb)
returns jsonb
language sql immutable
as $$
  select coalesce(p_state -> 'prov', p_state -> 'pieces');
$$;

/* Is this table playing Desi rules? An absent marker means an old table, and
   an old table finishes the way it started. */
create or replace function public.ludo_is_desi(p_state jsonb)
returns boolean
language sql immutable
as $$
  select coalesce(p_state ->> 'ruleset', 'classic') = 'desi';
$$;

/* How many of this seat's pieces stand on progress p. Two is a jota. */
create or replace function public.ludo_count_at(p_board jsonb, p_seat int, p int)
returns int
language sql immutable
as $$
  select count(*)::int
  from jsonb_array_elements_text(p_board -> p_seat) v
  where p between 1 and 56 and v::int = p;
$$;

/* Has this pair moved together? Keyed by seat and the square it stands on, so
   the flag travels with the pair and is dropped the moment the pair splits. */
create or replace function public.ludo_pair_moved(p_state jsonb, p_seat int, p int)
returns boolean
language sql immutable
as $$
  select coalesce((p_state -> 'pairs_moved' ->> (p_seat || ':' || p))::boolean, false);
$$;

/* Every enemy jota on the track that WALLS, as absolute squares. A jota
   standing on a safe square walls nobody — and if the table turned safe
   squares off then no square is safe, so every enemy jota walls. */
create or replace function public.ludo_walls(p_state jsonb, p_seat int, p_seats int)
returns int[]
language plpgsql immutable
as $$
declare
  v_board jsonb;
  v_rules jsonb;
  v_out int[] := '{}';
  s int;
  p int;
  v_abs int;
begin
  if not public.ludo_is_desi(p_state) then
    return '{}';                      -- classic knows no wall
  end if;
  v_board := public.ludo_board(p_state);
  v_rules := public.ludo_rules(p_state -> 'rules');
  for s in 0 .. p_seats - 1 loop
    if s = p_seat then continue; end if;
    for p in 1 .. 51 loop
      if public.ludo_count_at(v_board, s, p) >= 2 then
        v_abs := public.ludo_abs(s, p);
        if not public.ludo_is_safe(v_abs, v_rules) then
          v_out := v_out || v_abs;
        end if;
      end if;
    end loop;
  end loop;
  return v_out;
end;
$$;

/* Can a piece of p_seat travel from progress p_from to p_to without breaking
   a wall?

   The wall rule in one place, because it is the rule most easily got wrong:
   a single may not PASS an enemy jota and may not land BEYOND it, but it may
   land exactly ON it and rest there. So a wall STRICTLY BETWEEN from and to
   blocks; a wall AT to does not. Checking only the strictly-between squares
   expresses both halves at once — landing beyond a wall necessarily passes
   it, and is refused by the same test. */
create or replace function public.ludo_path_clear(
  p_state jsonb, p_seat int, p_seats int, p_from int, p_to int, p_is_pair boolean
)
returns boolean
language plpgsql immutable
as $$
declare
  v_walls int[];
  step int;
begin
  -- A pair is not stopped by another pair, and nothing walls inside a home
  -- column (52..57), which only its owner can enter.
  if p_is_pair then return true; end if;
  v_walls := public.ludo_walls(p_state, p_seat, p_seats);
  if coalesce(array_length(v_walls, 1), 0) = 0 then return true; end if;

  for step in greatest(p_from + 1, 1) .. least(p_to - 1, 51) loop
    if public.ludo_abs(p_seat, step) = any (v_walls) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- Legality
-- ----------------------------------------------------------------------------

/* The legal options for ONE die, as a jsonb array of
   {piece, split, to, kind} where kind is 'out' | 'single' | 'pair'.

   The client draws its choices from exactly this and the executor validates
   against exactly this, so what a person is offered and what the server will
   accept cannot drift apart. */
create or replace function public.ludo_desi_legal(
  p_state jsonb, p_seat int, p_seats int, p_die int
)
returns jsonb
language plpgsql immutable
as $$
declare
  v_board jsonb := public.ludo_board(p_state);
  v_rules jsonb := public.ludo_rules(p_state -> 'rules');
  v_desi boolean := public.ludo_is_desi(p_state);
  v_captured boolean := coalesce((p_state -> 'captured_by' ->> p_seat)::boolean, false);
  v_cbh boolean := (v_rules ->> 'capture_before_home')::boolean;
  v_exact boolean := (v_rules ->> 'exact_home')::boolean;
  v_out jsonb := '[]';
  v_pieces jsonb := v_board -> p_seat;
  i int;
  p int;
  v_to int;
  v_pair boolean;
  v_moved boolean;
  v_abs int;
  v_can_split boolean;
begin
  for i in 0 .. 3 loop
    p := (v_pieces ->> i)::int;

    -- In the yard: only a six brings a piece out, onto its start square.
    if p = 0 then
      if p_die = 6 and public.ludo_path_clear(p_state, p_seat, p_seats, 0, 1, false) then
        v_out := v_out || jsonb_build_array(
          jsonb_build_object('piece', i, 'split', false, 'to', 1, 'kind', 'out'));
      end if;
      continue;
    end if;

    if p >= 57 then continue; end if;                  -- already home

    v_pair := v_desi and public.ludo_count_at(v_board, p_seat, p) >= 2;
    v_moved := v_pair and public.ludo_pair_moved(p_state, p_seat, p);
    v_abs := case when p between 1 and 51 then public.ludo_abs(p_seat, p) end;
    -- A moved pair may split only on a safe square or in the home column.
    v_can_split := (not v_moved)
                   or (p >= 52)
                   or (v_abs is not null and public.ludo_is_safe(v_abs, v_rules));

    if v_pair and p_die % 2 = 0 then
      -- As a pair: even dice only, half the die, and never onto the finish —
      -- the last square is entered as singles.
      v_to := p + p_die / 2;
      if v_to <= 56
         and not (v_cbh and not v_captured and p <= 51 and v_to >= 52)
         and public.ludo_path_clear(p_state, p_seat, p_seats, p, v_to, true) then
        v_out := v_out || jsonb_build_array(
          jsonb_build_object('piece', i, 'split', false, 'to', v_to, 'kind', 'pair'));
      end if;
    end if;

    -- As a single: either this piece stands alone, or it splits off a pair.
    if (not v_pair) or v_can_split then
      v_to := p + p_die;
      if v_to > 57 then
        if v_exact then v_to := null; else v_to := 57; end if;
      end if;
      if v_to is not null
         and not (v_cbh and not v_captured and p <= 51 and v_to >= 52)
         and public.ludo_path_clear(p_state, p_seat, p_seats, p, v_to, false) then
        v_out := v_out || jsonb_build_array(
          jsonb_build_object('piece', i, 'split', v_pair, 'to', v_to, 'kind', 'single'));
      end if;
    end if;
  end loop;
  return v_out;
end;
$$;

-- ----------------------------------------------------------------------------
-- Applying one die
-- ----------------------------------------------------------------------------

/* Moves p_piece by p_die on the board inside p_state, honouring the pair and
   jota rules, and reports what happened. Assumes the move came from
   ludo_desi_legal — the executor checks that before calling. */
create or replace function public.ludo_desi_apply(
  p_state jsonb, p_seat int, p_seats int, p_piece int, p_die int, p_split boolean,
  out o_state jsonb, out o_capture boolean, out o_finished boolean, out o_kind text
)
language plpgsql
as $$
declare
  v_board jsonb := public.ludo_board(p_state);
  v_rules jsonb := public.ludo_rules(p_state -> 'rules');
  v_desi boolean := public.ludo_is_desi(p_state);
  v_exact boolean := (v_rules ->> 'exact_home')::boolean;
  v_from int;
  v_to int;
  v_pair boolean;
  v_partner int;
  i int;
  s int;
  v_other jsonb;
  v_op int;
  v_victim int;
  v_abs_to int;
  v_enemy int;
  v_pairs jsonb := coalesce(p_state -> 'pairs_moved', '{}'::jsonb);
begin
  o_capture := false;
  o_finished := false;
  v_from := (v_board -> p_seat ->> p_piece)::int;
  v_pair := v_desi and not p_split and v_from > 0
            and public.ludo_count_at(v_board, p_seat, v_from) >= 2;

  if v_from = 0 then
    v_to := 1;
    o_kind := 'out';
  elsif v_pair then
    v_to := v_from + p_die / 2;
    o_kind := 'pair';
  else
    v_to := v_from + p_die;
    if v_to > 57 and not v_exact then v_to := 57; end if;
    o_kind := 'single';
  end if;

  -- Move the piece, and its partner when travelling as a pair.
  v_board := jsonb_set(v_board, array[p_seat::text, p_piece::text], to_jsonb(v_to));
  if v_pair then
    v_partner := null;
    for i in 0 .. 3 loop
      if i <> p_piece and (v_board -> p_seat ->> i)::int = v_from then
        v_partner := i;
        exit;
      end if;
    end loop;
    if v_partner is not null then
      v_board := jsonb_set(v_board, array[p_seat::text, v_partner::text], to_jsonb(v_to));
      -- This pair has now moved together: from here it splits only on a safe
      -- square or in the home column.
      v_pairs := (v_pairs - (p_seat || ':' || v_from))
                 || jsonb_build_object(p_seat || ':' || v_to, true);
    end if;
  else
    -- A piece leaving a square where a pair stood ends the pair: what remains
    -- is a single, and the "has moved together" flag goes with it.
    if v_from > 0 and public.ludo_count_at(v_board, p_seat, v_from) < 2 then
      v_pairs := v_pairs - (p_seat || ':' || v_from);
    end if;
  end if;

  -- Captures, on the track only, and never on a safe square.
  if v_to between 1 and 51 then
    v_abs_to := public.ludo_abs(p_seat, v_to);
    if not public.ludo_is_safe(v_abs_to, v_rules) then
      for s in 0 .. p_seats - 1 loop
        if s = p_seat then continue; end if;
        v_other := v_board -> s;
        v_enemy := 0;
        v_victim := null;
        for i in 0 .. 3 loop
          v_op := (v_other ->> i)::int;
          if v_op between 1 and 51 and public.ludo_abs(s, v_op) = v_abs_to then
            v_enemy := v_enemy + 1;
            v_victim := v_op;
          end if;
        end loop;

        -- A single takes a single, as ever. A jota kills a jota and both
        -- victims go home. A SINGLE landing on an enemy jota kills nothing —
        -- it rests there — which is what stops two singles arriving one at a
        -- time from becoming a killing jota on an occupied square.
        if (v_enemy = 1 and not v_pair) or (v_enemy >= 2 and v_pair) then
          for i in 0 .. 3 loop
            v_op := (v_other ->> i)::int;
            if v_op between 1 and 51 and public.ludo_abs(s, v_op) = v_abs_to then
              v_board := jsonb_set(v_board, array[s::text, i::text], '0'::jsonb);
              o_capture := true;
            end if;
          end loop;
          if v_enemy >= 2 then
            v_pairs := v_pairs - (s || ':' || v_victim);
          end if;
        end if;
      end loop;
    end if;
  end if;

  if v_to = 57 then o_finished := true; end if;

  -- Write back to whichever board we are playing on: provisional mid-chain,
  -- committed otherwise.
  if p_state ? 'prov' then
    o_state := jsonb_set(p_state, '{prov}', v_board);
  else
    o_state := jsonb_set(p_state, '{pieces}', v_board);
  end if;
  o_state := jsonb_set(o_state, '{pairs_moved}', v_pairs);
  -- capture_before_home reads this, so a capture must be recorded.
  if o_capture then
    o_state := jsonb_set(o_state, array['captured_by', p_seat::text], 'true'::jsonb, true);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Chain resolution
-- ----------------------------------------------------------------------------

/* A chain of this many sixes: does it stand? 3, 6 and 9 count for nothing;
   any other length stands, which is exactly how a 4th six redeems the first
   three. */
create or replace function public.ludo_chain_stands(p_len int)
returns boolean
language sql immutable
as $$
  select p_len not in (3, 6, 9);
$$;

/* Settle an open chain: promote the provisional board, or discard it. Safe to
   call when no chain is open. */
create or replace function public.ludo_resolve_chain(p_state jsonb)
returns jsonb
language plpgsql immutable
as $$
declare
  v_len int := coalesce((p_state ->> 'chain')::int, 0);
  v_stands boolean;
  v_out jsonb := p_state;
begin
  if not (p_state ? 'prov') then
    return jsonb_set(p_state, '{chain}', '0'::jsonb, true) - 'chain_void';
  end if;
  v_stands := public.ludo_chain_stands(v_len);
  if v_stands then
    v_out := jsonb_set(v_out, '{pieces}', p_state -> 'prov');
  end if;
  -- Promoted or voided, the provisional board is gone and the chain is shut.
  return (v_out - 'prov')
         || jsonb_build_object('chain', 0, 'chain_void', not v_stands);
end;
$$;

revoke execute on function public.ludo_board(jsonb) from public, anon;
revoke execute on function public.ludo_is_desi(jsonb) from public, anon;
revoke execute on function public.ludo_count_at(jsonb, int, int) from public, anon;
revoke execute on function public.ludo_pair_moved(jsonb, int, int) from public, anon;
revoke execute on function public.ludo_walls(jsonb, int, int) from public, anon;
revoke execute on function public.ludo_path_clear(jsonb, int, int, int, int, boolean) from public, anon;
revoke execute on function public.ludo_desi_apply(jsonb, int, int, int, int, boolean) from public, anon;
revoke execute on function public.ludo_chain_stands(int) from public, anon;
revoke execute on function public.ludo_resolve_chain(jsonb) from public, anon;

-- The client draws its choices from this, so it may read it.
revoke execute on function public.ludo_desi_legal(jsonb, int, int, int) from public, anon;
grant execute on function public.ludo_desi_legal(jsonb, int, int, int) to authenticated;
