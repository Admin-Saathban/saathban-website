/* Events lane — all user-facing copy in one place (per-lane
   convention), so the Urdu pass is a one-file extraction into
   locales/ under events.*. Interpolating strings are functions and
   become {name}-style templates on extraction.

   Copy rules (SPEC.md): never "elderly", never "user"; family is
   welcome alongside, never assumed. */

export const COPY = {
  nav: {
    events: "Gatherings",
    calendar: "My calendar",
    manage: "Manage",
  },

  list: {
    title: "Gatherings",
    intro:
      "Saathban events near and far — company, chai, and something to look forward to.",
    upcomingLabel: "Coming up",
    pastLabel: "Past gatherings",
    noUpcoming:
      "Nothing scheduled at this moment — new gatherings appear here the day they're announced.",
    capacity: (going, cap) => `${going} of ${cap} places taken`,
    openToAll: "Open to all — no limit on places",
    goingCount: (n) => (n === 1 ? "1 person going so far" : `${n} people going so far`),
    rsvpCta: "Count me in",
    goingBadge: "You're going",
    cancelCta: "Change of plans?",
    fullNote: "This one is full — the next gathering will have your name on it.",
    famNote: "Family are welcome alongside — no sign-up needed to accompany someone.",
    siteBadge: "From saathban.com",
    loadError: "That didn't load. Please try again in a moment.",
    rsvpError: "That didn't go through — please try again.",
  },

  calendar: {
    title: "My calendar",
    intro:
      "Gatherings you've said yes to, plus your own dates — birthdays, reminders, anything worth remembering.",
    empty: "Nothing here yet. Add a date below, or say yes to a gathering.",
    addCta: "Add a date",
    kindLabel: "What kind of date?",
    kinds: {
      personal: "Something personal",
      birthday: "A birthday",
      custom_reminder: "A reminder",
    },
    titleField: "What is it?",
    titlePlaceholder: "For example: Amna's birthday, pension office visit",
    dateField: "Which day?",
    timeField: "At what time? (optional)",
    yearlyNote: "Birthdays come back every year on their own.",
    saveCta: "Save it",
    cancelCta: "Cancel",
    deleteCta: "Remove",
    eventTag: "Gathering",
    saveError: "That didn't save. Please try again in a moment.",
  },

  admin: {
    title: "Manage gatherings",
    intro:
      "Events created here appear in the app the moment they're published. The marketing site's events remain in src/shared/eventsData.js.",
    newCta: "New gathering",
    editCta: "Edit",
    draftPill: "Draft",
    publishedPill: "Published",
    fields: {
      title: "Title",
      description: "Description",
      venue: "Venue",
      city: "City",
      date: "Date",
      start: "Starts",
      end: "Ends (optional)",
      capacity: "Places (leave empty for no limit)",
      published: "Published — visible in the app",
    },
    saveCta: "Save gathering",
    cancelCta: "Cancel",
    attendeesLabel: (n) => (n === 1 ? "1 going" : `${n} going`),
    attendeesCta: "Door list",
    checkinCta: "Mark arrived",
    checkedinBadge: "Arrived",
    undoCta: "Undo",
    noAttendees: "No RSVPs yet.",
    saveError: "That didn't save — check the fields and try again.",
  },
};
