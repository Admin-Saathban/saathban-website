import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const missing = [
  !url && "VITE_SUPABASE_URL",
  !anonKey && "VITE_SUPABASE_ANON_KEY",
].filter(Boolean);

/* Null when configured; otherwise the human-readable explanation.
   AppRoot checks this at the /app boundary and renders a proper error
   screen instead of mounting the app. */
export const supabaseConfigError = missing.length
  ? `Supabase is not configured: missing ${missing.join(" and ")}. ` +
    `Locally: add ${missing.length > 1 ? "them" : "it"} to .env.local in the project root ` +
    `(copy the Project URL and anon key from the Supabase project's API settings), then restart the dev server. ` +
    `On Vercel: add ${missing.length > 1 ? "them" : "it"} under Settings → Environment Variables ` +
    `with the Preview and Production environments enabled, then redeploy.`
  : null;

/* The client is created LAZILY, on first use — never at module load.
   This file sits in the /app import graph that main.jsx pulls in for
   every visitor, so a module-scope throw here would white-screen the
   marketing site too. Missing env now surfaces only when something
   actually touches Supabase, and the /app boundary catches it first
   via supabaseConfigError above. */
let client = null;

function getClient() {
  if (supabaseConfigError) throw new Error(supabaseConfigError);
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        // Icons get a long-lived session; the client refreshes silently and never auto-logs-out.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // magic-link callback
      },
    });
  }
  return client;
}

/* Call sites keep the exact same shape (`supabase.auth…`,
   `supabase.from(…)`, `supabase.rpc(…)`, `supabase.storage…`) — the
   proxy just defers client creation to the first property access. */
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const c = getClient();
      const value = c[prop];
      return typeof value === "function" ? value.bind(c) : value;
    },
  }
);

export default supabase;
