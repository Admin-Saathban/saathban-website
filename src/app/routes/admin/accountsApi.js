/* ════════════════════════════════════════════════
   Admin — people, activity, content and test data (0150–0154).

   Every call here is a SECURITY DEFINER function that checks who is
   asking and writes the audit log itself. The screen decides nothing
   about permission: a support admin who presses a super-admin button
   is refused by the database, and the refusal is shown.

   Stored files cannot be removed in SQL. Deleting an account or
   removing content hands back the files it queued; removeQueuedFiles
   deletes them through the Storage API (a storage policy allows a
   super-admin to remove ONLY queued paths) and then asks the database
   what is really gone.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";
import { sendMagicLink } from "../../lib/authFlow.js";

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

export const listPeople = (query) =>
  rpc("admin_list_people", { p_query: query || null, p_limit: 500 });

export const getPerson = (id) => rpc("admin_person", { p_id: id });

export const setPause = (id, paused, reason) =>
  rpc("moderator_set_pause", { p_profile: id, p_paused: paused, p_reason: reason });

export const setRole = (id, role, level, reason) =>
  rpc("admin_set_role", { p_id: id, p_role: role, p_level: level || null, p_reason: reason });

export const setTest = (id, isTest, reason) =>
  rpc("admin_set_test", { p_id: id, p_is_test: isTest, p_reason: reason });

/* Recorded first, then sent. The address comes back from the audited
   call, so the link goes where the database says the account lives.
   shouldCreateUser: false — this never makes a new account. The link
   lands on /app/auth/complete, the same as a link the person asks for
   themselves (authFlow.sendMagicLink). */
export async function sendSignInLink(id, reason) {
  const email = await rpc("admin_record_signin_link", { p_id: id, p_reason: reason || null });
  const { error } = await sendMagicLink(email, {}, { createUser: false });
  if (error) throw error;
  return email;
}

export const deletionPreview = (id) => rpc("admin_account_deletion_preview", { p_id: id });

export const deleteAccount = (id, confirm, reason) =>
  rpc("admin_delete_account", { p_id: id, p_confirm: confirm, p_reason: reason });

/* files: [{bucket, path}] from a delete or remove call. Returns
   { removed, remaining: [{bucket, path}] } as the DATABASE sees it
   after the Storage API has done its part. */
export async function removeQueuedFiles(batch, files) {
  const byBucket = {};
  for (const f of files || []) (byBucket[f.bucket] ||= []).push(f.path);
  for (const [bucket, paths] of Object.entries(byBucket)) {
    // Failures are not thrown: the database check below is the truth.
    await supabase.storage.from(bucket).remove(paths).catch(() => null);
  }
  return rpc("admin_files_removed", { p_batch: batch });
}

export const activity = (includeTest) =>
  rpc("admin_activity", { p_include_test: Boolean(includeTest) });

export const recentContent = () => rpc("admin_recent_content", { p_limit: 40 });

export const hideContent = (kind, id, hide, reason, report) =>
  rpc("moderate_content", {
    p_kind: kind,
    p_id: id,
    p_hide: hide,
    p_reason: reason,
    p_report: report || null,
  });

export const removeContent = (kind, id, reason, report) =>
  rpc("admin_remove_content", {
    p_kind: kind,
    p_id: id,
    p_reason: reason,
    p_report: report || null,
  });

export const testDataOverview = () => rpc("admin_test_data_overview");

export const removeTestAccounts = (expected, confirm, reason) =>
  rpc("admin_remove_test_accounts", {
    p_expected: expected,
    p_confirm: confirm,
    p_reason: reason,
  });

/* Refusals from the database arrive as English sentences written in
   the migrations. The screens show a translated line for the ones a
   person can act on, and the raw message otherwise (staff-facing). */
export function refusalKey(error) {
  const m = (error && error.message) || "";
  if (/last super-admin/i.test(m)) return "admin.people.errLastSuper";
  if (/confirmation does not match/i.test(m)) return "admin.people.errConfirm";
  if (/reason is required/i.test(m)) return "admin.people.errReason";
  if (/only a super-admin|not allowed|42501/i.test(m) || error?.code === "42501")
    return "admin.people.errNotAllowed";
  if (/own account/i.test(m)) return "admin.people.errSelf";
  if (/list changed/i.test(m)) return "admin.testData.errChanged";
  if (/already be gone|nothing to/i.test(m)) return "admin.content.errGone";
  return null;
}
