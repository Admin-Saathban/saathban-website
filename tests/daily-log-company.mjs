/* ════════════════════════════════════════════════
   Company, not competition — PRODUCT_DECISIONS §5, at the database.

   Run:  node tests/daily-log-company.mjs

   §5's hardest rule is a negative one: the app must NEVER say a named
   person hasn't logged. A rule like that cannot be kept by careful
   rendering, because every future caller has to keep it too. It is
   kept by the shape of the data — circle_logged_today() (0081) can
   only return people who DID log, and returns no total, so there is
   nothing from which a client could construct a missing person.

   So this file asserts the SHAPE, not just the values:

     · somebody who logged today appears;
     · somebody who did NOT is simply absent — no row, no flag, no
       null-valued placeholder that a client could render;
     · no count of the circle comes back, because a client holding
       "3 of 5" would draw the missing two and somebody would
       eventually name them;
     · sharing gates it, not connection — being in a circle is not
       consent to have your day reported.

   §20.3: each check is made to fail before it is trusted. The sharing
   flag is flipped and the row disappears; the log is removed and the
   row disappears. A checker that matched nothing would pass both, so
   both are also asserted in the positive direction first.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";

let failures = 0;
const check = (name, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(64), note);
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
const today = new Date().toISOString().slice(0, 10);

/* The membership that ties them together, and its sharing flag —
   restored exactly as found at the end. */
const memRes = await icon.rest(
  `circle_members?icon_id=eq.${icon.id}&member_id=eq.${fam.id}&select=id,member_shares_log`
);
const membership = memRes.body?.[0] || null;
if (!membership) {
  console.error("smoke-fam is not in smoke-icon's circle — cannot test §5's company line.");
  process.exit(2);
}
const originalShares = membership.member_shares_log;

/* Whether the Fam member has a log today, restored at the end. */
const logRes = await fam.rest(`daily_logs?icon_id=eq.${fam.id}&log_date=eq.${today}&select=id,module`);
const hadLogs = Array.isArray(logRes.body) ? logRes.body.length : 0;

console.log(`\nicon ${icon.id}\nfam  ${fam.id}\nfam had ${hadLogs} log rows today, member_shares_log=${originalShares}`);

const setShares = (v) =>
  icon.rest(`circle_members?id=eq.${membership.id}`, { method: "PATCH", body: JSON.stringify({ member_shares_log: v }) });

const famLogs = async () => {
  const r = await fam.rest(`daily_logs`, {
    method: "POST",
    body: JSON.stringify({ icon_id: fam.id, log_date: today, module: "mood", payload: { choices: ["good"] }, mood_value: 4 }),
  });
  return r;
};
const famUnlogs = () =>
  fam.rest(`daily_logs?icon_id=eq.${fam.id}&log_date=eq.${today}&module=eq.mood`, { method: "DELETE" });

const seesFam = async () => {
  const r = await icon.rpc("circle_logged_today");
  const rows = Array.isArray(r.body) ? r.body : [];
  return { rows, has: rows.some((x) => x.profile_id === fam.id), status: r.status };
};

console.log("\n── presence is reported ──\n");

await setShares(true);
if (!hadLogs) await famLogs();
{
  const { rows, has, status } = await seesFam();
  check("somebody who logged today appears", has, `HTTP ${status}, ${rows.length} row(s)`);
  check("the row carries a name to say it with",
    rows.some((x) => x.profile_id === fam.id && !!x.full_name),
    JSON.stringify(rows.find((x) => x.profile_id === fam.id) || null));
}

console.log("\n── and absence is not ──\n");

{
  /* The check that must flip. If it does not, everything above is
     passing on evidence that would pass for a broken function too. */
  await famUnlogs();
  const { rows, has } = await seesFam();
  check("somebody who did NOT log is absent entirely", !has, `${rows.length} row(s)`);
  check("no placeholder row is returned for them",
    !rows.some((x) => x.profile_id === fam.id),
    JSON.stringify(rows).slice(0, 80));
  await famLogs(); // put the log back for the sharing checks
}

{
  /* Nothing in the payload could be used to build a total. */
  const { rows } = await seesFam();
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].sort();
  check("the shape is only profile_id and full_name",
    keys.every((k) => ["profile_id", "full_name"].includes(k)), keys.join(", "));
  check("no circle total comes back with it",
    !JSON.stringify(rows).match(/"(total|count|of|missing|pending)"/), "no count key");
}

console.log("\n── sharing gates it, not connection ──\n");

{
  await setShares(false);
  const { has, rows } = await seesFam();
  check("a circle member who does not share their log is absent", !has, `${rows.length} row(s)`);
  await setShares(true);
  const back = await seesFam();
  check("and returns when sharing is on again", back.has, `${back.rows.length} row(s)`);
}

console.log("\n── a stranger gets nothing ──\n");

{
  const r = await fetch(`${SUPA}/rest/v1/rpc/circle_logged_today`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: "{}",
  });
  check("anon cannot call it", r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}

/* Put everything back exactly as found. */
await setShares(originalShares);
if (!hadLogs) await famUnlogs();
{
  const m = await icon.rest(`circle_members?id=eq.${membership.id}&select=member_shares_log`);
  const l = await fam.rest(`daily_logs?icon_id=eq.${fam.id}&log_date=eq.${today}&select=id`);
  const rows = Array.isArray(l.body) ? l.body.length : 0;
  check("the fixture is put back as it was found",
    m.body?.[0]?.member_shares_log === originalShares && rows === hadLogs,
    `shares=${m.body?.[0]?.member_shares_log}, logs=${rows} (was ${hadLogs})`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
