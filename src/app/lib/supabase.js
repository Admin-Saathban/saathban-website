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

/* ── WHAT A SIGNED-IN PERSON LEAVES ON THE DEVICE ──

   Screens that keep a copy of the last thing they showed, so the next
   open paints at once instead of waiting on the network, store it
   under one of these prefixes followed by the person's id. The id in
   the key is what stops one person's copy being shown to another; this
   list is what makes signing out take every copy with it, so a shared
   phone does not keep somebody's feed after they have left.

   What Home paints from with no network (lib/offline.js): the profile
   row, the runs and days, today's company line, the log preferences,
   and the daily logs with their unsent queue. The queue goes too: it
   holds the same private notes as the log cache, and a phone handed to
   somebody else must not keep them. A log not yet sent when its writer
   signs out is therefore not sent — privacy over convenience. */
export const SIGNED_IN_CACHE_PREFIXES = [
  "saathban.app.homeFeed.",
  "saathban.app.profile.",
  "saathban.app.streaks.",
  "saathban.app.company.",
  "saathban.app.logPrefs.",
  "saathban.app.iconPrefs",
  "saathban.app.dailyLogs.",
  "saathban.app.dailyLogQueue.",
  "saathban.app.messages.",
];

function forgetSignedInCaches() {
  try {
    const ls = window.localStorage;
    /* Collected first, removed after. key(i) has no stable order once
       the store is mutated — measured in Edge, removing while indexing
       skipped one of eight signed-in copies and it survived sign-out. */
    const doomed = [];
    for (let i = 0; i < ls.length; i += 1) {
      const k = ls.key(i);
      if (k && SIGNED_IN_CACHE_PREFIXES.some((p) => k.startsWith(p))) doomed.push(k);
    }
    doomed.forEach((k) => ls.removeItem(k));
  } catch {
    /* storage unavailable — then nothing was stored either */
  }
}

/* The client is created LAZILY, on first use — never at module load.
   This file sits in the /app import graph, so a module-scope throw here
   would white-screen the app boundary before it can explain itself.
   Missing env now surfaces only when something actually touches
   Supabase, and the /app boundary catches it first via
   supabaseConfigError above. */
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
    /* SIGNED_OUT covers both doors out: pressing Sign out, and a
       session the server has refused to refresh. Storage only — an
       auth callback must not call back into the client. */
    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") forgetSignedInCaches();
    });
  }
  return client;
}

/* ── WHO AM I, WITHOUT ASKING THE SERVER ──

   auth.getUser() is a network round trip to the auth server every time
   it is called, and it was being called about thirty times across the
   app purely to learn the signed-in person's id — for a filter, or to
   fill in an author column. On a phone at 150ms latency that is a
   visible pause before every one of those reads even starts.

   getSession() answers from the session already held on the device
   (refreshing it first only if it has expired). The id it returns is
   NOT a security decision: every read and write is still judged by row
   security on the server against the verified token, so a wrong id
   here could only ever produce a refused write, never a leak.

   Use getUser() where the server's CURRENT view of the account is the
   point — linked identities, a just-changed email. */
export async function sessionUser() {
  const { data } = await getClient().auth.getSession();
  return data?.session?.user ?? null;
}

export async function currentUserId() {
  return (await sessionUser())?.id ?? null;
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
