/* Milestones lane — UI copy in one place for the Urdu extraction
   (locales/ under milestones.*). Badge names and descriptions are NOT
   here: they are content rows in the badges table, already in both
   languages — the screens pick name_en/name_ur by the active locale.

   Copy rules (SPEC.md): participation, never performance; no
   comparison with anyone, ever; a quiet stretch is met with warmth. */

export const COPY = {
  title: "Your milestones",
  intro:
    "Points and badges here celebrate one thing only: you showing up, in your own way. Nothing on this page compares you with anyone.",

  points: {
    label: "points",
    line: "Every log earns the same — a rest day counts exactly like a busy one.",
  },

  arc: {
    title: "Your first hundred days",
    line: (days) =>
      days === 0
        ? "The first day is waiting whenever you are."
        : days === 1
        ? "Day one is in the book."
        : `${days} days of your company so far.`,
    done: "One hundred days — and counting. Thank you for every one.",
    note: "The count never resets. Quiet weeks don't undo a single day.",
  },

  streak: {
    line: (n) =>
      n === 0
        ? "Today is a fine day to begin again — nothing is lost."
        : n === 1
        ? "Present today."
        : `${n} days present in a row.`,
    forgiveness: "One quiet day never breaks it.",
  },

  badges: {
    earnedLabel: "Yours",
    aheadLabel: "Still ahead",
    aheadNote: "These aren't tasks — they'll find you on their own.",
    earnedOn: (date) => `Earned ${date}`,
    noteFrom: "A note from Saathban",
  },

  celebration: {
    heading: "A new badge!",
    continueCta: "Lovely — continue",
    messageLabel: "A note from Saathban, just for you",
  },

  admin: {
    title: "Milestone messages",
    intro:
      "Recent badge awards across Saathban. Attach a personal note to any of them — it reaches the person as a notification, with your words, not a template.",
    empty: "No awards yet.",
    attachCta: "Write a note",
    sendCta: "Send the note",
    cancelCta: "Cancel",
    placeholder: "For example: Zubaida ji, a hundred days! We noticed, and we're so glad you're here. — Maheen",
    sentNote: "Sent. It's on its way as a notification.",
    alreadySent: (date) => `Note sent ${date}`,
    error: "That didn't send — please try again.",
  },

  loadError: "That didn't load. Please try again in a moment.",
};
