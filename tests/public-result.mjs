/* ════════════════════════════════════════════════
   The anon grant — what a stranger can read, and what they cannot.

   Run:  node tests/public-result.mjs

   `public_game_result` is the FIRST deliberate anonymous grant in this
   schema. Every other migration revokes from anon; the app is closed
   to the world by construction. So the interesting half of this file
   is not "does the page work" — it is "did opening one door open any
   others".

   A SECURITY DEFINER function runs as its owner and bypasses RLS
   entirely. That is the point of it and also the danger: if the body
   were ever widened, or a table grant slipped in beside it, nothing in
   the app would fail and nothing would look different. The only thing
   that notices is a test that asks, as a stranger, for things a
   stranger must never have.

   So the checks come in two halves:

     · THE DOOR OPENS — a finished game's names and board come back.
     · THE DOOR IS EXACTLY THAT WIDE — profiles, safe_profiles,
       daily_logs, dm_messages, circle_members, community_posts and the
       game tables themselves all still refuse; a LIVE game refuses; an
       unknown id refuses; and nothing in the payload can be joined
       back to a person.

   "Refuses" means either a permission error or an empty result. Both
   are safe and the test records which, because the difference tells
   you whether the grant is missing or RLS is doing the work.
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
const PLAYER = process.env.TEST_ACCOUNT_2 || "smoke-fam@saathban.dev";

if (!SUPA || !ANON) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  process.exit(2);
}

/* A TRULY ANONYMOUS CLIENT: the apikey and nothing else. No
   Authorization header, so PostgREST gives it the `anon` role — the
   same thing a stranger's browser sends when it opens a shared link. */
const anonHeaders = { apikey: ANON, "Content-Type": "application/json" };

async function anonRpc(fn, args) {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: anonHeaders,
    body: JSON.stringify(args),
  });
  return { status: r.status, ok: r.ok, body: await r.json().catch(() => null) };
}

async function anonRest(path) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: anonHeaders });
  const body = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok, body };
}

/* Signed in only to FIND a finished game to ask about. Nothing in the
   assertions uses this session. */
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
  const H = { apikey: ANON, Authorization: `Bearer ${s.access_token}` };
  return {
    id: s.user.id,
    rest: async (path) => (await fetch(`${SUPA}/rest/v1/${path}`, { headers: H })).json(),
  };
}

const player = await signIn(PLAYER);
const finished = await player.rest(
  "game_sessions?game_key=eq.ludo&status=eq.finished&select=id,winner_seat&order=created_at.desc&limit=1"
);
/* ANY session that is not finished, not only a live one. "Finished
   games only" is the constraint most likely to be quietly lost in a
   later edit to the function body, and a check that can only run when
   somebody happens to be mid-game would skip itself most of the time
   and notice nothing. Cancelled tables are always available, and the
   function's `status = 'finished'` clause makes no distinction between
   the ways a game can fail to be finished. */
const unfinished = await player.rest(
  "game_sessions?status=neq.finished&select=id,status&order=created_at.desc&limit=1"
);

if (!Array.isArray(finished) || finished.length === 0) {
  console.error("No finished ludo game to test against — play one first.");
  process.exit(2);
}
const gameId = finished[0].id;
const unfinishedRow = Array.isArray(unfinished) && unfinished[0] ? unfinished[0] : null;
console.log(`\nfinished game under test: ${gameId}`);
console.log(unfinishedRow
  ? `unfinished game under test: ${unfinishedRow.id} (${unfinishedRow.status})`
  : "unfinished game under test: NONE FOUND — the finished-only check cannot run");

console.log("\n── the door opens ──\n");

const res = await anonRpc("public_game_result", { p_session: gameId });
check("an anonymous client can read a finished game's result",
  res.ok && res.body && typeof res.body === "object", `HTTP ${res.status}`);

const payload = res.body || {};
const seats = Array.isArray(payload.seats) ? payload.seats : [];

check("it carries the players", seats.length > 0, `${seats.length} seats`);
check("it carries the final board", Array.isArray(payload.pieces), JSON.stringify(payload.pieces || null).slice(0, 40));
check("it carries the winner", payload.winner_seat != null, String(payload.winner_seat));
check("a human seat has a name", seats.some((s) => !s.is_bot && s.name),
  seats.map((s) => (s.is_bot ? "bot" : s.name)).join(", "));

console.log("\n── and nothing in it points back at a person ──\n");

if (!res.ok) {
  /* Before the grant is applied the rpc 404s and "payload" is an error
     object, whose keys would then fail the shape checks for a reason
     that has nothing to do with shape. A check that fails for the
     wrong reason teaches the wrong lesson. */
  console.log(`SKIP  the payload checks need the grant applied first — HTTP ${res.status}`);
} else {
  /* The whole payload, flattened, so a field added later cannot smuggle
     something through a key nobody thought to check. */
  const flat = JSON.stringify(payload);
  check("no profile ids anywhere in the payload",
    !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(flat),
    (flat.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || ["none"])[0]);
  check("no avatar or storage urls", !/avatar|storage|\/object\/|https?:\/\//i.test(flat));
  check("no chat", !/message|chat|body/i.test(flat));
  check("no join code", !/join_code|\bcode\b/i.test(flat));
  const keys = Object.keys(payload).sort();
  check("only the fields the page needs",
    keys.every((k) => ["game_key", "finished_at", "seats_total", "winner_seat", "pieces", "seats"].includes(k)),
    keys.join(", "));
  const seatKeys = [...new Set(seats.flatMap((s) => Object.keys(s)))].sort();
  check("a seat is only seat_no, is_bot and name",
    seatKeys.every((k) => ["seat_no", "is_bot", "name"].includes(k)), seatKeys.join(", "));
}

console.log("\n── the door is exactly that wide ──\n");

{
  /* The load-bearing half. Each of these is something a stranger must
     never read, and each is asked for the way a stranger would ask. */
  const closed = [
    ["profiles", "profiles?select=id,full_name&limit=1"],
    ["safe_profiles", "safe_profiles?select=id,full_name&limit=1"],
    ["daily_logs", "daily_logs?select=*&limit=1"],
    ["dm_messages", "dm_messages?select=*&limit=1"],
    ["circle_members", "circle_members?select=*&limit=1"],
    ["community_posts", "community_posts?select=*&limit=1"],
    ["game_sessions", "game_sessions?select=*&limit=1"],
    ["game_seats", "game_seats?select=*&limit=1"],
    ["game_messages", "game_messages?select=*&limit=1"],
  ];
  for (const [name, path] of closed) {
    const r = await anonRest(path);
    const rows = Array.isArray(r.body) ? r.body.length : null;
    const refused = !r.ok || rows === 0;
    check(`anon still cannot read ${name}`, refused,
      !r.ok ? `refused, HTTP ${r.status}` : `empty (RLS), HTTP ${r.status}`);
  }
}

{
  /* Reading the session directly is the obvious way round the
     function, so it is asked directly rather than assumed closed. */
  const r = await anonRest(`game_sessions?id=eq.${gameId}&select=*`);
  const rows = Array.isArray(r.body) ? r.body.length : null;
  check("anon cannot read THE VERY GAME it is allowed a result for",
    !r.ok || rows === 0, !r.ok ? `refused, HTTP ${r.status}` : "empty");
}

console.log("\n── and it only opens on a finished game ──\n");

/* Every check below must require the function to EXIST as well as to
   refuse. "Returns nothing" is trivially true of a function that was
   never applied, and a suite that goes green on a database without the
   feature is worse than no suite. */
if (!res.ok) {
  console.log("SKIP  finished-only and enumerability need the grant applied first");
} else {
  {
    /* A missing fixture is a FAILURE here, not a skip: the whole point
       of this check is that it runs. */
    check("there is an unfinished game to test the constraint against",
      !!unfinishedRow, unfinishedRow ? unfinishedRow.status : "none in the database");
    if (unfinishedRow) {
      const r = await anonRpc("public_game_result", { p_session: unfinishedRow.id });
      check(`a game that is not finished (${unfinishedRow.status}) returns nothing to a stranger`,
        r.ok && r.body === null, `HTTP ${r.status} ${JSON.stringify(r.body || null).slice(0, 50)}`);
    }
  }

  {
    const r = await anonRpc("public_game_result", { p_session: "00000000-0000-4000-8000-000000000000" });
    check("an unknown id returns nothing", r.ok && r.body === null,
      `HTTP ${r.status} ${JSON.stringify(r.body || null).slice(0, 40)}`);
  }

  {
    /* Not enumerable: there is no argument that means "all of them",
       and a missing argument must not become one. */
    const r = await anonRpc("public_game_result", {});
    check("the function cannot be asked for every game", !r.ok || r.body === null,
      `HTTP ${r.status} ${JSON.stringify(r.body || null).slice(0, 40)}`);
  }
}

{
  /* One id in, one game out — the return is an object, never a list,
     so there is no shape in which more than one game could arrive. */
  check("the result is one game, not a list", !Array.isArray(payload), Array.isArray(payload) ? "ARRAY" : "object");
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
