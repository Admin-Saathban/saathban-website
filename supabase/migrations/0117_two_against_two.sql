-- ════════════════════════════════════════════════
-- TWO AGAINST TWO, and the rules that come with it.
--
-- The toggle has existed in the setup room for several rounds and did
-- nothing whatever. Two reasons, and the second is the interesting
-- one:
--
--   1. Nothing in the engine paired seats.
--   2. `teams` COULD NOT REACH THE ENGINE AT ALL. ludo_rules() builds
--      a fixed object of four keys from the house rules, and
--      ludo_state_init() freezes the game's rules by calling it — so
--      house_rules.teams was written by the setup room, stored on the
--      session, and then dropped on the floor at the moment the game
--      started. A switch whose value is filtered out one function
--      later is not a half-built feature, it is a switch wired to
--      nothing, and no amount of work further down would have shown
--      anything.
--
-- WHO IS WHOSE PARTNER. Seats across the board: 0 with 2, 1 with 3.
-- Only at a four-seat table, because two against two needs four
-- people — at any other size ludo_teams() is false and every function
-- below behaves exactly as it did before this migration.
--
-- ─── THE FOUR RULES, AND WHERE EACH ONE LIVES ───
--
-- PARTNERS CANNOT TAKE EACH OTHER, and more than that: a move that
-- would land on a partner is not offered. Refusing the capture alone
-- would leave the move on the list and then make it do nothing, which
-- is a worse lie than not offering it. (ludo_desi_legal, ludo_desi_apply)
--
-- SHARED NUMBERS, ONCE BOTH HAVE TAKEN SOMEBODY. Until then each
-- player moves only their own gotis. After it, either partner's roll
-- may move either partner's goti. The condition is read from
-- captured_by, which the engine already maintained for the
-- capture-before-home rule — no new state. (ludo_shared)
--
-- MIXED JOTAS, AFTER SHARING. Two gotis of the two partner colours on
-- one square, moving as one for half an even number, exactly like a
-- jota of one colour. Before sharing they simply stand on the same
-- square as two separate gotis, and an attacker takes one of them.
--
-- A JOTA IS BROKEN ONLY BY A JOTA. This is now one rule rather than
-- four cases: an attack succeeds when the arriving stack is at least
-- as tall as the standing stack. One takes one; two takes one; two
-- takes two; one cannot take two.
--
--   THAT LAST COMPARISON FIXES A BUG THAT PREDATES TEAMS. The old
--   test was `(enemy = 1 and not pair) or (enemy >= 2 and pair)`,
--   which is not "at least as tall" — it says a JOTA LANDING ON A
--   LONE GOTI DOES NOT TAKE IT. Two of your pieces would arrive on
--   top of one of somebody else's and politely leave it there. No
--   ludo anybody plays works that way, the rulebook could not have
--   been written to describe it, and it has been in the engine the
--   whole time.
--
-- ─── WHAT THIS DOES NOT DECIDE ───
--
-- WINNING IS UNCHANGED: the first player to bring all four gotis home
-- wins, and with teams on their partner has won with them. Whether a
-- team should instead play on until BOTH partners are home is a real
-- question with two defensible answers and the owner has not ruled on
-- it, so this migration does not invent one. QUESTIONS.md.
-- ════════════════════════════════════════════════

-- ── teams reaches the engine ────────────────────────────────────
create or replace function public.ludo_rules(p jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'extra_roll_on_six',   coalesce((p->>'extra_roll_on_six')::boolean, true),
    'capture_before_home', coalesce((p->>'capture_before_home')::boolean, false),
    'exact_home',          coalesce((p->>'exact_home')::boolean, true),
    'safe_squares',        case when p->>'safe_squares' = 'none' then 'none' else 'standard' end,
    -- The key this migration exists to let through. Defaults false,
    -- so every table ever created reads exactly as it did.
    'teams',               coalesce((p->>'teams')::boolean, false)
  );
$$;

comment on function public.ludo_rules(jsonb) is
  'The frozen rules of a table. EVERY RULE THE ENGINE READS MUST BE '
  'NAMED HERE — this function is the filter between what the setup '
  'room wrote and what the game can see, so a key that is missing '
  'from this object is a switch wired to nothing however carefully '
  'the rest of it is built. That is exactly what happened to teams.';

-- ── who is playing with whom ────────────────────────────────────
create or replace function public.ludo_teams(p_state jsonb, p_seats integer)
returns boolean language sql immutable as $$
  select p_seats = 4
     and coalesce((public.ludo_rules(p_state -> 'rules') ->> 'teams')::boolean, false);
$$;

create or replace function public.ludo_partner(p_state jsonb, p_seats integer, p_seat integer)
returns integer language sql immutable as $$
  -- Across the board, never beside you: 0 with 2, 1 with 3.
  select case when public.ludo_teams(p_state, p_seats) then (p_seat + 2) % 4 end;
$$;

-- Both partners have taken somebody, so the team's numbers are one
-- pool. Read from captured_by, which the engine already keeps.
create or replace function public.ludo_shared(p_state jsonb, p_seats integer, p_seat integer)
returns boolean language sql immutable as $$
  select case
    when public.ludo_partner(p_state, p_seats, p_seat) is null then false
    else coalesce((p_state -> 'captured_by' ->> p_seat)::boolean, false)
     and coalesce((p_state -> 'captured_by' ->>
                    ((p_seat + 2) % 4))::boolean, false)
  end;
$$;

-- The ring square a seat's step lands on, and back again. ludo_abs
-- has existed forever; this is its inverse, and a mixed jota cannot
-- be expressed without it — two partners standing together are on one
-- ABSOLUTE square and two different step numbers.
create or replace function public.ludo_p_of_abs(p_seat integer, p_abs integer)
returns integer language sql immutable as $$
  select case
    when p_abs is null then null
    when ((p_abs - p_seat * 13 + 52) % 52) + 1 between 1 and 51
      then ((p_abs - p_seat * 13 + 52) % 52) + 1
  end;
$$;

-- How many gotis of this seat — and, when asked, of its partner —
-- stand on one absolute square. This is the stack height that every
-- rule below is written in terms of.
create or replace function public.ludo_stack_at(
  p_board jsonb, p_seat integer, p_abs integer, p_partner integer)
returns integer language plpgsql immutable as $$
declare
  v_n int := 0;
  i int;
  p int;
begin
  if p_abs is null then return 0; end if;
  for i in 0 .. 3 loop
    p := (p_board -> p_seat ->> i)::int;
    if p between 1 and 51 and public.ludo_abs(p_seat, p) = p_abs then
      v_n := v_n + 1;
    end if;
  end loop;
  if p_partner is not null then
    for i in 0 .. 3 loop
      p := (p_board -> p_partner ->> i)::int;
      if p between 1 and 51 and public.ludo_abs(p_partner, p) = p_abs then
        v_n := v_n + 1;
      end if;
    end loop;
  end if;
  return v_n;
end;
$$;

-- ── a partner's pieces do not block you, and a mixed jota blocks ──
create or replace function public.ludo_walls(p_state jsonb, p_seat integer, p_seats integer)
returns integer[] language plpgsql immutable as $$
declare
  v_board jsonb;
  v_rules jsonb;
  v_out int[] := '{}';
  v_partner int;
  s int;
  a int;
begin
  if not public.ludo_is_desi(p_state) then
    return '{}';
  end if;
  v_board := public.ludo_board(p_state);
  v_rules := public.ludo_rules(p_state -> 'rules');
  v_partner := public.ludo_partner(p_state, p_seats, p_seat);

  -- By ABSOLUTE square and by TEAM, which is what lets a mixed jota
  -- stop somebody. Counting per seat, as this used to, would see two
  -- partners standing together as two lone gotis and let an opponent
  -- walk through a wall that is plainly there on the board.
  for a in 0 .. 51 loop
    if public.ludo_is_safe(a, v_rules) then continue; end if;
    for s in 0 .. p_seats - 1 loop
      if s = p_seat or (v_partner is not null and s = v_partner) then continue; end if;
      -- Each opposing team counted once, from its lower seat.
      if v_partner is not null and s >= 2 then continue; end if;
      if public.ludo_stack_at(
           v_board, s, a,
           case when v_partner is not null then (s + 2) % 4 end) >= 2 then
        v_out := v_out || a;
        exit;
      end if;
    end loop;
  end loop;
  return v_out;
end;
$$;

-- ── what may be moved, and where it may land ────────────────────
create or replace function public.ludo_desi_legal(
  p_state jsonb, p_seat integer, p_seats integer, p_die integer)
returns jsonb language plpgsql immutable as $$
declare
  v_board jsonb := public.ludo_board(p_state);
  v_rules jsonb := public.ludo_rules(p_state -> 'rules');
  v_desi boolean := public.ludo_is_desi(p_state);
  v_cbh boolean := (v_rules ->> 'capture_before_home')::boolean;
  v_exact boolean := (v_rules ->> 'exact_home')::boolean;
  v_partner int := public.ludo_partner(p_state, p_seats, p_seat);
  v_shared boolean := public.ludo_shared(p_state, p_seats, p_seat);
  v_out jsonb := '[]';
  v_owners int[];
  v_owner int;
  v_captured boolean;
  v_mate int;
  i int;
  p int;
  v_to int;
  v_stack int;
  v_pair boolean;
  v_moved boolean;
  v_abs int;
  v_abs_to int;
  v_can_split boolean;
begin
  -- ONCE BOTH PARTNERS HAVE TAKEN SOMEBODY, YOUR ROLL MOVES EITHER
  -- OF YOUR TEAM'S GOTIS. Before that the list is your own pieces
  -- only, exactly as it always was.
  v_owners := case when v_shared then array[p_seat, v_partner] else array[p_seat] end;

  foreach v_owner in array v_owners loop
    -- capture-before-home follows the goti's OWNER, because it is a
    -- statement about that player's own pieces going home.
    v_captured := coalesce((p_state -> 'captured_by' ->> v_owner)::boolean, false);
    -- Only a mixed jota needs the partner counted; before sharing,
    -- a stack is your own colour or it is not a stack.
    v_mate := case when v_shared then (v_owner + 2) % 4 end;

    for i in 0 .. 3 loop
      p := (v_board -> v_owner ->> i)::int;
      if p = 0 then
        if p_die = 6 and public.ludo_path_clear(p_state, v_owner, p_seats, 0, 1, false) then
          v_out := v_out || jsonb_build_array(jsonb_build_object(
            'piece', i, 'owner', v_owner, 'split', false, 'to', 1, 'kind', 'out'));
        end if;
        continue;
      end if;
      if p >= 57 then continue; end if;

      v_abs := case when p between 1 and 51 then public.ludo_abs(v_owner, p) end;
      v_stack := public.ludo_stack_at(v_board, v_owner, v_abs, v_mate);
      v_pair := v_desi and v_stack >= 2;
      v_moved := v_pair and public.ludo_pair_moved(p_state, v_owner, p);
      v_can_split := (not v_moved)
                     or (p >= 52)
                     or (v_abs is not null and public.ludo_is_safe(v_abs, v_rules));

      -- as a jota: half an even number, the two of them together
      if v_pair and p_die % 2 = 0 then
        v_to := p + p_die / 2;
        v_abs_to := case when v_to between 1 and 51 then public.ludo_abs(v_owner, v_to) end;
        if v_to <= 56
           and not (v_cbh and not v_captured and p <= 51 and v_to >= 52)
           -- A MIXED JOTA TRAVELS ONLY WHILE BOTH CAN STAND TOGETHER.
           -- The partner's goti has to have a step of its own on the
           -- square being moved to, and once the mover turns into its
           -- home column there is no such square. It splits there
           -- instead, which is what the board shows anyway.
           and (v_mate is null
                or public.ludo_stack_at(v_board, v_mate, v_abs, null) = 0
                or public.ludo_p_of_abs(v_mate, v_abs_to) is not null)
           and public.ludo_path_clear(p_state, v_owner, p_seats, p, v_to, true) then
          v_out := v_out || jsonb_build_array(jsonb_build_object(
            'piece', i, 'owner', v_owner, 'split', false, 'to', v_to, 'kind', 'pair'));
        end if;
      end if;

      -- alone
      if (not v_pair) or v_can_split then
        v_to := p + p_die;
        if v_to > 57 then
          if v_exact then v_to := null; else v_to := 57; end if;
        end if;
        v_abs_to := case when v_to between 1 and 51 then public.ludo_abs(v_owner, v_to) end;
        if v_to is not null
           and not (v_cbh and not v_captured and p <= 51 and v_to >= 52)
           -- YOU MAY NOT LAND ON YOUR PARTNER UNTIL YOUR NUMBERS ARE
           -- SHARED. After that the same landing forms a mixed jota,
           -- so it is offered rather than refused.
           and not (v_partner is not null and not v_shared and v_abs_to is not null
                    and public.ludo_stack_at(v_board, v_partner, v_abs_to, null) > 0)
           and public.ludo_path_clear(p_state, v_owner, p_seats, p, v_to, false) then
          v_out := v_out || jsonb_build_array(jsonb_build_object(
            'piece', i, 'owner', v_owner, 'split', v_pair, 'to', v_to, 'kind', 'single'));
        end if;
      end if;
    end loop;
  end loop;
  return v_out;
end;
$$;

-- ── and what happens when it lands ──────────────────────────────
-- The 7th parameter has a default, which would make the old 6-argument
-- version ambiguous rather than replaced. It has to go first.
drop function if exists public.ludo_desi_apply(jsonb, integer, integer, integer, integer, boolean);

create or replace function public.ludo_desi_apply(
  p_state jsonb, p_seat integer, p_seats integer, p_piece integer,
  p_die integer, p_split boolean, p_owner integer default null,
  out o_state jsonb, out o_capture boolean, out o_finished boolean, out o_kind text)
returns record language plpgsql as $$
declare
  v_board jsonb := public.ludo_board(p_state);
  v_rules jsonb := public.ludo_rules(p_state -> 'rules');
  v_desi boolean := public.ludo_is_desi(p_state);
  v_exact boolean := (v_rules ->> 'exact_home')::boolean;
  v_owner int := coalesce(p_owner, p_seat);
  v_partner int := public.ludo_partner(p_state, p_seats, p_seat);
  v_shared boolean := public.ludo_shared(p_state, p_seats, p_seat);
  v_mate int;
  v_from int;
  v_to int;
  v_abs_from int;
  v_abs_to int;
  v_pair boolean;
  v_att int;
  v_def int;
  v_partner_of_s int;
  i int;
  s int;
  v_op int;
  v_pairs jsonb := coalesce(p_state -> 'pairs_moved', '{}'::jsonb);
begin
  o_capture := false;
  o_finished := false;
  v_mate := case when v_shared then (v_owner + 2) % 4 end;
  v_from := (v_board -> v_owner ->> p_piece)::int;
  v_abs_from := case when v_from between 1 and 51 then public.ludo_abs(v_owner, v_from) end;
  v_pair := v_desi and not p_split and v_from > 0
            and public.ludo_stack_at(v_board, v_owner, v_abs_from, v_mate) >= 2;

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
  v_abs_to := case when v_to between 1 and 51 then public.ludo_abs(v_owner, v_to) end;

  v_board := jsonb_set(v_board, array[v_owner::text, p_piece::text], to_jsonb(v_to));

  if v_pair then
    -- Everything standing with it comes too: the second goti of your
    -- own colour, or your partner's, or both.
    for i in 0 .. 3 loop
      if i <> p_piece and (v_board -> v_owner ->> i)::int = v_from then
        v_board := jsonb_set(v_board, array[v_owner::text, i::text], to_jsonb(v_to));
        exit;
      end if;
    end loop;
    if v_mate is not null and v_abs_to is not null then
      for i in 0 .. 3 loop
        v_op := (v_board -> v_mate ->> i)::int;
        if v_op between 1 and 51 and public.ludo_abs(v_mate, v_op) = v_abs_from then
          v_board := jsonb_set(v_board, array[v_mate::text, i::text],
                               to_jsonb(public.ludo_p_of_abs(v_mate, v_abs_to)));
          v_pairs := (v_pairs - (v_mate || ':' || v_op))
                     || jsonb_build_object(
                          v_mate || ':' || public.ludo_p_of_abs(v_mate, v_abs_to), true);
          exit;
        end if;
      end loop;
    end if;
    v_pairs := (v_pairs - (v_owner || ':' || v_from))
               || jsonb_build_object(v_owner || ':' || v_to, true);
  else
    if v_from > 0 and public.ludo_stack_at(v_board, v_owner, v_abs_from, v_mate) < 2 then
      v_pairs := v_pairs - (v_owner || ':' || v_from);
    end if;
  end if;

  -- ── the fight ──
  if v_abs_to is not null and not public.ludo_is_safe(v_abs_to, v_rules) then
    -- How tall the arriving stack is: two if it is a jota of any
    -- colouring, one otherwise.
    v_att := case when v_pair then 2 else 1 end;
    for s in 0 .. p_seats - 1 loop
      if s = v_owner then continue; end if;
      -- YOUR PARTNER IS NEVER TAKEN. Not by you and not by the goti
      -- you are moving on their behalf.
      if v_partner is not null and (s = v_partner or s = v_mate) then continue; end if;
      if v_partner is not null and s = ((v_owner + 2) % 4) then continue; end if;

      v_partner_of_s := public.ludo_partner(p_state, p_seats, s);
      v_def := public.ludo_stack_at(v_board, s, v_abs_to, null);
      if v_def = 0 then continue; end if;
      -- The defending stack is the whole of what stands there for
      -- that team, so a mixed jota defends as two.
      if v_partner_of_s is not null then
        v_def := public.ludo_stack_at(v_board, s, v_abs_to, v_partner_of_s);
        -- counted once for the team, from its lower seat
        if s > v_partner_of_s then continue; end if;
      end if;

      -- AT LEAST AS TALL, and that is the whole rule. One takes one,
      -- two takes one, two takes two, one cannot take two.
      if v_att >= v_def then
        for i in 0 .. 3 loop
          v_op := (v_board -> s ->> i)::int;
          if v_op between 1 and 51 and public.ludo_abs(s, v_op) = v_abs_to then
            v_board := jsonb_set(v_board, array[s::text, i::text], '0'::jsonb);
            v_pairs := v_pairs - (s || ':' || v_op);
            o_capture := true;
          end if;
        end loop;
        if v_partner_of_s is not null then
          for i in 0 .. 3 loop
            v_op := (v_board -> v_partner_of_s ->> i)::int;
            if v_op between 1 and 51 and public.ludo_abs(v_partner_of_s, v_op) = v_abs_to then
              v_board := jsonb_set(v_board, array[v_partner_of_s::text, i::text], '0'::jsonb);
              v_pairs := v_pairs - (v_partner_of_s || ':' || v_op);
              o_capture := true;
            end if;
          end loop;
        end if;
      end if;
    end loop;
  end if;

  if v_to = 57 then o_finished := true; end if;

  if p_state ? 'prov' then
    o_state := jsonb_set(p_state, '{prov}', v_board);
  else
    o_state := jsonb_set(p_state, '{pieces}', v_board);
  end if;
  o_state := jsonb_set(o_state, '{pairs_moved}', v_pairs);
  if o_capture then
    -- Credited to the goti's OWNER, not the hand that moved it. The
    -- flag governs that player's own capture-before-home, and it is
    -- their piece that did it. Before sharing the two are the same
    -- seat anyway, so this only ever differs after the very thing it
    -- helps unlock has already happened.
    o_state := jsonb_set(o_state, array['captured_by', v_owner::text], 'true'::jsonb, true);
  end if;
end;
$$;

comment on function public.ludo_desi_apply(jsonb, integer, integer, integer, integer, boolean, integer) is
  'Lands a move. p_owner is the seat whose goti is being moved, which '
  'is the mover except when a team is sharing its numbers. Capture is '
  'decided by stack height alone: an arriving stack takes a standing '
  'one when it is at least as tall, so a jota is broken only by a '
  'jota and a jota landing on a lone goti does take it — which the '
  'previous version did not do.';
