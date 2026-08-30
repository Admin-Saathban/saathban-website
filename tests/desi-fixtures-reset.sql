/* ════════════════════════════════════════════════
   Reset the five desi positions — run this IMMEDIATELY before
   tests/desi-rules-played.mjs, every time.

   WHY IT IS NEEDED EVERY RUN, not just the first. LudoSession drives
   bot seats itself: it calls game_tick whenever the current seat is a
   bot, regardless of any clock. So merely OPENING one of these tables
   plays it on, and by the end of a run all five boards have moved.
   The next run then finds four advanced boards and reports the
   fixtures wrong — which is the guard working, not the rules
   breaking, and it has now cost two lanes an hour each.

   WHY IT IS SQL AND NOT PART OF THE SUITE. Setting a position means
   writing game_sessions.state, which a seated player may not do. RLS
   refuses it, correctly, and that refusal is itself covered by
   tests/undo.mjs and the leave suite. So this runs on the DB channel
   (service credentials or the Supabase MCP), and the suite stays a
   thing a player could do.

   The positions here must stay identical to tests/desi-fixtures.json.
   If you change one, change both — the suite reads the JSON and
   verifies every board against it before judging any rule, so a
   disagreement between these two files fails loudly rather than
   quietly reporting a broken rule.

   turn_seconds is set to 600 so the clock cannot consume a fixture
   while somebody is looking at it.
   ════════════════════════════════════════════════ */

with base as (
  select '{"last":null,"chain":0,
           "rules":{"exact_home":true,"safe_squares":"standard",
                    "extra_roll_on_six":true,"capture_before_home":false},
           "ruleset":"desi","dice_count":1,"pairs_moved":{}}'::jsonb as s
),
f(id, patch) as (
  values
  /* virgin_jota — two of seat 0's gotis stacked on 10, never moved as
     a pair, and a 4 in hand: the board must ASK which was meant. */
  ('99b977d9-09eb-4e86-b860-c6534283415b'::uuid,
   '{"pieces":[[10,10,0,0],[30,0,0,0],[0,0,0,0],[0,0,0,0]],
     "pairs_moved":{},
     "dice":[{"v":4,"used":false,"wasted":false}]}'::jsonb),

  /* moved_jota_even — the same stack, already moved as a pair, on an
     EVEN die: the pair may move. */
  ('be39bd40-774f-4a15-9fb4-84312fed764e'::uuid,
   '{"pieces":[[10,10,0,0],[30,0,0,0],[0,0,0,0],[0,0,0,0]],
     "pairs_moved":{"0:10":true},
     "dice":[{"v":4,"used":false,"wasted":false}]}'::jsonb),

  /* moved_jota_odd — the same stack and history on an ODD die: the
     pair may not, and the board must offer nothing. */
  ('c044e183-16f1-4eec-a719-9a46d8021316'::uuid,
   '{"pieces":[[10,10,0,0],[30,0,0,0],[0,0,0,0],[0,0,0,0]],
     "pairs_moved":{"0:10":true},
     "dice":[{"v":3,"used":false,"wasted":false}]}'::jsonb),

  /* sixes_chain — two sixes standing and a third in hand. Three is
     the cliff, not a triumph, and the board must say so. */
  ('70068036-79c2-432a-a3ac-aa68bb63751c'::uuid,
   '{"pieces":[[10,0,0,0],[30,0,0,0],[0,0,0,0],[0,0,0,0]],
     "pairs_moved":{},"chain":2,
     "dice":[{"v":6,"used":false,"wasted":false}]}'::jsonb),

  /* two_dice — BOTH dice must be drawn. dice_count alone is not the
     test: the suite counts the die faces on screen, so the position
     needs two ROLLED dice, not the setting that would produce them. */
  ('00fb742f-72f3-4a60-945b-b07c1aa36245'::uuid,
   '{"pieces":[[10,20,0,0],[30,0,0,0],[0,0,0,0],[0,0,0,0]],
     "pairs_moved":{},"dice_count":2,
     "dice":[{"v":3,"used":false,"wasted":false},
             {"v":5,"used":false,"wasted":false}]}'::jsonb)
)
update public.game_sessions g
set state = (select s from base) || f.patch,
    status = 'active',
    current_seat = 1,
    winner_seat = null,
    finished_at = null,
    turn_started_at = now(),
    house_rules = coalesce(g.house_rules, '{}'::jsonb) || jsonb_build_object('turn_seconds', 600)
from f
where g.id = f.id
returning g.id, g.status, g.state -> 'pieces' as pieces, g.state -> 'dice' as dice;
