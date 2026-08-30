/* ════════════════════════════════════════════════
   Carrom — bilingual strings, local to the lane (English reference,
   Urdu draft pending native review). Kept local like the other newer
   lanes; a future pass merges game copy into the central locales under
   a games.carrom.* namespace (GAMES_CONTRACT asks the rails lane where
   shared game chrome strings should live).

   Resolve with: const { lang } = useI18n(); const s = STRINGS[lang] || STRINGS.en;
   ════════════════════════════════════════════════ */

export const STRINGS = {
  en: {
    title: "Carrom",
    seat: (n) => `Player ${n}`,
    turnOf: (name) => `${name}'s turn`,
    timeLeft: "Time left this turn",
    aimHint: "Pull back from the striker and let go to shoot.",
    boardLabel: "Carrom board",
    power: "Power",
    powerGentle: "Gentle",
    powerFirm: "Firm",
    scoreLine: (who) => `${who} pocketed one — shoot again!`,
    queenLine: (who) => `${who} covered the Queen — shoot again!`,
    foulLine: (who) => `${who} fouled — the turn passes.`,
    missedLine: (who) => `${who} ran out of time — the turn passes. No hurry; your next go is waiting.`,
    turnPassLine: "A miss — the turn passes.",
    shotRefused: "That shot didn't go through — try it again.",
    wonLine: (who) => `${who} wins! 🎉`,
    watching: "Watching — it's their go.",
    playAgain: "Play again",
    // DM chat action
    playCarromCta: "Play carrom",
    invitedLine: "You're invited to a game of carrom.",
    takeSeat: "Take my seat",
    notNow: "Not this time",
    waitingForThem: "The board is set — waiting for them to take their seat.",
    tableSetting: "The table is being set…",
    tableFilled: "That table filled up — ask for a fresh board.",
    alreadySetUp: "A carrom board is already set up in this conversation — scroll up to it.",
    startedInChat: "A carrom board is set up above — play a few turns, chat carries on below.",
  },
  ur: {
    // ⚠ Urdu draft — pending native review.
    title: "کیرم",
    seat: (n) => `کھلاڑی ${n}`,
    turnOf: (name) => `${name} کی باری`,
    timeLeft: "اس باری کا وقت",
    aimHint: "سٹرائیکر کو پیچھے کھینچیں اور چھوڑ دیں تاکہ ضرب لگے۔",
    boardLabel: "کیرم کی بساط",
    power: "زور",
    powerGentle: "ہلکا",
    powerFirm: "زوردار",
    scoreLine: (who) => `${who} نے ایک ڈالی — دوبارہ ضرب لگائیں!`,
    queenLine: (who) => `${who} نے کوئین ڈھانپ لی — دوبارہ ضرب لگائیں!`,
    foulLine: (who) => `${who} سے فاؤل ہوا — باری بدل گئی۔`,
    missedLine: (who) => `${who} کا وقت ختم — باری بدل گئی۔ کوئی جلدی نہیں؛ اگلی باری تیار ہے۔`,
    turnPassLine: "خطا — باری بدل گئی۔",
    shotRefused: "یہ شاٹ نہیں جا سکا — دوبارہ کوشش کریں۔",
    wonLine: (who) => `${who} جیت گئے! 🎉`,
    watching: "دیکھ رہے ہیں — ان کی باری ہے۔",
    playAgain: "دوبارہ کھیلیں",
    playCarromCta: "کیرم کھیلیں",
    invitedLine: "آپ کو کیرم کے کھیل کی دعوت ہے۔",
    takeSeat: "میری نشست سنبھالیں",
    notNow: "ابھی نہیں",
    waitingForThem: "بورڈ تیار ہے — ان کے نشست سنبھالنے کا انتظار ہے۔",
    tableSetting: "میز لگائی جا رہی ہے…",
    tableFilled: "وہ میز بھر گئی — نیا بورڈ مانگیں۔",
    alreadySetUp: "اس گفتگو میں کیرم کا بورڈ پہلے سے لگا ہے — اوپر جائیں۔",
    startedInChat: "اوپر کیرم کا بورڈ لگ گیا ہے — چند باریاں کھیلیں، گفتگو نیچے جاری رہے گی۔",
  },
};
