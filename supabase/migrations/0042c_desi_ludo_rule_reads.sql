-- ============================================================================
-- 0042c — the rule functions are readable by a signed-in player
--
-- The rule functions are pure: they take a whole board as an argument, touch
-- no table, and hold no secret. Answering "what could this hypothetical board
-- do" reveals nothing about any real game, and the client already needs
-- ludo_desi_legal to draw a person's choices. Granting the rest lets the
-- ruleset be tested through the ordinary authenticated harness — the same
-- anon-key + password-grant path every other suite in tests/ uses — instead
-- of needing a privileged one that no other test has.
--
-- The real boundary is unmoved: game_exec_ludo, which mutates a session, stays
-- revoked from everyone but the rails.
--
-- (ludo_roll is NOT locked and never was — it is the ludo screen's own entry
-- point, called straight from ludoRails.js, and it is SECURITY DEFINER with
-- its own "is it your turn" check. Said here because I had it wrong in a
-- message to another lane, and a wrong premise about what is reachable is
-- exactly the kind of thing that goes on to justify a bad change.)
-- ============================================================================

grant execute on function public.ludo_board(jsonb) to authenticated;
grant execute on function public.ludo_is_desi(jsonb) to authenticated;
grant execute on function public.ludo_count_at(jsonb, int, int) to authenticated;
grant execute on function public.ludo_pair_moved(jsonb, int, int) to authenticated;
grant execute on function public.ludo_walls(jsonb, int, int) to authenticated;
grant execute on function public.ludo_path_clear(jsonb, int, int, int, int, boolean) to authenticated;
grant execute on function public.ludo_desi_apply(jsonb, int, int, int, int, boolean) to authenticated;
grant execute on function public.ludo_chain_stands(int) to authenticated;
grant execute on function public.ludo_resolve_chain(jsonb) to authenticated;
