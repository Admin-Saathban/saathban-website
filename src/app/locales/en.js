/* ════════════════════════════════════════════════
   English strings — the reference locale.

   Every user-facing string in src/app/ lives here (or in ur.js),
   never inline in a component (SPEC.md, Language & accessibility).
   Keys are grouped by screen/feature; components look them up with
   t("group.key") from useI18n().

   Copy rules (SPEC.md, Principles):
   - The words "elderly" and "user" never appear.
   - No clinical framing, no patronising tone.
   - Never imply an audience the person may not have.

   When you add a key here, add the same key to ur.js in the same
   place, wrapped in TODO() until the team translator supplies the
   real Urdu.
   ════════════════════════════════════════════════ */

const en = {
  common: {
    appName: "Saathban",
    backToHome: "Back to home",
  },

  settings: {
    title: "Settings",

    language: {
      title: "Language",
      hint: "Choose the language Saathban speaks with you in.",
    },

    textSize: {
      title: "Text size",
      hint: "Make everything in the app bigger. This is separate from your phone's own text size setting.",
      sizes: {
        standard: "Standard",
        large: "Large",
        larger: "Larger",
        largest: "Largest",
      },
    },

    preview: {
      title: "Preview",
      hint: "This is how the app will look with your choices.",
      heading: "A morning at the park",
      body: "The weather is lovely today. Gulshan Park is ten minutes away, and the walking track is shaded until noon.",
      button: "Sounds good",
      scriptSampleLabel: "Urdu script sample",
    },
  },

  auth: {
    common: {
      notMe: "This isn't me — start over",
      optional: "optional",
      signedInAs: "You're signed in as {email}.",
      fullNameLabel: "Your full name",
      emailLabel: "Email address",
      phoneLabel: "Phone number",
      cityLabel: "City",
      cityHint:
        "Helps us point you to what's happening nearby. You can add or change this any time.",
      countryLabel: "Country",
      relationshipLabel: "Who they are to you",
      relationshipHint: "For example: my mother, my uncle, a dear neighbour.",
      languagesLabel: "Languages you speak",
      languagesHint: "Separate with commas — for example: Urdu, Punjabi, English.",
      passwordLabel: "Password",
      passwordHint: "At least 8 characters.",
      errorName: "Please tell us your name.",
      errorEmail: "That email address doesn't look complete — please check it.",
      errorPassword: "Please choose a password of at least 8 characters.",
      errorGeneric: "Something went wrong on our side. Please try again.",
      finishCta: "All set — take me in",
    },

    roleSelect: {
      title: "How will you be part of Saathban?",
      finishTitle: "Welcome! Tell us who you are, and you're all set.",
      cardIcon: "This is my place — community, activity, and good company.",
      cardBuddy: "I'd like to volunteer my time and companionship.",
      cardFam: "I'm here alongside a parent or someone dear to me.",
      haveAccount: "Already have an account?",
      signIn: "Sign in",
      backToSite: "Back to saathban.com",
    },

    icon: {
      title: "Let's get you set up",
      intro: "Just a few details — everything else can wait.",
      emailHint:
        "We'll email you a link. Opening it signs you in — no password to remember.",
      cta: "Email me my sign-in link",
    },

    fam: {
      title: "Create your account",
      intro:
        "A few details so we can connect you well — wherever in the world you are.",
      cta: "Email me my sign-in link",
    },

    buddy: {
      title: "Create your volunteer account",
      intro:
        "Becoming a {buddy} starts with an application and an interview — the care we take is part of the promise. First, your account; then we'll walk you through the rest.",
      cta: "Create my account",
    },

    login: {
      title: "Welcome back",
      magicTitle: "Sign in with an email link",
      magicHint: "For {icon} and {fam} accounts — no password needed.",
      magicCta: "Email me a sign-in link",
      passwordTitle: "Sign in with your password",
      passwordHint: "For {buddy} volunteers.",
      passwordCta: "Sign in",
      forgot: "Forgotten your password?",
      badCredentials: "That email and password don't match. Please try again.",
      newHere: "New to Saathban?",
      getStarted: "Get started",
    },

    checkEmail: {
      title: "Check your email",
      bodyMagic:
        "We've sent a sign-in link to {email}. Open the email on this device and tap the link — that's all there is to it.",
      bodyConfirm:
        "We've sent a confirmation link to {email}. Tap it to finish creating your account.",
      resend: "Send it again",
      resent: "Sent — give it a minute to arrive.",
    },

    complete: {
      working: "Signing you in…",
      stalled:
        "That link didn't work — it may have expired. Links only stay valid for a little while.",
      stalledCta: "Start again",
    },

    reset: {
      requestTitle: "Reset your password",
      requestHint: "Tell us your email and we'll send a link to choose a new one.",
      requestCta: "Email me a reset link",
      requestSent: "If that email has an account, a reset link is on its way.",
      setTitle: "Choose a new password",
      setCta: "Save my password",
    },
  },
};

export default en;
