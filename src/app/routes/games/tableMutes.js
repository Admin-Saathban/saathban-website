/* ════════════════════════════════════════════════
   Muting one person, at one table.

   Three switches per person on their profile card — their chat, their
   emoji, their sounds — and every one of them is REVERSIBLE and
   SCOPED. Muting the neighbour who is spamming a stone-throwing emoji
   at tonight's table must not follow them into tomorrow's, and must
   not follow them out of the game into the rest of Saathban.

   THIS IS A VIEWING PREFERENCE, NOT A RELATIONSHIP, so it lives in
   this browser and nowhere else. Two things follow from that and both
   are deliberate:

   · The muted person is never told. A mute that notifies is a
     confrontation, and the whole value of this control is that it
     costs the person using it nothing.
   · It does not sync to another device. That is the honest trade for
     not writing "X has muted Y" into a table anybody could read, and
     for a table that is over in twenty minutes it costs nothing.

   BLOCKING AND REPORTING ARE DIFFERENT ACTS and do not live here.
   Report goes to the admin queue; block is a person-level decision
   that belongs to the people lane. This is the small, quiet, local
   one: "not from you, not right now".

   Storage is per session id, so a table's mutes disappear with the
   table rather than accumulating for ever in somebody's browser.
   ════════════════════════════════════════════════ */

const KEY = (sessionId) => `saathban.game.mutes.${sessionId}`;

/* What a person can be muted for. The card draws one row per entry,
   so adding a fourth kind is a one-line change here and a string. */
export const MUTE_KINDS = ["chat", "emoji", "sounds"];

export function readMutes(sessionId) {
  if (!sessionId) return {};
  try {
    const raw = localStorage.getItem(KEY(sessionId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    /* A private window, cleared site data, or storage refused
       outright. Nobody is muted, which is the safe direction: a
       message shown to somebody who wanted it hidden is a smaller
       failure than a message hidden from somebody who did not. */
    return {};
  }
}

/* True when THIS person is muted for THIS kind at THIS table. */
export function isMuted(sessionId, profileId, kind) {
  if (!sessionId || !profileId) return false;
  return readMutes(sessionId)[profileId]?.[kind] === true;
}

export function setMuted(sessionId, profileId, kind, muted) {
  if (!sessionId || !profileId) return {};
  const all = readMutes(sessionId);
  const row = { ...(all[profileId] || {}) };
  if (muted) row[kind] = true;
  else delete row[kind];
  const next = { ...all };
  if (Object.keys(row).length) next[profileId] = row;
  else delete next[profileId];
  try {
    localStorage.setItem(KEY(sessionId), JSON.stringify(next));
  } catch {
    /* The switch still moved for this screen; it simply will not
       survive a reload. Better than throwing inside a tap. */
  }
  return next;
}
