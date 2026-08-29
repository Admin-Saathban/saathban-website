/* ════════════════════════════════════════════════
   Urdu strings — اردو

   ⚠ PLACEHOLDERS. Every value wrapped in TODO() below is NOT yet
   translated — it renders as "[UR] <english>" so untranslated text
   is impossible to miss in the app. The named Urdu owner on the
   Saathban team (SPEC.md, Language & accessibility) replaces each
   TODO("…") with the real Urdu string, e.g.:

       title: TODO("Settings"),   →   title: "ترتیبات",

   To find everything still untranslated:  grep TODO src/app/locales/ur.js

   Notes for the translator:
   - Structure must mirror en.js exactly — same keys, same nesting.
     If a key is missing here the app silently falls back to English.
   - Text renders in Noto Nastaliq Urdu, right-to-left. Layouts flip
     automatically; write natural Urdu, not layout-aware Urdu.
   - Same copy rules as English (SPEC.md, Principles): warm, never
     clinical, never patronising, never audience-assuming.
   - {curly} placeholders are variables filled in by the app — keep
     them in the string, positioned wherever Urdu grammar wants them.
   ════════════════════════════════════════════════ */

const TODO = (english) => `[UR] ${english}`;

const ur = {
  common: {
    appName: TODO("Saathban"),
    backToHome: TODO("Back to home"),
  },

  settings: {
    title: TODO("Settings"),

    language: {
      title: TODO("Language"),
      hint: TODO("Choose the language Saathban speaks with you in."),
    },

    textSize: {
      title: TODO("Text size"),
      hint: TODO(
        "Make everything in the app bigger. This is separate from your phone's own text size setting."
      ),
      sizes: {
        standard: TODO("Standard"),
        large: TODO("Large"),
        larger: TODO("Larger"),
        largest: TODO("Largest"),
      },
    },

    preview: {
      title: TODO("Preview"),
      hint: TODO("This is how the app will look with your choices."),
      heading: TODO("A morning at the park"),
      body: TODO(
        "The weather is lovely today. Gulshan Park is ten minutes away, and the walking track is shaded until noon."
      ),
      button: TODO("Sounds good"),
      scriptSampleLabel: TODO("Urdu script sample"),
    },
  },

  auth: {
    common: {
      notMe: TODO("This isn't me — start over"),
      optional: TODO("optional"),
      signedInAs: TODO("You're signed in as {email}."),
      fullNameLabel: TODO("Your full name"),
      emailLabel: TODO("Email address"),
      phoneLabel: TODO("Phone number"),
      cityLabel: TODO("City"),
      cityHint: TODO(
        "Helps us point you to what's happening nearby. You can add or change this any time."
      ),
      countryLabel: TODO("Country"),
      relationshipLabel: TODO("Who they are to you"),
      relationshipHint: TODO(
        "For example: my mother, my uncle, a dear neighbour."
      ),
      languagesLabel: TODO("Languages you speak"),
      languagesHint: TODO(
        "Separate with commas — for example: Urdu, Punjabi, English."
      ),
      passwordLabel: TODO("Password"),
      passwordHint: TODO("At least 8 characters."),
      errorName: TODO("Please tell us your name."),
      errorEmail: TODO(
        "That email address doesn't look complete — please check it."
      ),
      errorPassword: TODO("Please choose a password of at least 8 characters."),
      errorGeneric: TODO("Something went wrong on our side. Please try again."),
      finishCta: TODO("All set — take me in"),
    },

    roleSelect: {
      title: TODO("How will you be part of Saathban?"),
      finishTitle: TODO("Welcome! Tell us who you are, and you're all set."),
      cardIcon: TODO(
        "This is my place — community, activity, and good company."
      ),
      cardBuddy: TODO("I'd like to volunteer my time and companionship."),
      cardFam: TODO("I'm here alongside a parent or someone dear to me."),
      haveAccount: TODO("Already have an account?"),
      signIn: TODO("Sign in"),
      backToSite: TODO("Back to saathban.com"),
    },

    icon: {
      title: TODO("Let's get you set up"),
      intro: TODO("Just a few details — everything else can wait."),
      emailHint: TODO(
        "We'll email you a link. Opening it signs you in — no password to remember."
      ),
      cta: TODO("Email me my sign-in link"),
    },

    fam: {
      title: TODO("Create your account"),
      intro: TODO(
        "A few details so we can connect you well — wherever in the world you are."
      ),
      cta: TODO("Email me my sign-in link"),
    },

    buddy: {
      title: TODO("Create your volunteer account"),
      intro: TODO(
        "Becoming a {buddy} starts with an application and an interview — the care we take is part of the promise. First, your account; then we'll walk you through the rest."
      ),
      cta: TODO("Create my account"),
    },

    login: {
      title: TODO("Welcome back"),
      magicTitle: TODO("Sign in with an email link"),
      magicHint: TODO("For {icon} and {fam} accounts — no password needed."),
      magicCta: TODO("Email me a sign-in link"),
      passwordTitle: TODO("Sign in with your password"),
      passwordHint: TODO("For {buddy} volunteers."),
      passwordCta: TODO("Sign in"),
      forgot: TODO("Forgotten your password?"),
      badCredentials: TODO(
        "That email and password don't match. Please try again."
      ),
      newHere: TODO("New to Saathban?"),
      getStarted: TODO("Get started"),
    },

    checkEmail: {
      title: TODO("Check your email"),
      bodyMagic: TODO(
        "We've sent a sign-in link to {email}. Open the email on this device and tap the link — that's all there is to it."
      ),
      bodyConfirm: TODO(
        "We've sent a confirmation link to {email}. Tap it to finish creating your account."
      ),
      resend: TODO("Send it again"),
      resent: TODO("Sent — give it a minute to arrive."),
    },

    complete: {
      working: TODO("Signing you in…"),
      stalled: TODO(
        "That link didn't work — it may have expired. Links only stay valid for a little while."
      ),
      stalledCta: TODO("Start again"),
    },

    reset: {
      requestTitle: TODO("Reset your password"),
      requestHint: TODO(
        "Tell us your email and we'll send a link to choose a new one."
      ),
      requestCta: TODO("Email me a reset link"),
      requestSent: TODO(
        "If that email has an account, a reset link is on its way."
      ),
      setTitle: TODO("Choose a new password"),
      setCta: TODO("Save my password"),
    },
  },
};

export default ur;
