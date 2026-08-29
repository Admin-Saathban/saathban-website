/* ════════════════════════════════════════════════
   "Suggest a gathering" — bilingual strings, local to this flow.

   Kept here (not in the central locales/) so the proposals flow stays
   self-contained and its commit touches only its own paths — the rest
   of the events lane already reads central `t("events.*")`. See
   PROPOSALS_WIRING.md for the planned merge into `events.proposals.*`.
   English is the reference; Urdu is a DRAFT pending native review.

   Resolve in a component with:
     const { lang } = useI18n();
     const s = STRINGS[lang] || STRINGS.en;
   ════════════════════════════════════════════════ */

export const STRINGS = {
  en: {
    // Entry point on the Gatherings list
    listCta: "Suggest a gathering",

    // The Icon's form
    title: "Suggest a gathering",
    intro: "Have an idea for a get-together? Tell us, and our team will take it from there.",
    backToEvents: "Back to gatherings",
    titleLabel: "What's the gathering?",
    titlePh: "For example: Morning walk and chai",
    placeLabel: "Where?",
    placeChoose: "Choose a place…",
    placeOwnLabel: "…or type a place of your own",
    placeOwnPh: "For example: the tea stall by the park",
    dateLabel: "Which day?",
    timeLabel: "At what time? (optional)",
    noteLabel: "Anything else? (optional)",
    notePh: "What you'd love to do, who it's for…",
    submitCta: "Send my suggestion",
    sending: "Sending…",
    sentTitle: "Thank you — your suggestion is in.",
    sentBody:
      "Our team will have a look. If it becomes a gathering you'll see it on the events page — and either way, we'll let you know.",
    another: "Suggest another",
    errTitle: "Please give the gathering a name.",
    errDate: "Please choose a day.",
    errPlace: "Please pick a place, or type one of your own.",
    errGeneric: "That didn't send just now. Please try again in a moment.",

    // Admin review section (inside events → Manage)
    admin: {
      heading: "Suggestions from the community",
      empty: "No suggestions waiting right now.",
      loadError: "We couldn't load the suggestions just now.",
      suggestedBy: (name) => `Suggested by ${name}`,
      noteLabel: "Their note",
      approveCta: "Approve & publish",
      approving: "Publishing…",
      declineCta: "Decline kindly",
      declinePromptLabel: (name) => `A kind message to ${name}`,
      declinePromptPh: "For example: We love this — could you suggest another date?",
      declineSend: "Send reply",
      declining: "Sending…",
      cancel: "Cancel",
      approvedToast: (name) => `Published — it's on the events page, credited to ${name}.`,
      declinedToast: (name) => `Sent. ${name} will receive your message.`,
      needMessage: "Please write a short message first.",
      actionError: "That didn't go through. Please try again.",
    },
  },

  ur: {
    // ⚠ Urdu draft — pending native review.
    listCta: "کوئی محفل تجویز کریں",

    title: "کوئی محفل تجویز کریں",
    intro: "کسی ملاقات کا خیال ہے؟ ہمیں بتائیں، آگے کا کام ہماری ٹیم سنبھال لے گی۔",
    backToEvents: "واپس محفلوں کی طرف",
    titleLabel: "محفل کیا ہے؟",
    titlePh: "مثلاً: صبح کی سیر اور چائے",
    placeLabel: "کہاں؟",
    placeChoose: "کوئی جگہ چنیں…",
    placeOwnLabel: "…یا اپنی کوئی جگہ لکھیں",
    placeOwnPh: "مثلاً: پارک کے پاس چائے کا کھوکھا",
    dateLabel: "کس دن؟",
    timeLabel: "کس وقت؟ (اختیاری)",
    noteLabel: "اور کچھ؟ (اختیاری)",
    notePh: "آپ کیا کرنا چاہیں گے، یہ کس کے لیے ہے…",
    submitCta: "میری تجویز بھیجیں",
    sending: "بھیجی جا رہی ہے…",
    sentTitle: "شکریہ — آپ کی تجویز موصول ہو گئی۔",
    sentBody:
      "ہماری ٹیم اسے دیکھے گی۔ اگر یہ محفل بن گئی تو آپ کو ایونٹس کے صفحے پر نظر آئے گی — اور ہر صورت ہم آپ کو بتائیں گے۔",
    another: "ایک اور تجویز کریں",
    errTitle: "براہِ کرم محفل کو کوئی نام دیں۔",
    errDate: "براہِ کرم کوئی دن چنیں۔",
    errPlace: "براہِ کرم کوئی جگہ چنیں، یا اپنی کوئی لکھیں۔",
    errGeneric: "ابھی نہیں بھیجی جا سکی۔ تھوڑی دیر میں دوبارہ کوشش کریں۔",

    admin: {
      heading: "برادری کی تجاویز",
      empty: "ابھی کوئی تجویز زیرِ انتظار نہیں۔",
      loadError: "ابھی تجاویز نہیں کھل سکیں۔",
      suggestedBy: (name) => `${name} کی تجویز`,
      noteLabel: "ان کا نوٹ",
      approveCta: "منظور کر کے شائع کریں",
      approving: "شائع ہو رہی ہے…",
      declineCta: "نرمی سے معذرت",
      declinePromptLabel: (name) => `${name} کے لیے ایک نرم پیغام`,
      declinePromptPh: "مثلاً: خیال بہت اچھا ہے — کیا آپ کوئی اور دن تجویز کر سکتے ہیں؟",
      declineSend: "جواب بھیجیں",
      declining: "بھیجا جا رہا ہے…",
      cancel: "منسوخ",
      approvedToast: (name) => `شائع ہو گئی — ایونٹس کے صفحے پر ہے، ${name} کے نام کے ساتھ۔`,
      declinedToast: (name) => `بھیج دیا۔ ${name} کو آپ کا پیغام مل جائے گا۔`,
      needMessage: "براہِ کرم پہلے ایک مختصر پیغام لکھیں۔",
      actionError: "یہ نہیں ہو سکا۔ براہِ کرم دوبارہ کوشش کریں۔",
    },
  },
};
