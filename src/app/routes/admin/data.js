/* ════════════════════════════════════════════════
   Admin lane — mock data and vetting constants.

   NO Supabase calls anywhere in this lane yet. Every record below
   mirrors the real schema (supabase/migrations/0004_buddy_vetting.sql)
   with the same snake_case column names, so swapping this file for
   real queries is a mechanical change, not a rewrite.

   Applications are VERSIONED — each attempt is its own row sharing an
   applicant_id. The detail view groups by applicant_id to show prior
   attempts, exactly as reviewers will see them against the real table.
   ════════════════════════════════════════════════ */

// ─── Pipeline (SPEC.md: "Status is a pipeline, not a boolean") ───
// Order matters: it drives the stepper and the "advance" action.
export const PIPELINE = ["pending", "interviewing", "probation", "active"];

export const STATUS_LABELS = {
  pending: "Pending",
  interviewing: "Interviewing",
  probation: "Probation",
  active: "Active",
  suspended: "Suspended",
  rejected: "Rejected",
};

// The forward move from each stage. Suspension/rejection are separate,
// deliberate actions — never part of "advance".
export const NEXT_STATUS = {
  pending: "interviewing",
  interviewing: "probation",
  probation: "active",
};

// ─── Reviewer red flags (SPEC.md: "surface these in the admin UI") ───
// Keys are what gets stored in buddy_applications.reviewer_flags.
export const RED_FLAGS = [
  {
    key: "specific_person_request",
    label: "Asking to be matched with a specific named person",
  },
  {
    key: "id_reluctance",
    label: "Reluctance to provide ID or references",
  },
  {
    key: "availability_mismatch",
    label: "Availability inconsistent with stated job or study",
  },
  {
    key: "off_platform_contact",
    label: "Early attempt to move contact off-platform",
  },
];

export const RED_FLAG_LABELS = Object.fromEntries(
  RED_FLAGS.map((f) => [f.key, f.label])
);

// ─── Document request types ───
// The document-request feature has no table yet; this list is the UI
// contract for when it does.
export const DOCUMENT_TYPES = [
  "Police character certificate",
  "Clearer CNIC photo",
  "Proof of occupation or enrolment",
  "Updated selfie",
];

// ─── Mock admin identities ───
// Two levels (SPEC.md, Admin): support handles approvals and documents,
// super reaches sensitive data. The layout header can switch between
// these to exercise scoping in the UI.
export const MOCK_ADMINS = [
  { id: "adm-1", name: "Amina Qureshi", level: "support" },
  { id: "adm-2", name: "Omar Farooq", level: "super" },
];

/* ─── Mock applications ───
   Field names match buddy_applications columns. Extra UI-only fields:
     - audit:            mocks the audit_log rows the status trigger writes
     - document_requests: mocks the future document-request records
     - references:       joined buddy_references rows (name, relationship,
                          phone, called_at, called_by, call_notes)
   cnic_photo_path / selfie_path point at the PRIVATE buddy-documents
   bucket — the UI must never treat these as public URLs. */
export const MOCK_APPLICATIONS = [
  {
    id: "app-1001",
    applicant_id: "prof-hamza",
    legal_name: "Hamza Siddiqui",
    cnic_number: "35202-1234567-1",
    dob: "2002-03-14",
    cnic_photo_path: "buddy-documents/prof-hamza/cnic.jpg",
    selfie_path: "buddy-documents/prof-hamza/selfie.jpg",
    phone: "+92 300 1234567",
    occupation: "Final-year student, Punjab University",
    city: "Lahore",
    reachable_areas: "Gulberg, Model Town, Garden Town",
    languages: ["Urdu", "Punjabi", "English"],
    motivation:
      "My grandmother lived with us until she passed last year, and the house has felt wrong ever since. I used to read the newspaper to her every morning. I have time on weekends and I would rather spend it with someone who wants company than anywhere else.",
    experience:
      "Cared for my grandmother at home for three years, including hospital visits and medication routines.",
    weekly_hours: 6,
    commitment_months: 12,
    declared_criminal_record: false,
    criminal_record_details: null,
    consented_character_certificate: true,
    accepted_code_of_conduct: true,
    status: "pending",
    reviewer_flags: [],
    review_notes: null,
    reviewed_by: null,
    decided_at: null,
    created_at: "2026-08-26T10:15:00Z",
    references: [
      {
        id: "ref-1001a",
        name: "Prof. Naveed Alam",
        relationship: "University lecturer",
        phone: "+92 321 5550101",
        called_at: null,
        called_by: null,
        call_notes: null,
      },
      {
        id: "ref-1001b",
        name: "Saira Khan",
        relationship: "Neighbour, family friend",
        phone: "+92 333 5550102",
        called_at: null,
        called_by: null,
        call_notes: null,
      },
    ],
    document_requests: [],
    audit: [],
  },
  {
    id: "app-1002",
    applicant_id: "prof-ayesha",
    legal_name: "Ayesha Raza",
    cnic_number: "42101-7654321-2",
    dob: "1995-11-02",
    cnic_photo_path: "buddy-documents/prof-ayesha/cnic.jpg",
    selfie_path: "buddy-documents/prof-ayesha/selfie.jpg",
    phone: "+92 301 2345678",
    occupation: "Marketing executive",
    city: "Karachi",
    reachable_areas: "Clifton, Defence",
    languages: ["Urdu", "English"],
    motivation:
      "I want to volunteer with your organisation. There is an uncle in Clifton, Javed sahab near Boat Basin, who I know is registered with you — I would like to be assigned to him specifically as I already know the family situation.",
    experience: "None formally.",
    weekly_hours: 4,
    commitment_months: 6,
    declared_criminal_record: false,
    criminal_record_details: null,
    consented_character_certificate: true,
    accepted_code_of_conduct: true,
    status: "pending",
    reviewer_flags: ["specific_person_request"],
    review_notes:
      "Motivation names a specific Icon. One reference appears to be family (listed as cousin) — references must be non-family. Do not advance without an interview that resolves both.",
    reviewed_by: "adm-1",
    decided_at: null,
    created_at: "2026-08-27T14:40:00Z",
    references: [
      {
        id: "ref-1002a",
        name: "Faisal Raza",
        relationship: "Cousin",
        phone: "+92 345 5550201",
        called_at: null,
        called_by: null,
        call_notes: null,
      },
      {
        id: "ref-1002b",
        name: "Nida Hussain",
        relationship: "Former colleague",
        phone: "+92 300 5550202",
        called_at: null,
        called_by: null,
        call_notes: null,
      },
    ],
    document_requests: [],
    audit: [],
  },
  {
    id: "app-1003",
    applicant_id: "prof-bilal",
    legal_name: "Bilal Chaudhry",
    cnic_number: "35201-2468135-3",
    dob: "1984-06-21",
    cnic_photo_path: "buddy-documents/prof-bilal/cnic.jpg",
    selfie_path: "buddy-documents/prof-bilal/selfie.jpg",
    phone: "+92 302 3456789",
    occupation: "Branch manager, full-time banking",
    city: "Lahore",
    reachable_areas: "DHA, Cantt",
    languages: ["Urdu", "Punjabi"],
    motivation:
      "I believe in giving back to the community. Our elders deserve companionship and respect, and I want to be part of that.",
    experience: "Organised two community iftars for seniors at our mosque.",
    weekly_hours: 20,
    commitment_months: 12,
    declared_criminal_record: false,
    criminal_record_details: null,
    consented_character_certificate: true,
    accepted_code_of_conduct: true,
    status: "interviewing",
    reviewer_flags: ["availability_mismatch"],
    review_notes:
      "Claims 20 hours a week alongside a full-time branch manager role — raise in the interview and settle on a realistic number before probation.",
    reviewed_by: "adm-1",
    decided_at: null,
    created_at: "2026-08-15T09:00:00Z",
    references: [
      {
        id: "ref-1003a",
        name: "Imran Sheikh",
        relationship: "Mosque committee member",
        phone: "+92 321 5550301",
        called_at: "2026-08-20T11:30:00Z",
        called_by: "adm-1",
        call_notes:
          "Confirms the community iftars and speaks warmly of him. Says weekends are when he is actually free.",
      },
      {
        id: "ref-1003b",
        name: "Rashid Mehmood",
        relationship: "Former manager",
        phone: "+92 333 5550302",
        called_at: null,
        called_by: null,
        call_notes: null,
      },
    ],
    document_requests: [
      {
        id: "doc-1",
        type: "Police character certificate",
        note: "Standard pre-probation requirement.",
        requested_at: "2026-08-20T12:00:00Z",
        requested_by: "adm-1",
        status: "awaiting",
      },
    ],
    audit: [
      {
        at: "2026-08-18T10:00:00Z",
        actor: "Amina Qureshi",
        action: "Status change",
        from: "pending",
        to: "interviewing",
        note: "Solid references; availability question to be resolved in interview.",
      },
    ],
  },
  {
    id: "app-1004",
    applicant_id: "prof-sana",
    legal_name: "Sana Mirza",
    cnic_number: "61101-1357924-4",
    dob: "1999-01-30",
    cnic_photo_path: "buddy-documents/prof-sana/cnic.jpg",
    selfie_path: "buddy-documents/prof-sana/selfie.jpg",
    phone: "+92 303 4567890",
    occupation: "Physiotherapy assistant",
    city: "Islamabad",
    reachable_areas: "F-sectors, G-sectors",
    languages: ["Urdu", "English", "Pashto"],
    motivation:
      "Half my patients are seniors and the sessions they enjoy most are the ones where we just talk. I want to give that time without a clock running.",
    experience:
      "Three years working with senior patients in rehabilitation settings.",
    weekly_hours: 5,
    commitment_months: 12,
    declared_criminal_record: false,
    criminal_record_details: null,
    consented_character_certificate: true,
    accepted_code_of_conduct: true,
    status: "probation",
    reviewer_flags: [],
    review_notes:
      "Excellent interview. Both references glowing. Probation pairing with a Saathban staffer present at first two visits.",
    reviewed_by: "adm-1",
    decided_at: null,
    created_at: "2026-07-30T08:20:00Z",
    references: [
      {
        id: "ref-1004a",
        name: "Dr. Khalid Anwar",
        relationship: "Supervising physiotherapist",
        phone: "+92 321 5550401",
        called_at: "2026-08-04T15:00:00Z",
        called_by: "adm-1",
        call_notes: "Unreserved recommendation. Patient, reliable, kind.",
      },
      {
        id: "ref-1004b",
        name: "Mahnoor Tariq",
        relationship: "Flatmate, colleague",
        phone: "+92 333 5550402",
        called_at: "2026-08-04T15:30:00Z",
        called_by: "adm-1",
        call_notes: "Confirms character and stated availability.",
      },
    ],
    document_requests: [
      {
        id: "doc-2",
        type: "Police character certificate",
        note: null,
        requested_at: "2026-08-05T09:00:00Z",
        requested_by: "adm-1",
        status: "received",
      },
    ],
    audit: [
      {
        at: "2026-08-03T10:00:00Z",
        actor: "Amina Qureshi",
        action: "Status change",
        from: "pending",
        to: "interviewing",
        note: null,
      },
      {
        at: "2026-08-08T16:00:00Z",
        actor: "Amina Qureshi",
        action: "Status change",
        from: "interviewing",
        to: "probation",
        note: "Both references called, certificate received.",
      },
    ],
  },
  {
    id: "app-1005",
    applicant_id: "prof-tariq",
    legal_name: "Tariq Aziz",
    cnic_number: "42201-9876543-5",
    dob: "1971-09-12",
    cnic_photo_path: "buddy-documents/prof-tariq/cnic.jpg",
    selfie_path: "buddy-documents/prof-tariq/selfie.jpg",
    phone: "+92 304 5678901",
    occupation: "Retired schoolteacher",
    city: "Karachi",
    reachable_areas: "Gulshan, North Nazimabad",
    languages: ["Urdu", "Sindhi", "English"],
    motivation:
      "Forty years of teaching taught me that everyone, at every age, wants to be listened to. Retirement gave me the time to do the listening.",
    experience: "Volunteered at an old-age home in Gulshan for two years.",
    weekly_hours: 10,
    commitment_months: 24,
    declared_criminal_record: false,
    criminal_record_details: null,
    consented_character_certificate: true,
    accepted_code_of_conduct: true,
    status: "active",
    reviewer_flags: [],
    review_notes: "Model application. Activated after clean probation.",
    reviewed_by: "adm-2",
    decided_at: "2026-07-10T12:00:00Z",
    created_at: "2026-06-01T09:30:00Z",
    references: [
      {
        id: "ref-1005a",
        name: "Principal Zafar Iqbal",
        relationship: "Former colleague",
        phone: "+92 321 5550501",
        called_at: "2026-06-05T10:00:00Z",
        called_by: "adm-1",
        call_notes: "Thirty years of shared history; total confidence.",
      },
      {
        id: "ref-1005b",
        name: "Sister Maria D'Souza",
        relationship: "Old-age home coordinator",
        phone: "+92 333 5550502",
        called_at: "2026-06-05T10:30:00Z",
        called_by: "adm-1",
        call_notes: "Residents ask for him by name. Would rehire instantly.",
      },
    ],
    document_requests: [
      {
        id: "doc-3",
        type: "Police character certificate",
        note: null,
        requested_at: "2026-06-06T09:00:00Z",
        requested_by: "adm-1",
        status: "received",
      },
    ],
    audit: [
      {
        at: "2026-06-08T10:00:00Z",
        actor: "Amina Qureshi",
        action: "Status change",
        from: "pending",
        to: "interviewing",
        note: null,
      },
      {
        at: "2026-06-15T10:00:00Z",
        actor: "Amina Qureshi",
        action: "Status change",
        from: "interviewing",
        to: "probation",
        note: null,
      },
      {
        at: "2026-07-10T12:00:00Z",
        actor: "Omar Farooq",
        action: "Status change",
        from: "probation",
        to: "active",
        note: "Clean probation; staffer sign-off on both supervised visits.",
      },
    ],
  },
  {
    id: "app-1006",
    applicant_id: "prof-farhan",
    legal_name: "Farhan Malik",
    cnic_number: "37405-1122334-6",
    dob: "1993-04-08",
    cnic_photo_path: "buddy-documents/prof-farhan/cnic.jpg",
    selfie_path: "buddy-documents/prof-farhan/selfie.jpg",
    phone: "+92 305 6789012",
    occupation: "Sales representative",
    city: "Rawalpindi",
    reachable_areas: "Saddar, Satellite Town",
    languages: ["Urdu", "Punjabi"],
    motivation: "I enjoy meeting new people and helping where I can.",
    experience: "None.",
    weekly_hours: 8,
    commitment_months: 6,
    declared_criminal_record: false,
    criminal_record_details: null,
    consented_character_certificate: true,
    accepted_code_of_conduct: true,
    status: "suspended",
    reviewer_flags: ["off_platform_contact"],
    review_notes:
      "During a probation visit, asked the Icon to continue the conversation on WhatsApp. Suspended pending super-admin review. Icon informed and unmatched.",
    reviewed_by: "adm-2",
    decided_at: "2026-08-05T17:00:00Z",
    created_at: "2026-06-20T11:00:00Z",
    references: [
      {
        id: "ref-1006a",
        name: "Adeel Sattar",
        relationship: "Team lead",
        phone: "+92 321 5550601",
        called_at: "2026-06-25T14:00:00Z",
        called_by: "adm-1",
        call_notes: "Positive but brief.",
      },
      {
        id: "ref-1006b",
        name: "Waqas Ali",
        relationship: "Childhood friend",
        phone: "+92 333 5550602",
        called_at: "2026-06-25T14:20:00Z",
        called_by: "adm-1",
        call_notes: "Vouches for him generally.",
      },
    ],
    document_requests: [],
    audit: [
      {
        at: "2026-06-28T10:00:00Z",
        actor: "Amina Qureshi",
        action: "Status change",
        from: "pending",
        to: "interviewing",
        note: null,
      },
      {
        at: "2026-07-08T10:00:00Z",
        actor: "Amina Qureshi",
        action: "Status change",
        from: "interviewing",
        to: "probation",
        note: null,
      },
      {
        at: "2026-08-05T17:00:00Z",
        actor: "Omar Farooq",
        action: "Status change",
        from: "probation",
        to: "suspended",
        note: "Off-platform contact attempt during probation visit.",
      },
    ],
  },

  // Danish Iqbal — SECOND attempt. His first (rejected) application is the
  // row below, sharing applicant_id; the detail view surfaces it as prior
  // attempt history.
  {
    id: "app-1007",
    applicant_id: "prof-danish",
    legal_name: "Danish Iqbal",
    cnic_number: "37401-5566778-7",
    dob: "1997-12-19",
    cnic_photo_path: "buddy-documents/prof-danish/cnic-2.jpg",
    selfie_path: "buddy-documents/prof-danish/selfie-2.jpg",
    phone: "+92 306 7890123",
    occupation: "Software developer, remote",
    city: "Rawalpindi",
    reachable_areas: "Bahria Town, DHA Islamabad",
    languages: ["Urdu", "English"],
    motivation:
      "I applied earlier this year and was rejected because I hesitated over references — honestly, I was embarrassed to ask. I have thought about why I wanted this since. My father passed in January and his last years were lonely in ways I did not see in time. Both references are attached this time.",
    experience: "None formally.",
    weekly_hours: 5,
    commitment_months: 12,
    declared_criminal_record: false,
    criminal_record_details: null,
    consented_character_certificate: true,
    accepted_code_of_conduct: true,
    status: "pending",
    reviewer_flags: [],
    review_notes: null,
    reviewed_by: null,
    decided_at: null,
    created_at: "2026-08-20T13:10:00Z",
    references: [
      {
        id: "ref-1007a",
        name: "Kamran Yousaf",
        relationship: "Engineering manager",
        phone: "+92 321 5550701",
        called_at: null,
        called_by: null,
        call_notes: null,
      },
      {
        id: "ref-1007b",
        name: "Hina Shahid",
        relationship: "Former university advisor",
        phone: "+92 333 5550702",
        called_at: null,
        called_by: null,
        call_notes: null,
      },
    ],
    document_requests: [],
    audit: [],
  },
  {
    id: "app-0907",
    applicant_id: "prof-danish",
    legal_name: "Danish Iqbal",
    cnic_number: "37401-5566778-7",
    dob: "1997-12-19",
    cnic_photo_path: "buddy-documents/prof-danish/cnic-1.jpg",
    selfie_path: "buddy-documents/prof-danish/selfie-1.jpg",
    phone: "+92 306 7890123",
    occupation: "Software developer, remote",
    city: "Rawalpindi",
    reachable_areas: "Bahria Town",
    languages: ["Urdu", "English"],
    motivation: "I have free time and want to do something useful with it.",
    experience: "None.",
    weekly_hours: 4,
    commitment_months: 6,
    declared_criminal_record: false,
    criminal_record_details: null,
    consented_character_certificate: true,
    accepted_code_of_conduct: true,
    status: "rejected",
    reviewer_flags: ["id_reluctance"],
    review_notes:
      "Declined twice to provide reference contact details, then supplied one number that never answered. Rejected with standard 90-day reapply window; no permanent concern noted.",
    reviewed_by: "adm-1",
    decided_at: "2026-04-12T10:00:00Z",
    created_at: "2026-03-28T09:45:00Z",
    references: [
      {
        id: "ref-0907a",
        name: "Kamran Yousaf",
        relationship: "Engineering manager",
        phone: "+92 321 5550701",
        called_at: null,
        called_by: null,
        call_notes: "Number provided late; three attempts, no answer.",
      },
    ],
    document_requests: [],
    audit: [
      {
        at: "2026-04-12T10:00:00Z",
        actor: "Amina Qureshi",
        action: "Status change",
        from: "pending",
        to: "rejected",
        note: "Reference reluctance; standard cooldown applies.",
      },
    ],
  },
];

/* ─── Mock moderation reports ───
   Skeleton only — Community/Outdoor land at build steps 11–12 and there
   is no reports table yet. Shapes anticipate one: source surface, the
   reported content, reporter, reason, timestamps, resolution.
   SPEC.md target: response measured in HOURS, not days. */
export const MOCK_REPORTS = [
  {
    id: "rep-1",
    surface: "Park board",
    place: "Model Town Park, Lahore",
    content_excerpt:
      "“Brother I have an investment opportunity, guaranteed profit, send me your number…”",
    reported_by: "A Saath-Icon (name withheld in queue view)",
    reason: "Asking for money / investment talk",
    created_at: "2026-08-28T06:30:00Z",
    status: "open",
    resolution: null,
  },
  {
    id: "rep-2",
    surface: "Community post",
    place: null,
    content_excerpt:
      "“Click this link to claim your free medical check-up voucher…”",
    reported_by: "Saath-Fam member",
    reason: "Possible scam link",
    created_at: "2026-08-27T07:00:00Z",
    status: "open",
    resolution: null,
  },
  {
    id: "rep-3",
    surface: "DM request",
    place: null,
    content_excerpt: "Fourteen identical DM requests sent within one hour.",
    reported_by: "Automatic rate-limit flag",
    reason: "Request spam",
    created_at: "2026-08-25T19:00:00Z",
    status: "resolved",
    resolution: "Account paused; requests withdrawn.",
  },
];
