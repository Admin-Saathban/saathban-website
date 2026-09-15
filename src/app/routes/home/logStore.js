/* ════════════════════════════════════════════════
   Daily log persistence — real Supabase daily_logs (migration 0006)
   behind the same shapes the UI already spoke.

   One DB row per (icon, day, module); the UI's per-module value object
   is stored verbatim in payload. mood_value is its own column (the
   welfare query needs it) and is derived here from the mood choice.

   Offline-first (SPEC.md, Daily logs): every write lands in a
   localStorage cache immediately — the UI never waits on the network —
   and joins a localStorage queue that flushes on reconnect, on
   'online', and shortly after each write. Reload mid-outage and
   nothing is lost.

   Custom trackers used to live only in the device cache. Since 0039
   the enum has a 'tracker' value: every tracker on a day folds into ONE
   durable row (module='tracker'). The unique (icon_id, log_date, module)
   key makes that a database fact — a replayed offline queue cannot
   double it.

   Date-window notes: the log date written is the person's LOCAL date
   (isoDate of the device clock), and since 0140 the server measures the
   48-hour window from the person's own today (profiles.timezone, kept in
   step with the device by lib/session.jsx).
   - A log at the far edge of the 48-hour window can become too old for
     the server while queued. That can never succeed, so the op is
     dropped from the queue; the entry stays in the device cache.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "../../lib/supabase.js";
import { MOODS, isoDate, daysAgo } from "./homeMock.js";
import { getIconPrefs } from "../../lib/iconPrefs.js";
import { isOnline } from "../../lib/offline.js";

// The modules migration 0006 knows (public.log_module). Anything else
// (tracker:<id> keys) is device-local.
export const DB_MODULES = [
  "mood", "sleep", "medication", "exercise", "diet", "water",
  "blood_pressure", "blood_sugar", "weight", "pain",
  "rest_day", // 0017: resting IS participation
  "tracker",  // 0039: all of a day's custom trackers, folded into one row
];

/* Does this tracker entry count as done? Mirrors isEntryDone in
   DailyLogCard, kept local so the store has no UI import. */
/* ── A MEAL TICK TRAVELS WITH ITS NAME (0119) ──

   The database now refuses a ticked food it cannot name, so a record can
   never again point at a food that later vanishes. A write queued by an
   OLDER build carries food ids alone; if one of those foods was since
   taken off the server's list, that write would be refused — and this
   queue retries a refused write forever and stops everything queued
   behind it. This device still holds the list those ids came from, so
   the names go in here, before the write is sent. */
function withMealLabels(value, items) {
  const ids = [...Object.values(value.entries || {}).flat(), ...(value.meals || [])];
  if (!ids.length) return value;
  const labels = { ...(value.labels || {}) };
  let changed = false;
  for (const id of ids) {
    if (labels[id]) continue;
    const item = (items || []).find((m) => m.id === id);
    if (item && item.label) {
      labels[id] = item.label;
      changed = true;
    }
  }
  return changed ? { ...value, labels } : value;
}

function trackerDone(v) {
  if (!v) return false;
  return !!v.done || (v.count || 0) > 0 || !!(v.note || "").trim();
}

// mood_value: 1 (lowest) … 5 (best) — MOODS is ordered best-first.
// Moods can be several at once ("content" AND "tired"); the welfare
// column keeps the LOWEST one selected — staff outreach errs towards
// noticing a heavy note, never towards missing it.
function moodValueFor(value) {
  const ids = Array.isArray(value?.choices) && value.choices.length
    ? value.choices
    : value?.choice ? [value.choice] : [];
  let lowest = null;
  for (const id of ids) {
    const i = MOODS.findIndex((m) => m.id === id);
    if (i === -1) continue;
    const v = MOODS.length - i;
    if (lowest === null || v < lowest) lowest = v;
  }
  return lowest;
}

const cacheKey = (iconId) => `saathban.app.dailyLogs.${iconId}`;
const queueKey = (iconId) => `saathban.app.dailyLogQueue.${iconId}`;

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private browsing — the server copy is still written */
  }
}

/* Row → UI merge helpers. logsByDate: { "2026-08-28": { mood: {...} } } */
function rowsToLogs(rows) {
  const byDate = {};
  for (const r of rows) {
    (byDate[r.log_date] ??= {})[r.module] = r.payload ?? {};
  }
  return byDate;
}

/* ── THE QUEUE, OUTSIDE THE HOOK ──

   Signing out has to send what is waiting before it ends the session,
   and it is pressed from the More drawer or the admin panel, where Home
   (and so this hook) may not be mounted at all. So sending the queue is
   a module function, and the hook calls the same one: one sender, one
   in-flight promise per person, and a sign-out that asks while Home is
   already sending waits for that send rather than starting a second. */

const QUEUE_PREFIX = "saathban.app.dailyLogQueue.";
const inflight = {}; // iconId -> promise of the count left unsent

export function queuedLogCount(iconId) {
  return iconId ? Object.keys(readJson(queueKey(iconId), {})).length : 0;
}

/* Every queued entry on this phone, whoever wrote it. */
export function allQueuedLogCount() {
  let n = 0;
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i += 1) {
      const k = ls.key(i);
      if (k && k.startsWith(QUEUE_PREFIX)) n += Object.keys(readJson(k, {})).length;
    }
  } catch {
    /* storage unavailable — then nothing is queued either */
  }
  return n;
}

export function logFlushInFlight(iconId) {
  return inflight[iconId] || null;
}

/* Push every queued op to daily_logs. Ops are keyed by (date, module),
   so rapid edits coalesce into one upsert — last write wins. Resolves to
   how many entries are still waiting. */
export function flushLogQueue(iconId) {
  if (!iconId) return Promise.resolve(0);
  if (inflight[iconId]) return inflight[iconId];
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return Promise.resolve(queuedLogCount(iconId));
  }
  const p = (async () => {
    const queue = readJson(queueKey(iconId), {});
    for (const [opKey, op] of Object.entries(queue)) {
      if (op.module === "diet" && op.value && typeof op.value === "object") {
        op.value = withMealLabels(op.value, getIconPrefs(iconId).mealItems);
      }
      let error = null;
      try {
        ({ error } = await supabase.from("daily_logs").upsert(
          {
            icon_id: iconId,
            log_date: op.dateIso,
            module: op.module,
            payload: op.value,
            mood_value: op.module === "mood" ? moodValueFor(op.value) : null,
          },
          { onConflict: "icon_id,log_date,module" }
        ));
      } catch (e) {
        error = e || new Error("send failed");
      }
      if (!error) {
        delete queue[opKey];
      } else if (/last 48 hours|must carry the name/i.test(error.message || "")) {
        // A name refusal is as permanent as the 48-hour window: the
        // device has no name to add, and retrying would hold up every
        // log queued behind this one. The entry stays in the device cache.
        // Permanently outside the server window — retrying can never
        // succeed. The entry survives in the device cache.
        delete queue[opKey];
      } else {
        // "future" (local midnight ahead of UTC — self-heals), network,
        // RLS hiccup: keep the op and try again on the next flush.
        break;
      }
    }
    writeJson(queueKey(iconId), queue);
    return Object.keys(queue).length;
  })();
  inflight[iconId] = p;
  p.finally(() => {
    if (inflight[iconId] === p) delete inflight[iconId];
  }).catch(() => {});
  return p;
}

export function useDailyLogs(iconId) {
  const [logsByDate, setLogsByDate] = useState(() =>
    iconId ? readJson(cacheKey(iconId), {}) : {}
  );
  // "loading" until the first server read settles; then "ready", or
  // "local" when the read failed and the device cache is what's shown.
  const [status, setStatus] = useState("loading");
  const [pendingCount, setPendingCount] = useState(() =>
    iconId ? Object.keys(readJson(queueKey(iconId), {})).length : 0
  );
  const flushTimer = useRef(null);

  const persistLogs = useCallback(
    (next) => {
      setLogsByDate(next);
      if (iconId) writeJson(cacheKey(iconId), next);
    },
    [iconId]
  );

  /* The module sender above; the hook only mirrors the count it leaves. */
  const flush = useCallback(async () => {
    if (!iconId) return;
    const left = await flushLogQueue(iconId);
    setPendingCount(left);
  }, [iconId]);

  const scheduleFlush = useCallback(() => {
    clearTimeout(flushTimer.current);
    // Debounced so typing a mood note is one upsert, not one per key.
    flushTimer.current = setTimeout(flush, 700);
  }, [flush]);

  /* Flush NOW and wait for it — for a streak send, which must reach the
     server only after the value on screen has. Waits out a flush already
     in flight, then runs one more so nothing queued behind it is missed. */
  const flushNow = useCallback(async () => {
    clearTimeout(flushTimer.current);
    const running = logFlushInFlight(iconId);
    if (running) await running.catch(() => {});
    await flush();
  }, [flush, iconId]);

  /* The one write path. key is a module id or "tracker:<id>". */
  const writeEntry = useCallback(
    (dateIso, key, value) => {
      const day = { ...(logsByDate[dateIso] || {}), [key]: value };
      const next = { ...logsByDate, [dateIso]: day };
      persistLogs(next);
      if (!iconId) return;

      const queue = readJson(queueKey(iconId), {});
      const isTracker = key.startsWith("tracker:");
      if (isTracker) {
        /* Every tracker on this day summarised into the single
           'tracker' row: the ids that were completed, and the day's
           values for the record. One row, one award — the day's
           second tracker adds nothing, by design. */
        const done = Object.entries(day)
          .filter(([k, v]) => k.startsWith("tracker:") && trackerDone(v))
          .map(([k]) => k.slice("tracker:".length));
        if (done.length === 0) {
          // Nothing completed any more: drop the pending write rather
          // than claiming participation that was undone.
          delete queue[`${dateIso}|tracker`];
        } else {
          queue[`${dateIso}|tracker`] = {
            dateIso,
            module: "tracker",
            value: { done, entries: Object.fromEntries(Object.entries(day).filter(([k]) => k.startsWith("tracker:"))) },
          };
        }
      } else if (DB_MODULES.includes(key)) {
        queue[`${dateIso}|${key}`] = { dateIso, module: key, value };
      } else {
        return; // not a durable module and not a tracker: cache only
      }
      writeJson(queueKey(iconId), queue);
      setPendingCount(Object.keys(queue).length);
      scheduleFlush();
    },
    [iconId, logsByDate, persistLogs, scheduleFlush]
  );

  /* The server read: the last 7 days for the strip. Server rows win over
     the cache for the fetched range, except where an unsynced queued
     write is newer. Run on arrival AND again when the connection comes
     back, so Home catches up with the day rather than staying on the
     copy it opened with. With no network at all it does not start:
     the cache is on screen already, and a request that can only fail
     would just hold the status at "loading" while it does. */
  const readGen = useRef(0);
  const readServer = useCallback(async () => {
    if (!iconId) return;
    const gen = ++readGen.current;
    if (!isOnline()) {
      setStatus("local");
      return;
    }
    try {
      const from = isoDate(daysAgo(6));
      const { data: rows, error } = await supabase
        .from("daily_logs")
        .select("log_date, module, payload")
        .eq("icon_id", iconId)
        .gte("log_date", from);
      if (gen !== readGen.current) return;
      if (error) throw error;

      const server = rowsToLogs(rows || []);
      const cached = readJson(cacheKey(iconId), {});
      const queue = readJson(queueKey(iconId), {});
      const merged = { ...cached };
      for (const [date, dayLogs] of Object.entries(server)) {
        merged[date] = { ...(cached[date] || {}), ...dayLogs };
      }
      for (const op of Object.values(queue)) {
        (merged[op.dateIso] ??= {})[op.module] = op.value;
      }
      persistLogs(merged);
      setStatus("ready");
    } catch {
      if (gen === readGen.current) setStatus("local"); // cache-only until the next reconnect
    }
  }, [iconId, persistLogs]);

  useEffect(() => {
    if (!iconId) return;

    (async () => {
      await readServer();
      flush();
    })();

    /* Back online: send what was kept first, then read the day again. */
    const onOnline = () => {
      setStatus((s) => (s === "local" ? "loading" : s));
      flush().then(readServer);
    };
    window.addEventListener("online", onOnline);
    return () => {
      readGen.current += 1;
      window.removeEventListener("online", onOnline);
      clearTimeout(flushTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconId]);

  /* KEEP TRYING WHILE SOMETHING IS WAITING. The 'online' event is not
     the only way a connection comes back — a phone that never lost its
     interface (lie-fi), or a session whose refresh only succeeds a
     minute after reconnecting, never fires it, and the queue would sit
     until the next write or reload. Every fifteen seconds while logs are
     unsent or the day could not be read, try again; an empty queue
     costs one localStorage read. */
  useEffect(() => {
    if (!iconId || (pendingCount === 0 && status !== "local")) return undefined;
    const id = setInterval(() => {
      if (!isOnline()) return;
      flush().then(() => {
        if (status === "local") readServer();
      });
    }, 15000);
    return () => clearInterval(id);
  }, [iconId, pendingCount, status, flush, readServer]);

  return {
    logsByDate,
    writeEntry,
    status,
    pendingCount,
    flushNow,
  };
}
