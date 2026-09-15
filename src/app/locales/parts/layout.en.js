/* Layout strings (English) — the app at every width. Deep-merged over en.js.

   adminPanel  the header's way into the admin panel, shown only to an
               admin who is somewhere in the app outside /app/admin.
   skipToTabs  the first thing a keyboard reaches on any screen; Enter
               puts focus on the tab you are on.
   signOut     the way out of the account (lib/signOut.jsx): the More
               drawer's last row, Account settings, and the one question
               asked before leaving. "of Saathban" and "on this phone" are
               deliberate — it must not read as closing the app. */
export default {
  layout: {
    adminPanel: "Admin panel",
    skipToTabs: "Go to the tabs",
    signOut: {
      row: "Sign out of Saathban",
      rowHint: "To come back in, you will need your email address",
      title: "Sign out of Saathban on this phone?",
      body: "Your account stays just as it is. To come back in, you will need your email address.",
      sendingTitle: "Sending your daily log first",
      sendingBody: "Some of your daily log has not been sent yet. Sending it now, before you sign out…",
      sentOne: "1 entry from your daily log has just been sent.",
      sentMany: "{n} entries from your daily log have just been sent.",
      unsentTitle: "Some of your daily log has not been sent",
      unsentLogsOne: "1 entry from your daily log has not been sent.",
      unsentLogsMany: "{n} entries from your daily log have not been sent.",
      unsentPrefs: "Changes to your daily log settings have not been sent either.",
      whyOffline: "This phone is not connected to the internet right now.",
      whyFailed: "We tried to send it just now, and that did not work.",
      lostOne: "If you sign out now, it will be lost from this phone. If you stay signed in, it will be sent when the connection is working.",
      lostMany: "If you sign out now, they will be lost from this phone. If you stay signed in, they will be sent when the connection is working.",
      stay: "Stay signed in",
      confirm: "Sign out",
      confirmAnyway: "Sign out anyway",
      leaving: "Signing out…",
    },
  },
};
