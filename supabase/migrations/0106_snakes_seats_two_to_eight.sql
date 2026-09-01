-- ============================================================================
-- 0106 — Snakes seats 2 to 8, and 0105's set_table corrected.
--
-- THREE THINGS 0105 GOT WRONG, all found by the database refusing the
-- very first table this lane tried to create.
--
-- 1. SEATS ARE 1-BASED. create_game_session seats the host at seat 1.
--    0105 generated seats from 0, which the seat_no check rejected
--    outright — the good case, because it failed loudly instead of
--    quietly creating a table numbered differently from every other
--    table in the app.
--
-- 2. AN EMPTY SEAT IS NOT A ROW. game_seats_check is
--    `is_bot = (profile_id is null)`, so a row with nobody in it must
--    declare itself a bot; there is no such thing as a blank seat
--    record. How many seats a table HAS is game_sessions.seats_total,
--    and rows appear as people claim them. 0105 inserted placeholder
--    rows, which is both illegal and the wrong model. It no longer
--    touches game_seats at all — it only moves seats_total, and the
--    setup room draws the empty chairs from the difference.
--
-- 3. THE TABLE ONLY SEATED FOUR. The owner asked for 2 to 8. Both the
--    CHECK constraint and the games registry capped it at 4, so
--    seats_total = 6 would have been accepted by 0105's own guard and
--    then refused by the row that tried to sit in seat 5 — which is
--    the worst shape of bug there is: a setting you can save and
--    cannot use.
--
-- Widening the CHECK is safe for the other games: each one's real cap
-- is games.min_seats/max_seats, which create_game_session enforces,
-- and ludo's stays 4.
-- ============================================================================

alter table public.game_seats drop constraint if exists game_seats_seat_no_check;
alter table public.game_seats add constraint game_seats_seat_no_check
  check (seat_no >= 1 and seat_no <= 8);

update public.games set max_seats = 8 where key = 'snakes';

create or replace function public.snakes_set_table(
  p_session uuid,
  p_players int,
  p_snakes  int,
  p_ladders int,
  p_board   jsonb
) returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_owner uuid; v_status text; v_game text; v_highest int;
begin
  select created_by, status, game_key into v_owner, v_status, v_game
  from public.game_sessions where id = p_session;

  if v_owner is null then raise exception 'no such table'; end if;
  if v_game <> 'snakes' then raise exception 'not a snakes table'; end if;
  if v_owner <> auth.uid() then raise exception 'only the host may set the table'; end if;
  if v_status <> 'lobby' then raise exception 'the game has already started'; end if;
  if p_players < 2 or p_players > 8 then raise exception 'a table seats 2 to 8'; end if;
  if not public.snakes_board_ok(p_board) then raise exception 'that board is not playable'; end if;

  -- The table may not be shrunk out from under somebody already in a
  -- high seat. Seats are 1-based, so seat_no IS the count needed.
  select coalesce(max(seat_no), 0) into v_highest
  from public.game_seats where session_id = p_session;
  if p_players < v_highest then
    raise exception 'somebody is already sitting in seat %', v_highest;
  end if;

  update public.game_sessions
     set seats_total = p_players,
         house_rules = coalesce(house_rules, '{}'::jsonb)
                       || jsonb_build_object('snakes', p_snakes,
                                             'ladders', p_ladders,
                                             'board', p_board),
         updated_at = now()
   where id = p_session;
end; $$;

revoke execute on function public.snakes_set_table(uuid, int, int, int, jsonb) from public, anon;
grant  execute on function public.snakes_set_table(uuid, int, int, int, jsonb) to authenticated;
