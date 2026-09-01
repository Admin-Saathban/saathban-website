-- ════════════════════════════════════════════════
-- Reaching home earns another turn. So does a capture.
--
-- Both are standard in the Pakistani game and both were missing, in
-- different ways. HOME earned nothing at all. A CAPTURE earned
-- another turn at a one-die table and nothing at a two-dice one --
-- the two-dice branch computed v_extra from the sixes alone, so a
-- Desi table could take a goti clean off the board and then pass play
-- on, which is not the game anybody at that table thinks they are
-- playing.
--
-- The move record carries 'home' now as well, so the board can name
-- who reached it and throw the right colour of confetti at it. It was
-- already carrying 'capture'.
--
-- Everything else here is the function exactly as it stood.
-- ════════════════════════════════════════════════

create or replace function public.game_exec_ludo(
  p_session uuid, p_seat smallint, p_by_bot boolean, p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
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
  v_n int;
  v_d1 int;
  v_d2 int;
  v_any boolean := false;
  opt jsonb;
begin
  select * into s from public.game_sessions where id = p_session;
  v_state := s.state;
  v_seat := p_seat - 1;
  v_rules := public.ludo_rules(v_state -> 'rules');
  v_dice := v_state -> 'dice';

  -- A bot seat has no profile_id, so nobody can call ludo_roll for it.
  -- It rolls here instead, with the same arithmetic, chain and all.
  if v_dice is null and p_by_bot then
    if not (v_state ? 'pieces') then
      v_state := public.ludo_state_init(s.seats_total, s.house_rules);
      v_rules := public.ludo_rules(v_state -> 'rules');
    end if;
    v_n := case when public.ludo_is_desi(v_state)
                then coalesce((v_state ->> 'dice_count')::int, 1) else 1 end;
    v_d1 := 1 + floor(random() * 6)::int;
    if v_n = 2 then v_d2 := 1 + floor(random() * 6)::int; end if;
    v_six := case when v_n = 2 then (v_d1 = 6 and v_d2 = 6) else v_d1 = 6 end;

    if public.ludo_is_desi(v_state) then
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
      v_dice := v_dice ||
        jsonb_build_array(jsonb_build_object('v', v_d2, 'used', false, 'wasted', false));
    end if;

    for v_i in 0 .. v_n - 1 loop
      if jsonb_array_length(public.ludo_desi_legal(
           v_state, v_seat, s.seats_total, (v_dice -> v_i ->> 'v')::int)) > 0 then
        v_any := true;
      end if;
    end loop;

    if not v_any then
      v_state := public.ludo_resolve_chain(v_state);
      v_move := jsonb_build_object('seat', v_seat, 'dice', v_dice,
                                   'piece', null, 'capture', false, 'skipped', true);
      update public.game_sessions
      set state = jsonb_set(v_state - 'dice', '{last}', v_move, true)
      where id = p_session;
      return jsonb_build_object('move', v_move, 'winner', false, 'again', false);
    end if;

    v_state := v_state || jsonb_build_object('dice', v_dice);
    update public.game_sessions set state = v_state where id = p_session;
  end if;

  if v_dice is null then
    raise exception 'Roll first';
  end if;
  v_two := jsonb_array_length(v_dice) = 2;

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

  -- ANOTHER TURN: a six, a capture, or a goti reaching home.
  --
  -- The two-dice branch used to read v_extra := v_six alone, so a
  -- Desi table gave nothing for a capture. Home gave nothing at
  -- either kind of table.
  if v_two then
    v_six := (v_dice -> 0 ->> 'v')::int = 6 and (v_dice -> 1 ->> 'v')::int = 6;
    v_extra := v_six or v_res.o_capture or v_res.o_finished;
  else
    v_six := (v_dice -> 0 ->> 'v')::int = 6
             and coalesce((v_rules ->> 'extra_roll_on_six')::boolean, true);
    v_extra := v_six or v_res.o_capture or v_res.o_finished;
  end if;

  v_move := jsonb_build_object(
    'seat', v_seat, 'piece', v_piece, 'die', v_die, 'split', v_split,
    'kind', v_res.o_kind, 'capture', v_res.o_capture,
    -- so the board can name who got there and celebrate the right seat
    'home', v_res.o_finished,
    'chain', coalesce((v_state ->> 'chain')::int, 0),
    'provisional', v_state ? 'prov');

  if v_left then
    v_state := jsonb_set(v_state, '{last}', v_move, true);
    update public.game_sessions set state = v_state where id = p_session;
    return jsonb_build_object(
      'move', v_move || jsonb_build_object('dice_left', true),
      'winner', false, 'again', true);
  end if;

  v_state := v_state - 'dice';
  if not v_extra then
    v_state := public.ludo_resolve_chain(v_state);
  end if;
  v_void := coalesce((v_state ->> 'chain_void')::boolean, false);
  v_state := jsonb_set(v_state - 'chain_void', '{last}', v_move, true);
  update public.game_sessions set state = v_state where id = p_session;

  select count(*)::int into v_home
  from jsonb_array_elements_text(coalesce(v_state -> 'pieces', '[]'::jsonb) -> v_seat) v
  where v::int = 57;

  return jsonb_build_object(
    'move', v_move || jsonb_build_object('chain_void', v_void),
    'winner', v_home = 4,
    'again', v_extra);
end;
$function$;
