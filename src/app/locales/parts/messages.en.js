/* Messages structure (English). Deep-merged over en.js at load.

   Owner, 2026-09-13: Chats shows only conversations; + New chat holds
   everything about starting one — the people you know, finding someone
   new by name, inviting someone who is not here, and the "Not heard
   from" faces. */
export default {
  msg: {
    newChat: {
      knownTitle: "People you know",
      showAll: "Show everyone ({n})",
      findTitle: "Find someone new",
      findBody: "Search for someone on Saathban by name. Your first message reaches them as a request, and they decide whether to reply.",
      findPh: "Type a name",
      findHint: "Type at least 3 letters of their name.",
      searching: "Searching",
      findNone: "Nobody on Saathban by that name. If they are not here yet, you can invite them below.",
      findFailed: "That search did not work just now. Please try again in a moment.",
      known: "You know each other",
      askTitle: "Write to {name}?",
      askBody: "{name} will get your first message as a request. You can send one message, and they choose whether to reply.",
      askConfirm: "Write to {name}",
      askCancel: "Not now",
      errNotMet: "{name} takes first messages only from people they have met on Saathban — in a group, a game or at a place.",
      errConnected: "{name} takes messages only from people they are connected to.",
      errProfile: "Please finish your profile before writing to someone new.",
      errTooMany: "You have written to five new people today. You can write to more tomorrow.",
      errFailed: "That did not go through. Please try again in a moment.",
      inviteTitle: "Not on Saathban yet?",
    },
    drifted: {
      hint: "People you have written to before. Tap a face to say hello.",
    },
  },
};
