/* ════════════════════════════════════════════════
   Admin lane — vetting constants (and the moderation mock).

   Buddy review runs on REAL data now — queries live in ./api.js
   against buddy_applications / buddy_references / audit_log
   (supabase/migrations/0004, 0003). This file keeps the constants the
   UI shares with that schema, plus MOCK_REPORTS for the moderation
   skeleton, which has no backing table until build step 11.

   Applications are VERSIONED — each attempt is its own row sharing an
   applicant_id. The detail view groups by applicant_id to show prior
   attempts.
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
