/* ════════════════════════════════════════════════
   Saath-Fam lane — copy and display maps. (Replaces famMock.js: the
   data now comes from Supabase through lib/circle.js; what remains
   here is every string this lane renders, so the Urdu pass stays a
   one-file extraction into locales/ under fam.*.)

   Copy rules (SPEC.md, Principles): never "elderly", never "user",
   never clinical, and what an Icon has NOT shared is framed as their
   privacy working — never as a gap or a worry.
   ════════════════════════════════════════════════ */

// mood_value (1 lowest … 5 best) → face + label, matching the Icon
// home's five options in order.
export const MOOD_BY_VALUE = {
  5: { face: "😄", label: "Wonderful" },
  4: { face: "🙂", label: "Good" },
  3: { face: "😐", label: "Okay" },
  2: { face: "🙁", label: "Low" },
  1: { face: "😞", label: "Heavy" },
};

export const COPY = {
  dashboard: {
    greeting: (name) => `Assalam-o-alaikum, ${name}`,
    intro: "Here's how everyone you're connected with is doing.",
    connectedLabel: "Your people",
    emptyCircle:
      "No one yet — and connecting takes a minute. Ask to join someone's circle below, or enter a code they read to you.",
    pendingLabel: "Waiting for a yes",
    // Neutral by design: a request never reveals whether the email
    // belongs to anyone (0005, decision #6).
    pendingHint: (email) =>
      `Your request went to ${email}. If it belongs to someone on Saathban, they'll see it and can say yes with one tap.`,
    pendingExpiry: (h) => `This request expires in about ${h} hours. You can always send a fresh one.`,
    inviteCta: "Connect with someone",
    inviteHint:
      "Ask to join the circle of someone already on Saathban, or enter a code they read to you.",
    loadError: "That didn't load. Please try again in a moment.",
  },

  card: {
    sosFirst: "First SOS contact",
    sosSecond: "Second SOS contact",
    todayLabel: "Today",
    logsSummary: (n) => `${n} daily ${n === 1 ? "log" : "logs"} so far today`,
    medsSummary: (taken) => `Medication: ${taken} ticked off`,
    lastLog: (t) => `Last log at ${t}`,
    quietSoFar: "Nothing logged yet today — everyone's mornings run differently.",
    quietHealth: "No health entries yet today.",
    // Locked states: privacy is presented as working as intended.
    privateDaily: (first) => `${first} keeps daily logs private. That's exactly how it should be — it's their call.`,
    privateHealth: (first) => `Health entries stay between ${first} and Saathban.`,
    locationSos: "Location is shared only during an SOS.",
    locationNever: "Location is never shared.",
    remindersCta: "Reminders & routines",
  },

  reminders: {
    title: (first) => `Reminders for ${first}`,
    intro: (first) =>
      `Gentle nudges inside ${first}'s app — never alarms to rely on. Times are in their local time.`,
    addCta: "Add a reminder",
    empty: "No reminders set up yet. Add the first one below.",
    labelField: "What is it?",
    labelPlaceholder: "For example: evening tablet, our weekly call",
    timeField: "At what time?",
    daysField: "Which days?",
    saveCta: "Save reminder",
    cancelCta: "Cancel",
    deleteCta: "Remove",
    editCta: "Change",
    savedNote: "Saved. It will appear gently in their app — no alarms, no pressure.",
    saveError: "That didn't save. Please try again in a moment.",
  },

  invite: {
    title: "Connect with someone",
    intro:
      "Two ways in, whichever suits the two of you. Either way, they stay in charge of what you can see.",
    emailLabel: "Ask to join their circle",
    emailField: "Their email address",
    emailHint:
      "We'll pass your request along. If that email belongs to someone on Saathban, they'll see it and can say yes with one tap.",
    emailCta: "Ask to join",
    // Always this, whatever the email matched — never a hint either way.
    emailSent:
      "Request sent. If that email belongs to someone on Saathban, they'll see your request and can say yes with one tap.",
    haveCodeLabel: "Were you given a code?",
    haveCodeHint:
      "If someone read you their 6-digit invitation code, enter it here — it connects you straight away.",
    haveCodeField: "Their 6-digit code",
    haveCodeCta: "Connect",
    codeInvalid:
      "That code didn't work — it may have expired (they last 48 hours) or already been used. Ask them to make a fresh one.",
    backToDashboard: "Back to your people",
  },
};
