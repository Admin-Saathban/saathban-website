/* ════════════════════════════════════════════════
   A birthday is a kindness, not a public field.

   Run:  node tests/dob-privacy.mjs

   PRODUCT_DECISIONS §2 asks for a date of birth so the app can
   celebrate with people. §20.6 asks for the negative case at the
   database. This is that case.

   THE YEAR IS THE SENSITIVE HALF. It is the age, and §2 is explicit
   that the 50+ check happens quietly and that nobody is ever told they
   are being verified. A circle member who can see "born 1948" makes
   the app the thing that told them. So the rule is narrower than
   "don't leak the row":

     · nobody but the person themselves reads the DATE, ever;
     · a circle may learn the one derived fact — whose birthday is
       TODAY — and nothing else;
     · that fact is ids, not dates. Returning "2026-08-30" for a match
       would be the same leak wearing a hat;
     · it is not enumerable. "Whose birthday is today, in my circle" is
       a kindness. "Give me everyone's birthday" is a list.

   WHAT THIS FILE IS ACTUALLY GUARDING. `safe_profiles` is an explicit
   column list, so `date_of_birth` cannot appear in it by accident — it
   would take somebody deliberately adding it, most likely while
   building a birthday feature and reaching for the obvious field. So
   these checks guard a FUTURE edit rather than today's behaviour. That
   is the point: today's behaviour is correct and needs no test, and
   the edit that breaks it will look like it is about something else.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";

let failures = 0;
const check = (name, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(66), note);
};

function envLocal(name) {
  if (process.env[name]) return process.env[name].trim();
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(name));
  return line ? line.slice(line.indexOf("=") + 1).replace(/\s/g, "") : null;
}
const SUPA = envLocal("VITE_SUPABASE_URL");
const ANON = envLocal("VITE_SUPABASE_ANON_KEY");
const PASSWORD = process.env.TEST_PASSWORD || "SaathTest!2026";
const ICON = process.env.TEST_ACCOUNT || "smoke-icon@saathban.dev";
const FAM = process.env.TEST_ACCOUNT_2 || "smoke-fam@saathban.dev";

if (!SUPA || !ANON) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  process.exit(2);
}

/* A stranger: the apikey and nothing else, which is what a browser
   with no session sends. */
const anonHeaders = { apikey: ANON, "Content-Type": "application/json" };

async function signIn(email) {
  const s = await (
    await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  ).json();
  if (!s.access_token) {
    console.error(`${email}: login failed`);
    process.exit(2);
  }
  const H = { apikey: ANON, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" };
  return {
    id: s.user.id,
    rest: async (path, init) => {
      const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: H, ...init });
      return { status: r.status, ok: r.ok, body: await r.json().catch(() => null) };
    },
    rpc: async (fn, args = {}) => {
      const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(args) });
      return { status: r.status, ok: r.ok, body: await r.json().catch(() => null) };
    },
  };
}

const icon = await signIn(ICON);
const fam = await signIn(FAM);

/* A birthday to test with. Set to TODAY so the derived fact has
   something true to report, then put back exactly as found — a test
   that leaves a birthday behind has changed the thing it measured. */
const before = await icon.rest(`profiles?id=eq.${icon.id}&select=date_of_birth,settings`);
const originalDob = before.body?.[0]?.date_of_birth ?? null;
const today = new Date();
const dobToday = `1948-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

await icon.rest(`profiles?id=eq.${icon.id}`, {
  method: "PATCH",
  body: JSON.stringify({ date_of_birth: dobToday }),
});

console.log(`\nicon ${icon.id} birthday set to ${dobToday} (born 1948 — the year is what must never travel)`);

console.log("\n── the column exists and its owner may read it ──\n");

{
  const r = await icon.rest(`profiles?id=eq.${icon.id}&select=date_of_birth`);
  check("a person can read their OWN date of birth",
    r.ok && r.body?.[0]?.date_of_birth === dobToday, r.body?.[0]?.date_of_birth ?? `HTTP ${r.status}`);
}

console.log("\n── and nobody else can ──\n");

{
  /* The load-bearing one. A Fam member is as close as anybody gets —
     they are in the circle, they can see mood and health if granted —
     and they still must not read the date. */
  const r = await fam.rest(`profiles?id=eq.${icon.id}&select=date_of_birth`);
  const rows = Array.isArray(r.body) ? r.body.length : null;
  check("a Fam member in the circle cannot read the date",
    !r.ok || rows === 0 || r.body?.[0]?.date_of_birth == null,
    !r.ok ? `refused, HTTP ${r.status}` : rows === 0 ? "no row" : JSON.stringify(r.body[0]));
}

{
  const r = await fetch(`${SUPA}/rest/v1/profiles?select=date_of_birth&limit=1`, { headers: anonHeaders });
  check("a stranger cannot read the date", r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}

{
  /* safe_profiles is the view a stranger and a search DO reach, which
     is exactly why the field must never be added to it. */
  const r = await fam.rest(`safe_profiles?id=eq.${icon.id}&select=*`);
  const row = Array.isArray(r.body) ? r.body[0] : null;
  check("safe_profiles carries no date_of_birth column at all",
    !!row && !("date_of_birth" in row), row ? Object.keys(row).join(", ") : `HTTP ${r.status}`);
  check("safe_profiles carries no year, under any column name",
    !row || !JSON.stringify(row).includes("1948"), JSON.stringify(row || null).slice(0, 90));
}

console.log("\n── the derived fact, and only the fact ──\n");

{
  const r = await fam.rpc("circle_birthdays_today");
  const ids = Array.isArray(r.body) ? r.body : [];
  check("a circle member learns WHOSE birthday it is today",
    r.ok && ids.includes(icon.id), `HTTP ${r.status} ${JSON.stringify(ids).slice(0, 80)}`);
  check("it returns ids, never dates",
    !JSON.stringify(r.body ?? null).includes("1948") && !/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(r.body ?? null)),
    JSON.stringify(r.body ?? null).slice(0, 80));
}

{
  const r = await fetch(`${SUPA}/rest/v1/rpc/circle_birthdays_today`, {
    method: "POST", headers: anonHeaders, body: "{}",
  });
  check("a stranger cannot call it at all", r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}

console.log("\n── and the person who does not want the fuss ──\n");

{
  await icon.rest(`profiles?id=eq.${icon.id}`, {
    method: "PATCH",
    body: JSON.stringify({ settings: { ...(before.body?.[0]?.settings || {}), birthday_private: true } }),
  });
  const r = await fam.rpc("circle_birthdays_today");
  const ids = Array.isArray(r.body) ? r.body : [];
  check("birthday_private removes them from the day entirely",
    r.ok && !ids.includes(icon.id), `HTTP ${r.status} ${JSON.stringify(ids).slice(0, 60)}`);
}

/* Put it back exactly as found, including the settings blob. */
await icon.rest(`profiles?id=eq.${icon.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    date_of_birth: originalDob,
    settings: before.body?.[0]?.settings || {},
  }),
});
{
  const after = await icon.rest(`profiles?id=eq.${icon.id}&select=date_of_birth,settings`);
  const dob = after.body?.[0]?.date_of_birth ?? null;
  const priv = after.body?.[0]?.settings?.birthday_private;
  check("the fixture is put back as it was found",
    dob === originalDob && priv === undefined, `dob ${dob}, birthday_private ${String(priv)}`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
