/* ════════════════════════════════════════════════
   Saath-Buddy vetting — data contract.

   Field keys are EXACTLY the snake_case columns of
   supabase/migrations/0004_buddy_vetting.sql, so buildPayload()
   produces the `application` / `refs` jsonb arguments that
   submit_buddy_application() expects, byte for byte.

   All user-facing strings live in locales/en.js + ur.js under
   vetting.* (the Urdu pass). This file carries KEYS into those files;
   validation returns keys too, and FieldError translates them at
   render time. Stored VALUES (languages, reference relationships)
   stay English — they are data the review team matches on — while
   their display is localized.
   ════════════════════════════════════════════════ */

// ─── Step registry ───
export const STEPS = [
  { id: "identity", titleKey: "vetting.steps.identity" },
  { id: "profile", titleKey: "vetting.steps.profile" },
  { id: "motivation", titleKey: "vetting.steps.motivation" },
  { id: "experience", titleKey: "vetting.steps.experience" },
  { id: "references", titleKey: "vetting.steps.references" },
  { id: "declarations", titleKey: "vetting.steps.declarations" },
  { id: "review", titleKey: "vetting.steps.review" },
];

// ─── Choice lists ───
// Languages spoken is the single most important matching field (SPEC.md).
// `value` is what's stored; `key` is how it's displayed.
export const LANGUAGES = [
  { value: "Urdu", key: "vetting.languages.urdu" },
  { value: "Punjabi", key: "vetting.languages.punjabi" },
  { value: "Sindhi", key: "vetting.languages.sindhi" },
  { value: "Pashto", key: "vetting.languages.pashto" },
  { value: "Balochi", key: "vetting.languages.balochi" },
  { value: "Saraiki", key: "vetting.languages.saraiki" },
  { value: "Hindko", key: "vetting.languages.hindko" },
  { value: "Brahui", key: "vetting.languages.brahui" },
  { value: "English", key: "vetting.languages.english" },
];

// References must be non-family — the select simply offers no family option.
export const REFERENCE_RELATIONSHIPS = [
  { value: "Friend", key: "vetting.references.relFriend" },
  { value: "Colleague or coworker", key: "vetting.references.relColleague" },
  { value: "Teacher or mentor", key: "vetting.references.relTeacher" },
  { value: "Employer", key: "vetting.references.relEmployer" },
  { value: "Neighbour", key: "vetting.references.relNeighbour" },
  { value: "Fellow volunteer", key: "vetting.references.relVolunteer" },
  { value: "Other (not family)", key: "vetting.references.relOther" },
];

export const WEEKLY_HOURS_OPTIONS = [
  { value: 2, labelKey: "vetting.experience.hours2" },
  { value: 4, labelKey: "vetting.experience.hours4" },
  { value: 6, labelKey: "vetting.experience.hours6" },
  { value: 8, labelKey: "vetting.experience.hours8" },
  { value: 10, labelKey: "vetting.experience.hours10" },
];

export const COMMITMENT_OPTIONS = [
  { value: 3, labelKey: "vetting.experience.months3" },
  { value: 6, labelKey: "vetting.experience.months6" },
  { value: 12, labelKey: "vetting.experience.months12" },
];

export const MOTIVATION_MIN_CHARS = 40;

// ─── Code of conduct (scrollable, accepted explicitly) ───
export const CODE_OF_CONDUCT = [
  { titleKey: "vetting.coc.t1", textKey: "vetting.coc.b1" },
  { titleKey: "vetting.coc.t2", textKey: "vetting.coc.b2" },
  { titleKey: "vetting.coc.t3", textKey: "vetting.coc.b3" },
  { titleKey: "vetting.coc.t4", textKey: "vetting.coc.b4" },
  { titleKey: "vetting.coc.t5", textKey: "vetting.coc.b5" },
  { titleKey: "vetting.coc.t6", textKey: "vetting.coc.b6" },
  { titleKey: "vetting.coc.t7", textKey: "vetting.coc.b7" },
  { titleKey: "vetting.coc.t8", textKey: "vetting.coc.b8" },
];

// ─── Form state ───
// Keys mirror the buddy_applications columns. The two photos are NOT
// part of this state: they live as in-memory File objects (a `files`
// object with `cnic` and `selfie`) and upload to the private
// buddy-documents bucket at submit time — the returned storage paths
// are passed to buildPayload() then. Files can't survive a page
// reload, so drafts restore without them and the identity step asks
// again.
export const INITIAL_APPLICATION = {
  legal_name: "",
  cnic_number: "",
  dob: "",
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
// Returns { fieldKey: messageKEY } — locale keys under vetting.errors.*,
// translated where they render. Reference errors use keys like
// "ref0_name"; the photo errors keep the column-named keys so the
// upload boxes can show them. `files` is { cnic: File|null,
// selfie: File|null }.
export function validateStep(stepId, application, refs, files) {
  const e = {};
  if (stepId === "identity") {
    if (!application.legal_name.trim()) e.legal_name = "vetting.errors.name";
    if (!isValidCnic(application.cnic_number)) e.cnic_number = "vetting.errors.cnic";
    if (!application.dob) e.dob = "vetting.errors.dob";
    else if (!isAtLeast18(application.dob)) e.dob = "vetting.errors.under18";
    if (!isValidPhone(application.phone)) e.phone = "vetting.errors.phone";
    if (!files?.cnic) e.cnic_photo_path = "vetting.errors.cnicPhoto";
    if (!files?.selfie) e.selfie_path = "vetting.errors.selfie";
  }
  if (stepId === "profile") {
    if (!application.city.trim()) e.city = "vetting.errors.city";
    if (application.languages.length === 0) e.languages = "vetting.errors.languages";
  }
  if (stepId === "motivation") {
    if (application.motivation.trim().length < MOTIVATION_MIN_CHARS)
      e.motivation = "vetting.errors.motivation";
  }
  if (stepId === "references") {
    refs.forEach((r, i) => {
      if (!r.name.trim()) e[`ref${i}_name`] = "vetting.errors.refName";
      if (!r.relationship) e[`ref${i}_relationship`] = "vetting.errors.refRel";
      if (!isValidPhone(r.phone)) e[`ref${i}_phone`] = "vetting.errors.refPhone";
    });
  }
  if (stepId === "declarations") {
    if (application.declared_criminal_record === null)
      e.declared_criminal_record = "vetting.errors.criminalAnswer";
    if (!application.consented_character_certificate)
      e.consented_character_certificate = "vetting.errors.certRequired";
    if (!application.accepted_code_of_conduct)
      e.accepted_code_of_conduct = "vetting.errors.cocRequired";
  }
  return e;
}

export function validateAll(application, refs, files) {
  return STEPS.filter((s) => s.id !== "review").reduce(
    (acc, s) => ({ ...acc, ...validateStep(s.id, application, refs, files) }),
    {}
  );
}

// ─── Payload builder — the shape submit_buddy_application() receives ───
// `paths` carries the storage paths returned by the uploads.
export function buildPayload(application, refs, paths) {
  return {
    application: {
      legal_name: application.legal_name.trim(),
      cnic_number: application.cnic_number,
      dob: application.dob,
      cnic_photo_path: paths.cnic_photo_path,
      selfie_path: paths.selfie_path,
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
