/* ════════════════════════════════════════════════
   Real Supabase data layer for the vetting flow — replaces
   mockSubmit.js. Everything the flow needs from the backend goes
   through this file:

   - document uploads into the PRIVATE buddy-documents bucket, under
     the applicant's own folder (`<uid>/…` — migration 0008 rejects
     any other prefix)
   - the submit_buddy_application(application, refs) RPC
     (migration 0004), whose raise messages are classified here into
     the codes the kind error screens render
   - reading the applicant's own applications (RLS: applicants can
     always read their own rows, all versions)
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

export const COOLDOWN_DAYS = 90;

/* Extensions the bucket accepts (0008 allows jpeg/png/webp/pdf; the
   form offers images only). */
const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isAcceptedImage(file) {
  return !!EXT_BY_MIME[file?.type];
}

/* Upload one document into the applicant's own folder. Returns the
   object path stored in cnic_photo_path / selfie_path (path within
   the bucket, no bucket prefix — matching 0004's column comment).
   The name is timestamped so a retry never collides; stale attempts
   are the retention job's problem, not the applicant's. */
export async function uploadBuddyDocument(userId, kind, file) {
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    throw new Error(
      "Please use a JPG, PNG, or WebP photo — that format isn't supported."
    );
  }
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("buddy-documents")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`We couldn't save your ${kind === "cnic" ? "CNIC photo" : "photo"} — please try again.`);
  return path;
}

/* The real submission. Throws with the RPC's message on rejection. */
export async function submitBuddyApplication(payload) {
  const { data, error } = await supabase.rpc("submit_buddy_application", {
    application: payload.application,
    refs: payload.refs,
  });
  if (error) throw new Error(error.message);
  return { id: data };
}

/* Own applications, newest first. RLS scopes this to the caller. */
export async function fetchOwnApplications() {
  const { data, error } = await supabase
    .from("buddy_applications")
    .select("id, status, created_at, decided_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export function liveApplication(applications) {
  return applications.find((a) => a.status !== "rejected") || null;
}

/* Days left before reapplying is allowed, or 0 if clear. */
export function cooldownDaysLeft(applications) {
  const rejected = applications.find(
    (a) => a.status === "rejected" && a.decided_at
  );
  if (!rejected) return 0;
  const until = new Date(rejected.decided_at);
  until.setDate(until.getDate() + COOLDOWN_DAYS);
  const left = Math.ceil((until - new Date()) / 86400000);
  return Math.max(0, left);
}

/* Map the RPC's raise messages (migration 0004) onto screen codes.
   Matching is by substring so wording tweaks in copy never leak a raw
   database error to an applicant. */
export function classifySubmitError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("at least 18")) return "under18";
  if (m.includes("90 days")) return "cooldown";
  if (m.includes("already in progress")) return "duplicate";
  if (m.includes("cannot apply") || m.includes("good standing")) return "blocked";
  return "generic";
}

export async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Your session has expired — please sign in again.");
  return data.user.id;
}
