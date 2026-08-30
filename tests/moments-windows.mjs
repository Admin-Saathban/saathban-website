/* OUT_AND_ABOUT_SPEC §8 — the three windows of a moment.
 *
 *   live   → in the tab, by the ordinary widening rules
 *   past   → only the author and THE PEOPLE WHO WERE THERE
 *   gone   → 48 hours after it started, for everyone
 *
 * All three are in the row's read policy (0066), never in a cleanup
 * job — a job that fails to run leaves somebody's movements readable
 * indefinitely, and it fails silently. This test exists to prove the
 * policy really is the thing enforcing it. Note the 48-hour cut is
 * checked separately rather than here: a client cannot back-date its
 * own row, so a test cannot age one either — see the note beside that
 * assertion.
 *
 * Refusals are paired with controls throughout: a suite in which
 * everything is invisible passes for the wrong reason.
 */

const SUPA = process.env.SUPA, KEY = process.env.KEY;
let failures = 0;
const check = (n, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(62), String(note).slice(0, 40));
};
const login = async (e) =>
  (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, password: "SaathTest!2026" }),
  })).json();
const H = (s) => ({ apikey: KEY, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" });
const rest = async (s, p, init = {}) => {
  const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: s ? H(s) : { apikey: KEY }, ...init });
  const t = await r.text();
  let body = null;
  try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  return { status: r.status, body };
};
const must = (label, res, want = [200, 201, 204]) => {
  if (!want.includes(res.status)) {
    console.error(`FIXTURE FAILED ${label}: HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 180)}`);
    process.exit(2);
  }
  return res;
};

const author = await login("smoke-icon@saathban.dev");
const wasThere = await login("smoke-fam@saathban.dev");
const stranger = await login("test-buddy@saathban.dev");

const sweep = async () => {
  await rest(author, `outdoor_moments?label=like.M8TEST*`, { method: "DELETE" });
};
await sweep();

const mk = async (label, patch = {}) =>
  must(`create ${label}`, await rest(author, "outdoor_moments", {
    method: "POST",
    headers: { ...H(author), Prefer: "return=representation" },
    body: JSON.stringify({ profile_id: author.user.id, label, visibility: "board", ...patch }),
  }), [201]).body[0];

/* ── LIVE ── */
const live = await mk("M8TEST live at the chai stall");
const liveSeen = await rest(stranger, `outdoor_moments?select=id&id=eq.${live.id}`);
check("CONTROL: a live moment reaches other people",
  Array.isArray(liveSeen.body) && liveSeen.body.length === 1, `${liveSeen.body?.length ?? liveSeen.status} rows`);

/* ── PAST: over, and the stranger was not there ── */
const past = await mk("M8TEST finished walk", {
  expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
});
const pastStranger = await rest(stranger, `outdoor_moments?select=id&id=eq.${past.id}`);
check("once it is over, somebody who was NOT there cannot read it",
  !Array.isArray(pastStranger.body) || pastStranger.body.length === 0,
  `${pastStranger.body?.length ?? pastStranger.status} rows`);

const pastAuthor = await rest(author, `outdoor_moments?select=id&id=eq.${past.id}`);
check("CONTROL: the author still reads their own finished moment",
  Array.isArray(pastAuthor.body) && pastAuthor.body.length === 1,
  `${pastAuthor.body?.length ?? pastAuthor.status} rows`);

/* ── PAST: somebody who WAS there ──
   Presence can only be claimed while the moment is live (0066), so
   this is done in the honest order: join first, then let it end. */
const stillLive = await mk("M8TEST walk with company");
must("join while live", await rest(wasThere, "outdoor_moment_presence", {
  method: "POST", headers: H(wasThere),
  body: JSON.stringify({ moment_id: stillLive.id, profile_id: wasThere.user.id }),
}), [201]);
await rest(author, `outdoor_moments?id=eq.${stillLive.id}`, {
  method: "PATCH", headers: H(author),
  body: JSON.stringify({ ended_at: new Date().toISOString() }),
});
const pastMember = await rest(wasThere, `outdoor_moments?select=id&id=eq.${stillLive.id}`);
check("CONTROL: somebody who WAS there still reads it afterwards",
  Array.isArray(pastMember.body) && pastMember.body.length === 1,
  `${pastMember.body?.length ?? pastMember.status} rows`);

const endedStranger = await rest(stranger, `outdoor_moments?select=id&id=eq.${stillLive.id}`);
check("and a stranger still cannot, once it has ended",
  !Array.isArray(endedStranger.body) || endedStranger.body.length === 0,
  `${endedStranger.body?.length ?? endedStranger.status} rows`);

/* ── JOINING A FINISHED MOMENT is how you would otherwise buy the
      right to read it. The policy must refuse. ── */
const lateJoin = await rest(stranger, "outdoor_moment_presence", {
  method: "POST", headers: H(stranger),
  body: JSON.stringify({ moment_id: stillLive.id, profile_id: stranger.user.id }),
});
check("nobody can join a finished moment to gain the right to read it",
  lateJoin.status >= 400, `HTTP ${lateJoin.status}`);

/* ── GONE at 48 hours ──

   This window CANNOT be exercised from here, and the reason is
   itself the thing worth asserting: a client is forbidden from
   back-dating its own row, so a test cannot age one either. What is
   checked here is that refusal — without it a person could keep a
   moment alive indefinitely, or push its timestamps around to slip
   out of the window that lets somebody report it.

   The 48-hour cut itself is verified against the policy directly,
   with two rows seeded owner-side (one an hour old, one 49 hours
   old) and read back through REST as their own author: the recent
   one comes back, the ancient one does not, for the author himself.
   See the migration header in 0066 — the cut is in the read policy,
   which is why it holds without any cleanup job running. */
const backdate = await rest(author, `outdoor_moments?id=eq.${live.id}`, {
  method: "PATCH",
  headers: H(author),
  body: JSON.stringify({ created_at: new Date(Date.now() - 49 * 3600 * 1000).toISOString() }),
});
check("a person cannot back-date their own moment out of the window",
  backdate.status >= 400, `HTTP ${backdate.status}`);

/* ── A signed-out stranger ── */
const anon = await rest(null, `outdoor_moments?select=id&id=eq.${live.id}`);
check("a signed-out stranger reads nothing", anon.status === 401, `HTTP ${anon.status}`);

await sweep();
console.log(`\n${failures} failed.`);
process.exit(failures ? 1 : 0);
