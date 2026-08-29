/* Mock of the submit_buddy_application(application jsonb, refs jsonb) RPC
   from supabase/migrations/0004_buddy_vetting.sql.

   Mirrors the database-side rejections the form can actually trip
   (18+, exactly two references, required declarations) so the UI's
   error handling is exercised now and unchanged later. Replace the
   body with a supabase.rpc("submit_buddy_application", payload) call
   when the data layer lands — the signature and errors are the same. */

export function mockSubmitBuddyApplication({ application, refs }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const dob = new Date(application.dob);
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 18);
      if (Number.isNaN(dob.getTime()) || dob > cutoff) {
        return reject(new Error("Applicants must be at least 18"));
      }
      if (!Array.isArray(refs) || refs.length !== 2) {
        return reject(new Error("Exactly two references are required"));
      }
      if (
        !application.consented_character_certificate ||
        !application.accepted_code_of_conduct
      ) {
        return reject(new Error("The required declarations were not accepted"));
      }

      // Visible in devtools so reviewers can inspect the exact payload
      // the real RPC will receive.
      console.log("[mock] submit_buddy_application payload:", { application, refs });

      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "mock-application-id";
      resolve({ id });
    }, 900);
  });
}
