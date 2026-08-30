/* ════════════════════════════════════════════════
   What a person wears on their own four gotis — migration 0095.

   Run:  node tests/goti-marks.mjs   (needs the DB channel)

   The interesting assertions are the two limits, because the marks
   themselves are four strings and would pass any test:

     the SHAPE cannot be a check constraint. Per-element validation
     needs jsonb_array_elements and Postgres refuses a subquery in a
     check (0A000), so the length cap lives in a trigger. A rule that
     moved from a place everyone knows to check to a place nobody
     does is exactly the rule that quietly stops being enforced, so
     it is asserted here against a DIRECT write as well as through
     the RPC.

     the OWNERSHIP is RLS. Marks are readable by anyone signed in on
     purpose — everyone at the table has to see them — which makes
     "and nobody can write mine" the load-bearing half.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";

const PASSWORD = "SaathTest!2026";
function envLocal(name) {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(name));
  return line.slice(line.indexOf("=") + 1).replace(/\s/g, "");
}
const SUPA = envLocal("VITE_SUPABASE_URL");
const ANON = envLocal("VITE_SUPABASE_ANON_KEY");

let failures = 0;
const check = (name, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(58), note);
};

async function login(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`${email}: login failed`);
  return { token: j.access_token, id: j.user.id };
}
async function rest(user, method, path, body, extra = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${user.token}`,
      "Content-Type": "application/json",
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await r.json();
  } catch {
    /* 204 */
  }
  return { status: r.status, data };
}
const rpc = (u, fn, args) => rest(u, "POST", `rpc/${fn}`, args);
const marksOf = (u, id) =>
  rest(u, "GET", `game_piece_marks?profile_id=eq.${id}&select=marks`).then((r) => r.data?.[0]?.marks ?? null);

const me = await login("smoke-icon@saathban.dev");
const them = await login("smoke-fam@saathban.dev");

/* ── Setting them, and setting them again ───────────────────────── */
{
  const first = await rpc(me, "set_piece_marks", { p_marks: ["☘", "", "☀", ""] });
  check("a person can set what their gotis wear", first.status < 400, `HTTP ${first.status}`);
  check("...and it is stored in piece order", JSON.stringify(await marksOf(me, me.id)) === '["☘","","☀",""]', JSON.stringify(await marksOf(me, me.id)));

  /* The same call again, because first-time and changing must not be
     two code paths — one of which is exercised once per account. */
  const again = await rpc(me, "set_piece_marks", { p_marks: ["", "❤", "", "★"] });
  check("changing them is the same call, not a second path", again.status < 400, `HTTP ${again.status}`);
  check("...and it replaced rather than merged", JSON.stringify(await marksOf(me, me.id)) === '["","❤","","★"]', JSON.stringify(await marksOf(me, me.id)));
}

/* ── The shape, which is a trigger and not a check ──────────────── */
{
  const long = await rpc(me, "set_piece_marks", { p_marks: ["this is a sentence", "", "", ""] });
  check("a sentence on a goti is refused", long.status >= 400, `HTTP ${long.status}`);

  /* Straight at the table, past the RPC. This is the assertion that
     matters: the rule moved out of a check constraint and into a
     trigger, and a trigger is easy to drop and never notice. */
  const direct = await rest(
    me,
    "PATCH",
    `game_piece_marks?profile_id=eq.${me.id}`,
    { marks: ["also far too long to wear", "", "", ""] }
  );
  check("...including a direct write that skips the RPC", direct.status >= 400, `HTTP ${direct.status}`);

  /* NOT FOUR IS REFUSED EVERYWHERE, and the padding is the CLIENT
     rails' job rather than the servers. setPieceMarks in ludoRails
     maps [0,1,2,3] before it calls, so a short array never leaves
     the browser; the server does not forgive one, and should not —
     a three-goti set would be a board with a piece that has no
     mark and no way to get one. */
  const three = await rpc(me, "set_piece_marks", { p_marks: ["a", "b", "c"] });
  check("a set that is not four is refused by the RPC", three.status >= 400, `HTTP ${three.status}`);
  const threeDirect = await rest(me, "PATCH", `game_piece_marks?profile_id=eq.${me.id}`, { marks: ["a", "b", "c"] });
  check("...and at the table too", threeDirect.status >= 400, `HTTP ${threeDirect.status}`);

  await rpc(me, "set_piece_marks", { p_marks: ["a", "b", "c", ""] });
  check("nothing broken got through", JSON.stringify(await marksOf(me, me.id)) === '["a","b","c",""]', JSON.stringify(await marksOf(me, me.id)));
}

/* ── Everyone sees them; only I set mine ────────────────────────── */
{
  const seen = await marksOf(them, me.id);
  check("everyone at the table can read them", JSON.stringify(seen) === '["a","b","c",""]', JSON.stringify(seen));

  const before = await marksOf(me, me.id);
  /* RLS answers this with 204 AND NO ROWS TOUCHED rather than an
     error: the row is simply not visible to their UPDATE. So the
     assertion has to be the value, not the status — a test reading
     204 as success here would report a hole that is not there, and
     one reading it as failure would miss a real one. */
  const steal = await rest(them, "PATCH", `game_piece_marks?profile_id=eq.${me.id}`, { marks: ["x", "", "", ""] });
  const after = await marksOf(me, me.id);
  check(
    "nobody else can change what my gotis wear",
    JSON.stringify(after) === JSON.stringify(before),
    `HTTP ${steal.status} then ${JSON.stringify(after)}`
  );

  const forge = await rest(them, "POST", "game_piece_marks", { profile_id: me.id, marks: ["x", "", "", ""] });
  check("...nor claim a row in my name", forge.status >= 400, `HTTP ${forge.status}`);
}

/* Leave the account as it was found. */
await rest(me, "DELETE", `game_piece_marks?profile_id=eq.${me.id}`);
check("the suite cleans up after itself", (await marksOf(me, me.id)) === null);

console.log(failures ? `\n${failures} FAILED` : "\nall green");
process.exit(failures ? 1 : 0);
