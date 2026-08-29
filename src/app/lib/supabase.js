import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const missing = [
  !url && "VITE_SUPABASE_URL",
  !anonKey && "VITE_SUPABASE_ANON_KEY",
].filter(Boolean);

if (missing.length) {
  throw new Error(
    `Supabase is not configured: missing ${missing.join(" and ")}. ` +
      `Add ${missing.length > 1 ? "them" : "it"} to .env.local in the project root ` +
      `(copy the Project URL and anon key from your Supabase project's API settings), ` +
      `then restart the dev server so Vite picks up the change.`
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Icons get a long-lived session; the client refreshes silently and never auto-logs-out.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // magic-link callback
  },
});

export default supabase;
