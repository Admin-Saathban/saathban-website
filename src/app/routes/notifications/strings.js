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
    unread: "unread",
    unreadLabel: (n) => `${n} unread`,
    bellLabel: "Notifications",
    loadError: "We couldn't load your notifications just now. Please try again.",
    justNow: "Just now",
    ago: (s) => `${s} ago`,
  },
  ur: {
    // ⚠ Urdu draft — pending native review.
    title: "اطلاعات",
    subtitle: "ساتھ بن اور آپ کے حلقے کی طرف سے پیغامات۔",
    empty: "ابھی کچھ نیا نہیں۔ جب ہوگا ہم آپ کو بتا دیں گے۔",
    markAll: "سب کو پڑھا ہوا نشان زد کریں",
    markOne: "پڑھا ہوا نشان زد کریں",
    unread: "غیر پڑھی",
    unreadLabel: (n) => `${n} غیر پڑھی`,
    bellLabel: "اطلاعات",
    loadError: "اس وقت آپ کی اطلاعات نہیں کھل سکیں۔ براہِ کرم دوبارہ کوشش کریں۔",
    justNow: "ابھی ابھی",
    ago: (s) => `${s} پہلے`,
  },
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
