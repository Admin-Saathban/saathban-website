-- ============================================================================
-- 0043 — Don't seat a bot at a game that has no bot player
--
-- Found by generalising the games lane's finding in 0042d: a two-phase turn
-- (roll, then act) has no answer for a player who cannot be authenticated,
-- because a bot has no profile_id. The same question asked of the other
-- games turns up the mirror defect.
--
-- `start_with_bots` filled every empty seat with a bot for ANY game. Carrom
-- has no bot player at all — its `timeout_style` is 'pass_turn', so when a
-- bot's turn comes round `game_tick` simply passes it on. A carrom table with
-- a bot in it is therefore unfinishable: the turn ping-pongs between the
-- human and a seat that can never take a shot, forever, with nothing in the
-- UI to explain why. The client already hid the "start with bots" button for
-- pass_turn games, but the RPC accepted the call regardless, and the client
-- is never the security boundary.
--
-- Four such tables existed on this project when the guard was written —
-- three of them ACTIVE, two of them sessions a person had reported as
-- "broken" without either of us knowing this was why.
--
-- The rule: a game may be filled with bots only if a bot can actually play
-- it. `timeout_style = 'pass_turn'` is the existing marker for "no bot
-- player" (0022 set it that way for carrom deliberately), so it is the
-- condition used here rather than a new column.
-- ============================================================================

create or replace function public.start_with_bots(p_session uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_timeout_style text;
  v_taken int;
  i int;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if s.created_by <> auth.uid() or s.status <> 'lobby' then
    raise exception 'Only the host can start, and only in the lobby';
  end if;

  -- A bot may only take a seat in a game a bot can actually play. For a
  -- pass_turn game (carrom) there is no bot player, so a bot seat would
  -- make the table unfinishable rather than merely quiet.
  select timeout_style into v_timeout_style from public.games where key = s.game_key;
  if v_timeout_style = 'pass_turn' then
    raise exception 'This game is played between people — invite someone, or open the table to the community';
  end if;

  select count(*) into v_taken from public.game_seats where session_id = p_session;
  for i in (v_taken + 1) .. s.seats_total loop
    insert into public.game_seats (session_id, seat_no, profile_id, is_bot)
    values (p_session, i, null, true);
  end loop;
  perform public.game_start_if_full(p_session);
end;
$$;

revoke execute on function public.start_with_bots(uuid) from public, anon;
grant execute on function public.start_with_bots(uuid) to authenticated;

-- ─── Remediation: the tables this already produced ───
-- A pass_turn table holding a bot seat cannot be finished by anyone. Calling
-- it off is the honest end state (0038's 'cancelled'): it leaves the lists
-- and reads as "called off" rather than sitting in someone's games list
-- forever waiting for a move that can never come. Finished tables are left
-- alone — they are history, and history is not rewritten here.
update public.game_sessions s
   set status = 'cancelled', current_seat = null, turn_started_at = null
 where s.status in ('lobby', 'active')
   and exists (select 1 from public.games g
                where g.key = s.game_key and g.timeout_style = 'pass_turn')
   and exists (select 1 from public.game_seats gs
                where gs.session_id = s.id and gs.is_bot);
