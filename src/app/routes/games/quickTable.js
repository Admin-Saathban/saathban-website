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

   Bots fill every seat that is not yours, immediately, so the board
   is playable the moment it appears — §8's "dice ready". A person
   who wants people instead invites them from the table, where the
   seat they are replacing is visible.

   Throws on failure rather than returning null: the caller is about
   to navigate, and navigating to a table that does not exist is
   worse than staying put with an error. */
export async function openQuickTable(gameKey) {
  const seats = DEFAULT_SEATS[gameKey] || 4;
  const id = await createSession(gameKey, seats, defaultHouseRules(gameKey), null);
  if (!id) throw new Error("no session");

  /* Seat the bots. If this fails the table still exists and still
     opens — it simply waits for people, which is the old behaviour
     rather than a broken one, so it is not worth refusing the
     navigation over. */
  try {
    await startWithBots(id);
  } catch {
    /* the table opens as a waiting room; the seats can be filled there */
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
