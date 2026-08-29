-- ============================================================================
-- 0035 — Race to 100 becomes Snakes & Ladders
--
-- Same rails, same engine contract (game_exec_<key>(session, seat, by_bot,
-- payload) → {move, winner}; game_seats.score is the position; the server
-- is the dice). What changes is the board: 100 cells, classic snakes and
-- ladders — landing on a ladder's foot climbs you to its top, landing on a
-- snake's head slides you to its tail — and the classic finish: you need
-- the exact roll to reach 100; a roll that would overshoot leaves you
-- where you are (recorded, turn passes, nobody loses anything).
--
-- The registry row is RENAMED (key race100 → snakes, names in both
-- languages) and existing sessions follow, so old tables still open —
-- their positions simply become positions on the new board.
--
-- The board map lives in exactly two places that must agree:
--   here (the executor)  ⇄  src/app/routes/games/snakes/board.js (the art)
-- ============================================================================

-- ─── 1. Registry rename (FK game_sessions.game_key → games.key) ───
insert into public.games (key, name_en, name_ur, tagline_en, tagline_ur, kind, min_seats, max_seats, timeout_style, enabled)
values (
  'snakes',
  'Snakes & Ladders',
  'سانپ سیڑھی',
  'Roll, climb the ladders, mind the snakes. First to land exactly on 100 wins.',
  'پانسہ پھینکیں، سیڑھیاں چڑھیں، سانپوں سے بچیں۔ جو پہلے ٹھیک 100 پر پہنچے وہ جیتا۔',
  'turns', 2, 4, 'bot_plays', true
)
on conflict (key) do update
  set name_en = excluded.name_en, name_ur = excluded.name_ur,
      tagline_en = excluded.tagline_en, tagline_ur = excluded.tagline_ur,
      enabled = true;

update public.game_sessions set game_key = 'snakes' where game_key = 'race100';
delete from public.games where key = 'race100';
drop function if exists public.game_exec_race100(uuid, smallint, boolean, jsonb);

-- ─── 2. The board: classic Milton Bradley layout ───
-- Ladders (foot → top) and snakes (head → tail), keyed by landing cell.
create or replace function public.snakes_board_jump(p_cell int)
returns int
language sql immutable
as $$
  select case p_cell
    -- ladders
    when 1 then 38 when 4 then 14 when 9 then 31 when 21 then 42 when 28 then 84
    when 36 then 44 when 51 then 67 when 71 then 91 when 80 then 100
    -- snakes
    when 16 then 6 when 47 then 26 when 49 then 11 when 56 then 53 when 62 then 19
    when 64 then 60 when 87 then 24 when 93 then 73 when 95 then 75 when 98 then 78
    else p_cell
  end;
$$;

-- ─── 3. The executor ───
create or replace function public.game_exec_snakes(
  p_session uuid, p_seat smallint, p_by_bot boolean, p_payload jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_roll   int;
  v_from   int;
  v_landed int;
  v_to     int;
  v_via    text;
begin
  select score into v_from
  from public.game_seats where session_id = p_session and seat_no = p_seat;

  -- The server IS the dice; the client payload carries nothing.
  v_roll := floor(random() * 6)::int + 1;

  if v_from + v_roll > 100 then
    -- Classic finish: an exact roll is needed. Stay put, turn passes.
    return jsonb_build_object(
      'move', jsonb_build_object(
        'roll', v_roll, 'from', v_from, 'landed', v_from, 'to', v_from,
        'via', null, 'stuck', true, 'need', 100 - v_from, 'score', v_from
      ),
      'winner', false
    );
  end if;

  v_landed := v_from + v_roll;
  v_to := public.snakes_board_jump(v_landed);
  v_via := case when v_to > v_landed then 'ladder'
                when v_to < v_landed then 'snake'
                else null end;

  update public.game_seats set score = v_to
  where session_id = p_session and seat_no = p_seat;

  return jsonb_build_object(
    'move', jsonb_build_object(
      'roll', v_roll, 'from', v_from, 'landed', v_landed, 'to', v_to,
      'via', v_via, 'stuck', false, 'score', v_to
    ),
    'winner', v_to = 100
  );
end;
$$;

revoke execute on function public.game_exec_snakes(uuid, smallint, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.snakes_board_jump(int) from public, anon;
grant execute on function public.snakes_board_jump(int) to authenticated;
