/* ════════════════════════════════════════════════
   Saath-Fam dashboard — mock data layer.

   Everything the Fam screens show comes from here; no Supabase calls.
   When the real data layer lands (My Circle backend, build step 7),
   this file is the contract to replace: each export maps to a query
   the app will make as the signed-in Fam member, and RLS — not this
   file — becomes what enforces the permission fields.

   Also the single place for this lane's copy, following the home
   lane's convention, so the Urdu pass (locales/) is a one-file
   extraction. Copy rules (SPEC.md, Principles): never "elderly",
   never "user", never clinical, and what an Icon has NOT shared is
   framed as their privacy working — never as a gap or a worry.
   ════════════════════════════════════════════════ */

// ─── Who is signed in (mock) ───
export const MOCK_FAM = {
  firstName: "Omar",
  city: "Manchester",
  country: "United Kingdom",
};

// ─── Per-member permissions (SPEC.md, My Circle) ───
// These are what the ICON granted to this Fam member — default OFF
// except SOS contact. The dashboard only renders what they allow;
// in production RLS enforces the same shape at the database level.
//   sosContact:      null | 1 | 2   (ordering — first or second call)
//   seeDailyLogs:    mood + daily log summary
//   seeHealth:       health entries and appointments
//   manageReminders: add / edit reminders and routines
//   location:        "never" | "sos_only"   (those are the only values)

export const MOCK_CONNECTED_ICONS = [
  {
    id: "zubaida",
    name: "Zubaida Khanum",
    relationship: "Your mother",
    city: "Lahore",
    timezoneLabel: "Pakistan time",
    permissions: {
      sosContact: 1,
      seeDailyLogs: true,
      seeHealth: true,
      manageReminders: true,
      location: "sos_only",
    },
    // Score-level summary — a permitted Fam member sees that the day is
    // going, not a transcript of it. Notes and voice notes never appear
    // here regardless of permission (SPEC.md, sharing rules).
    today: {
      mood: { face: "🙂", label: "Good" },
      modulesLogged: 4,
      modulesEnabled: 6,
      meds: { taken: 2, total: 3 },
      lastLogAt: "11:40 am",
    },
    health: {
      nextAppointment: {
        title: "Dr. Farooq — blood pressure review",
        when: "Tuesday 2 Sep, 10:00 am",
      },
    },
    reminders: [
      { id: "r1", icon: "💊", label: "Evening calcium tablet", time: "8:00 pm", days: "Every day" },
      { id: "r2", icon: "📞", label: "Call with Omar", time: "6:30 pm", days: "Sundays" },
      { id: "r3", icon: "🚶", label: "Walk in Model Town park", time: "7:30 am", days: "Mon · Wed · Fri" },
    ],
  },
  {
    id: "iqbal",
    name: "Iqbal Ahmed",
    relationship: "Your uncle",
    city: "Karachi",
    timezoneLabel: "Pakistan time",
    permissions: {
      sosContact: null,
      seeDailyLogs: true,
      seeHealth: false,
      manageReminders: false,
      location: "never",
    },
    // Nothing logged yet today. The copy for this state lives in
    // COPY.today.quietSoFar — a fact, never an alarm or a scoreboard.
    today: {
      mood: null,
      modulesLogged: 0,
      modulesEnabled: 4,
      meds: null,
      lastLogAt: null,
    },
    health: null,
    reminders: [],
  },
];

// ─── Pending connection (SPEC.md: invites work both directions) ───
// This one is outgoing: Omar asked to join his father-in-law's circle;
// it lands on the Icon's side as a one-tap approval. Until then the
// Fam member sees exactly nothing about him beyond what they typed.
export const MOCK_PENDING = [
  {
    id: "req-1",
    name: "Abdul Rashid",
    relationship: "Your father-in-law",
    sentAt: "Yesterday, 6:12 pm",
    expiresInHours: 22, // tokens are single-use and expire in 48 hours
  },
];

// ─── Invite flow (mock token — one token behind all three methods) ───
export const MOCK_INVITE = {
  code: "482 915", // shown large, readable aloud over a phone call
  expiryHours: 48,
};

// ─── Copy ───
export const COPY = {
  dashboard: {
    greeting: (name) => `Assalam-o-alaikum, ${name}`,
    intro: "Here's how everyone you're connected with is doing.",
    connectedLabel: "Your people",
    pendingLabel: "Waiting for a yes",
    pendingHint: (name) =>
      `${name} has your request. He can accept it with one tap — there's nothing more you need to do.`,
    pendingExpiry: (h) => `This request expires in about ${h} hours. You can always send a fresh one.`,
    inviteCta: "Connect with someone",
    inviteHint:
      "Invite someone to connect, or ask to join the circle of someone already on Saathban.",
  },

  card: {
    sosFirst: "First SOS contact",
    sosSecond: "Second SOS contact",
    todayLabel: "Today",
    logsSummary: (n, total) => `${n} of ${total} daily logs done`,
    medsSummary: (taken, total) => `Medication: ${taken} of ${total} ticked off`,
    lastLog: (t) => `Last log at ${t}`,
    quietSoFar: "Nothing logged yet today — everyone's mornings run differently.",
    nextAppt: "Next appointment",
    // Locked states: privacy is presented as working as intended.
    privateDaily: (first) => `${first} keeps daily logs private. That's exactly how it should be — it's their call.`,
    privateHealth: (first) => `Health entries stay between ${first} and Saathban.`,
    locationSos: "Location is shared only during an SOS.",
    locationNever: "Location is never shared.",
    remindersCta: "Reminders & routines",
    remindersNoAccess: null, // deliberately nothing — an absent button, not a locked one
  },

  reminders: {
    title: (first) => `Reminders for ${first}`,
    intro: (first, tz) =>
      `Gentle nudges inside ${first}'s app — never alarms to rely on. Times are in ${tz}.`,
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
  },

  invite: {
    title: "Connect with someone",
    intro:
      "One invitation works three ways — whichever suits the two of you. Every invitation can be used once and lasts 48 hours.",
    tabEmail: "By email",
    tabCode: "By code",
    tabQr: "By QR code",
    emailField: "Their email address",
    emailHint: "We'll send them an invitation they can accept with one tap.",
    emailCta: "Send invitation",
    emailSent: (email) => `Invitation sent to ${email}. You'll see them here as soon as they accept.`,
    codeHint:
      "Read this code aloud over the phone. They enter it under “Connect” in their app.",
    codeExpiry: "This code works once and expires in 48 hours.",
    qrHint: "For when you're in the same room — they point their camera at this.",
    qrPlaceholderNote: "QR preview — the real code is generated when circles go live.",
    haveCodeLabel: "Were you given a code?",
    haveCodeHint: "If someone read you their code, enter it here to ask to join their circle.",
    haveCodeField: "Their 6-digit code",
    haveCodeCta: "Ask to join",
    haveCodeSent:
      "Done — they'll see your request next time they open Saathban and can accept it with one tap.",
    backToDashboard: "Back to your people",
  },
};
