/* ════════════════════════════════════════════════
   Notifications — bilingual strings, local to this lane.

   English is the reference; Urdu is a DRAFT pending native review
   (same posture as locales/ur.js). Kept here rather than in the shared
   locales/ files so this lane stays self-contained and its commit
   touches only its own paths — see QUESTIONS.md for the planned merge
   into the central `notifications.*` namespace.

   Resolve in a component with:
     const { lang } = useI18n();
     const s = STRINGS[lang] || STRINGS.en;
   ════════════════════════════════════════════════ */

export const STRINGS = {
  en: {
    title: "Notifications",
    subtitle: "Messages from Saathban and your circle.",
    empty: "Nothing new right now. We'll let you know when there is.",
    markAll: "Mark all as read",
    markOne: "Mark as read",
    /* §6.1 — the off-switch has to be where the notification is. */
    mutePerson: "Stop telling me about them",
    muteKind: "Stop telling me about these",
    mutedPerson: "You won't hear about them again. You can undo this in Settings.",
    mutedKind: "You won't get these again. You can undo this in Settings.",
    muteFailed: "That didn't work. Please try again.",
    unread: "unread",
    unreadLabel: (n) => `${n} unread`,
    bellLabel: "Notifications",
    /* NAVIGATION_SPEC §7 — the report chain. Silence after reporting
       a neighbour is its own discomfort, so this is the destination
       AUDIT_11 flagged people/ThreadPage.jsx's report as needing. */
    seeAll: "See all notifications",
    reportsTitle: "What you reported",
    reportsNone: "You have not reported anything.",
    reportRef: "Reference {ref}",
    /* Never "pending". A person is waiting on a person, and the word
       for that is not a queue position. */
    reportOpen: "Someone at Saathban is looking at this",
    reportResolved: "Acted on",
    reportDismissed: "Looked at, nothing needed",
    reportKind: { post: "A post", comment: "A comment", dm_message: "A message" },
    loadError: "We couldn't load your notifications just now. Please try again.",
    justNow: "Just now",
    ago: (s) => `${s} ago`,
    kinds: {
      general: "Saathban",
      broadcast: "Announcement",
      document_request: "Your application",
      document_response: "Application review",
      question_reply: "Your question",
      reminder: "Reminder",
      milestone: "Milestone",
      game: "Games",
      group: "Groups",
      social: "Friends",
      dm: "Message",
      circle: "My Circle",
    },
  },
  ur: {
    // ⚠ Urdu draft — pending native review.
    title: "اطلاعات",
    subtitle: "ساتھ بن اور آپ کے حلقے کی طرف سے پیغامات۔",
    empty: "ابھی کچھ نیا نہیں۔ جب ہوگا ہم آپ کو بتا دیں گے۔",
    markAll: "سب کو پڑھا ہوا نشان زد کریں",
    markOne: "پڑھا ہوا نشان زد کریں",
    mutePerson: "ان کے بارے میں مجھے نہ بتائیں",
    muteKind: "ایسی باتیں مجھے نہ بتائیں",
    mutedPerson: "اب ان کے بارے میں نہیں بتایا جائے گا۔ ترتیبات میں واپس بدل سکتے ہیں۔",
    mutedKind: "اب یہ نہیں آئیں گی۔ ترتیبات میں واپس بدل سکتے ہیں۔",
    muteFailed: "یہ نہیں ہو سکا۔ دوبارہ کوشش کریں۔",
    unread: "غیر پڑھی",
    unreadLabel: (n) => `${n} غیر پڑھی`,
    bellLabel: "اطلاعات",
    seeAll: "تمام اطلاعات دیکھیں",
    reportsTitle: "آپ نے کیا رپورٹ کیا",
    reportsNone: "آپ نے کچھ رپورٹ نہیں کیا۔",
    reportRef: "حوالہ {ref}",
    reportOpen: "ساتھ بن میں کوئی اسے دیکھ رہا ہے",
    reportResolved: "کارروائی ہو گئی",
    reportDismissed: "دیکھ لیا، کچھ ضروری نہیں تھا",
    reportKind: { post: "ایک بات", comment: "ایک تبصرہ", dm_message: "ایک پیغام" },
    loadError: "اس وقت آپ کی اطلاعات نہیں کھل سکیں۔ براہِ کرم دوبارہ کوشش کریں۔",
    justNow: "ابھی ابھی",
    ago: (s) => `${s} پہلے`,
    kinds: {
      general: "ساتھ بن",
      broadcast: "اعلان",
      document_request: "آپ کی درخواست",
      document_response: "درخواست کا جائزہ",
      question_reply: "آپ کا سوال",
      reminder: "یاد دہانی",
      milestone: "سنگِ میل",
      game: "کھیل",
      group: "گروپ",
      social: "دوست",
      dm: "پیغام",
      circle: "میرا حلقہ",
    },
  },
};

/* One emoji per kind — a visual anchor beside the label, never the
   only signal (the label carries the words). Unknown kinds fall back
   to the bell. */
export const KIND_ICON = {
  general: "bell",
  broadcast: "announce",
  document_request: "document",
  document_response: "document",
  question_reply: "messages",
  reminder: "time",
  milestone: "badge",
  game: "dice",
  group: "people",
  social: "good",
  dm: "messages",
  circle: "helpOffer",
};

/* Relative time, language-neutral units resolved by the caller's copy.
   Returns { key } where key is one of justNow | ago, plus a value. */
export function relativeTime(iso, s) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const mins = Math.max(0, Math.round((now - then) / 60000));
  if (mins < 1) return s.justNow;
  if (mins < 60) return s.ago(`${mins}m`);
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return s.ago(`${hrs}h`);
  const days = Math.round(hrs / 24);
  return s.ago(`${days}d`);
}
