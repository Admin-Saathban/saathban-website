/* ════════════════════════════════════════════════
   What a calendar entry lets you DO — PRODUCT_DECISIONS §13.

   "A calendar entry that's only text is a note. An entry must offer
   the action that fits it, at its time."

   §13 gives four worked examples, and they are not decoration — they
   are the specification, one per kind:

     Sunday 4pm — Chai Reunion  → open the event, message who's going
     Tuesday 10am — doctor      → tell your circle you're heading out
     Thursday — Ammi's birthday → call her, send a sticker, post a wish
     Friday — Sara visiting     → message her

   The rule underneath them: the action is what a person would want to
   DO about this entry at its time — not what the app can most easily
   offer. "Tell your circle you're heading out" is the doctor's
   appointment's action because that is the thing a person actually
   does before leaving the house, and no amount of it being an unusual
   feature makes "open" the right answer instead.

   Pure: takes an entry, returns a list of {key, to, kind}. No React,
   no data fetching, so the mapping can be pinned by a test without a
   browser — and so that adding a kind cannot quietly leave it
   actionless, because the test asks every kind for its actions.

   §11 is respected by construction: every action is a ROUTE to where
   the result lives, never a fire-and-forget that leaves you on the
   calendar wondering whether anything happened.
   ════════════════════════════════════════════════ */

export const KINDS = ["event", "outing", "birthday", "appointment", "visiting", "custom_reminder", "personal"];

/* Icons that read as the thing, not as a category. */
export const KIND_ICON = {
  event: "🎪",
  outing: "🌳",
  birthday: "🎂",
  appointment: "🩺",
  visiting: "🚪",
  custom_reminder: "⏰",
  personal: "📌",
};

/**
 * The actions this entry offers.
 * @param {object} entry  {kind, refId, personId, personName}
 * @returns {Array<{key: string, to: string|null, primary?: boolean}>}
 */
export function actionsFor(entry) {
  const person = entry?.personId ? `/app/people/${entry.personId}` : null;
  const chat = person ? `${person}/chat` : null;

  switch (entry?.kind) {
    /* An event you said yes to: open it, and reach the people going.
       Both, because "open the event" answers "where is it again?" and
       "message who's going" answers "shall we go together?" */
    case "event":
      return [
        { key: "openEvent", to: entry.refId ? `/app/events/all` : "/app/events/all", primary: true },
        { key: "messageGoing", to: "/app/people" },
      ];

    /* Something on at a place — an outing or a "who's up for chai?".
       It lives on What's on, which is where joining and seeing who
       else is coming both happen (§12). */
    case "outing":
      return [{ key: "openHappening", to: "/app/outdoor", primary: true }];

    /* §13's own example, and the one most likely to be got wrong: a
       birthday's action is to REACH THE PERSON, not to open a card.
       Message first because it works at any hour and needs nobody to
       pick up; the community wish is second because it is public and
       not everyone wants that. */
    case "birthday":
      return [
        { key: "messageThem", to: chat, primary: true },
        { key: "postAWish", to: "/app/community" },
      ];

    /* The doctor. §13: "tell your circle you're heading out." Not a
       reminder, not an alarm — a person letting the people who care
       know where they are. It goes to My Circle, which is where that
       is said. */
    case "appointment":
      return [{ key: "tellMyCircle", to: "/app/circle", primary: true }];

    /* Sara visiting: message her. If the entry does not say who, there
       is nobody to message and the entry offers nothing rather than a
       button that goes to a list and shrugs. */
    case "visiting":
      return chat ? [{ key: "messageThem", to: chat, primary: true }] : [];

    /* A one-off reminder and a personal note are already the thing
       they are. Neither gets a made-up action: §0.6's spirit — an
       action that would be empty is ABSENT, not a disabled button. */
    case "custom_reminder":
    case "personal":
    default:
      return [];
  }
}

/* Which entries belong to whom. §13: "Fam and Buddies get their own
   calendars, holding what's relevant to them."

   A Fam member's calendar is about their person and their own life; a
   Buddy's is about the visits and events they are helping with. What
   neither gets is the other's — and a Buddy never gets an Icon's
   private entries, which is a rule the database enforces (owner-only
   rows) and this only mirrors for the UI. */
export function kindsForRole(role) {
  switch (role) {
    case "saath_buddy":
      /* No personal notes about somebody else's life, and no
         birthdays from a circle a Buddy is not in. */
      return ["event", "outing", "appointment", "custom_reminder", "personal"];
    case "family_member":
      return ["event", "outing", "birthday", "visiting", "custom_reminder", "personal"];
    default:
      return KINDS;
  }
}

/* MEDICATION IS DELIBERATELY ABSENT (§13): it recurs daily and would
   bury everything that makes a given day different. Reminders handle
   it. This constant exists so the exclusion is visible rather than
   merely unimplemented — the next person adding a kind meets it. */
export const EXCLUDED_KINDS = ["medication"];
