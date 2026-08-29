#!/usr/bin/env node
/* ════════════════════════════════════════════════
   Pre-launch purge of development test data.

   DRY RUN (safe, the default):
     node scripts/purge-test-data.mjs

   FOR REAL:
     node scripts/purge-test-data.mjs --execute

   Needs a SERVICE ROLE key, because deleting an account means deleting
   from the auth schema, which the anon key cannot touch:

     SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-test-data.mjs

   ── What it does ──────────────────────────────────────────────────
   Deletes the development accounts and the fixture rows created around
   them, then reports what remains. Nearly everything hangs off
   profiles.id with ON DELETE CASCADE, so removing an auth user takes
   its logs, seats, messages, notifications and memberships with it;
   the handful of rows that belong to no account (a demo event, a demo
   group) are removed explicitly.

   ── The safety property that matters ──────────────────────────────
   This database has REAL accounts in it alongside the test ones. The
   script therefore works from an explicit ALLOW-LIST of addresses it
   may delete, never a pattern like "%@saathban.dev" or "everything
   except…". If it encounters an account it was not told about, it
   stops and prints it rather than guessing. Adding a new test account
   means adding it here — that friction is the point.

   Re-runnable: deleting what is already gone is not an error.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";

/* ── The allow-list. ONLY these accounts are ever deleted. ────────── */
const PURGE_EMAILS = [
  "test-icon@saathban.dev",
  "test-icon2@saathban.dev",
  "test-fam@saathban.dev",
  "test-buddy@saathban.dev",
  "test-buddy-pending@saathban.dev",
  "test-admin@saathban.dev",
  "smoke-icon@saathban.dev",
  "smoke-fam@saathban.dev",
  "test-magiclink-e2e@saathban.dev",
  "test-magiclink-e2e-2@saathban.dev",
  "test-magiclink-e2e-3@saathban.dev",
  "test-welcome-e2e@saathban.dev",
  "test-welcome-e2e2@saathban.dev",
];

/* Real accounts, listed so an unexpected address is obvious rather
   than merely absent from the purge list. NEVER add one of these to
   PURGE_EMAILS. */
const KNOWN_REAL = ["hr@saathban.com", "saathban@gmail.com", "tahirsajeel2002@gmail.com"];

/* Fixture rows that belong to no account, matched narrowly by name. */
const FIXTURE_EVENTS = ["Chai Reunion — Model Town"];
const FIXTURE_GROUPS = ["Sticker Test Group"];

const EXECUTE = process.argv.includes("--execute");

function envVar(name, fallbackNames = []) {
  for (const n of [name, ...fallbackNames]) if (process.env[n]) return process.env[n].trim();
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const n of [name, ...fallbackNames]) {
      const line = raw.split(/\r?\n/).find((l) => l.startsWith(n));
      if (line) return line.slice(line.indexOf("=") + 1).replace(/\s/g, "");
    }
  } catch {
    /* no .env.local — env vars only */
  }
  return null;
}

const SUPA = envVar("SUPABASE_URL", ["VITE_SUPABASE_URL"]);
const SERVICE = envVar("SUPABASE_SERVICE_ROLE_KEY", ["SERVICE_ROLE_KEY"]);
if (!SUPA) {
  console.error("Missing SUPABASE_URL (or VITE_SUPABASE_URL).");
  process.exit(2);
}
if (!SERVICE) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Deleting accounts touches the auth schema, which the anon key cannot do.\n" +
      "Find it in the Supabase dashboard under Project Settings → API, and pass it\n" +
      "on the command line rather than committing it:\n\n" +
      "  SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-test-data.mjs\n"
  );
  process.exit(2);
}

const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const rest = async (path, init = {}) => {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
};
const admin = async (path, init = {}) => {
  const r = await fetch(`${SUPA}/auth/v1/admin/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => null) };
};
const inList = (arr) => `(${arr.map((v) => `"${v}"`).join(",")})`;

console.log(EXECUTE ? "PURGE — executing\n" : "DRY RUN — nothing will be deleted. Add --execute to run it for real.\n");

/* ── 1. Accounts: reconcile what exists against what we may delete ── */
const users = [];
for (let page = 1; ; page++) {
  const r = await admin(`users?page=${page}&per_page=200`);
  const batch = r.body?.users || [];
  users.push(...batch);
  if (batch.length < 200) break;
}
const emails = users.map((u) => u.email).filter(Boolean);
const toPurge = users.filter((u) => PURGE_EMAILS.includes(u.email));
const unknown = emails.filter((e) => !PURGE_EMAILS.includes(e) && !KNOWN_REAL.includes(e));

console.log(`accounts: ${emails.length} total — ${toPurge.length} to purge, ${KNOWN_REAL.length} known real`);
if (unknown.length) {
  console.error(
    `\nSTOPPING: ${unknown.length} account(s) are neither on the purge list nor known real:\n` +
      unknown.map((e) => "  " + e).join("\n") +
      "\n\nDecide about each one, then add it to PURGE_EMAILS or KNOWN_REAL in this file.\n" +
      "This script will not guess which accounts belong to people.\n"
  );
  process.exit(1);
}
for (const u of toPurge) console.log(`  purge: ${u.email}`);

/* ── 2. What the cascade will take with them ───────────────────────── */
const ids = toPurge.map((u) => u.id);
const counts = {};
if (ids.length) {
  const owned = [
    ["daily_logs", "icon_id"],
    ["game_seats", "profile_id"],
    ["dm_messages", "sender_id"],
    ["community_posts", "author_id"],
    ["notifications", "profile_id"],
    ["circle_members", "member_id"],
    ["reminders", "icon_id"],
    ["buddy_applications", "applicant_id"],
    ["puzzle_attempts", "profile_id"],
    ["game_sessions", "created_by"],
  ];
  for (const [table, col] of owned) {
    const r = await rest(`${table}?select=id&${col}=in.${inList(ids)}`);
    counts[table] = Array.isArray(r.body) ? r.body.length : `? (${r.status})`;
  }
}
console.log("\nrows that cascade with those accounts:");
for (const [t, n] of Object.entries(counts)) console.log(`  ${String(n).padStart(6)}  ${t}`);

/* ── 3. Ownerless fixtures ─────────────────────────────────────────── */
const ev = await rest(`events?select=id,title&title=in.${inList(FIXTURE_EVENTS)}`);
const gr = await rest(`groups?select=id,name&name=in.${inList(FIXTURE_GROUPS)}`);
console.log(`\nownerless fixtures: ${(ev.body || []).length} event(s), ${(gr.body || []).length} group(s)`);

if (!EXECUTE) {
  console.log("\nDry run complete. Re-run with --execute to delete the above.");
  console.log("Afterwards, empty these storage buckets by hand in the dashboard:");
  console.log("  cnic (identity documents), dm-images, voice-notes");
  process.exit(0);
}

/* ── 4. Execute ────────────────────────────────────────────────────── */
for (const g of gr.body || []) await rest(`groups?id=eq.${g.id}`, { method: "DELETE" });
for (const e of ev.body || []) await rest(`events?id=eq.${e.id}`, { method: "DELETE" });
console.log("fixtures removed");

let deleted = 0;
for (const u of toPurge) {
  const r = await admin(`users/${u.id}`, { method: "DELETE" });
  if (r.ok) deleted++;
  else console.error(`  failed: ${u.email} (${r.status})`);
}
console.log(`accounts deleted: ${deleted}/${toPurge.length}`);

/* ── 5. Verify, because a delete that removed nothing looks like this
       one succeeding (agreement 10: check the count, not the status) ── */
const after = [];
for (let page = 1; ; page++) {
  const r = await admin(`users?page=${page}&per_page=200`);
  const batch = r.body?.users || [];
  after.push(...batch);
  if (batch.length < 200) break;
}
const leftovers = after.map((u) => u.email).filter((e) => PURGE_EMAILS.includes(e));
const stray = {};
for (const [table, col] of [["daily_logs", "icon_id"], ["game_sessions", "created_by"], ["dm_messages", "sender_id"]]) {
  if (!ids.length) break;
  const r = await rest(`${table}?select=id&${col}=in.${inList(ids)}`);
  stray[table] = Array.isArray(r.body) ? r.body.length : "?";
}
console.log("\nverification:");
console.log(`  test accounts remaining: ${leftovers.length}${leftovers.length ? " -> " + leftovers.join(", ") : ""}`);
console.log(`  rows still owned by deleted ids: ${JSON.stringify(stray)}`);
console.log("\nStill to do by hand in the dashboard: empty the cnic, dm-images and voice-notes buckets.");
process.exit(leftovers.length ? 1 : 0);
