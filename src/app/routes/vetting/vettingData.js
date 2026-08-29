/* ════════════════════════════════════════════════
   Saath-Buddy vetting — data contract and copy.

   Field keys are EXACTLY the snake_case columns of
   supabase/migrations/0004_buddy_vetting.sql, so buildPayload()
   produces the `application` / `refs` jsonb arguments that
   submit_buddy_application() expects, byte for byte. When the real
   submission lands, only mockSubmit.js changes.

   All user-facing strings for the flow live in this file (plus
   steps.jsx headings) so the Urdu extraction is contained. The words
   "elderly" and "user" appear nowhere.
   ════════════════════════════════════════════════ */

// ─── Step registry ───
export const STEPS = [
  { id: "identity", title: "Who you are" },
  { id: "profile", title: "Where and how you can help" },
  { id: "motivation", title: "Why you want to do this" },
  { id: "experience", title: "Experience and time" },
  { id: "references", title: "Two people who know you" },
  { id: "declarations", title: "Declarations" },
  { id: "review", title: "Check and send" },
];

// ─── Choice lists ───
// Languages spoken is the single most important matching field (SPEC.md).
export const LANGUAGES = [
  "Urdu", "Punjabi", "Sindhi", "Pashto", "Balochi",
  "Saraiki", "Hindko", "Brahui", "English",
];

// References must be non-family — the select simply offers no family option.
export const REFERENCE_RELATIONSHIPS = [
  "Friend",
  "Colleague or coworker",
  "Teacher or mentor",
  "Employer",
  "Neighbour",
  "Fellow volunteer",
  "Other (not family)",
];

export const WEEKLY_HOURS_OPTIONS = [
  { value: 2, label: "About 2 hours" },
  { value: 4, label: "About 4 hours" },
  { value: 6, label: "About 6 hours" },
  { value: 8, label: "About 8 hours" },
  { value: 10, label: "10 or more" },
];

export const COMMITMENT_OPTIONS = [
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "A year or more" },
];

export const MOTIVATION_MIN_CHARS = 40;

// ─── Code of conduct (scrollable, accepted explicitly) ───
export const CODE_OF_CONDUCT = [
  {
    title: "Money never changes hands",
    text:
      "You will never give money to, accept money from, lend to, borrow from, " +
      "or discuss financial arrangements with a Saath-Icon or their family. " +
      "Not as a gift, not as a favour, not once.",
  },
  {
    title: "No soliciting of any kind",
    text:
      "No selling, no fundraising, no recruiting, and no religious or " +
      "political persuasion. You are there for companionship, nothing else.",
  },
  {
    title: "No medical advice, ever",
    text:
      "You may listen, and you may encourage someone to speak to their doctor " +
      "or family. You will never suggest treatments, medicines, dosages, or " +
      "alternatives to professional care.",
  },
  {
    title: "No photos or recordings without clear consent",
    text:
      "Every photo, video, or recording requires the Saath-Icon's clear " +
      "agreement, every time. When in doubt, don't.",
  },
  {
    title: "Contact stays in-app",
    text:
      "All contact goes through Saathban until Saathban itself formalises " +
      "anything further. Moving conversations to personal phones or social " +
      "media is not permitted and is treated as a serious concern.",
  },
  {
    title: "What you hear stays private",
    text:
      "A Saath-Icon may share personal things with you. They stay between " +
      "you, them, and — where safety requires it — Saathban. Never material " +
      "for stories elsewhere.",
  },
  {
    title: "Concerns get reported",
    text:
      "If you are ever worried about a Saath-Icon's safety, health, or " +
      "wellbeing — or about another volunteer's behaviour — you report it to " +
      "Saathban straight away. Staying silent is not neutral.",
  },
  {
    title: "Reliability is kindness",
    text:
      "A cancelled visit can be the loneliest moment of someone's week. If " +
      "you cannot make it, say so as early as you possibly can.",
  },
];

// ─── Form state ───
// Keys mirror the buddy_applications columns; the *_name entries are
// UI-only (chosen file names) and are stripped by buildPayload().
export const INITIAL_APPLICATION = {
  legal_name: "",
  cnic_number: "",
  dob: "",
  cnic_photo_path: "",
  cnic_photo_name: "",
  selfie_path: "",
  selfie_name: "",
  phone: "",
  occupation: "",
  city: "",
  reachable_areas: "",
  languages: [],
  motivation: "",
  experience: "",
  weekly_hours: null,
  commitment_months: null,
  declared_criminal_record: null, // null until the applicant answers
  criminal_record_details: "",
  consented_character_certificate: false,
  accepted_code_of_conduct: false,
};

export const INITIAL_REFS = [
  { name: "", relationship: "", phone: "" },
  { name: "", relationship: "", phone: "" },
];

// ─── Helpers ───
export function formatCnic(raw) {
  const d = raw.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

export function isValidCnic(v) {
  return v.replace(/\D/g, "").length === 13;
}

export function isValidPhone(v) {
  return v.replace(/\D/g, "").length >= 10;
}

export function isAtLeast18(dobString) {
  if (!dobString) return false;
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return dob <= cutoff;
}

// ─── Per-step validation ───
// Returns { fieldKey: message }. Reference errors use keys like "ref0_name".
export function validateStep(stepId, application, refs) {
  const e = {};
  if (stepId === "identity") {
    if (!application.legal_name.trim())
      e.legal_name = "Please enter your name exactly as it appears on your CNIC.";
    if (!isValidCnic(application.cnic_number))
      e.cnic_number = "A CNIC number has 13 digits.";
    if (!application.dob) e.dob = "Please enter your date of birth.";
    else if (!isAtLeast18(application.dob))
      e.dob = "Saath-Buddies must be at least 18.";
    if (!isValidPhone(application.phone))
      e.phone = "Please enter a phone number we can reach you on.";
    if (!application.cnic_photo_path)
      e.cnic_photo_path = "Please add a photo of the front of your CNIC.";
    if (!application.selfie_path)
      e.selfie_path = "Please add a clear photo of your face.";
  }
  if (stepId === "profile") {
    if (!application.city.trim()) e.city = "Please tell us your city.";
    if (application.languages.length === 0)
      e.languages =
        "Please choose at least one language — matching depends on it more than anything else.";
  }
  if (stepId === "motivation") {
    if (application.motivation.trim().length < MOTIVATION_MIN_CHARS)
      e.motivation =
        "A few sentences, please — this is the first thing our team reads.";
  }
  if (stepId === "references") {
    refs.forEach((r, i) => {
      if (!r.name.trim()) e[`ref${i}_name`] = "Please give their name.";
      if (!r.relationship)
        e[`ref${i}_relationship`] = "How do you know them? (Not a family member.)";
      if (!isValidPhone(r.phone))
        e[`ref${i}_phone`] = "Please give a phone number they answer.";
    });
  }
  if (stepId === "declarations") {
    if (application.declared_criminal_record === null)
      e.declared_criminal_record = "Please answer yes or no.";
    if (!application.consented_character_certificate)
      e.consented_character_certificate =
        "This consent is required to volunteer with Saathban.";
    if (!application.accepted_code_of_conduct)
      e.accepted_code_of_conduct =
        "Please read the code of conduct to the end, then accept it.";
  }
  return e;
}

export function validateAll(application, refs) {
  return STEPS.filter((s) => s.id !== "review").reduce(
    (acc, s) => ({ ...acc, ...validateStep(s.id, application, refs) }),
    {}
  );
}

// ─── Payload builder — the shape submit_buddy_application() receives ───
export function buildPayload(application, refs) {
  return {
    application: {
      legal_name: application.legal_name.trim(),
      cnic_number: application.cnic_number,
      dob: application.dob,
      cnic_photo_path: application.cnic_photo_path,
      selfie_path: application.selfie_path,
      phone: application.phone.trim(),
      occupation: application.occupation.trim() || null,
      city: application.city.trim(),
      reachable_areas: application.reachable_areas.trim() || null,
      languages: application.languages,
      motivation: application.motivation.trim(),
      experience: application.experience.trim() || null,
      weekly_hours: application.weekly_hours,
      commitment_months: application.commitment_months,
      declared_criminal_record: application.declared_criminal_record === true,
      criminal_record_details:
        application.declared_criminal_record === true
          ? application.criminal_record_details.trim() || null
          : null,
      consented_character_certificate: application.consented_character_certificate,
      accepted_code_of_conduct: application.accepted_code_of_conduct,
    },
    refs: refs.map((r) => ({
      name: r.name.trim(),
      relationship: r.relationship,
      phone: r.phone.trim(),
    })),
  };
}

export const DRAFT_KEY = "saathban.vetting.draft.v1";
