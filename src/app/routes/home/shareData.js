/* ════════════════════════════════════════════════
   Reading a shared day link — /app/s/:token.

   The score card that minted these links is gone with points. Links
   already sent keep working until they expire, so the reader stays;
   nothing in the app creates a new one.
   ════════════════════════════════════════════════ */

import { supabase } from "../../lib/supabase.js";

/* Read by a stranger, so this must work with no session at all.
   Returns null for a token that is missing, expired or revoked — the
   three are indistinguishable on purpose. */
export async function fetchSharedScore(token) {
  const { data, error } = await supabase.rpc("read_share_link", { p_token: token });
  if (error) throw new Error(error.message);
  return data || null;
}
