/* ════════════════════════════════════════════════
   Community lane — copy and the money-talk pattern.

   English only for now: the locales files belong to the i18n lane
   (QUESTIONS.md C8). Structured like famCopy was pre-extraction so the
   later lift into en.js/ur.js under community.* is mechanical.

   Copy rules (SPEC.md, Principles): never "elderly", never "user",
   warm, nothing clinical; the feed is a shared verandah, not a metric.
   ════════════════════════════════════════════════ */

export const COPY = {
  feed: {
    title: "Community",
    intro: "What people are sharing, newest first. No rankings, no feeds within feeds — just neighbours.",
    emptyFeed: "Nothing here yet. The first post starts the conversation.",
    noAccess:
      "The community opens for Saath-Buddies once volunteering begins — after your application is through.",
    loadError: "That didn't load. Please try again in a moment.",
    composerPlaceholder: "Share something with the community…",
    composerCta: "Share",
    composerImage: "Add a photo",
    composerImageChosen: "Photo attached — tap to change",
    posting: "Sharing…",
    postError: "That didn't send. Please try again.",
    orgBadge: "Saathban",
    announcement: "Announcement",
    messagesCta: "Messages",
    comments: "Comments",
    commentPlaceholder: "Write a comment…",
    commentCta: "Send",
    noComments: "No comments yet.",
    reactAria: "React to this post",
    menuAria: "More actions",
    menuReport: "Report",
    menuMute: "Mute this person",
    menuBlock: "Block this person",
    menuMessage: "Send a message request",
    menuDeleteOwn: "Remove my post",
    reportPrompt: "Tell us briefly what's wrong (optional):",
    reportedToast: "Thank you. Our team will look at this quickly.",
    mutedToast: "Muted. You won't see their posts any more.",
    blockedToast: "Blocked. You won't see them, and messages are closed both ways.",
    undo: "Undo",
    dmRequestedToast: "Request sent. If they accept, you'll find the conversation under Messages.",
    dmRequestFailed: "That request couldn't be sent right now.",
  },

  dm: {
    title: "Messages",
    backToFeed: "Back to the community",
    intro: "Conversations start with a request — nothing lands in your messages unless you said yes.",
    requestsLabel: "Requests for you",
    requestLine: "would like to message you.",
    accept: "Accept",
    decline: "Decline",
    declinedNote: "Declined. They won't be told.",
    outgoingLabel: "Waiting for a yes",
    outgoingLine: "hasn't answered yet. They're never told about declines.",
    threadsLabel: "Conversations",
    emptyThreads: "No conversations yet.",
    empty: "Nothing here yet. When someone sends you a request, it appears here.",
    threadPlaceholder: "Write a message…",
    threadSend: "Send",
    sendError: "That didn't send. The conversation may have closed.",
    moneyWarning:
      "A gentle caution: this message mentions money. Saathban never involves money between members — no lending, no giving, no 'emergencies'. If something feels off, report it.",
    reportMessage: "Report this message",
    loadError: "That didn't load. Please try again in a moment.",
  },
};

/* Money-talk pattern (SPEC.md: money-talk patterns in a DM trigger a
   warning banner to the recipient). Deliberately over-broad, advisory
   only, checked client-side on render — nothing is blocked or logged
   (QUESTIONS.md C6). English + Urdu keywords. */
export const MONEY_PATTERN = new RegExp(
  [
    "\\brs\\.?\\s?\\d",
    "₨",
    "\\brupees?\\b",
    "\\brupay\\b",
    "\\bpais[ae]\\b",
    "\\beasypaisa\\b",
    "\\bjazz\\s?cash\\b",
    "\\bbank\\b",
    "\\biban\\b",
    "\\baccount\\s+number\\b",
    "\\bwestern\\s+union\\b",
    "\\bmoneygram\\b",
    "\\bloan\\b",
    "\\budhaar\\b",
    "\\bqarz\\b",
    "پیسے",
    "پیسہ",
    "رقم",
    "روپے",
    "بینک",
    "اکاؤنٹ",
    "قرض",
    "ادھار",
  ].join("|"),
  "i"
);

export const REACTIONS = ["👍", "❤️", "🌸", "🤲"];
