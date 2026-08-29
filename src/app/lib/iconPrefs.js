/* ════════════════════════════════════════════════
   Icon preferences — the mock data layer behind Settings and the
   daily log card. NO Supabase; state lives in this module and
   persists to localStorage so Settings choices survive a reload and
   are already applied when the home screen mounts.

   SPEC.md: "Each module is opt-in from Settings." Mood is the one
   exception — always on, always first (the character's tone depends
   on it). Everything else, medication and diet included, defaults
   OFF and is hidden from the log card until enabled here.

   Shapes (the contract the real backend replaces):
     enabledModules: ["mood", ...]        mood is always present
     medications:  [{ id, name, dose, time }]      user-defined list
     dietItems:    [{ id, label }]                 user-defined list
     trackers:     [{ id, name, type, schedule }]  custom trackers
        type:      "yesno" | "count" | "note"
        schedule:  { kind: "daily" } | { kind: "days", days: [0..6] }

   Read with useIconPrefs(); mutate through the exported actions.
   Components re-render via useSyncExternalStore — no provider needed,
   so the home and settings routes stay siblings.
   ════════════════════════════════════════════════ */

import { useSyncExternalStore } from "react";

const STORE_KEY = "saathban.app.iconPrefs";

// Familiar starting points for the meals list — fully editable and
// removable, unlike the old fixed set. Medications deliberately start
// empty: a medicine list is personal, and inventing one would be worse
// than an empty state that points to Settings.
const DEFAULTS = {
  enabledModules: ["mood"],
  medications: [],
  dietItems: [
    { id: "breakfast", label: "Breakfast" },
    { id: "lunch", label: "Lunch" },
    { id: "dinner", label: "Dinner" },
    { id: "chai", label: "Chai & a bite" },
  ],
  trackers: [],
};

// The opt-in modules Settings can switch on. Mood is not listed — it
// is not a choice. (Water/BP/sugar/weight/pain arrive with the rest of
// build step 9; the shapes here already accommodate them.)
export const OPTIONAL_MODULES = ["sleep", "medication", "exercise", "diet", "water"];

export const TRACKER_TYPES = ["yesno", "count", "note"];

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `t-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
  }
}

function load() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULTS, ...parsed };
    // Mood can never be switched off, whatever got stored.
    if (!merged.enabledModules.includes("mood")) {
      merged.enabledModules = ["mood", ...merged.enabledModules];
    }
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

let state = load();
const listeners = new Set();

function set(next) {
  state = next;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* private browsing — choices just won't survive a reload */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getIconPrefs() {
  return state;
}

export function useIconPrefs() {
  return useSyncExternalStore(subscribe, getIconPrefs, getIconPrefs);
}

// ─── Actions ───

export function toggleModule(id) {
  if (id === "mood" || !OPTIONAL_MODULES.includes(id)) return;
  const on = state.enabledModules.includes(id);
  set({
    ...state,
    enabledModules: on
      ? state.enabledModules.filter((m) => m !== id)
      : [...state.enabledModules, id],
  });
}

export function addMedication({ name, dose, time }) {
  if (!(name || "").trim()) return;
  set({
    ...state,
    medications: [
      ...state.medications,
      { id: newId(), name: name.trim(), dose: (dose || "").trim(), time: (time || "").trim() },
    ],
  });
}

export function removeMedication(id) {
  set({ ...state, medications: state.medications.filter((m) => m.id !== id) });
}

export function addDietItem(label) {
  if (!(label || "").trim()) return;
  set({
    ...state,
    dietItems: [...state.dietItems, { id: newId(), label: label.trim() }],
  });
}

export function removeDietItem(id) {
  set({ ...state, dietItems: state.dietItems.filter((d) => d.id !== id) });
}

export function addTracker({ name, type, schedule }) {
  if (!(name || "").trim() || !TRACKER_TYPES.includes(type)) return;
  set({
    ...state,
    trackers: [
      ...state.trackers,
      {
        id: newId(),
        name: name.trim(),
        type,
        schedule: schedule?.kind === "days" && schedule.days?.length
          ? { kind: "days", days: [...schedule.days].sort() }
          : { kind: "daily" },
      },
    ],
  });
}

export function removeTracker(id) {
  set({ ...state, trackers: state.trackers.filter((t) => t.id !== id) });
}

// Is this tracker due on the given Date? (Log card filters by the
// day being viewed, so backfill days show what was due THAT day.)
export function trackerDueOn(tracker, date) {
  if (tracker.schedule.kind === "daily") return true;
  return tracker.schedule.days.includes(date.getDay());
}
