/* ════════════════════════════════════════════════
   0097 — rolling proves you are here

   THE OWNER'S OWN SEAT SAYS "BOT" WHILE HE IS PLAYING. His plate
   reads "admi… BOT" and the board announces "admin test stepped away
   — a bot is playing their seat" while he is sitting there looking
   at it.

   It is not away-detection misfiring. It is away-detection that
   NEVER TURNS OFF for ludo.

   game_tick marks a seat 'away' after three missed turns, which is
   right — a table must not stall forever on somebody who has gone.
   But nothing in ludo's path ever puts it back. ludo_roll touches
   neither presence nor missed_turns; exec_game_move only READS
   presence, to decide who to notify. play_turn does reset it, which
   is why snakes and carrom never showed this — and why it looked
   like a ludo styling bug rather than a rails one.

   So the first three times the clock catches you — reading the
   board, taking a phone call, thinking — you are marked away, and
   you stay away for the rest of that game no matter how many turns
   you then play. Every one of the owner's finished ludo tables has
   his seat at presence='away', missed_turns=3. All of them. That is
   not a person who keeps walking off; that is a flag with no way
   back.

   IT COMPOUNDS, which is worth naming because it explains a second
   complaint. exec_game_move only sends the "your turn" notification
   when the next seat's presence = 'active'. Once wrongly marked
   away, a player also silently stops being told it is their move.

   THE FIX: acting proves presence. You cannot roll a die from
   another room. The reset goes at the top of ludo_roll, which is
   ludo's one entry point — every ludo turn begins with a roll, so
   there is no second door to guard.

   The function is restated whole from the live definition read
   immediately before this change. The only addition is the block
   marked NEW.
   ════════════════════════════════════════════════ */

create or replace function public.ludo_roll(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s public.game_sessions%rowtype;
  v_seat int;
  v_state jsonb;
  v_n int;
  v_d1 int;
  v_d2 int;
  v_six boolean;
  v_dice jsonb;
  v_desi boolean;
  v_any boolean := false;
  v_legal jsonb;
  i int;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.status <> 'active' or s.game_key <> 'ludo' then
    raise exception 'No game to roll in';
  end if;
  if not exists (
    select 1 from public.game_seats gs
    where gs.session_id = s.id and gs.seat_no = s.current_seat and gs.profile_id = auth.uid()
  ) then
    raise exception 'Not your turn';
  end if;
  if s.state ? 'dice' then
    raise exception 'You already rolled';
  end if;

  /* NEW (0097) — ROLLING PROVES YOU ARE HERE. Whoever is throwing
     this die is at the table by definition, so any 'away' the clock
     put on them is stale the moment they act. Without this the flag
     is one-way: three missed turns marks you, and nothing you do for
     the rest of the game takes it off. */
  update public.game_seats
  set presence = 'active', missed_turns = 0
  where session_id = s.id
    and seat_no = s.current_seat
    and profile_id = auth.uid()
    and (presence is distinct from 'active' or missed_turns <> 0);

  v_state := s.state;
  if not (v_state ? 'pieces') then
    v_state := public.ludo_state_init(s.seats_total, s.house_rules);
  end if;
  v_desi := public.ludo_is_desi(v_state);
  v_n := case when v_desi then coalesce((v_state ->> 'dice_count')::int, 1) else 1 end;
  v_seat := s.current_seat - 1;

  v_d1 := 1 + floor(random() * 6)::int;
  if v_n = 2 then v_d2 := 1 + floor(random() * 6)::int; end if;
  v_six := case when v_n = 2 then (v_d1 = 6 and v_d2 = 6) else v_d1 = 6 end;

  if v_desi then
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
    v_dice := v_dice || jsonb_build_array(jsonb_build_object('v', v_d2, 'used', false, 'wasted', false));
  end if;

  for i in 0 .. v_n - 1 loop
    v_legal := public.ludo_desi_legal(v_state, v_seat, s.seats_total, (v_dice -> i ->> 'v')::int);
    if jsonb_array_length(v_legal) > 0 then v_any := true; end if;
  end loop;

  if not v_any then
    v_state := public.ludo_resolve_chain(v_state);
    update public.game_sessions
    set state = jsonb_set(v_state - 'dice', '{last}', jsonb_build_object(
          'seat', v_seat, 'dice', v_dice, 'piece', null,
          'capture', false, 'skipped', true), true)
    where id = s.id;
    perform public.play_turn(s.id, '{"pass": true}'::jsonb);
    return jsonb_build_object('dice', v_dice, 'skipped', true);
  end if;

  update public.game_sessions
  set state = v_state || jsonb_build_object('dice', v_dice)
  where id = s.id;
  return jsonb_build_object('dice', v_dice, 'skipped', false,
                            'chain', coalesce((v_state ->> 'chain')::int, 0));
end;
$function$;

/* The tables people are sitting at right now carry the stale flag,
   and it will not clear itself until each of them happens to roll.
   Clear it for every LIVE seat: nobody at an unfinished table should
   be wearing a label this migration has just established was wrong.

   Finished tables are left exactly as they are — they are a record
   of what happened, not a screen anybody is looking at. */
update public.game_seats s
set presence = 'active', missed_turns = 0
from public.game_sessions g
where g.id = s.session_id
  and g.status in ('lobby', 'active')
  and not s.is_bot
  and (s.presence is distinct from 'active' or s.missed_turns <> 0);
