/* ════════════════════════════════════════════════
   Tapping a game opens a table — GAMES_IMMERSION_SPEC §8.

   "Tapping a game goes straight to a table, seats filled with bots,
   dice ready. No form."

   WHAT ACTUALLY HAPPENED TO THE EARLIER INSTRUCTION, since §8 asks
   whether it landed or regressed: it landed HALF, and has not
   regressed since. Commit 7b1ff7a ("Games: one setup screen, and the
   board becomes the waiting room", 29 Aug) killed the lobby PAGE and
   moved waiting onto the board, exactly as it says. But it read the
   rest as "ONE compact setup screen" rather than "no screen" — its
   own words — so the form was never removed. Nothing took it away
   and put it back; the second half was never built.

   This is that second half. The defaults below are the ones the setup
   form itself used, so a table opened this way is the table the form
   would have made if you had pressed Start without touching anything
   — which is what almost everybody did.

   Everything the form asked is still changeable, at the table, by
   tapping the thing itself. That is §8's other half and it belongs
   there rather than in front.
   ════════════════════════════════════════════════ */

import { createSession, startWithBots } from "../../lib/games.js";

/* Seats a game opens with when nobody has said otherwise. Carrom is
   always two; the others are four, because a ludo board with two
   empty quadrants looks like a game someone left. */
const DEFAULT_SEATS = { ludo: 4, snakes: 4, carrom: 2 };

/* The house rules the form would have produced untouched. Kept HERE
   rather than read from the form so that deleting the form later
   cannot silently change what a table is. */
function defaultHouseRules(gameKey) {
  const house = { table_theme: "classic" };
  if (gameKey === "ludo") {
    house.dice_count = 1;
    /* Written explicitly, not left to a default: game_tick's own
       fallback governs tables whose house_rules lack the key, and a
       board counting 30 while the server waits on a different number
       shows a clock that lies. Both are 30 now (0091) and this keeps
       them agreeing even if one of them moves again. */
    house.turn_seconds = 30;
  }
  return house;
}

/* Open a table and hand back where to go.

   FOR LUDO AND SNAKES, bots fill every seat that is not yours and
   the board is playable the moment it appears — §8's "dice ready".

   FOR CARROM IT IS NOT, and this comment used to say otherwise.
   Carrom's timeout_style is 'pass_turn': start_with_bots refuses
   it outright, because a carrom table with a bot in it could never
   finish. So tapping carrom opens a table that WAITS FOR A PERSON
   — one seat, yours, and an invitation to send. That is not a
   degraded ludo table, it is what carrom is.

   Do not write "the board is playable on arrival" anywhere a
   person will read it without naming the game. Lane 38 quoted the
   old version of this comment into their own file and had to
   correct it there too; a confident sentence about behaviour the
   code does not have travels further than the code does.

   Throws on failure rather than returning null: the caller is about
   to navigate, and navigating to a table that does not exist is
   worse than staying put with an error. */
export async function openQuickTable(gameKey) {
  const seats = DEFAULT_SEATS[gameKey] || 4;
  const id = await createSession(gameKey, seats, defaultHouseRules(gameKey), null);
  if (!id) throw new Error("no session");

  /* Seat the bots. THIS FAILS BY DESIGN FOR CARROM — start_with_bots
     raises "This game is played between people" for any game whose
     timeout_style is 'pass_turn' — and the catch below is what lets
     carrom open at all.

     So the catch is not defensive padding against an unlikely
     error; it is the carrom path, taken every single time anybody
     taps carrom. It was written as though it were the former,
     which is why the table it leaves behind went unexamined until
     an invitation to one of its seats failed (0098). */
  try {
    await startWithBots(id);
  } catch {
    /* the table opens as a waiting room — for carrom, the only room
       it has. The seats are filled by invitation from the table. */
  }

  /* The board glows the row it just made, the way the form's tables
     did. Same key, so the effect is unchanged. */
  try {
    sessionStorage.setItem("saathban.app.freshTable", id);
  } catch {
    /* storage off — no glow, no harm */
  }

  return gameKey === "ludo" ? `/app/games/ludo/${id}` : `/app/games/s/${id}`;
}
