/* ════════════════════════════════════════════════
   Saath-Icon home — mock data layer.

   Everything the home screen shows comes from here; no Supabase
   calls yet. When the real data layer lands (build step 9 backend),
   this file is the contract to replace.

   Also the single place for this screen's copy and the character's
   tone matrix, so the Urdu pass (locales/) is a one-file extraction.

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
export const MODULES = [
  { id: "mood", name: "Mood", icon: "🌤️" },
  { id: "sleep", name: "Sleep", icon: "🌙" },
  { id: "medication", name: "Medication", icon: "💊" },
  { id: "exercise", name: "Movement", icon: "🚶" },
  { id: "diet", name: "Meals", icon: "🍲" },
  { id: "water", name: "Water", icon: "💧" },
];

// Five options, always in this order. The note placeholder adapts to the
// selection — a heavy day is met with patience, a bright one with curiosity.
export const MOODS = [
  { id: "wonderful", face: "😄", label: "Wonderful", placeholder: "What made today shine?" },
  { id: "good", face: "🙂", label: "Good", placeholder: "What has been good so far?" },
  { id: "okay", face: "😐", label: "Okay", placeholder: "Anything on your mind?" },
  { id: "low", face: "🙁", label: "Low", placeholder: "Would you like to share what's on your heart?" },
  { id: "heavy", face: "😞", label: "Heavy", placeholder: "Take your time. Whatever you write stays yours." },
];

export const SLEEP_HOURS = ["4", "5", "6", "7", "8", "9", "10+"];

export const SLEEP_QUALITY = [
  { id: "restful", face: "🙂", label: "Restful" },
  { id: "fair", face: "😐", label: "So-so" },
  { id: "restless", face: "🙁", label: "Restless" },
];

export const EXERCISE_TYPES = [
  { id: "walk", icon: "🚶", label: "A walk" },
  { id: "stretch", icon: "🙆", label: "Stretching" },
  { id: "garden", icon: "🌿", label: "Gardening" },
  { id: "house", icon: "🧹", label: "Housework" },
  { id: "other", icon: "✨", label: "Something else" },
];

export const EXERCISE_MINUTES = ["10", "20", "30", "45+"];

export const WATER_GOAL_GLASSES = 8;

// ─── Participation points ───
// Flat per-module credit: logging a heavy mood earns exactly what logging a
// wonderful one does. Never scaled by content. No leaderboards, ever.
export const POINTS_PER_MODULE = 10;

export const BADGES = [
  { name: "First Light", at: 50 },
  { name: "Morning Star", at: 250 },
  { name: "Neem Tree", at: 500 },
  { name: "Monsoon Steady", at: 1000 },
  { name: "Mountain Quiet", at: 2000 },
];

// Lifetime points before today (mock).
export const MOCK_LIFETIME_POINTS = 210;

// ─── Past days (mock) ───
// Keyed by offset-from-today. Days -1 and -2 are deliberately empty so the
// character greets with "welcome back", never guilt. Day -4 was a rest day —
// it counts as showing up, exactly like a fully logged day.
export const MOCK_PAST_DAYS = {
  "-6": { modulesLogged: 5 },
  "-5": { modulesLogged: 4 },
  "-4": { restDay: true, modulesLogged: 0 },
  "-3": { modulesLogged: 6 },
};

// ─── Character tone matrix (SPEC.md, "Points, character, celebrations") ───
// Mood is asked first precisely so this can be mood-aware.
export function characterLine({ moodId, doneCount, missedDays, firstName, restDay }) {
  if (restDay) {
    return `A rest day is a good day, ${firstName}. I'll be right here.`;
  }
  if (!moodId) {
    if (missedDays >= 2) {
      // Returning after missed days → warm welcome, never guilt.
      return `${firstName}! How lovely to see you again. How is your heart today?`;
    }
    return `How is your heart today, ${firstName}?`;
  }
  if (moodId === "low" || moodId === "heavy") {
    // Low mood → gentle, regardless of activity.
    return "Thank you for telling me. No hurry today — I'm right here with you.";
  }
  if (moodId === "okay") {
    return "An okay day still counts. Thank you for checking in.";
  }
  // Good or wonderful:
  if (doneCount >= 4) {
    return `Look at you go, ${firstName}! What a day you're making.`;
  }
  if (doneCount <= 2) {
    return "Feeling bright, I see! Shall we give that energy somewhere to go?";
  }
  return "That's wonderful to hear. The day is yours.";
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

export function greetingForHour(h) {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
