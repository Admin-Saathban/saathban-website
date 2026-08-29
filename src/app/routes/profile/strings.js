/* ════════════════════════════════════════════════
   Profile — bilingual strings, local to this lane (English reference,
   Urdu draft pending native review). See QUESTIONS.md for the planned
   merge into the central `profile.*` namespace.

   Role names are NOT here — they live in constants/roles.js
   (ROLE_DISPLAY), the one place display names change (SPEC.md, Roles).
   ════════════════════════════════════════════════ */

export const STRINGS = {
  en: {
    title: "Your profile",
    subtitle: "Your details, in your hands. Change them whenever you like.",
    // Warm, role-respectful — every role is honoured, none is framed as lesser.
    roleLine: (role) => `You're part of Saathban as ${role}.`,
    nameLabel: "Your name",
    cityLabel: "City",
    cityHint: "Helps us point you to what's happening nearby. Optional.",
    languagesLabel: "Languages you speak",
    languagesHint: "Separate with commas — for example: Urdu, Punjabi, English.",
    save: "Save changes",
    saving: "Saving…",
    saved: "Saved.",
    nameRequired: "Please tell us your name.",
    loadError: "We couldn't load your profile just now. Please try again.",
    saveError: "That didn't save. Please check your connection and try again.",
    noLanguages: "None added yet",
  },
  ur: {
    // ⚠ Urdu draft — pending native review.
    title: "آپ کی پروفائل",
    subtitle: "آپ کی تفصیلات، آپ کے اختیار میں۔ جب چاہیں تبدیل کریں۔",
    roleLine: (role) => `آپ ساتھ بن کا حصہ ہیں بطور ${role}۔`,
    nameLabel: "آپ کا نام",
    cityLabel: "شہر",
    cityHint: "قریب کی سرگرمیوں تک رہنمائی میں مدد دیتا ہے۔ اختیاری۔",
    languagesLabel: "آپ کو آنے والی زبانیں",
    languagesHint: "کوما سے الگ کریں — مثلاً: اردو، پنجابی، انگریزی۔",
    save: "تبدیلیاں محفوظ کریں",
    saving: "محفوظ ہو رہا ہے…",
    saved: "محفوظ ہو گیا۔",
    nameRequired: "براہِ کرم اپنا نام بتائیں۔",
    loadError: "اس وقت آپ کی پروفائل نہیں کھل سکی۔ براہِ کرم دوبارہ کوشش کریں۔",
    saveError: "محفوظ نہیں ہو سکا۔ براہِ کرم اپنا رابطہ جانچیں اور دوبارہ کوشش کریں۔",
    noLanguages: "ابھی کوئی شامل نہیں",
  },
};
