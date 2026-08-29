-- ============================================================================
-- 0042b — Desi Ludo, part two: the turn
--
-- 0042 holds the rules (the jota, the wall, the chain arithmetic). This holds
-- the turn: rolling one die or two, assigning each die to a piece, forfeiting
-- a die that has nothing to do, and deciding when the turn ends.
--
-- The rails contract is untouched: game_exec_ludo(session, seat, by_bot,
-- payload) still returns {move, winner, again}. `again` now carries two
-- meanings the rails treat identically — "a die is still unassigned" and "an
-- extra roll was earned" — because in both cases the turn stays with this
-- seat. exec_game_move writes exactly one game_moves row per call either way,
-- so a two-dice turn honestly appears as two rows and a chained six as one
-- row per roll, marked provisional.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- New tables carry the Desi marker and the host's dice choice
-- ----------------------------------------------------------------------------

create or replace function public.ludo_state_init(p_seats integer, p_house_rules jsonb)
returns jsonb
language plpgsql immutable
as $function$
declare
  v_pieces jsonb := '[]';
  v_flags jsonb := '[]';
  i int;
begin
  for i in 1..p_seats loop
    v_pieces := v_pieces || jsonb_build_array(jsonb_build_array(0, 0, 0, 0));
    v_flags := v_flags || to_jsonb(false);
  end loop;
  return jsonb_build_object(
    'pieces', v_pieces,
    'captured_by', v_flags,
    'rules', public.ludo_rules(p_house_rules),
    'ruleset', 'desi',
    'dice_count', least(2, greatest(1, coalesce((p_house_rules ->> 'dice_count')::int, 1))),
    'pairs_moved', '{}'::jsonb,
    'chain', 0,
    'last', null
  );
end;
$function$;

-- ----------------------------------------------------------------------------
-- Rolling
-- ----------------------------------------------------------------------------

/* One die, or two if the host chose two.

   A six — in two-dice mode a DOUBLE six — extends the chain, and from the
   first chained six onwards moves land on a provisional board so that voiding
   the chain costs nothing and rewrites no history. A non-six first RESOLVES
   any open chain (promote at 1, 2, 4, 5, 7...; discard at 3, 6, 9) and then
   plays normally on the committed board. */
create or replace function public.ludo_roll(p_session uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $function$
declare
  s public.game_sessions%rowtype;
  v_seat int;
  v_state jsonb;
  v_n int;
  v_d1 int;
  v_d2 int;
  v_six boolean;
  v_dice jsonb;
  v_desi boolean;
  v_any boolean := false;
  v_legal jsonb;
  i int;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.status <> 'active' or s.game_key <> 'ludo' then
    raise exception 'No game to roll in';
  end if;
  if not exists (
    select 1 from public.game_seats gs
    where gs.session_id = s.id and gs.seat_no = s.current_seat and gs.profile_id = auth.uid()
  ) then
    raise exception 'Not your turn';
  end if;
  if s.state ? 'dice' then
    raise exception 'You already rolled';
  end if;

  v_state := s.state;
  if not (v_state ? 'pieces') then
    v_state := public.ludo_state_init(s.seats_total, s.house_rules);
  end if;
  v_desi := public.ludo_is_desi(v_state);
  v_n := case when v_desi then coalesce((v_state ->> 'dice_count')::int, 1) else 1 end;
  v_seat := s.current_seat - 1;

  v_d1 := 1 + floor(random() * 6)::int;
  if v_n = 2 then v_d2 := 1 + floor(random() * 6)::int; end if;
  v_six := case when v_n = 2 then (v_d1 = 6 and v_d2 = 6) else v_d1 = 6 end;

  if v_desi then
    if v_six then
      v_state := jsonb_set(v_state, '{chain}',
                           to_jsonb(coalesce((v_state ->> 'chain')::int, 0) + 1), true);
      if not (v_state ? 'prov') then
        v_state := jsonb_set(v_state, '{prov}', v_state -> 'pieces', true);
      end if;
    else
      v_state := public.ludo_resolve_chain(v_state);
    end if;
  end if;

  v_dice := jsonb_build_array(jsonb_build_object('v', v_d1, 'used', false, 'wasted', false));
  if v_n = 2 then
    v_dice := v_dice || jsonb_build_array(jsonb_build_object('v', v_d2, 'used', false, 'wasted', false));
  end if;

  -- Has anything at all a use? If not, the turn simply passes.
  for i in 0 .. v_n - 1 loop
    v_legal := public.ludo_desi_legal(v_state, v_seat, s.seats_total, (v_dice -> i ->> 'v')::int);
    if jsonb_array_length(v_legal) > 0 then v_any := true; end if;
  end loop;

  if not v_any then
    -- A lapsed opportunity closes an open chain too: nobody is left to roll
    -- the redeeming six.
    v_state := public.ludo_resolve_chain(v_state);
    update public.game_sessions
    set state = jsonb_set(v_state - 'dice', '{last}', jsonb_build_object(
          'seat', v_seat, 'dice', v_dice, 'piece', null,
          'capture', false, 'skipped', true), true)
    where id = s.id;
    perform public.play_turn(s.id, '{"pass": true}'::jsonb);
    return jsonb_build_object('dice', v_dice, 'skipped', true);
  end if;

  update public.game_sessions
  set state = v_state || jsonb_build_object('dice', v_dice)
  where id = s.id;
  return jsonb_build_object('dice', v_dice, 'skipped', false,
                            'chain', coalesce((v_state ->> 'chain')::int, 0));
end;
$function$;

-- ----------------------------------------------------------------------------
-- Assigning a die — the executor the rails call
-- ----------------------------------------------------------------------------

/* Payload: {piece, die, split}. `die` is the INDEX into state.dice, so a
   player who rolls 6 and 6 can say which of the two they are spending even
   though the faces are identical. */
create or replace function public.game_exec_ludo(
  p_session uuid, p_seat smallint, p_by_bot boolean, p_payload jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $function$
declare
  s public.game_sessions%rowtype;
  v_state jsonb;
  v_seat int;
  v_dice jsonb;
  v_idx int;
  v_die int;
  v_piece int;
  v_split boolean;
  v_legal jsonb;
  v_ok boolean := false;
  v_res record;
  v_i int;
  v_left boolean := false;
  v_two boolean;
  v_six boolean;
  v_rules jsonb;
  v_extra boolean := false;
  v_home int := 0;
  v_move jsonb;
  v_void boolean;
  opt jsonb;
begin
  select * into s from public.game_sessions where id = p_session;
  v_state := s.state;
  v_seat := p_seat - 1;
  v_rules := public.ludo_rules(v_state -> 'rules');
  v_dice := v_state -> 'dice';
  if v_dice is null then
    raise exception 'Roll first';
  end if;
  v_two := jsonb_array_length(v_dice) = 2;

  -- A bot picks for itself: the first die with something to do, and the
  -- first legal option for it.
  if p_by_bot and (p_payload -> 'piece') is null then
    for v_i in 0 .. jsonb_array_length(v_dice) - 1 loop
      if not coalesce((v_dice -> v_i ->> 'used')::boolean, false)
         and not coalesce((v_dice -> v_i ->> 'wasted')::boolean, false) then
        v_legal := public.ludo_desi_legal(v_state, v_seat, s.seats_total,
                                          (v_dice -> v_i ->> 'v')::int);
        if jsonb_array_length(v_legal) > 0 then
          p_payload := jsonb_build_object(
            'die', v_i,
            'piece', (v_legal -> 0 ->> 'piece')::int,
            'split', coalesce((v_legal -> 0 ->> 'split')::boolean, false));
          exit;
        end if;
      end if;
    end loop;
  end if;

  v_idx := coalesce((p_payload ->> 'die')::int, 0);
  v_piece := coalesce((p_payload ->> 'piece')::int, 0);
  v_split := coalesce((p_payload ->> 'split')::boolean, false);
  if (v_dice -> v_idx) is null then raise exception 'No such die'; end if;
  if coalesce((v_dice -> v_idx ->> 'used')::boolean, false)
     or coalesce((v_dice -> v_idx ->> 'wasted')::boolean, false) then
    raise exception 'That die is already spent';
  end if;
  v_die := (v_dice -> v_idx ->> 'v')::int;

  -- Legality, from the very function the client reads to draw its choices.
  v_legal := public.ludo_desi_legal(v_state, v_seat, s.seats_total, v_die);
  for opt in select * from jsonb_array_elements(v_legal) loop
    if (opt ->> 'piece')::int = v_piece
       and coalesce((opt ->> 'split')::boolean, false) = v_split then
      v_ok := true;
    end if;
  end loop;
  if not v_ok then raise exception 'That piece cannot use that die'; end if;

  select * into v_res from public.ludo_desi_apply(
    v_state, v_seat, s.seats_total, v_piece, v_die, v_split);
  v_state := v_res.o_state;

  -- Spend this die; forfeit any other that now has nothing left to do.
  v_dice := jsonb_set(v_state -> 'dice', array[v_idx::text, 'used'], 'true'::jsonb);
  for v_i in 0 .. jsonb_array_length(v_dice) - 1 loop
    if not coalesce((v_dice -> v_i ->> 'used')::boolean, false)
       and not coalesce((v_dice -> v_i ->> 'wasted')::boolean, false) then
      if jsonb_array_length(public.ludo_desi_legal(
           v_state, v_seat, s.seats_total, (v_dice -> v_i ->> 'v')::int)) = 0 then
        v_dice := jsonb_set(v_dice, array[v_i::text, 'wasted'], 'true'::jsonb);
      else
        v_left := true;
      end if;
    end if;
  end loop;
  v_state := jsonb_set(v_state, '{dice}', v_dice);

  -- An extra roll: a double six in two-dice mode; a six or a capture in one.
  if v_two then
    v_six := (v_dice -> 0 ->> 'v')::int = 6 and (v_dice -> 1 ->> 'v')::int = 6;
    v_extra := v_six;
  else
    -- Classic's own house rule still decides whether a six repeats.
    v_six := (v_dice -> 0 ->> 'v')::int = 6
             and coalesce((v_rules ->> 'extra_roll_on_six')::boolean, true);
    v_extra := v_six or v_res.o_capture;
  end if;

  v_move := jsonb_build_object(
    'seat', v_seat, 'piece', v_piece, 'die', v_die, 'split', v_split,
    'kind', v_res.o_kind, 'capture', v_res.o_capture,
    'chain', coalesce((v_state ->> 'chain')::int, 0),
    'provisional', v_state ? 'prov');

  if v_left then
    -- The other die is still to be assigned: the turn stays here, and this
    -- move is logged honestly as a half-turn.
    v_state := jsonb_set(v_state, '{last}', v_move, true);
    update public.game_sessions set state = v_state where id = p_session;
    return jsonb_build_object(
      'move', v_move || jsonb_build_object('dice_left', true),
      'winner', false, 'again', true);
  end if;

  -- Every die is spent or forfeited. Clear them, and settle the chain unless
  -- an extra roll is about to extend it.
  v_state := v_state - 'dice';
  if not v_extra then
    v_state := public.ludo_resolve_chain(v_state);
  end if;
  v_void := coalesce((v_state ->> 'chain_void')::boolean, false);
  v_state := jsonb_set(v_state - 'chain_void', '{last}', v_move, true);
  update public.game_sessions set state = v_state where id = p_session;

  -- A win counts only on the COMMITTED board: four pieces home on a
  -- provisional board win nothing until the chain has stood.
  select count(*)::int into v_home
  from jsonb_array_elements_text(coalesce(v_state -> 'pieces', '[]'::jsonb) -> v_seat) v
  where v::int = 57;

  return jsonb_build_object(
    'move', v_move || jsonb_build_object('chain_void', v_void),
    'winner', v_home = 4,
    'again', v_extra);
end;
$function$;

revoke execute on function public.ludo_state_init(integer, jsonb) from public, anon;
revoke execute on function public.ludo_roll(uuid) from public, anon;
grant execute on function public.ludo_roll(uuid) to authenticated;
revoke execute on function public.game_exec_ludo(uuid, smallint, boolean, jsonb) from public, anon, authenticated;
