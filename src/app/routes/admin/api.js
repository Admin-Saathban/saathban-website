/* ════════════════════════════════════════════════
   Admin lane — real Supabase queries and writes.

   Everything the admin UI reads or changes goes through here. RLS is
   the actual boundary (0004: is_admin() for applications/references;
   0003: audit_log readable by super-admins only) — failures surface
   as thrown errors, never silently.

   What writes what:
   - Status / flags / notes → UPDATE buddy_applications. The DB
     trigger on_buddy_status_change appends the audit entry and stamps
     decided_at / reviewed_by — the client never writes those.
   - Reference calls → UPDATE buddy_references (called_at, called_by,
     call_notes). "The collection is not the safeguard; the call is."
   - Document requests → rpc admin_contact_icon: there is no document
     requests table yet, but this RPC is the real, audited channel —
     it delivers an in-app notification to the applicant and writes an
     'admin_contact' audit entry. When a dedicated table lands, only
     requestDocument() changes.
   - Audit trail → SELECT audit_log for the applicant. Super-admin
     scope by design; support admins get a scope notice, not data.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

export async function fetchApplications() {
  const { data, error } = await supabase
    .from("buddy_applications")
    .select("*, references:buddy_references(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function setApplicationStatus(id, status, note) {
  const patch = { status };
  if (note) patch.review_notes = note;
  const { error } = await supabase
    .from("buddy_applications")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function setReviewerFlags(id, flags) {
  const { error } = await supabase
    .from("buddy_applications")
    .update({ reviewer_flags: flags })
    .eq("id", id);
  if (error) throw error;
}

export async function saveReviewNotes(id, notes) {
  const { error } = await supabase
    .from("buddy_applications")
    .update({ review_notes: notes })
    .eq("id", id);
  if (error) throw error;
}

export async function recordReferenceCall(refId, adminId, callNotes) {
  const { error } = await supabase
    .from("buddy_references")
    .update({
      called_at: new Date().toISOString(),
      called_by: adminId,
      call_notes: callNotes || null,
    })
    .eq("id", refId);
  if (error) throw error;
}

/* Document request = an audited admin contact. The applicant receives
   an in-app notification; the audit log records who asked, whom, and
   why. p_reason is the audit reason, distinct from the message body. */
export async function requestDocument(applicantId, type, note) {
  const { error } = await supabase.rpc("admin_contact_icon", {
    p_profile: applicantId,
    p_title: `Document needed: ${type}`,
    p_body:
      (note ? `${note}\n\n` : "") +
      "Please add this document to your volunteer application. " +
      "Reply from your application page or at your next interview.",
    p_reason: `Buddy vetting: requested ${type}`,
  });
  if (error) throw error;
}

/* Super-admin only (0003). RLS filters SELECTs silently rather than
   erroring, so a support admin would just see an empty list — callers
   must check admin_level BEFORE calling and show a scope notice
   instead; never call this as support and present [] as "no history". */
export async function fetchAuditTrail(applicantProfileId) {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("target_profile_id", applicantProfileId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
