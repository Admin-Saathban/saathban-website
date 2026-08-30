/* ════════════════════════════════════════════════
   JUST AHEAD — PRODUCT_DECISIONS §14.

   "Only things genuinely close. Two more days and A Full Moon finds
   you. NEVER show far-off progress — a badge eighty days away is a
   number telling someone how far behind they are."

   That last sentence is the entire specification, and it is a rule
   about kindness expressed as a threshold. A progress bar at 4% does
   not motivate a lonely person; it measures the distance between them
   and something they have not got. So a thing appears here only when
   it is close enough that showing it is encouragement rather than
   arithmetic.

   The thresholds, and why each is what it is:

     a badge      within 7 days OR 3 steps — "two more days" is a
                  sentence a person finishes in their head; "43 more
                  days" is a verdict
     an event     within 14 days — long enough to plan around, short
                  enough that it is genuinely ahead rather than
                  someday
     a birthday   within 14 days, for the same reason
     a course     only if STARTED — an untouched course is an advert,
                  and adverts do not belong in a person's own journey

   Pure, so the rule can be pinned without a browser and so the
   thresholds live in one readable place rather than scattered through
   JSX as magic numbers.
   ════════════════════════════════════════════════ */

export const BADGE_DAYS = 7;
export const BADGE_STEPS = 3;
export const EVENT_DAYS = 14;
export const BIRTHDAY_DAYS = 14;

const DAY = 86400000;

/** Whole days from now until `when`. Negative means it has passed. */
export function daysUntil(when, now = new Date()) {
  if (!when) return Infinity;
  const a = new Date(now);
  a.setHours(0, 0, 0, 0);
  const b = new Date(when);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / DAY);
}

/**
 * Is this badge close enough to mention?
 * @param {{remaining?: number, daysAway?: number}} b
 */
export function badgeIsNear(b) {
  if (!b) return false;
  const steps = Number.isFinite(b.remaining) ? b.remaining : Infinity;
  const days = Number.isFinite(b.daysAway) ? b.daysAway : Infinity;
  /* Either measure being close is enough: some badges count days and
     some count things done, and a person does not care which. */
  return steps <= BADGE_STEPS || days <= BADGE_DAYS;
}

/**
 * Build the JUST AHEAD list. Everything far away is dropped rather
 * than shown greyed out — §0.6: absent, never an empty scoreboard.
 *
 * Returns [{kind, key, label, when?, remaining?}] in soonest-first
 * order, so what is nearest is read first.
 */
export function justAhead({ badges, events, birthdays, course = null } = {}, now = new Date()) {
  /* Same null-tolerance as chapters, and for the same reason. */
  const badgeList = Array.isArray(badges) ? badges : [];
  const eventList = Array.isArray(events) ? events : [];
  const birthdayList = Array.isArray(birthdays) ? birthdays : [];
  const out = [];

  for (const b of badgeList) {
    if (b.earned) continue;                       // earned things are the chapters, not the horizon
    if (!badgeIsNear(b)) continue;
    out.push({ kind: "badge", key: b.key, label: b.name, remaining: b.remaining, when: null, sort: b.remaining ?? 99 });
  }

  for (const e of eventList) {
    const d = daysUntil(e.when, now);
    if (d < 0 || d > EVENT_DAYS) continue;
    out.push({ kind: "event", key: e.id, label: e.title, when: e.when, sort: d });
  }

  for (const p of birthdayList) {
    const d = daysUntil(p.when, now);
    if (d < 0 || d > BIRTHDAY_DAYS) continue;
    out.push({ kind: "birthday", key: p.id, label: p.name, when: p.when, sort: d });
  }

  /* A course counts only once it has been started: §16 puts the
     invitation to begin in Grow, not in a person's own journey. */
  if (course && course.started && !course.finished) {
    out.push({ kind: "course", key: "course", label: course.title, remaining: course.remaining, sort: 0 });
  }

  return out.sort((a, b) => a.sort - b.sort);
}

/* ── Months as chapters ──
   §14: "August — 22 days here. The month you started walking again."
   Newest first, and a month with nothing in it is simply not a
   chapter — an empty August is not a page saying you did nothing. */
export function chapters(logRows, badges, now = new Date()) {
  /* NULL, not just undefined. The page holds `null` while the months
     are loading — a default parameter does not fire for null, so the
     first render threw "logRows is not iterable" and took the whole
     journey down. A module that is handed a loading state must treat
     it as "nothing yet", not as a programming error. */
  const rows = Array.isArray(logRows) ? logRows : [];
  const badgeList = Array.isArray(badges) ? badges : [];
  const byMonth = new Map();
  for (const r of rows) {
    const key = String(r.log_date).slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, new Set());
    byMonth.get(key).add(r.log_date);
  }
  for (const b of badgeList) {
    if (!b.earned_at) continue;
    const key = String(b.earned_at).slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, new Set());
  }
  return [...byMonth.entries()]
    .map(([key, days]) => ({
      key,
      days: days.size,
      badges: badgeList.filter((b) => b.earned_at && String(b.earned_at).slice(0, 7) === key),
    }))
    .filter((c) => c.days > 0 || c.badges.length > 0)
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}
