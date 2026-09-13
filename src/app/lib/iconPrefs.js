/* ════════════════════════════════════════════════
   Daily-log preferences — server-backed since migration 0033
   (public.daily_log_prefs, one row per Icon), keyed by the Icon whose
   log they describe so a Fam member with can_configure_daily_log can
   edit the same row from their side.

   SPEC.md: "Each module is opt-in from Settings." Mood is the one
   exception — always on, always first (the character's tone depends
   on it; the DB trigger re-adds it if a client ever drops it).
   SLEEP AND WATER ARE ALSO ON at the start (PRODUCT_DECISIONS §5):
   three questions rather than one, because a log with a single
   question is not yet a habit. Medicines, meals and movement default
   OFF — medicines especially, because they need setting up first and
   an empty medicine list on day one is a bad first impression.

   Shapes:
     enabledModules: ["mood", ...]
     medications:  [{ id, name, dose, time }]
     mealItems:    [{ id, label, tags: ["protein", ...] }]   the item library
     trackers:     [{ id, name, type, schedule }]
        type:      "yesno" | "count" | "note"
        schedule:  { kind: "daily" } | { kind: "days", days: [0..6] }
     units:        { water: "glasses" | "l" | "ml", weight: "kg" | "lbs" }
     configuredBy / configuredAt: who last set it up, if not the Icon

   Offline posture matches logStore: a localStorage cache per Icon is
   shown immediately, the server row wins when it arrives, and writes
   are optimistic + debounced. On first load with no server row, an
   old device-local prefs blob (pre-0033) is migrated up once.

   Read with useIconPrefs(iconId); mutate through the exported actions
   (all take iconId first). useSyncExternalStore — no provider needed.
   ════════════════════════════════════════════════ */

import { useEffect, useSyncExternalStore } from "react";
import supabase from "./supabase.js";

const LEGACY_KEY = "saathban.app.iconPrefs";
const cacheKey = (iconId) => `saathban.app.logPrefs.${iconId}`;

export const OPTIONAL_MODULES = ["sleep", "medication", "exercise", "diet", "water"];
export const TRACKER_TYPES = ["yesno", "count", "note"];
export const MEAL_TAGS = ["protein", "carbs", "veg", "fruit", "dairy", "sweet"];

/* ── MEALS AND MOVEMENT ARE THE PERSON'S OWN LISTS (2026-09-13) ──

   Owner: movement is customised from Settings exactly as meals are, and
   the meal log asks one category at a time. Both lists ship with a
   sensible default set that anyone can rename, remove or add to.

   A DEFAULT CARRIES A KEY, NOT A WORD, until it is renamed: "breakfast"
   shows as Breakfast in English and in Urdu as the Urdu word. Renaming
   replaces the key with the person's own words, which then show
   verbatim in whatever language they were typed — like medicines and
   trackers. Default ids ARE the keys, so days logged before this change
   ("walk", "breakfast") still line up with them.

   null in the row means never set, which is the defaults; an empty list
   means somebody removed everything, which is kept as their choice. */
export const MEAL_DEFAULT_KEYS = ["breakfast", "lunch", "dinner"];
export const MOVEMENT_DEFAULT_KEYS = ["walk", "stretch", "garden", "house", "other"];
const defaultList = (keys) => keys.map((k) => ({ id: k, key: k, name: null }));

function cleanList(list, defaults) {
  if (!Array.isArray(list)) return defaultList(defaults);
  return list
    .filter((o) => o && o.id && ((o.name || "").trim() || o.key))
    .map((o) => {
      const name = (o.name || "").trim() || null;
      return { id: String(o.id), key: name ? null : o.key || null, name };
    });
}

/* The name to show for a list item: the person's own words, or the
   default's translation. */
export function listItemName(item, t, defaultsNs) {
  if (!item) return "";
  if (item.name) return item.name;
  return item.key ? t(defaultsNs + "." + item.key) : "";
}

const DEFAULTS = Object.freeze({
  /* §5's defaults. Three on, not one: a log with a single question is
     not yet a habit. Medicines, meals and movement stay OFF —
     medicines especially, because they need setting up first and an
     empty medicine list on day one is a bad first impression. */
  enabledModules: ["mood", "sleep", "water"],
  medications: [],
  mealItems: [],
  trackers: [],
  mealCategories: defaultList(MEAL_DEFAULT_KEYS),
  movementOptions: defaultList(MOVEMENT_DEFAULT_KEYS),
  units: { water: "glasses", weight: "kg" },
  configuredBy: null,
  configuredAt: null,
});

// Familiar starting points for a brand-new meal library.
const STARTER_MEALS = [
  { label: "Roti", tags: ["carbs"] },
  { label: "Daal", tags: ["protein"] },
  { label: "Sabzi", tags: ["veg"] },
  { label: "Chai", tags: ["dairy"] },
  { label: "Fruit", tags: ["fruit"] },
];

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `t-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
  }
}

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private browsing — the server copy still exists */
  }
}

function normalize(p) {
  const merged = { ...DEFAULTS, ...(p || {}) };
  merged.units = { ...DEFAULTS.units, ...(merged.units || {}) };
  if (!Array.isArray(merged.enabledModules)) merged.enabledModules = ["mood"];
  if (!merged.enabledModules.includes("mood")) merged.enabledModules = ["mood", ...merged.enabledModules];
  merged.mealItems = (merged.mealItems || []).map((m) => ({ ...m, tags: Array.isArray(m.tags) ? m.tags : [] }));
  merged.mealCategories = cleanList(p && p.mealCategories, MEAL_DEFAULT_KEYS);
  merged.movementOptions = cleanList(p && p.movementOptions, MOVEMENT_DEFAULT_KEYS);
  return merged;
}

/* Row ↔ prefs */
function rowToPrefs(row) {
  return normalize({
    enabledModules: row.enabled_modules,
    medications: row.medications,
    mealItems: row.meal_items,
    mealCategories: row.meal_categories,
    movementOptions: row.movement_options,
    trackers: row.trackers,
    units: row.units,
    configuredBy: row.configured_by,
    configuredAt: row.configured_at,
  });
}
function prefsToRow(iconId, p) {
  return {
    profile_id: iconId,
    enabled_modules: p.enabledModules,
    medications: p.medications,
    meal_items: p.mealItems,
    meal_categories: p.mealCategories,
    movement_options: p.movementOptions,
    trackers: p.trackers,
    units: p.units,
  };
}

/* ─── Store ─── */
let byIcon = {}; // iconId → prefs
let statusByIcon = {}; // iconId → "loading" | "ready" | "local"
const listeners = new Set();
const loading = new Set();
const flushTimers = {};

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function setLocal(iconId, prefs, status) {
  byIcon = { ...byIcon, [iconId]: prefs };
  if (status) statusByIcon = { ...statusByIcon, [iconId]: status };
  writeJson(cacheKey(iconId), prefs);
  emit();
}

async function pushToServer(iconId) {
  const p = byIcon[iconId];
  if (!p || !iconId) return;
  const { data, error } = await supabase
    .from("daily_log_prefs")
    .upsert(prefsToRow(iconId, p), { onConflict: "profile_id" })
    .select("configured_by, configured_at")
    .maybeSingle();
  if (!error && data) {
    // The trigger decides the "set up by" stamp; mirror it locally.
    const cur = byIcon[iconId];
    if (cur && (cur.configuredBy !== data.configured_by || cur.configuredAt !== data.configured_at)) {
      setLocal(iconId, { ...cur, configuredBy: data.configured_by, configuredAt: data.configured_at }, "ready");
    }
  }
}

function scheduleFlush(iconId) {
  clearTimeout(flushTimers[iconId]);
  flushTimers[iconId] = setTimeout(() => pushToServer(iconId), 400);
}

function update(iconId, patch) {
  if (!iconId) return;
  const cur = byIcon[iconId] || normalize(readJson(cacheKey(iconId)));
  setLocal(iconId, normalize({ ...cur, ...patch }));
  scheduleFlush(iconId);
}

/* Load once per Icon (cache first, server wins, legacy blob migrated). */
export async function loadIconPrefs(iconId, { isOwn = false } = {}) {
  if (!iconId || loading.has(iconId) || statusByIcon[iconId] === "ready") return;
  loading.add(iconId);
  if (!byIcon[iconId]) {
    const cached = readJson(cacheKey(iconId));
    byIcon = { ...byIcon, [iconId]: normalize(cached) };
    statusByIcon = { ...statusByIcon, [iconId]: "loading" };
    emit();
  }
  try {
    const { data, error } = await supabase
      .from("daily_log_prefs")
      .select("*")
      .eq("profile_id", iconId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      setLocal(iconId, rowToPrefs(data), "ready");
    } else {
      // No row yet. Seed from the pre-0033 device blob if this is the
      // Icon's own phone, else from the defaults; the first write
      // creates the row.
      const legacy = isOwn ? readJson(LEGACY_KEY) : null;
      const seed = normalize(
        legacy
          ? {
              enabledModules: legacy.enabledModules,
              medications: legacy.medications,
              mealItems: (legacy.dietItems || []).map((d) => ({ id: d.id || newId(), label: d.label, tags: [] })),
              trackers: legacy.trackers,
            }
          : { mealItems: STARTER_MEALS.map((m) => ({ id: newId(), ...m })) }
      );
      setLocal(iconId, seed, "ready");
      await pushToServer(iconId);
      if (legacy) {
        try {
          window.localStorage.removeItem(LEGACY_KEY);
        } catch {
          /* fine */
        }
      }
    }
  } catch {
    statusByIcon = { ...statusByIcon, [iconId]: "local" };
    emit();
  } finally {
    loading.delete(iconId);
  }
}

export function getIconPrefs(iconId) {
  return byIcon[iconId] || DEFAULTS;
}
export function getIconPrefsStatus(iconId) {
  return statusByIcon[iconId] || "loading";
}

/* The hook: prefs for one Icon (own or, for a permitted Fam member,
   theirs). Loads on first use. */
export function useIconPrefs(iconId, { isOwn = true } = {}) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => byIcon[iconId] || DEFAULTS,
    () => DEFAULTS
  );
  useEffect(() => {
    if (iconId) loadIconPrefs(iconId, { isOwn });
  }, [iconId, isOwn]);
  return snapshot;
}

export function useIconPrefsStatus(iconId) {
  return useSyncExternalStore(subscribe, () => getIconPrefsStatus(iconId), () => "loading");
}

// ─── Actions (all take the Icon's id first) ───

export function toggleModule(iconId, id) {
  if (id === "mood" || !OPTIONAL_MODULES.includes(id)) return;
  const p = getIconPrefs(iconId);
  const on = p.enabledModules.includes(id);
  update(iconId, {
    enabledModules: on ? p.enabledModules.filter((m) => m !== id) : [...p.enabledModules, id],
  });
}

export function addMedication(iconId, { name, dose, time }) {
  if (!(name || "").trim()) return;
  const p = getIconPrefs(iconId);
  update(iconId, {
    medications: [
      ...p.medications,
      { id: newId(), name: name.trim(), dose: (dose || "").trim(), time: (time || "").trim() },
    ],
  });
}

export function removeMedication(iconId, id) {
  const p = getIconPrefs(iconId);
  update(iconId, { medications: p.medications.filter((m) => m.id !== id) });
}

/* Meal library: a label plus optional tag chips (never nutrition math). */
export function addMealItem(iconId, { label, tags }) {
  if (!(label || "").trim()) return null;
  const p = getIconPrefs(iconId);
  const item = {
    id: newId(),
    label: label.trim(),
    tags: (tags || []).filter((tg) => MEAL_TAGS.includes(tg)),
  };
  update(iconId, { mealItems: [...p.mealItems, item] });
  return item;
}

export function removeMealItem(iconId, id) {
  const p = getIconPrefs(iconId);
  update(iconId, { mealItems: p.mealItems.filter((m) => m.id !== id) });
}

/* ── One pattern for both lists: add, rename, remove ──
   Renaming drops the default's key, so the person's words are shown
   from then on. Removing takes it off the list only; any day that
   already recorded it keeps the name it recorded. */
function listAdd(list, name) {
  const n = (name || "").trim();
  if (!n) return null;
  const item = { id: newId(), key: null, name: n };
  return { item, next: [...list, item] };
}
function listRename(list, id, name) {
  const n = (name || "").trim();
  if (!n) return list;
  return list.map((o) => (o.id === id ? { ...o, key: null, name: n } : o));
}

export function addMealCategory(iconId, name) {
  const r = listAdd(getIconPrefs(iconId).mealCategories, name);
  if (!r) return null;
  update(iconId, { mealCategories: r.next });
  return r.item;
}
export function renameMealCategory(iconId, id, name) {
  update(iconId, { mealCategories: listRename(getIconPrefs(iconId).mealCategories, id, name) });
}
export function removeMealCategory(iconId, id) {
  update(iconId, { mealCategories: getIconPrefs(iconId).mealCategories.filter((o) => o.id !== id) });
}

export function addMovementOption(iconId, name) {
  const r = listAdd(getIconPrefs(iconId).movementOptions, name);
  if (!r) return null;
  update(iconId, { movementOptions: r.next });
  return r.item;
}
export function renameMovementOption(iconId, id, name) {
  update(iconId, { movementOptions: listRename(getIconPrefs(iconId).movementOptions, id, name) });
}
export function removeMovementOption(iconId, id) {
  update(iconId, { movementOptions: getIconPrefs(iconId).movementOptions.filter((o) => o.id !== id) });
}

export function setUnit(iconId, kind, unit) {
  const p = getIconPrefs(iconId);
  update(iconId, { units: { ...p.units, [kind]: unit } });
}

export function addTracker(iconId, { name, type, schedule }) {
  if (!(name || "").trim() || !TRACKER_TYPES.includes(type)) return;
  const p = getIconPrefs(iconId);
  update(iconId, {
    trackers: [
      ...p.trackers,
      {
        id: newId(),
        name: name.trim(),
        type,
        schedule:
          schedule?.kind === "days" && schedule.days?.length
            ? { kind: "days", days: [...schedule.days].sort() }
            : { kind: "daily" },
      },
    ],
  });
}

export function removeTracker(iconId, id) {
  const p = getIconPrefs(iconId);
  update(iconId, { trackers: p.trackers.filter((t) => t.id !== id) });
}

// Is this tracker due on the given Date? (Log card filters by the
// day being viewed, so backfill days show what was due THAT day.)
export function trackerDueOn(tracker, date) {
  if (tracker.schedule.kind === "daily") return true;
  return tracker.schedule.days.includes(date.getDay());
}
