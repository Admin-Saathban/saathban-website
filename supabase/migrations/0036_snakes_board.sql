-- ============================================================================
-- 0036 — Snakes & Ladders: a board that plays fairly (games lane).
--
-- The 0035 map broke two rules the board game itself depends on:
--
--   * `when 1 then 38` — a ladder with its foot on square 1. A player
--     is carried off the start before they have really begun, and the
--     opening roll stops mattering.
--   * `when 80 then 100` — a ladder whose top IS the winning square.
--     Snakes & Ladders finishes on an EXACT 100 (game_exec_snakes
--     refuses to overshoot); a ladder onto 100 quietly bypasses that,
--     so the tense last few rolls the rule exists to create never
--     happen.
--
-- It was also lopsided: three snakes dropped 38, 43 and 63 squares
-- while two others dropped 3 and 4 — barely visible as snakes at all.
--
-- This replaces the map. Nothing on 1 or 100; ladders climb, snakes
-- drop; all 38 squares distinct, which makes it impossible for a
-- square to host two jumps or for one jump to feed another (no
-- chains); snakes mostly 6-14 with exactly two long ones (30 and 35).
--
-- Function replacement only — no table changes, no data migration.
-- Sessions in flight keep playing and simply see the corrected board.
-- The same map lives in src/app/routes/games/snakes/board.js, and
-- tests/snakes-board.mjs checks both against one shared contract so
-- they cannot drift.
-- ============================================================================

create or replace function public.snakes_board_jump(p_cell integer)
returns integer
language sql
immutable
as $$
  select case p_cell
    -- ladders (foot → top)
    when 4 then 25 when 13 then 46 when 27 then 38 when 33 then 52
    when 42 then 63 when 50 then 69 when 62 then 81 when 74 then 92
    when 85 then 97
    -- snakes (head → tail)
    when 17 then 8 when 24 then 15 when 36 then 22 when 45 then 32
    when 54 then 19 when 60 then 51 when 71 then 65 when 88 then 58
    when 94 then 87 when 96 then 90
    else p_cell
  end;
$$;
