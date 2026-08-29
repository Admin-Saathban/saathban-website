/* ════════════════════════════════════════════════
   Outdoor lane — copy. English only for now, structured for the
   mechanical lift into en.js/ur.js under outdoor.* by the i18n lane
   (same convention as communityCopy.js; see QUESTIONS.md).

   Copy rules (SPEC.md): warm, never clinical; presence is coarse and
   chosen ("at the park"), never a pin, never a track.
   ════════════════════════════════════════════════ */

export const COPY = {
  home: {
    title: "Outdoor",
    intro:
      "Good places to be out and about — parks, markets, courtyards. Check in when you arrive so company can find you. Nothing is tracked, ever: you say where you are, or nobody knows.",
    loadError: "That didn't load. Please try again in a moment.",
    hereNowOne: "1 person here now",
    hereNowMany: "{n} people here now",
    noAccess:
      "Outdoor opens for Saath-Buddies once volunteering begins — after your application is through.",
  },

  place: {
    backToPlaces: "All places",
    expiresNote: "Check-ins fade away on their own after about 2 hours.",
    checkedInUntil: "You're checked in here until about {time}.",
    leaveCta: "I've left",
    checkInCta: "Check in — I'm here",
    checkinFailed: "That didn't work — please try again.",
    visibilityLabel: "Who can see that you're here?",
    visConnections: "My circle only",
    visConnectionsHint: "Just the people you've invited into your circle.",
    visBoard: "Announce on the park board",
    visBoardHint: "Anyone from the community at this place sees your first name.",
    hereNowLabel: "Here now",
    nobodyHere: "Nobody has checked in just now.",
    outingsLabel: "Planned outings",
    noOutings: "Nothing planned yet — be the first.",
    planCta: "Plan an outing",
    outingWhen: "When?",
    outingNote: "A note, if you like",
    outingNotePh: "e.g. Morning walk, then chai",
    outingSave: "Save outing",
    formCancel: "Cancel",
    outingRemove: "Remove",
    boardLabel: "Park board",
    boardIntro: "An open notice-board for this place. Kind words travel far.",
    boardPh: "Write to the board…",
    boardSend: "Post",
    boardEmpty: "Nothing on the board yet.",
    report: "Report",
    block: "Block",
    reportedToast: "Thank you. Our team will look at this quickly.",
    blockedToast: "Blocked. You won't see them here or in the community.",
    undo: "Undo",
  },
};

export const TYPE_ICONS = {
  park: "🌳",
  mosque: "🕌",
  market: "🛍️",
  community_centre: "🏛️",
  walking_track: "🚶",
  seafront: "🌊",
};

/* First name only, everywhere presence is shown (SPEC.md). */
export const firstNameOf = (fullName) => (fullName || "").trim().split(/\s+/)[0] || "…";
