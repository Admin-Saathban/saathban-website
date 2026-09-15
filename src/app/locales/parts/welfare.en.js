/* Welfare check-ins (English). Deep-merged over en.js at load.
   The notice an Icon reads before a check-in can ever happen (0182), and
   the staff screen that lists people whose days have been low (0183–0185).
   Audit sentences live with the rest of the audit log, in admin.en.js. */
export default {
  welfare: {
    notice: {
      title: "If a few days feel heavy",
      body: "If your mood log shows several low days in a row, someone from Saathban may get in touch, simply to ask how you are.",
      onlyThat: "They are told only that there have been some low days in a row. They never see which moods you chose, your notes, or anything else you have logged.",
      aPerson: "It is a person checking in, the way a friend would. It is not an alarm, and it is not an emergency service.",
      noMessage: "The app will not send you a message about it — at most, a person may get in touch.",
      urgent: "If you ever need help straight away, please call someone near you or your local emergency number.",
      ok: "I understand",
      busy: "One moment…",
    },

    admin: {
      nav: "Welfare check-ins",
      title: "Welfare check-ins",
      intro: "People whose mood log has shown three or more low days in a row. That is all you see — never which moods they chose, their notes, or any other log. A check-in is a person asking how they are, not an emergency response. Opening this list is written to the audit log.",
      rule: "A day with no mood entry, or a rest day, does not end a run. A run ends when they log a better mood, or when a check-in is recorded.",
      opening: "Opening the list…",
      openFailed: "The list could not be opened. Please try again.",
      notAllowed: "Your account cannot open this list.",
      empty: "Nobody's days have been low for a while.",
      emptyNote: "When someone's mood log shows three low days in a row, their name appears here.",
      countOne: "{n} person",
      countMany: "{n} people",
      unnamed: "Someone with no name on their account",
      daysOne: "{n} low day in a row",
      daysMany: "{n} low days in a row",
      since: "since {date}",
      lastLow: "Most recent low day: {date}",
      tried: "Tried {date} — no answer",
      back: "← Back to the list",
      close: "Close",
      f: {
        run: "Low days",
        told: "Told about check-ins",
        reach: "How to reach them",
        email: "Email",
        phone: "Phone",
        noPhone: "No phone number on their account.",
        phoneHidden: "Phone numbers are shown to super-admins only.",
        openPerson: "Open their page — send a message from Saathban →",
        last: "Last check-in",
        none: "No check-in recorded yet.",
        by: "by {name}",
        note: "Note",
      },
      record: {
        title: "Record a check-in",
        what: "What happened",
        hint: {
          spoke: "They leave this list. If low days carry on, they can come back after seven days.",
          no_answer: "They stay on this list, so someone can try again.",
          not_needed: "They leave this list — for example, you already know they are being looked after. They can come back after seven days.",
        },
        noteLabel: "A short note for staff (optional)",
        noteHint: "Seen by staff only. Up to 500 characters. Write what helps the next person — not what they told you in confidence.",
        noteCount: "{n} of 500",
        save: "Record this check-in",
        saving: "Recording…",
        pick: "Choose what happened first.",
        savedGone: "Recorded. {name} has left the list.",
        savedStays: "Recorded. {name} stays on the list so someone can try again.",
        failed: "That was not recorded. Please try again.",
        notListed: "{name} is no longer on the list, so nothing was recorded.",
      },
      outcome: {
        spoke: "I spoke to them",
        no_answer: "No answer",
        not_needed: "Not needed",
      },
      front: {
        peopleOne: "{n} person whose days have been low",
        peopleMany: "{n} people whose days have been low",
        detail: "Three or more low days in a row — a check-in may help",
      },
    },
  },

  admin: {
    work: {
      kind: {
        welfare: "Someone's days have been low for a while",
      },
    },
  },
};
