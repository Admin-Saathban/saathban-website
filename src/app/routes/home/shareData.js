/* ════════════════════════════════════════════════
   What "Share today" actually does.

   Until now it did nothing. Two of the four destinations raised a
   toast claiming the score had been shared and wrote nothing at all;
   the third copied a hardcoded URL that was the same for everybody,
   showed nothing, and promised to expire after seven days.

   Every function here performs the thing its name claims, and returns
   enough for the caller to say which destination it went to — never a
   bare "shared".
   ════════════════════════════════════════════════ */

import { supabase } from "../../lib/supabase.js";
import { createShare } from "../community/communityData.js";


/* Absolute, because it is going into somebody else's messaging app. */
export function sharedScoreUrl(token) {
  const origin =
    typeof window !== "undefined" && window.location ? window.location.origin : "";
  return `${origin}/app/s/${token}`;
}

/* ── The community board ──
   post_type 'score' has been allowed since 0018 and the feed already
   renders it; the payload is a snapshot, so the card keeps saying what
   it said on the day. Score level only — never notes, mood or
   medication (SPEC.md). */
export async function shareScoreToCommunity(userId, { points, logs, day }) {
  return createShare(userId, "score", null, { points, logs, day });
}

/* ── The people who would want to know ──

   The count comes back from the server because it is the only place
   that knows it. Fanning out from here with social_notify_kind and
   counting the calls that did not error counts sends that never
   happened: that function returns void and its INSERT is conditional
   on the recipient's own notification setting, so a muted recipient
   yields a perfectly successful call and no row. 0115 returns the
   number of rows actually written. */
export async function shareScoreWithPeople({ points, logs, day, name, title, body }) {
  const token = await createScoreShareLink({ points, logs, day });
  const { data, error } = await supabase.rpc("share_score_with_people", {
    p_title: title || (name ? `${name} shared today` : "A friend shared their day"),
    p_body: body || null,
    p_link: sharedScoreUrl(token),
  });
  if (error) throw new Error(error.message);
  return { sent: Number(data) || 0, token };
}

/* ── A link that expires ──
   0114. Minting is idempotent by design: a live link is refreshed and
   handed back, so pressing the button again does not scatter extra
   windows into someone's day that would each need revoking. */
export async function createScoreShareLink({ points, logs, day }) {
  const { data, error } = await supabase.rpc("create_score_share_link", {
    p_payload: { points, logs, day },
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No link came back");
  return data;
}

/* Read by a stranger, so this must work with no session at all.
   Returns null for a token that is missing, expired or revoked — the
   three are indistinguishable on purpose. */
export async function fetchSharedScore(token) {
  const { data, error } = await supabase.rpc("read_share_link", { p_token: token });
  if (error) throw new Error(error.message);
  return data || null;
}
