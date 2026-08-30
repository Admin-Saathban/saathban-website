-- ============================================================================
-- 0046 — the safe squares go back to the classic eight, because the RING was
-- what was wrong, not the safe rule
--
-- 0045 moved them to (1,9,14,22,27,35,40,48) from the cells the user circled.
-- The cells were read correctly; the conclusion drawn from them was not.
--
-- The user marked the board again, in green, to say where a goti must LEAVE
-- ITS YARD. Those four cells are each exactly TWO STEPS PAST their own arm own
-- tip when the ring is walked CLOCKWISE — and two steps past nothing at all
-- when walked the other way, which is how the board had it. Since 52 - 50 = 2,
-- "two past the tip" is precisely the condition for a token to arrive at its
-- own tip on its 51st step and turn into its home column head-on. So the ring
-- was one arm out of phase AND running backwards.
--
-- Re-phased and reversed (in board.js — the engine own arithmetic never
-- changed), those same eight marked cells become absolute
-- 0, 8, 13, 21, 26, 34, 39, 47: each seat start, and the square eight steps
-- on. The classic set. And the start squares are safe again, which is the
-- whole point of a start.
--
-- THE LESSON WORTH KEEPING: an off-by-one in a LIST looked like an unusual
-- house rule, and was really a symptom of the ring beneath it being wrong. A
-- mis-phased ring still plays perfectly well — tokens move a legal number of
-- squares, enter a home column, finish — so nothing catches it except somebody
-- looking at the board and saying "that is not where my goti comes out".
--
-- These eight are also the answer to "which squares may a jota rest on
-- whatever colour it is": the same eight, safe for everyone, always.
--
-- The coalesce default from 0045 stays. An absent safe_squares key used to
-- make this NULL — nothing safe anywhere — while the board went on drawing the
-- stars from its own default.
-- ============================================================================

create or replace function public.ludo_is_safe(p_abs integer, p_rules jsonb)
returns boolean
language sql
immutable
as $function$
  select coalesce(p_rules ->> 'safe_squares', 'standard') = 'standard'
     and p_abs in (0, 8, 13, 21, 26, 34, 39, 47);
$function$;
