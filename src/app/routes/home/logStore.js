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

   Custom trackers (an iconPrefs feature) are NOT in the log_module
   enum, so tracker entries persist only in the device cache; they sync
   nothing until the schema grows a place for them. Built-in modules
   are the durable record.

   Date-window notes (the DB trigger speaks server/UTC dates, the UI
   speaks local dates):
   - A log for local-today can be rejected as "future" when local
     midnight has passed but UTC's hasn't (an Icon in Pakistan logging
     between 00:00 and 05:00). That rejection self-heals — the op stays
     queued and succeeds on a later flush.
   - A log at the far edge of the 48-hour window can become too old for
     the server while queued. That can never succeed, so the op is
     dropped from the queue; the entry stays in the device cache.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "../../lib/supabase.js";
import { MOODS, POINTS_PER_MODULE, isoDate, daysAgo } from "./homeMock.js";

// The modules migration 0006 knows (public.log_module). Anything else
// (tracker:<id> keys) is device-local.
const DB_MODULES = [
  "mood", "sleep", "medication", "exercise", "diet", "water",
  "blood_pressure", "blood_sugar", "weight", "pain",
];

// mood_value: 1 (lowest) … 5 (best) — MOODS is ordered best-first.
function moodValueFor(choice) {
  const i = MOODS.findIndex((m) => m.id === choice);
  return i === -1 ? null : MOODS.length - i;
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
  const [lifetimeRows, setLifetimeRows] = useState(null);
  const flushTimer = useRef(null);
  const flushing = useRef(false);

  const persistLogs = useCallback(
    (next) => {
      setLogsByDate(next);
      if (iconId) writeJson(cacheKey(iconId), next);
    },
    [iconId]
  );

  /* Push every queued op to daily_logs. Ops are keyed by (date, module),
     so rapid edits coalesce into one upsert — last write wins. */
  const flush = useCallback(async () => {
    if (!iconId || flushing.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    flushing.current = true;
    try {
      const queue = readJson(queueKey(iconId), {});
      for (const [opKey, op] of Object.entries(queue)) {
        const { error } = await supabase.from("daily_logs").upsert(
          {
            icon_id: iconId,
            log_date: op.dateIso,
            module: op.module,
            payload: op.value,
            mood_value: op.module === "mood" ? moodValueFor(op.value?.choice) : null,
          },
          { onConflict: "icon_id,log_date,module" }
        );
        if (!error) {
          delete queue[opKey];
        } else if (/last 48 hours/i.test(error.message || "")) {
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
      setPendingCount(Object.keys(queue).length);
    } finally {
      flushing.current = false;
    }
  }, [iconId]);

  const scheduleFlush = useCallback(() => {
    clearTimeout(flushTimer.current);
    // Debounced so typing a mood note is one upsert, not one per key.
    flushTimer.current = setTimeout(flush, 700);
  }, [flush]);

  /* The one write path. key is a module id or "tracker:<id>". */
  const writeEntry = useCallback(
    (dateIso, key, value) => {
      const next = {
        ...logsByDate,
        [dateIso]: { ...(logsByDate[dateIso] || {}), [key]: value },
      };
      persistLogs(next);
      if (!iconId || !DB_MODULES.includes(key)) return; // tracker → cache only
      const queue = readJson(queueKey(iconId), {});
      queue[`${dateIso}|${key}`] = { dateIso, module: key, value };
      writeJson(queueKey(iconId), queue);
      setPendingCount(Object.keys(queue).length);
      scheduleFlush();
    },
    [iconId, logsByDate, persistLogs, scheduleFlush]
  );

  /* Initial read: last 7 days for the strip + a lifetime participation
     count. Server rows win over the cache for the fetched range, except
     where an unsynced queued write is newer. */
  useEffect(() => {
    if (!iconId) return;
    let alive = true;

    (async () => {
      try {
        const from = isoDate(daysAgo(6));
        const [{ data: rows, error }, { count, error: countErr }] = await Promise.all([
          supabase
            .from("daily_logs")
            .select("log_date, module, payload")
            .eq("icon_id", iconId)
            .gte("log_date", from),
          // Strictly before today: ScoreShare adds today's points itself.
          supabase
            .from("daily_logs")
            .select("id", { count: "exact", head: true })
            .eq("icon_id", iconId)
            .lt("log_date", isoDate(new Date())),
        ]);
        if (!alive) return;
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
        if (!countErr && typeof count === "number") setLifetimeRows(count);
        setStatus("ready");
      } catch {
        if (alive) setStatus("local"); // cache-only until the next reconnect
      }
      flush();
    })();

    const onOnline = () => {
      setStatus((s) => (s === "local" ? "loading" : s));
      flush();
    };
    window.addEventListener("online", onOnline);
    return () => {
      alive = false;
      window.removeEventListener("online", onOnline);
      clearTimeout(flushTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconId]);

  return {
    logsByDate,
    writeEntry,
    status,
    pendingCount,
    // Participation only, flat per row — never scaled by content.
    lifetimePoints: lifetimeRows == null ? null : lifetimeRows * POINTS_PER_MODULE,
  };
}
