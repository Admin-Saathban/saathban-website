/* ════════════════════════════════════════════════
   The reconnect row — NAVIGATION_SPEC.md §4.3.

   Someone you have talked to before, quiet for two to three weeks, and
   AROUND RIGHT NOW. One at a time, once a week at most, inline in the
   feed.

   WHAT THIS ROW MUST NEVER DO, and it is the whole reason the rules are
   this fussy: PRODUCT_DECISIONS.md §5 says the app never tells you a
   named person has not done something. So there is no "you haven't
   spoken since the 4th", no "it's been three weeks", no quiet-days
   count, and nothing that reads as either person having neglected the
   other. The only sentence is that she is around today, which is an
   invitation rather than an accusation.

   The 14-day floor is therefore INTERNAL. It decides who to offer; it is
   never shown, and no string in this file or its component contains a
   duration.

   Cadence and dismissal both live in localStorage rather than the
   database, for the same reason the §9 drifted row does: this is a
   courtesy owed to the person looking at the screen, not a fact about
   anybody, and a row someone waved away should not follow them onto
   another device as data.
   ════════════════════════════════════════════════ */

import { isAbout } from "../messages/messagesData.js";

const DAY = 86400000;

/* "Two to three weeks" (§4.3). The floor of the range: at fourteen days
   a person is plainly out of touch, and waiting for twenty-one only
   makes the row rarer without making it kinder. */
export const RECONNECT_MS = 14 * DAY;

/* Once a week at most (§4.3) — the whole row, not per person. */
const SEEN_KEY = "saathban.feed.reconnect.seen";
const WEEK = 7 * DAY;

/* An X removes THAT PERSON for a month (§4.3) — per person, not a hush
   over the row. Waving away one name must not cost you the others. */
const HUSH_KEY = "saathban.feed.reconnect.hushed";
const MONTH = 30 * DAY;

function readHushes() {
  try {
    const raw = localStorage.getItem(HUSH_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/* Dismissals older than a month are dropped on write rather than kept
   and filtered on read, so the entry does not grow forever on a device
   that lives for years. */
export function hushPerson(personId, now = Date.now()) {
  if (!personId) return;
  try {
    const kept = {};
    const all = readHushes();
    for (const [id, at] of Object.entries(all)) {
      if (now - Number(at) < MONTH) kept[id] = Number(at);
    }
    kept[personId] = now;
    localStorage.setItem(HUSH_KEY, JSON.stringify(kept));
  } catch {
    /* storage off — the row simply reappears next week, which is the
       harmless direction to fail in. */
  }
}

export function rowAllowed(now = Date.now()) {
  try {
    const seen = Number(localStorage.getItem(SEEN_KEY) || 0);
    return !seen || now - seen > WEEK;
  } catch {
    return true;   /* storage off: showing it is the kinder failure */
  }
}

export function markRowSeen(now = Date.now()) {
  try {
    localStorage.setItem(SEEN_KEY, String(now));
  } catch {
    /* fine */
  }
}

/* ONE person, or null. Not a list the caller has to slice — §4.3 says
   one at a time, and returning an array would invite a future caller to
   render two.

   "Currently active" is isAbout(), which is itself gated on the other
   person's show_presence: someone who has turned presence off is not
   offered here, because this row would otherwise leak the thing they
   switched off. */
export function pickReconnect(chats, now = Date.now()) {
  if (!Array.isArray(chats) || !chats.length) return null;
  const hushed = readHushes();
  const eligible = chats.filter((c) => {
    if (!c?.last || c.archived || !c.person) return false;
    if (now - new Date(c.at).getTime() < RECONNECT_MS) return false;
    if (!isAbout(c.person, now)) return false;
    const at = Number(hushed[c.otherId] || 0);
    if (at && now - at < MONTH) return false;
    return true;
  });
  if (!eligible.length) return null;
  /* The most recently spoken-to of the eligible — the warmest thread
     still in range, rather than the coldest, which would systematically
     surface the people you are least likely to write to. */
  eligible.sort((a, b) => new Date(b.at) - new Date(a.at));
  return eligible[0];
}
