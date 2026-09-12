/* ════════════════════════════════════════════════
   THE GAMES ARE RESTING — one list, and every door reads it.

   Owner decision (2026-09-12): Ludo and Snakes & Ladders are
   deprioritised so the core app can be finished. NOTHING IS DELETED.
   The engines, the boards, the routes, the tables and the migrations
   are all exactly where they were, and turning them back on is
   removing two strings from PARKED below.

   WHY A LIST RATHER THAN A FLAG PER DOOR. There are eleven ways into a
   game in this app — the tile, the resume card, the tables-you-left
   row, join-by-code, a seat link, a claim link, a shared result, a
   "your move" chip on two dashboards, a person's presence row, a
   message that carries a table, and the deep links themselves. Parking
   each one in its own file is eleven chances to miss one, and the one
   that is missed is the one that opens a board nobody is maintaining.
   Every door asks this module instead.

   AND THE DATA IS NOT TOUCHED. A live table stays live in the
   database, with its seats, its moves and its chat; it simply has no
   door on the screen. If a game comes back, the table it was at is
   still there. Parking a feature is not the same act as ending
   somebody's game, and only one of those is reversible.

   The Daily Riddle is not here and must not be: it is its own surface,
   it has no table and no seats, and it stays open.
   ════════════════════════════════════════════════ */

/* The two game keys, as they are in the `games` table. */
export const PARKED = ["ludo", "snakes"];

export function isParkedGame(key) {
  return !!key && PARKED.includes(key);
}

/* The paths that ARE a parked game, judged on the URL alone — which is
   what a router guard has and a deep link arrives as. A session URL
   (/app/games/s/<id>) is deliberately absent: the path does not say
   which game it is, so SessionPage asks once it has the row. */
export function isParkedPath(pathname) {
  if (typeof pathname !== "string") return false;
  return PARKED.some(
    (k) =>
      pathname === "/app/games/" + k ||
      pathname.startsWith("/app/games/" + k + "/") ||
      pathname === "/app/games/new/" + k ||
      pathname.startsWith("/app/games/new/" + k + "/")
  );
}

/* Where a parked door sends somebody: the games screen, saying why.
   Not a 404 and not a crash — the flag is what turns the note on, and
   it is read and dropped by GamesHome so a reload does not repeat it. */
export const RESTING_TO = "/app/games?resting=1";

/* Drop every row that belongs to a parked game. Used on `sessions`,
   `leftTables` and the "your move" chips alike — they are all lists of
   rows carrying a `game_key`. */
export function withoutParked(rows, key = "game_key") {
  return (rows || []).filter((r) => !isParkedGame(r?.[key]));
}
