/* ════════════════════════════════════════════════
   Urdu strings — اردو

   ⚠ STATUS: drafted, pending native review. Every string below is a
   real Urdu draft (no [UR] placeholders remain), but the named Urdu
   owner on the Saathban team (SPEC.md, Language & accessibility) must
   review before launch — register, warmth, and regional word choice
   are editorial calls a native speaker signs off on.

   Register and tone rules applied throughout:
   - Always آپ, never تم — seniors are the honoured users.
   - Warm and dignified, nothing clinical, nothing childish.
   - Natural spoken Urdu over stiff literal translation.
   - Technical terms with no natural Urdu stay in common transliterated
     form: ای میل، ایپ، پاس ورڈ، سائن اِن، لنک، ڈیوائس.
   - Kept concise — Nastaliq runs long and wraps.

   Notes for future keys:
   - Structure must mirror en.js exactly — same keys, same nesting.
     If a key is missing here the app silently falls back to English.
   - New untranslated keys use TODO("english") so they render as
     "[UR] english" and are impossible to miss. Find them with:
     grep TODO src/app/locales/ur.js
   - {curly} placeholders are variables filled in by the app — keep
     them in the string, positioned wherever Urdu grammar wants them.
   ════════════════════════════════════════════════ */

// eslint-disable-next-line no-unused-vars
const TODO = (english) => `[UR] ${english}`;

const ur = {
  common: {
    appName: "ساتھ بن",
    backToHome: "مرکزی صفحے پر واپس",
    remove: "ہٹائیں",
  },

  settings: {
    title: "ترتیبات",

    dailyLog: {
      title: "آپ کا روزنامچہ",
      hint: "چنیں کہ آپ کے صفحۂ اول پر روز کیا نظر آئے۔ ہر چیز آپ کے اختیار میں ہے — کچھ بھی لازمی نہیں۔",
      moodAlways:
        "مزاج ہمیشہ روزنامچے کا حصہ رہتا ہے — اسی سے آپ کے ساتھی کو خبر ہوتی ہے کہ آج آپ کا دن کیسا ہے۔",
      modules: {
        mood: "مزاج",
        sleep: "نیند",
        medication: "دوائیں",
        exercise: "چلنا پھرنا",
        diet: "کھانا",
        water: "پانی",
      },
      meds: {
        title: "آپ کی دوائیں",
        hint: "ہر دوا کا نام، خوراک اور وقت لکھ دیں۔ یہ روزنامچے میں نشان لگانے کی سادہ فہرست بن جائے گی — یاد دہانی ساتھ ہے، مگر صرف اسی پر بھروسا نہ کریں۔",
        namePlaceholder: "دوا کا نام",
        dosePlaceholder: "خوراک",
        timePlaceholder: "کب",
        addCta: "دوا شامل کریں",
      },
      diet: {
        title: "آپ کے کھانوں کی فہرست",
        hint: "جن کھانوں کا آپ حساب رکھنا چاہیں۔ اپنی مرضی سے شامل کریں یا ہٹائیں — فہرست آپ کی ہے۔",
        addPlaceholder: "کوئی کھانا شامل کریں",
        addCta: "شامل کریں",
      },
      trackers: {
        title: "آپ کے اپنے معمولات",
        hint: "جو بھی آپ دیکھتے رہنا چاہیں — پودوں کو پانی، کسی کو فون، شام کی سیر۔ یہ بھی روزنامچے میں باقی چیزوں کی طرح نظر آئے گا۔",
        namePlaceholder: "آپ کس چیز کا حساب رکھنا چاہیں گے؟",
        types: {
          yesno: "ہوا / نہیں ہوا",
          count: "گنتی",
          note: "ایک نوٹ",
        },
        everyDay: "ہر روز",
        someDays: "کچھ دن",
        addCta: "معمول شامل کریں",
      },
    },

    language: {
      title: "زبان",
      hint: "وہ زبان چنیں جس میں ساتھ بن آپ سے بات کرے۔",
    },

    textSize: {
      title: "لکھائی کا سائز",
      hint: "ایپ کی ہر چیز بڑی کر لیں۔ یہ آپ کے فون کی اپنی ترتیب سے الگ ہے۔",
      sizes: {
        standard: "معیاری",
        large: "بڑا",
        larger: "اور بڑا",
        largest: "سب سے بڑا",
      },
    },

    preview: {
      title: "نمونہ",
      hint: "آپ کی چنی ہوئی ترتیبات کے ساتھ ایپ ایسی دکھائی دے گی۔",
      heading: "پارک میں ایک صبح",
      body: "آج موسم بہت خوشگوار ہے۔ گلشن پارک دس منٹ کے فاصلے پر ہے، اور واکنگ ٹریک دوپہر تک سائے میں رہتا ہے۔",
      button: "بہت خوب",
      scriptSampleLabel: "اردو رسم الخط کا نمونہ",
    },
  },

  auth: {
    common: {
      notMe: "یہ میں نہیں ہوں — دوبارہ شروع کریں",
      optional: "اختیاری",
      signedInAs: "آپ {email} کے طور پر سائن اِن ہیں۔",
      fullNameLabel: "آپ کا پورا نام",
      emailLabel: "ای میل پتہ",
      phoneLabel: "فون نمبر",
      cityLabel: "شہر",
      cityHint: "تاکہ ہم آپ کو قریب کی سرگرمیوں کی خبر دے سکیں۔ اسے آپ کبھی بھی بدل سکتے ہیں۔",
      countryLabel: "ملک",
      relationshipLabel: "وہ آپ کے کیا لگتے ہیں",
      relationshipHint: "مثلاً: میری والدہ، میرے چچا، کوئی عزیز ہمسایہ۔",
      languagesLabel: "آپ کون سی زبانیں بولتے ہیں",
      languagesHint: "کوما لگا کر لکھیں — مثلاً: اردو، پنجابی، انگریزی۔",
      passwordLabel: "پاس ورڈ",
      passwordHint: "کم از کم 8 حروف۔",
      errorName: "براہِ کرم اپنا نام لکھیں۔",
      errorEmail: "یہ ای میل پتہ مکمل نہیں لگتا — ذرا دیکھ لیں۔",
      errorPassword: "براہِ کرم کم از کم 8 حروف کا پاس ورڈ چنیں۔",
      errorGeneric: "ہماری طرف سے کچھ گڑبڑ ہو گئی۔ براہِ کرم دوبارہ کوشش کریں۔",
      finishCta: "سب تیار — مجھے اندر لے چلیں",
    },

    roleSelect: {
      title: "آپ ساتھ بن کا حصہ کیسے بنیں گے؟",
      finishTitle: "خوش آمدید! بس یہ بتا دیں کہ آپ کون ہیں، اور کام مکمل۔",
      cardIcon: "یہ میری اپنی جگہ ہے — رونق، سرگرمی اور اچھا ساتھ۔",
      cardBuddy: "میری خواہش ہے کہ اپنا وقت اور ساتھ رضاکارانہ طور پر دوں۔",
      cardFam: "میں اپنے والدین یا کسی عزیز کے ساتھ یہاں ہوں۔",
      haveAccount: "پہلے سے اکاؤنٹ ہے؟",
      signIn: "سائن اِن کریں",
      backToSite: "saathban.com پر واپس",
    },

    icon: {
      title: "آئیے آپ کا اکاؤنٹ بنا لیں",
      intro: "بس چند باتیں — باقی سب بعد میں بھی ہو سکتا ہے۔",
      emailHint:
        "ہم آپ کو ایک لنک ای میل کریں گے۔ اسے کھولتے ہی آپ سائن اِن ہو جائیں گے — کوئی پاس ورڈ یاد رکھنے کی ضرورت نہیں۔",
      cta: "میرا سائن اِن لنک ای میل کریں",
    },

    fam: {
      title: "اپنا اکاؤنٹ بنائیں",
      intro: "چند تفصیلات تاکہ ہم آپ کو اچھی طرح جوڑ سکیں — آپ دنیا میں کہیں بھی ہوں۔",
      cta: "میرا سائن اِن لنک ای میل کریں",
    },

    buddy: {
      title: "اپنا رضاکار اکاؤنٹ بنائیں",
      intro:
        "{buddy} بننے کا آغاز ایک درخواست اور انٹرویو سے ہوتا ہے — یہی احتیاط ہمارے وعدے کا حصہ ہے۔ پہلے آپ کا اکاؤنٹ، پھر ہم قدم قدم پر آپ کے ساتھ ہیں۔",
      cta: "میرا اکاؤنٹ بنائیں",
    },

    login: {
      title: "خوش آمدید",
      magicTitle: "ای میل لنک سے سائن اِن کریں",
      magicHint: "{icon} اور {fam} اکاؤنٹس کے لیے — پاس ورڈ کی ضرورت نہیں۔",
      magicCta: "مجھے سائن اِن لنک ای میل کریں",
      passwordTitle: "پاس ورڈ سے سائن اِن کریں",
      passwordHint: "{buddy} رضاکاروں کے لیے۔",
      passwordCta: "سائن اِن کریں",
      forgot: "پاس ورڈ بھول گئے؟",
      badCredentials: "یہ ای میل اور پاس ورڈ آپس میں نہیں ملتے۔ براہِ کرم دوبارہ کوشش کریں۔",
      newHere: "ساتھ بن پر نئے ہیں؟",
      getStarted: "شروع کریں",
    },

    checkEmail: {
      title: "اپنی ای میل دیکھیں",
      bodyMagic:
        "ہم نے {email} پر سائن اِن لنک بھیج دیا ہے۔ ای میل اسی ڈیوائس پر کھولیں اور لنک پر ٹیپ کریں — بس اتنا ہی کافی ہے۔",
      bodyConfirm: "ہم نے {email} پر تصدیقی لنک بھیجا ہے۔ اکاؤنٹ مکمل کرنے کے لیے اس پر ٹیپ کریں۔",
      resend: "دوبارہ بھیجیں",
      resent: "بھیج دیا — پہنچنے میں ایک آدھ منٹ لگ سکتا ہے۔",
    },

    complete: {
      working: "آپ کو سائن اِن کیا جا رہا ہے…",
      stalled: "یہ لنک نہیں چلا — شاید اس کی مدت گزر چکی ہے۔ لنک تھوڑی دیر ہی کارآمد رہتے ہیں۔",
      stalledCta: "دوبارہ شروع کریں",
    },

    reset: {
      requestTitle: "پاس ورڈ دوبارہ ترتیب دیں",
      requestHint: "اپنی ای میل بتائیں، ہم نیا پاس ورڈ چننے کا لنک بھیج دیں گے۔",
      requestCta: "مجھے ری سیٹ لنک ای میل کریں",
      requestSent: "اگر اس ای میل پر اکاؤنٹ ہے تو ری سیٹ لنک روانہ ہو چکا ہے۔",
      setTitle: "نیا پاس ورڈ چنیں",
      setCta: "میرا پاس ورڈ محفوظ کریں",
    },

    welcome: {
      title: "خوش آمدید، {name}",
      bodyBuddy:
        "آپ کا اکاؤنٹ تیار ہے۔ اگلا قدم آپ کی رضاکار درخواست ہے — اس میں تھوڑا وقت لگتا ہے، اور یہی وہ احتیاط ہے جس کا ہم نے وعدہ کیا ہے۔",
      bodyFam: "آپ کا اکاؤنٹ تیار ہے۔ اپنے {icon} کی دنیا سے جڑے رہنے کا آغاز یہیں سے ہو گا۔",
      startVetting: "میری درخواست شروع کریں",
      signOut: "سائن آؤٹ",
    },
  },
};

export default ur;
