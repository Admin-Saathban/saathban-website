/* ════════════════════════════════════════════════
   Skills — bilingual strings, local to this lane (English reference,
   Urdu draft pending native review). See QUESTIONS.md for the planned
   merge into the central `skills.*` namespace.

   SPEC.md, Skills: three cards — Languages, Courses, Earning — each a
   REAL description with a "Tell me when this opens" button. Interest
   is the demand signal; the shelves are never empty.
   ════════════════════════════════════════════════ */

// The three skills of v1. `key` matches the check constraint in
// migration 0012; adding a fourth is a card here plus a one-line
// migration.
export const SKILLS = ["languages", "courses", "earning"];

export const STRINGS = {
  en: {
    title: "Skills",
    subtitle: "New ways to learn, connect, and grow — tell us which you'd like, and we'll build those first.",
    interestCta: "Tell me when this opens",
    interestedCta: "We'll let you know",
    interestedNote: "You're on the list — we'll be in touch when it opens.",
    cards: {
      languages: {
        name: "Languages",
        emoji: "💬",
        desc: "Practise English, Urdu, or another language with others — reading, conversation, and confidence, at a gentle pace.",
      },
      courses: {
        name: "Courses",
        emoji: "📚",
        desc: "Short courses on things worth knowing — from using a smartphone with ease to history, poetry, and staying well.",
      },
      earning: {
        name: "Earning skills",
        emoji: "🌱",
        desc: "Skills that can bring in an income from home — tailoring, tutoring, handicrafts, and small online work.",
      },
    },
    saveError: "That didn't save just now. Please try again.",
    admin: {
      title: "Skill interest",
      subtitle: "How many people have asked to be told when each skill opens. This is the demand signal — not who, only how many.",
      countLabel: (n) => `${n} interested`,
      staffOnly: "This page is for Saathban staff.",
      loadError: "We couldn't load the counts just now.",
    },
  },
  ur: {
    // ⚠ Urdu draft — pending native review.
    title: "ہنر",
    subtitle: "سیکھنے، جُڑنے اور بڑھنے کے نئے راستے — بتائیں کون سا پسند ہے، ہم وہی پہلے بنائیں گے۔",
    interestCta: "جب یہ کھلے تو مجھے بتائیں",
    interestedCta: "ہم آپ کو بتا دیں گے",
    interestedNote: "آپ فہرست میں شامل ہیں — کھلنے پر ہم رابطہ کریں گے۔",
    cards: {
      languages: {
        name: "زبانیں",
        emoji: "💬",
        desc: "دوسروں کے ساتھ انگریزی، اردو یا کوئی اور زبان سیکھیں — پڑھنا، گفتگو اور اعتماد، نرم رفتار سے۔",
      },
      courses: {
        name: "کورسز",
        emoji: "📚",
        desc: "جاننے کے قابل چیزوں پر مختصر کورس — اسمارٹ فون کے آسان استعمال سے لے کر تاریخ، شاعری اور تندرستی تک۔",
      },
      earning: {
        name: "کمائی کے ہنر",
        emoji: "🌱",
        desc: "گھر بیٹھے آمدنی لانے والے ہنر — سلائی، ٹیوشن، دستکاری اور چھوٹا آن لائن کام۔",
      },
    },
    saveError: "ابھی محفوظ نہیں ہو سکا۔ براہِ کرم دوبارہ کوشش کریں۔",
    admin: {
      title: "ہنر میں دلچسپی",
      subtitle: "ہر ہنر کے کھلنے پر اطلاع مانگنے والوں کی تعداد۔ یہ طلب کا اشارہ ہے — کون نہیں، صرف کتنے۔",
      countLabel: (n) => `${n} دلچسپی رکھتے ہیں`,
      staffOnly: "یہ صفحہ ساتھ بن کے عملے کے لیے ہے۔",
      loadError: "ابھی تعداد نہیں کھل سکی۔",
    },
  },
};
