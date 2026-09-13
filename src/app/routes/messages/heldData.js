/* ════════════════════════════════════════════════
   What the Messages world already knows — held, so a tab draws at once.

   The owner: Requests, Menu and New chat each took about a second to
   show anything. Every one of them mounted with null, drew "···", asked
   the server, and only then drew the screen — on the second visit
   exactly as on the first, because nothing survived the unmount.

   Now each keeps the last answer twice over:
   · IN MEMORY, for the rest of the session, so moving between tabs is a
     redraw and not a wait;
   · IN A PER-PERSON COPY (lib/offline.js), so the first visit after the
     app is opened again draws from what was last seen.
   The screen draws from whichever is there, then asks the server and
   replaces it quietly. And the world warms all three a moment after it
   opens (warmMessages), so even a first visit usually finds them held.

   PRIVACY, the offline.js rules: every copy is keyed by the signed-in
   person's id and never read for anybody else, and the prefix below is
   listed in SIGNED_IN_CACHE_PREFIXES, so signing out takes every copy
   with it. What is held is what that person's own screens showed them.
   ════════════════════════════════════════════════ */

import { readUserCache, writeUserCache } from "../../lib/offline.js";
import { fetchMessageRequests } from "../community/communityData.js";
import { fetchMyPeople } from "../people/myPeopleStore.js";
import { friendsInCommon, fetchMessageSettings } from "./messagesData.js";

/* Listed in lib/supabase.js SIGNED_IN_CACHE_PREFIXES — keep them in step. */
export const MESSAGES_CACHE_PREFIX = "saathban.app.messages.";

const mem = {};        // kind -> { uid, data }
const inflight = {};   // kind|uid -> promise, so the warm-up and a screen never ask twice

export function heldFor(kind, myId) {
  if (!myId) return null;
  const m = mem[kind];
  if (m && m.uid === myId) return m.data;
  const c = readUserCache(`${MESSAGES_CACHE_PREFIX}${kind}.`, myId);
  if (c && c.data != null) {
    mem[kind] = { uid: myId, data: c.data };
    return c.data;
  }
  return null;
}

/* Written only on a successful read or a change the person just made —
   a failed refresh never replaces what they were looking at. */
export function holdFor(kind, myId, data) {
  if (!myId) return;
  mem[kind] = { uid: myId, data };
  writeUserCache(`${MESSAGES_CACHE_PREFIX}${kind}.`, myId, data);
}

export function forgetHeld() {
  for (const k of Object.keys(mem)) delete mem[k];
}

function once(kind, myId, run) {
  const key = `${kind}|${myId}`;
  if (!inflight[key]) inflight[key] = run().finally(() => { delete inflight[key]; });
  return inflight[key];
}

/* Requests with their friends-in-common counts, as the screen draws them. */
export function loadRequests(myId) {
  return once("requests", myId, async () => {
    const rows = await fetchMessageRequests(myId);
    const pairs = await Promise.all(
      rows.map(async (r) => [r.id, await friendsInCommon(myId, r.senderId).catch(() => 0)])
    );
    const data = { rows, common: Object.fromEntries(pairs) };
    holdFor("requests", myId, data);
    return data;
  });
}

/* The people a new chat can be with straight away. */
export function loadPeople(myId) {
  return once("people", myId, async () => {
    const rows = (await fetchMyPeople()) || [];
    holdFor("people", myId, rows);
    return rows;
  });
}

export function loadSettings(myId) {
  return once("settings", myId, async () => {
    const s = await fetchMessageSettings(myId);
    holdFor("settings", myId, s);
    return s;
  });
}

/* A moment after the world opens: fetch what the other tabs will need,
   so a first tap on them finds it held. Failures are silent — each
   screen still asks for itself. Resolves to the requests (for the
   badge), or null. */
export function warmMessages(myId) {
  if (!myId) return Promise.resolve(null);
  return Promise.allSettled([loadRequests(myId), loadPeople(myId), loadSettings(myId)])
    .then(([r]) => (r.status === "fulfilled" ? r.value : null));
}
