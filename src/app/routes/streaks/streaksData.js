/* ════════════════════════════════════════════════
   Shared streaks — the app side of 0140.

   Every read and write is an RPC. The database owns every rule that
   matters: who can be chosen, one send per streak per person per day,
   one rest day in seven, what "today" is for this person. This file
   only carries the calls, mirrors the day-counting rule so a screen can
   say plainly why today does not count yet, and holds my_streaks() and
   my_days() in one small store so the log card, the journey and the
   sheets never disagree with each other.

   NEVER AUTOMATIC. Nothing in here creates a streak, sends one, nudges
   anyone or takes a rest day except as the direct result of a press.
   ════════════════════════════════════════════════ */

import { useEffect, useSyncExternalStore } from "react";
import supabase from "../../lib/supabase.js";
import { fetchMyDays } from "../../lib/points.js";
import { waterMlOf } from "../../lib/units.js";
import { STREAKS_CACHE_PREFIX, readUserCache, writeUserCache } from "../../lib/offline.js";

/* ─── Which items can carry a number, and sensible starting ranges ───
   Water is in GLASSES (the server divides the stored ml by 250), sleep
   in hours, movement in minutes. A counted tracker counts times. Every
   other item is yes-or-no only. */
export const RANGE_SPECS = {
  water: { unit: "glasses", min: 6, max: 10, step: 1, lo: 1, hi: 20 },
  sleep: { unit: "hours", min: 7, max: 9, step: 1, lo: 1, hi: 14 },
  exercise: { unit: "minutes", min: 20, max: 60, step: 5, lo: 5, hi: 240 },
};
const TRACKER_COUNT_SPEC = { unit: "times", min: 1, max: 5, step: 1, lo: 1, hi: 99 };

export function rangeSpecFor(itemKey, tracker) {
  if (RANGE_SPECS[itemKey]) return RANGE_SPECS[itemKey];
  if (String(itemKey).startsWith("tracker:") && tracker && tracker.type === "count") return TRACKER_COUNT_SPEC;
  return null;
}

export const MODULE_KEYS = ["water", "sleep", "exercise", "diet", "medication", "mood"];

/* The item's name as a heading ("Water") and as a word inside a sentence
   ("water"). A tracker's name is the person's own words, verbatim. */
export function itemTitle(t, itemKey, itemName) {
  if (MODULE_KEYS.includes(itemKey)) return t(`settings.dailyLog.modules.${itemKey}`);
  return itemName || "";
}
export function itemNoun(t, itemKey, itemName) {
  if (MODULE_KEYS.includes(itemKey)) return t(`streaks.noun.${itemKey}`);
  return itemName || "";
}
export function unitWord(t, unit) {
  if (!unit) return "";
  const s = t(`streaks.units.${unit}`);
  return s.startsWith("streaks.") ? unit : s;
}
export function itemIcon(itemKey) {
  return MODULE_KEYS.includes(itemKey) ? itemKey : "tracker";
}

/* "1 day" and "14 days": the key, or its One twin when n is 1. */
export function tn(t, key, n, vars = {}) {
  if (Number(n) === 1) {
    const one = t(key + "One", { ...vars, n });
    if (!one.endsWith("One")) return one;
  }
  return t(key, { ...vars, n });
}

const fmtNum = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
};
export { fmtNum };

/* ─── The day-counting rule, mirrored from streak_item_value (0140) ───
   Used only to SAY why today does not count yet, before the server is
   asked. The server's answer is always the one acted on. */
const jnum = (v) => {
  if (v == null) return null;
  const m = String(v).match(/[0-9]+(?:\.[0-9]+)?/);
  return m ? Number(m[0]) : null;
};

export function itemValueFromLog(itemKey, log) {
  const v = log ? log[itemKey] : null;
  if (!v) return null;
  if (String(itemKey).startsWith("tracker:")) {
    if (v.count != null) return v.count > 0 ? v.count : null;
    if (v.done || (v.note || "").trim()) return 1;
    return null;
  }
  switch (itemKey) {
    case "water": {
      const ml = waterMlOf(v);
      return ml > 0 ? Math.round((ml / 250) * 10) / 10 : null;
    }
    case "sleep":
      return jnum(v.hours);
    case "exercise": {
      const m = jnum(v.minutes);
      if (m != null) return m;
      return v.activity || v.type ? 0 : null;
    }
    case "medication":
      return Array.isArray(v.taken) && v.taken.length > 0 ? 1 : null;
    case "diet": {
      const answers = v.answers && typeof v.answers === "object" ? Object.values(v.answers) : [];
      if (answers.some((a) => a && a.had === true)) return 1;
      const entries = v.entries && typeof v.entries === "object" ? Object.values(v.entries) : [];
      return entries.some((e) => Array.isArray(e) && e.length > 0) ? 1 : null;
    }
    case "mood": {
      const ids = Array.isArray(v.choices) && v.choices.length ? v.choices : v.choice ? [v.choice] : [];
      return ids.length ? 1 : null;
    }
    default:
      return null;
  }
}

export function valueCounts(streakLike, value) {
  if (value == null) return false;
  if (streakLike.kind === "range") {
    return Number(value) >= Number(streakLike.range_min) && Number(value) <= Number(streakLike.range_max);
  }
  return true;
}

/* ─── The store: my_streaks() + my_days() ─── */

/* OFFLINE: the last full answer is kept on this phone for the person it
   was fetched for (saathban.app.streaks.<id>, lib/offline.js) and is
   what the pills and "Your days" paint first. fresh says the store holds
   a server answer from this page life; failed says the last ask did not
   get one. A copy from an EARLIER DAY keeps its runs and its count of
   days but not its facts about today — yesterday's "sent today" is not
   today's. */

let state = { rows: null, days: null, forId: null, fresh: false, failed: false, version: 0 };
const subs = new Set();
let inflight = null;
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const EMPTY = Object.freeze({ rows: null, days: null, fresh: false, failed: false });

function emit(patch) {
  state = { ...state, ...patch, version: state.version + 1 };
  subs.forEach((fn) => fn());
}

function sameLocalDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

function keptFor(profileId) {
  const c = readUserCache(STREAKS_CACHE_PREFIX, profileId, { maxAgeMs: KEEP_MS });
  if (!c || !c.data) return null;
  let rows = Array.isArray(c.data.rows) ? c.data.rows : null;
  let days = c.data.days && typeof c.data.days === "object" ? c.data.days : null;
  if (!sameLocalDay(c.at, Date.now())) {
    rows = rows && rows.map((r) => ({ ...r, today_ok: false, today_value: null, sent_today: 0, received_today: 0 }));
    days = days && { ...days, logged_today: false };
  }
  return { rows, days };
}

export function refreshStreaks() {
  if (inflight) return inflight;
  const forId = state.forId;
  inflight = (async () => {
    try {
      const [{ data, error }, days] = await Promise.all([
        supabase.rpc("my_streaks"),
        fetchMyDays().catch(() => null),
      ]);
      // A different person signed in while this was on its way.
      if (forId && state.forId !== forId) return;
      const patch = {};
      if (!error) patch.rows = data || [];
      if (days) patch.days = days;
      patch.fresh = !error && !!days;
      patch.failed = !patch.fresh;
      emit(patch);
      if (patch.fresh && forId) {
        writeUserCache(STREAKS_CACHE_PREFIX, forId, { rows: patch.rows, days: patch.days });
      }
    } catch {
      /* the card keeps what it had; a streak is never worth an error here */
      if (!forId || state.forId === forId) emit({ failed: true });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
const snapshot = () => state;

/* The kept copy for the very first frame, before the effect below has
   adopted it into the store. Memoised so the same object comes back on
   every render until then. */
const firstPaint = new Map();

/* Reads the store for this person, fetching on first use and whenever
   the signed-in person changes (a different account never inherits it). */
export function useMyStreaks(profileId) {
  const snap = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (!profileId) return;
    if (state.forId !== profileId) {
      const kept = keptFor(profileId);
      firstPaint.delete(profileId);
      state = {
        rows: kept?.rows ?? null,
        days: kept?.days ?? null,
        forId: profileId,
        fresh: false,
        failed: false,
        version: state.version + 1,
      };
      subs.forEach((fn) => fn());
      refreshStreaks();
    } else if (state.rows === null || !state.fresh) {
      refreshStreaks();
    }
  }, [profileId]);
  if (!profileId) return EMPTY;
  if (snap.forId === profileId) return snap;
  if (!firstPaint.has(profileId)) {
    const kept = keptFor(profileId);
    firstPaint.set(profileId, kept ? { ...EMPTY, ...kept } : EMPTY);
  }
  return firstPaint.get(profileId);
}

export function streakFor(rows, itemKey) {
  return (rows || []).find((s) => s.item_key === itemKey) || null;
}

/* ─── Errors, by the words the server raises ─── */
export function errorKind(e) {
  const m = String((e && e.message) || e || "");
  for (const k of ["streak_exists", "not_counted_today", "already_sent", "already_nudged", "no_rest_day_left", "Nothing to rest", "Not connected"]) {
    if (m.includes(k)) return k;
  }
  return "other";
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export const peopleOptions = (streakId = null) => rpc("streak_people_options", { p_streak: streakId }).then((d) => d || []);

export const createStreak = ({ itemKey, itemName, kind, min, max, unit, isPrivate, people }) =>
  rpc("create_streak", {
    p_item_key: itemKey,
    p_item_name: itemName,
    p_kind: kind,
    p_min: kind === "range" ? min : null,
    p_max: kind === "range" ? max : null,
    p_unit: kind === "range" ? unit : null,
    p_private: !!isPrivate,
    p_people: isPrivate ? [] : people || [],
  });

export const setStreakPeople = (streakId, people) => rpc("set_streak_people", { p_streak: streakId, p_people: people || [] });
export const sendList = (streakId) => rpc("streak_send_list", { p_streak: streakId }).then((d) => d || []);
export const sendStreak = (streakId, recipients) => rpc("send_streak", { p_streak: streakId, p_recipients: recipients });
export const receivedStreaks = (days = 14) => rpc("received_streaks", { p_days: days }).then((d) => d || []);
export const streakWindow = (sendId) => rpc("streak_window", { p_send: sendId });
export const replyStreak = (sendId) => rpc("reply_streak", { p_send: sendId });
export const streakGroup = (streakId) => rpc("streak_group", { p_streak: streakId });
export const nudgeStreak = (streakId, personId, title, body) =>
  rpc("nudge_streak", { p_streak: streakId, p_person: personId, p_title: title, p_body: body });
export const takeRestDay = (streakId) => rpc("use_rest_day", { p_streak: streakId });
export const restartStreak = (streakId) => rpc("restart_streak", { p_streak: streakId });
export const personLoggedToday = (profileId) => rpc("person_logged_today", { p_profile: profileId });

/* "Mona", "Mona and Tariq", "Mona, Tariq and Nasreen". */
export function namesLine(t, names) {
  const first = names.map((n) => (n || "").split(" ")[0]).filter(Boolean);
  if (first.length <= 1) return first[0] || "";
  return t("share.namesAnd", { list: first.slice(0, -1).join(t("streaks.listJoin")), last: first[first.length - 1] });
}
