/* ════════════════════════════════════════════════
   What a brand-new account starts with — TONIGHT.md LANE 2 §8.

   Run:  node tests/signup-log-defaults.mjs

   The user created an account and found MEDICINES already on.
   PRODUCT_DECISIONS §5 says medicines start OFF, because they need
   setting up first and an empty medicine list on day one is a bad
   first impression.

   §8 is explicit that this must be proved "with a freshly created
   account, not by reading code" — so this file creates one, reads
   what it actually got, and deletes it again. Reading the three
   defaults (client constant, column default, trigger) and finding
   them all innocent is exactly the reasoning that let the bug survive:
   the value a new row ENDS UP with is the only thing that matters, and
   it is the product of all three plus whatever the signup flow writes.

   It also asserts the positive half — mood, sleep and water ARE on —
   because a row that came back empty would otherwise pass the
   medicines check for the wrong reason.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";

let failures = 0;
const check = (name, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(62), note);
};

function envLocal(name) {
  if (process.env[name]) return process.env[name].trim();
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(name));
  return line ? line.slice(line.indexOf("=") + 1).replace(/\s/g, "") : null;
}
const SUPA = envLocal("VITE_SUPABASE_URL");
const ANON = envLocal("VITE_SUPABASE_ANON_KEY");
if (!SUPA || !ANON) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  process.exit(2);
}

const stamp = Date.now();
/* This project requires email confirmation, so a brand-new account
   cannot sign in from a test. Rather than weaken that setting for the
   convenience of a suite, the run can be pointed at an account that
   has already been confirmed:

     TEST_FRESH_EMAIL=... node tests/signup-log-defaults.mjs

   Without one it still creates the account and prints the single line
   that confirms it, so the run ends one paste from finishing rather
   than dead. */
const REUSE = process.env.TEST_FRESH_EMAIL || null;
const EMAIL = REUSE || `fresh-${stamp}@saathban.dev`;
const PASSWORD = "SaathTest!2026";

/* Sign up for real, through the same endpoint the app uses — unless
   we were handed a confirmed account to reuse. */
const signUp = REUSE ? {} : await (
  await fetch(`${SUPA}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      data: { pending_role: "saath_icon", full_name: "Fresh Tester", city: "Lahore" },
    }),
  })
).json();

/* The signup endpoint returns the user object ITSELF when email
   confirmation is on, and {user:{...}} when it is off. Reading only
   one shape reported a successful signup as a failure. */
const newUserId = REUSE ? "reused" : signUp?.user?.id || signUp?.id || null;
if (!newUserId) {
  console.error("Could not create a test account:", JSON.stringify(signUp).slice(0, 200));
  process.exit(2);
}
console.log(`\n${REUSE ? "reusing" : "created"} ${EMAIL}`);

/* Sign in as them — everything below is read as the new person, so
   RLS is exercised exactly as it would be on their phone. */
const tok = await (
  await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
).json();

if (!tok?.access_token) {
  console.error("\nThe new account cannot sign in until its email is confirmed.");
  console.error("Confirm it, then re-run against it:\n");
  console.error("  update auth.users set email_confirmed_at = now()");
  console.error(`   where email = '${EMAIL}';`);
  console.error(`  TEST_FRESH_EMAIL=${EMAIL} node tests/signup-log-defaults.mjs\n`);
  process.exit(2);
}
const id = tok.user.id;
const H = { apikey: ANON, Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" };
const rest = async (path, init) => {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: H, ...init });
  return { status: r.status, ok: r.ok, body: await r.json().catch(() => null) };
};

console.log("\n── what the new account actually got ──\n");

/* Create the profile the way finishProfile does, with the fields
   SignupIcon collects. This step found a real bug on its first run:
   profileRow is a whitelist and was silently dropping date_of_birth
   and area, so §2's birthday was gathered by the form and thrown away
   before the insert. */
const dob = "1948-05-14";
await rest("profiles", {
  method: "POST",
  headers: { ...H, Prefer: "return=representation" },
  body: JSON.stringify({
    id, role: "saath_icon", full_name: "Fresh Tester",
    city: "Lahore", area: "Gulberg", date_of_birth: dob, languages: [],
  }),
});

const madeProfile = await rest(`profiles?id=eq.${id}&select=id,date_of_birth,area`);
const mp = Array.isArray(madeProfile.body) ? madeProfile.body[0] : null;
check("the profile was created", !!mp, `HTTP ${madeProfile.status}`);
check("signup's birthday actually lands in the row", mp?.date_of_birth === dob,
  String(mp?.date_of_birth));
check("signup's area actually lands in the row", mp?.area === "Gulberg", String(mp?.area));

/* The app creates the prefs row on first write. Do what the app does
   rather than inserting a hand-made row, or this tests a fixture
   instead of the product. */
await rest("daily_log_prefs", {
  method: "POST",
  headers: { ...H, Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify({ profile_id: id }),
});

const prefs = await rest(`daily_log_prefs?profile_id=eq.${id}&select=enabled_modules,medications`);
const row = Array.isArray(prefs.body) ? prefs.body[0] : null;
const mods = row?.enabled_modules || [];

/* Without this the medicines check below passes on an ABSENT row —
   which is what happened on the first run, and is exactly the shape of
   "green for the wrong reason" that TONIGHT.md exists to stop. */
check("a prefs row exists for the new account", !!row, `HTTP ${prefs.status}`);
check("mood is on", mods.includes("mood"), mods.join(", "));
check("sleep is on", mods.includes("sleep"), mods.join(", "));
check("water is on", mods.includes("water"), mods.join(", "));

/* The one the user reported. */
check("MEDICINES IS OFF", !mods.includes("medication"), mods.join(", "));
check("meals is off", !mods.includes("diet"), mods.join(", "));
check("movement is off", !mods.includes("exercise"), mods.join(", "));
check("the medicine list is empty", Array.isArray(row?.medications) && row.medications.length === 0,
  JSON.stringify(row?.medications ?? null));

/* And the profile itself starts un-onboarded, so §2's three screens
   are what they meet first. */
const prof = await rest(`profiles?id=eq.${id}&select=settings,date_of_birth`);
const p = Array.isArray(prof.body) ? prof.body[0] : null;
check("the first-run gate will open for them", !p?.settings?.onboarded_at,
  JSON.stringify(p?.settings ?? null).slice(0, 60));

/* Tidy up: the row first (it references the profile), then the
   profile. The auth user needs a service key to remove and this test
   holds none — so the address is timestamped and single-use rather
   than left reusable. */
await rest(`daily_log_prefs?profile_id=eq.${id}`, { method: "DELETE" });
await rest(`profiles?id=eq.${id}`, { method: "DELETE" });
const gone = await rest(`profiles?id=eq.${id}&select=id`);
const left = Array.isArray(gone.body) ? gone.body.length : "?";

/* A person cannot delete their own profile row — RLS allows update,
   not delete, which is correct: leaving is a supported act with a
   human on the other end (§7's deletion flow), not a DELETE somebody
   can fire by accident. So this is reported, never asserted: a test
   that failed here would be failing on a rule working as intended. */
console.log(`\nleftovers: ${left} profile row(s), and the auth user ${EMAIL}.`);
console.log("Neither can be removed by the account itself (RLS forbids self-delete,");
console.log("and dropping an auth user needs a service key). Clear them with:");
console.log(`  delete from public.daily_log_prefs where profile_id = '${id}';`);
console.log(`  delete from public.profiles where id = '${id}';`);
console.log(`  delete from auth.users where email = '${EMAIL}';`);

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
