/* ════════════════════════════════════════════════
   My Circle — copy in one place, following the fam/home convention so
   the Urdu pass (locales/) is a one-file extraction into a `circle.*`
   namespace. Interpolating strings are functions; they become
   {name}-style templates when they move into the locale files.

   Copy rules (SPEC.md): never "elderly", never "user". What an Icon has
   NOT granted is framed as their choice working — never a gap. The
   empty state is a door, never a scoreboard.
   ════════════════════════════════════════════════ */

export const COPY = {
  title: "My Circle",
  intro: "The people you've chosen to keep close — and exactly what each of them can see.",

  // Empty state — a door, not a scoreboard (SPEC.md, "The empty circle").
  empty: {
    heading: "Your circle is yours to build",
    body: "If there's someone you'd like kept in the loop — a daughter, a neighbour, a friend — you can add them here. Nothing is shared until you say so.",
  },

  requests: {
    heading: "Someone would like to join",
    body: (name) => `${name} has asked to be part of your circle.`,
    approve: "Add to my circle",
    approving: "Adding…",
    // shown when we only have an email (no profile yet)
    byEmail: (email) => `${email} has asked to be part of your circle.`,
  },

  member: {
    sosBadge: "SOS contact",
    sosOrder: (n) => (n === 1 ? "First to call" : n === 2 ? "Second to call" : `Call #${n}`),
    moveEarlier: "Move earlier",
    moveLater: "Move later",
    remove: "Remove",
    removeLabel: (name) => `Remove ${name} from your circle`,
    // section label above the toggles
    permissionsLabel: "What they can see",
  },

  perms: {
    sos: {
      label: "Emergency (SOS) contact",
      hint: "We may reach them if you ever raise an alarm.",
    },
    mood: {
      label: "See my mood and daily logs",
      hint: "The day's summary — never your private notes or voice notes.",
    },
    health: {
      label: "See my health entries and appointments",
      hint: "Medicines, readings, and upcoming visits.",
    },
    reminders: {
      label: "Add or edit my reminders",
      hint: "Gentle nudges in your app — never alarms you must rely on.",
    },
    location: {
      label: "See where I am",
      hint: "Only ever a coarse place, and only if you choose.",
      never: "Never",
      sosOnly: "Only during an SOS",
    },
  },

  toggle: { on: "On", off: "Off" },

  // Adding someone (the door leads somewhere real): one token, shown as
  // a 6-digit code to read aloud. Email/phone send + QR are the invite
  // lane's job; here we prove the code path end to end.
  invite: {
    open: "Add someone to my circle",
    intro: "Read this code aloud to them, or send it. It works once and lasts 48 hours.",
    generate: "Create an invite code",
    generating: "Creating…",
    codeLabel: "Your invite code",
    codeSpoken: "They enter it under “Join a circle” in their own app.",
    another: "Create another",
    close: "Done",
  },

  error: "Something didn't save. Please check your connection and try again.",
};
