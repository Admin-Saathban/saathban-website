-- ============================================================================
-- 0045 — the safe squares move one step, from the user's marked board
--
-- The user marked up a screenshot of the board and circled eight cells as the
-- stop positions. The image is the authority and overrides the earlier
-- convention.
--
-- HOW THE CELLS WERE READ, because eyeballing a photograph is not evidence.
-- Each circle was located by pixel, converted through the board's grid and
-- the screenshot's point-of-view rotation, and then checked two ways:
--
--   * every circle is exactly ONE TRACK STEP FORWARD of a mark already drawn;
--   * the resulting set is rotationally symmetric — 1, 14, 27, 40 and
--     9, 22, 35, 48, each pair thirteen apart, one of each per arm.
--
-- A misreading would not come out symmetric, and it would not come out
-- uniformly +1. Mapping the set back to pixels put every predicted circle
-- within ~15px of a mark on the image.
--
--   was:  0, 13, 26, 39   (the start squares)  +  8, 21, 34, 47
--   now:  1, 14, 27, 40                        +  9, 22, 35, 48
--
-- WHAT THIS CHANGES FOR A PLAYER, stated plainly because it is not cosmetic:
-- **the start squares are no longer safe.** A token coming out of the yard
-- lands on a capturable cell and reaches safety one step later. The opening
-- plays differently — bringing a token out is now a small risk rather than a
-- free move. That is what the marks say.
--
-- APPLIED GLOBALLY, not gated on ruleset. The board draws these squares; an
-- engine that protected different ones would be showing a person a star and
-- then taking their token off it, which is worse than any inconsistency
-- between old and new tables. (Checked with the registrar: the only live ludo
-- tables are two fixtures, so no real game changes underneath anyone.)
--
-- ALSO FIXED HERE, found by lane -42 while reviewing this change: the
-- `safe_squares` house rule had no default. `p_rules->>'safe_squares'` is NULL
-- when the key is absent, so the whole predicate went NULL — no square safe —
-- while the board's own check defaults to 'standard' and kept drawing the
-- stars. It happens to agree today because the engine is called with
-- `state.rules`, which ludo_start freezes WITH the key. But anything calling
-- it with `house_rules` (which live rows genuinely lack) would silently lose
-- every safe square while the stars stayed on the board. Defaulted to
-- 'standard' so the two cannot drift.
-- ============================================================================

create or replace function public.ludo_is_safe(p_abs integer, p_rules jsonb)
returns boolean
language sql
immutable
as $function$
  select coalesce(p_rules ->> 'safe_squares', 'standard') = 'standard'
     and p_abs in (1, 9, 14, 22, 27, 35, 40, 48);
$function$;
