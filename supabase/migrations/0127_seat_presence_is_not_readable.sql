/* ═══════════════════════════════════════════════════════════════
   0127 — seat presence is not readable directly

   The app reads a table's seats through game_table_seats and a person's
   live table through person_in_game (0126). This closes the direct read
   of the two presence columns, so hidden presence cannot be fetched from
   game_seats by anyone who views the table. Game functions (game_tick,
   exec_game_move, play_turn, …) run as their owner and are unaffected.
   ═══════════════════════════════════════════════════════════════ */

revoke select on public.game_seats from authenticated, anon;
grant select (id, session_id, seat_no, profile_id, is_bot, missed_turns, score, joined_at, left_by)
  on public.game_seats to authenticated;
