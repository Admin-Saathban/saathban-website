/* ════════════════════════════════════════════════
   Saath-Icon home — module/choice definitions and the character's
   tone matrix.

   All user-facing copy now lives in locales/en.js + ur.js under
   home.* (the Urdu pass) — this file carries only ids, icons, and
   KEY references into those files. Components resolve keys with
   t() from useI18n(); custom trackers keep their user-typed names
   verbatim (personal data is never translated).

   SPEC.md guardrails encoded here:
   - Points reward participation, never performance. Every module
     counts the same regardless of what was logged in it.
   - Copy never says "elderly" or "user", never implies an audience.
   ════════════════════════════════════════════════ */

// ─── Who is home ───
// Which modules are enabled, the medication list, diet items, and custom
// trackers all live in lib/iconPrefs.js now — Settings writes them, this
// screen reads them. Everything defaults OFF except mood.
export const MOCK_ICON = {
  firstName: "Zubaida",
  // Circle is intentionally empty in this mock: the share sheet must read
  // as a door, never as a gap (SPEC.md, "The empty circle").
  circleMembers: [],
};

// ─── Log modules ───
// Display names come from the existing settings.dailyLog.modules.* keys
// (one source for Settings and the log card alike).
/* `icon` is a name in components/Icon.jsx, not an emoji — the owner's
   30 August pass. Six emoji in a vertical list was the worst case for
   the mismatch: each one drawn by a different hand at a different
   optical size, stacked so the differences line up next to each
   other. */
export const MODULES = [
  { id: "mood", icon: "mood" },
  { id: "sleep", icon: "sleep" },
  { id: "medication", icon: "medication" },
  { id: "exercise", icon: "exercise" },
  { id: "diet", icon: "diet" },
  { id: "water", icon: "water" },
];

// Five options, always in this order. The note placeholder adapts to the
// selection — a heavy day is met with patience, a bright one with curiosity.
export const MOODS = [
  { id: "wonderful", face: "😄", labelKey: "home.moods.wonderful", phKey: "home.moods.phWonderful" },
  { id: "good", face: "🙂", labelKey: "home.moods.good", phKey: "home.moods.phGood" },
  { id: "okay", face: "😐", labelKey: "home.moods.okay", phKey: "home.moods.phOkay" },
  { id: "low", face: "🙁", labelKey: "home.moods.low", phKey: "home.moods.phLow" },
  { id: "heavy", face: "😞", labelKey: "home.moods.heavy", phKey: "home.moods.phHeavy" },
];

export const SLEEP_HOURS = ["4", "5", "6", "7", "8", "9", "10+"];

export const SLEEP_QUALITY = [
  { id: "restful", face: "🙂", labelKey: "home.sleepQuality.restful" },
  { id: "fair", face: "😐", labelKey: "home.sleepQuality.fair" },
  { id: "restless", face: "🙁", labelKey: "home.sleepQuality.restless" },
];

export const EXERCISE_TYPES = [
  { id: "walk", icon: "🚶", labelKey: "home.exercise.walk" },
  { id: "stretch", icon: "🙆", labelKey: "home.exercise.stretch" },
  { id: "garden", icon: "🌿", labelKey: "home.exercise.garden" },
  { id: "house", icon: "🧹", labelKey: "home.exercise.house" },
  { id: "other", icon: "✨", labelKey: "home.exercise.other" },
];

export const EXERCISE_MINUTES = ["10", "20", "30", "45+"];

export const WATER_GOAL_GLASSES = 8;

// ─── Participation points ───
// Flat per-module credit: logging a heavy mood earns exactly what logging a
// wonderful one does. Never scaled by content. No leaderboards, ever.
export const POINTS_PER_MODULE = 10;

export const BADGES = [
  { nameKey: "home.score.badges.firstLight", at: 50 },
  { nameKey: "home.score.badges.morningStar", at: 250 },
  { nameKey: "home.score.badges.neemTree", at: 500 },
  { nameKey: "home.score.badges.monsoonSteady", at: 1000 },
  { nameKey: "home.score.badges.mountainQuiet", at: 2000 },
];

// Past days and lifetime points come from Supabase daily_logs — see
// logStore.js.

// ─── Character tone matrix (SPEC.md, "Points, character, celebrations") ───
// Mood is asked first precisely so this can be mood-aware. Returns a
// { key, vars } pair for t() — never a finished sentence, so the matrix
// stays language-neutral.
export function characterLine({ moodId, doneCount, missedDays, firstName, restDay }) {
  const vars = { name: firstName };
  if (restDay) return { key: "home.character.restDay", vars };
  if (!moodId) {
    if (missedDays >= 2) {
      // Returning after missed days → warm welcome, never guilt.
      return { key: "home.character.welcomeBack", vars };
    }
    return { key: "home.character.ask", vars };
  }
  if (moodId === "low" || moodId === "heavy") {
    // Low mood → gentle, regardless of activity.
    return { key: "home.character.lowMood", vars };
  }
  if (moodId === "okay") return { key: "home.character.okayMood", vars };
  // Good or wonderful:
  if (doneCount >= 4) return { key: "home.character.activeDay", vars };
  if (doneCount <= 2) return { key: "home.character.brightNudge", vars };
  return { key: "home.character.goodMood", vars };
}

// ─── Share sheet copy ───
export const SHARE_LINK_MOCK = "https://saathban.app/s/AB12-CD34";

// ─── Small date helpers ───
export function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function greetingKeyForHour(h) {
  if (h < 12) return "home.greetingMorning";
  if (h < 17) return "home.greetingAfternoon";
  return "home.greetingEvening";
}
