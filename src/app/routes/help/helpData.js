/* Help and support, against the `questions` table (migration 0010).

   That table has had a working "ask a question" insert policy, an
   admin answering RPC, a notification on reply and an audit entry
   since 0010 — and nothing in the app could write to it. The admin
   queue has been reading an empty table for weeks because there was
   no front door, not because nobody had questions.

   Ownership, asker name and asker role are all stamped by an insert
   trigger, so the client sends only what a person actually typed.
   There is no update path on purpose: replies happen through the
   admin RPC so the stored reply, the notification and the audit entry
   stay one unit. */

import supabase from "../../lib/supabase.js";

export async function askQuestion({ subject, body }) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("not signed in");
  /* profile_id is in the policy's WITH CHECK as well as forced by the
     trigger; sending it means the insert is accepted rather than
     bounced before the trigger ever runs. */
  const { error } = await supabase
    .from("questions")
    .insert({ profile_id: uid, subject, body });
  if (error) throw error;
}

/* RLS ("read own questions") scopes this to the asker with no filter
   of ours — but the filter stays anyway, because a query that depends
   on a policy to be correct is one policy edit from leaking. */
export async function fetchMyQuestions() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("questions")
    .select("id, subject, body, status, reply, replied_at, created_at")
    .eq("profile_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
