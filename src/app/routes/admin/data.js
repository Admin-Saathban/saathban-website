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

/* The words live in locales/*.js under admin.status.*; resolve with
   statusLabel(status, t) at the point of use. Kept as a key list so
   nothing has to guess which statuses exist. */
export const STATUSES = ["pending", "interviewing", "probation", "active", "suspended", "rejected"];

export const statusLabel = (status, t) =>
  (status && t(`admin.status.${status}`)) || status || "";

// The forward move from each stage. Suspension/rejection are separate,
// deliberate actions — never part of "advance".
export const NEXT_STATUS = {
  pending: "interviewing",
  interviewing: "probation",
  probation: "active",
};

// ─── Reviewer red flags (SPEC.md: "surface these in the admin UI") ───
// Keys are what gets stored in buddy_applications.reviewer_flags.
/* Keys only — these are stored in buddy_applications.reviewer_flags,
   so they must never change. The wording is admin.flag.* */
export const RED_FLAG_KEYS = [
  "specific_person_request",
  "id_reluctance",
  "availability_mismatch",
  "off_platform_contact",
];

export const redFlagLabel = (key, t) => (key && t(`admin.flag.${key}`)) || key || "";

// ─── Document request types ───
// The document-request feature has no table yet; this list is the UI
// contract for when it does.
/* Keys, not sentences: a document request stores which KIND was
   asked for, and storing the English words would have made the
   stored value change meaning the day somebody reworded it. */
export const DOCUMENT_KEYS = ["police", "cnic", "occupation", "selfie"];

export const documentLabel = (key, t) => (key && t(`admin.doc.${key}`)) || key || "";

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
