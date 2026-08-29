/* ════════════════════════════════════════════════
   Outdoor v1 suite — real accounts, real RLS (migration 0016).

   Run:  node tests/outdoor.mjs
   Uses the seeded test accounts (password SaathTest!2026):
   - test-fam is in test-icon's circle → exercises "connections".
   - test-buddy's application is ACTIVE (the vetting lane approved
     it) and they are NOT in the circle → a community member who
     sees board-visibility things but no circle-only presence.
   - test-buddy-pending has no application → proves the vetting gate.
   - test-admin is NOT in the circle → proves no admin bypass on
     presence.

   Leaves a few rows; clean with tests/outdoor-cleanup.sql if needed.
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

async function rest(user, method, path, body, headers = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: user ? `Bearer ${user.token}` : `Bearer ${ANON}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await r.json();
  } catch {
    /* empty */
  }
  return { status: r.status, data };
}

const icon = await login("test-icon@saathban.dev");
const fam = await login("test-fam@saathban.dev");
const buddy = await login("test-buddy@saathban.dev"); // ACTIVE volunteer
const pending = await login("test-buddy-pending@saathban.dev");
const admin = await login("test-admin@saathban.dev");

const MARK = `[outdoor ${Math.random().toString(36).slice(2, 8)}]`;

/* test-buddy's pipeline status is churned by the vetting lane's own
   tests, so the suite asks the database what it currently is and
   asserts CONSISTENCY with it — the stable hard negative is
   test-buddy-pending, which this suite owns. */
const buddyActive = (await rest(buddy, "POST", "rpc/can_use_community", {})).data === true;
console.log(`(test-buddy is currently ${buddyActive ? "ACTIVE" : "not active"})`);
const LIVE = "ended_at=is.null&expires_at=gt." + encodeURIComponent(new Date().toISOString());

/* ─── Places ─── */
const places = (await rest(fam, "GET", "outdoor_places?select=id,name,city&order=name")).data;
check("fam: reads the seeded places", places?.length >= 15, `rows ${places?.length}`);
check(
  "pending buddy: sees NO places (community gate)",
  (await rest(pending, "GET", "outdoor_places?select=id")).data?.length === 0
);
{
  const n = (await rest(buddy, "GET", "outdoor_places?select=id")).data?.length ?? 0;
  check(
    `test-buddy: places match their standing (${buddyActive ? "visible" : "hidden"})`,
    buddyActive ? n >= 15 : n === 0,
    `rows ${n}`
  );
}
{
  const r = await rest(null, "GET", "outdoor_places?select=id&limit=1");
  check("anon: refused outright", r.status === 401 || r.status === 403, `status ${r.status}`);
}
const placeA = places[0].id;
const placeB = places[1].id;

/* ─── Check-in gates ─── */
{
  const r = await rest(fam, "POST", "rpc/outdoor_check_in", { p_place: placeA });
  check("fam: CANNOT check in (icons only)", r.status !== 200, `status ${r.status}`);
  const d = await rest(fam, "POST", "outdoor_checkins", {
    place_id: placeA,
    profile_id: fam.id,
  });
  check("fam: CANNOT insert a check-in directly (RLS)", [401, 403].includes(d.status), `status ${d.status}`);
}

/* ─── Connections visibility (the default) ─── */
let ciConnections;
{
  const r = await rest(icon, "POST", "rpc/outdoor_check_in", { p_place: placeA });
  ciConnections = r.data;
  check("icon: checks in (default connections)", r.status === 200 && !!ciConnections);

  const famSees = await rest(fam, "GET", `outdoor_checkins?id=eq.${ciConnections}&select=id`);
  check("fam (in circle): sees the connections check-in", famSees.data?.length === 1);

  const adminSees = await rest(admin, "GET", `outdoor_checkins?id=eq.${ciConnections}&select=id`);
  check(
    "admin (not in circle): does NOT see it — no admin bypass",
    adminSees.data?.length === 0,
    `rows ${adminSees.data?.length}`
  );

  const buddySees = await rest(buddy, "GET", `outdoor_checkins?id=eq.${ciConnections}&select=id`);
  check(
    "active buddy (not in circle): does NOT see connections presence",
    buddySees.data?.length === 0,
    `rows ${buddySees.data?.length}`
  );
  const pendingSees = await rest(pending, "GET", `outdoor_checkins?id=eq.${ciConnections}&select=id`);
  check("pending buddy: nothing (vetting gate)", pendingSees.data?.length === 0);
}

/* ─── Board visibility + one-place-at-a-time ─── */
let ciBoard;
{
  const r = await rest(icon, "POST", "rpc/outdoor_check_in", {
    p_place: placeB,
    p_visibility: "board",
  });
  ciBoard = r.data;
  check("icon: re-checks in elsewhere, announced to board", r.status === 200 && !!ciBoard);

  const old = await rest(fam, "GET", `outdoor_checkins?id=eq.${ciConnections}&select=id`);
  check("previous check-in auto-ended: gone for fam", old.data?.length === 0, `rows ${old.data?.length}`);

  const adminSees = await rest(admin, "GET", `outdoor_checkins?id=eq.${ciBoard}&select=id`);
  check("admin: SEES the board-announced check-in", adminSees.data?.length === 1);
  const famSees = await rest(fam, "GET", `outdoor_checkins?id=eq.${ciBoard}&select=id`);
  check("fam: sees the board-announced check-in", famSees.data?.length === 1);
  const buddySees = await rest(buddy, "GET", `outdoor_checkins?id=eq.${ciBoard}&select=id`);
  check(
    `test-buddy: board presence matches their standing (${buddyActive ? "visible" : "hidden"})`,
    buddySees.data?.length === (buddyActive ? 1 : 0)
  );
  const pendingSees = await rest(pending, "GET", `outdoor_checkins?id=eq.${ciBoard}&select=id`);
  check("pending buddy: nothing, even board visibility (vetting gate)", pendingSees.data?.length === 0);
}

/* ─── Expiry: an expired check-in is invisible to everyone but its owner ─── */
{
  await rest(icon, "PATCH", `outdoor_checkins?id=eq.${ciBoard}`, {
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  });
  const famSees = await rest(fam, "GET", `outdoor_checkins?id=eq.${ciBoard}&select=id`);
  check("expired: invisible to fam (no history of who was where)", famSees.data?.length === 0);
  const own = await rest(icon, "GET", `outdoor_checkins?id=eq.${ciBoard}&select=id`);
  check("expired: owner still sees their own record", own.data?.length === 1);
}

/* ─── Outings ─── */
let outingBoard, outingConn;
{
  const mk = (vis) =>
    rest(
      icon,
      "POST",
      "outdoor_outings",
      {
        place_id: placeA,
        creator_id: icon.id,
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
        note: `${MARK} morning walk`,
        visibility: vis,
      },
      { Prefer: "return=representation" }
    );
  outingBoard = (await mk("board")).data?.[0];
  outingConn = (await mk("connections")).data?.[0];
  check("icon: plans outings (both visibilities)", !!outingBoard?.id && !!outingConn?.id);

  const adminBoard = await rest(admin, "GET", `outdoor_outings?id=eq.${outingBoard.id}&select=id`);
  const adminConn = await rest(admin, "GET", `outdoor_outings?id=eq.${outingConn.id}&select=id`);
  check("admin: sees board outing, not connections one", adminBoard.data?.length === 1 && adminConn.data?.length === 0);
  const famConn = await rest(fam, "GET", `outdoor_outings?id=eq.${outingConn.id}&select=id`);
  check("fam (in circle): sees the connections outing", famConn.data?.length === 1);

  const famMk = await rest(fam, "POST", "outdoor_outings", {
    place_id: placeA,
    creator_id: fam.id,
    starts_at: new Date(Date.now() + 86_400_000).toISOString(),
    visibility: "board",
  });
  check("fam: CANNOT plan an outing (icons only)", [401, 403].includes(famMk.status), `status ${famMk.status}`);
}

/* ─── Park board: open chat, guarded ─── */
let boardMsg;
{
  const famPost = await rest(
    fam,
    "POST",
    "park_board_messages",
    { place_id: placeA, author_id: fam.id, body: `${MARK} Lovely shade near the gate today.` },
    { Prefer: "return=representation" }
  );
  check("fam: can write on the park board (open chat)", famPost.status === 201);

  const iconPost = await rest(
    icon,
    "POST",
    "park_board_messages",
    { place_id: placeA, author_id: icon.id, body: `${MARK} Chai stall is back!` },
    { Prefer: "return=representation" }
  );
  boardMsg = iconPost.data?.[0];
  check("icon: can write on the park board", iconPost.status === 201 && !!boardMsg?.id);

  const buddyPost = await rest(
    buddy,
    "POST",
    "park_board_messages",
    { place_id: placeA, author_id: buddy.id, body: `${MARK} See you at the walking track!` },
    { Prefer: "return=representation" }
  );
  check(
    `test-buddy: board write matches their standing (${buddyActive ? "allowed" : "refused"})`,
    buddyActive ? buddyPost.status === 201 : [401, 403].includes(buddyPost.status),
    `status ${buddyPost.status}`
  );

  const pendingPost = await rest(pending, "POST", "park_board_messages", {
    place_id: placeA,
    author_id: pending.id,
    body: `${MARK} should fail`,
  });
  check(
    "pending buddy: CANNOT write on the board (vetting gate, RLS)",
    [401, 403].includes(pendingPost.status),
    `status ${pendingPost.status}`
  );
}

/* ─── Report lands in the community queue; block hides ─── */
{
  const r = await rest(
    fam,
    "POST",
    "community_reports",
    {
      reporter_id: fam.id,
      target_kind: "park_board",
      target_id: boardMsg.id,
      target_author_id: icon.id,
      target_excerpt: boardMsg.body,
      reason: "suite: please ignore",
    },
    { Prefer: "return=representation" }
  );
  check("fam: reports a board message (kind park_board)", r.status === 201, `status ${r.status}`);
  const adminSees = await rest(
    admin,
    "GET",
    `community_reports?id=eq.${r.data?.[0]?.id}&select=id,target_kind`
  );
  check(
    "admin: board report is in the moderation queue",
    adminSees.data?.[0]?.target_kind === "park_board"
  );

  await rest(fam, "POST", "user_blocks", {
    blocker_id: fam.id,
    blocked_id: icon.id,
    kind: "block",
  });
  const hidden = await rest(fam, "GET", `park_board_messages?id=eq.${boardMsg.id}&select=id`);
  check("fam blocks icon: board message hidden from fam", hidden.data?.length === 0);
  await rest(
    fam,
    "DELETE",
    `user_blocks?blocker_id=eq.${fam.id}&blocked_id=eq.${icon.id}&kind=eq.block`
  );
  const back = await rest(fam, "GET", `park_board_messages?id=eq.${boardMsg.id}&select=id`);
  check("fam unblocks: board message is back", back.data?.length === 1);
}

console.log(`\n${failures} failures. Marker for cleanup: ${MARK}`);
process.exit(failures ? 1 : 0);
