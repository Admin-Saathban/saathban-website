/* ════════════════════════════════════════════════
   The two writes a snakes table needs that the shared games rails do
   not have: setting the table, and taking a colour.

   Both go through SECURITY DEFINER functions (0105) rather than
   through an UPDATE, for the reason this codebase keeps relearning:
   an UPDATE that no policy allows returns success and changes
   nothing. PostgREST answers 204, the client sees error: null, and
   the screen carries on as though the write landed. A function
   raises, and a raise is something a person can be told about.

   They live here rather than in lib/games.js because that file is the
   shared rails every game reads, and these two are snakes-only.
   ════════════════════════════════════════════════ */

import { supabase } from "../../../lib/supabase.js";
import { buildBoard } from "./design.js";

/* The host sets how many people, how many snakes, how many ladders.
   The BOARD is sent with them: the client builds it from the ordered
   pools so there is one implementation of "which snakes", and the
   server checks it is playable before storing it. */
export async function setTable(sessionId, { players, snakes, ladders }) {
  const board = buildBoard({ snakes, ladders });
  const { error } = await supabase.rpc("snakes_set_table", {
    p_session: sessionId,
    p_players: players,
    p_snakes: snakes,
    p_ladders: ladders,
    p_board: board.jumps,
  });
  if (error) throw error;
  return board;
}

/* A player takes a colour for their own seat. Refused if somebody
   else at the table already holds it — first to sit down keeps it,
   which is the rule a room would use. */
export async function pickColor(sessionId, colorIdx) {
  const { error } = await supabase.rpc("snakes_pick_color", {
    p_session: sessionId,
    p_color: colorIdx,
  });
  if (error) throw error;
}
