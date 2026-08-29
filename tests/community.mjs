/* ════════════════════════════════════════════════
   Community v1 suite — real accounts, real RLS (migration 0014).

   Run:  node tests/community.mjs
   Uses the four seeded test accounts (password SaathTest!2026).
   test-buddy's application is NOT active, which makes it the standing
   negative case for community access.

   Positive flows: icon posts (with storage upload), fam reads/reacts/
   reports, block hides + unblock restores, DM request → accept →
   message, admin queue + resolve.
   Negative (RLS) checks: fam cannot post or comment, non-active buddy
   sees nothing, anon is refused outright, messages cannot be sent
   before accept or edited after, outsiders cannot read or join a
   thread, non-admins cannot read others' reports or decide them,
   fam cannot upload to the community bucket.

   Leaves test rows behind; clean with tests/community-cleanup.sql
   (service role) if a pristine table matters.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { MONEY_PATTERN } from "../src/app/routes/community/communityCopy.js";

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
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(56), note);
};

async function login(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`${email}: login failed`);
  return { token: j.access_token, id: j.user.id, email };
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
    /* empty body */
  }
  return { status: r.status, data };
}

const icon = await login("test-icon@saathban.dev");
const fam = await login("test-fam@saathban.dev");
const buddy = await login("test-buddy@saathban.dev");
const admin = await login("test-admin@saathban.dev");

const MARK = `[suite ${Math.random().toString(36).slice(2, 8)}]`;

/* ─── 1. Posting ─── */

let post;
{
  const r = await rest(
    icon,
    "POST",
    "community_posts",
    { author_id: icon.id, body: `${MARK} Chai on the verandah, all welcome.` },
    { Prefer: "return=representation" }
  );
  post = r.data?.[0];
  check("icon: can post", r.status === 201 && !!post?.id, `status ${r.status}`);
}
{
  const r = await rest(fam, "POST", "community_posts", {
    author_id: fam.id,
    body: `${MARK} fam should not be able to post`,
  });
  check("fam: CANNOT post (RLS)", r.status === 403 || r.status === 401, `status ${r.status}`);
}
{
  const r = await rest(fam, "GET", `community_posts?id=eq.${post.id}&select=id,body`);
  check("fam: reads the feed", r.status === 200 && r.data?.length === 1, `status ${r.status}`);
}
{
  const r = await rest(buddy, "GET", `community_posts?id=eq.${post.id}&select=id`);
  check(
    "non-active buddy: sees NOTHING (RLS)",
    r.status === 200 && r.data?.length === 0,
    `rows ${r.data?.length}`
  );
}
{
  const r = await rest(null, "GET", "community_posts?select=id&limit=1");
  check("anon: refused outright", r.status === 401 || r.status === 403, `status ${r.status}`);
}

/* ─── 2. Reactions and comments ─── */

{
  const r = await rest(fam, "POST", "post_reactions", {
    post_id: post.id,
    profile_id: fam.id,
    emoji: "❤️",
  });
  check("fam: can react", r.status === 201, `status ${r.status}`);
}
{
  const r = await rest(fam, "POST", "post_comments", {
    post_id: post.id,
    author_id: fam.id,
    body: `${MARK} fam comment should fail`,
  });
  check("fam: CANNOT comment (C2, RLS)", r.status === 403 || r.status === 401, `status ${r.status}`);
}
let comment;
{
  const r = await rest(
    icon,
    "POST",
    "post_comments",
    { post_id: post.id, author_id: icon.id, body: `${MARK} Bring biscuits!` },
    { Prefer: "return=representation" }
  );
  comment = r.data?.[0];
  check("icon: can comment", r.status === 201 && !!comment?.id, `status ${r.status}`);
}

/* ─── 3. Storage ─── */

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
async function upload(user, path) {
  const r = await fetch(`${SUPA}/storage/v1/object/community-images/${path}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${user.token}`,
      "Content-Type": "image/png",
    },
    body: png,
  });
  return r.status;
}
check("icon: can upload post image", (await upload(icon, `${icon.id}/suite.png`)) === 200);
check(
  "fam: CANNOT upload to community bucket (RLS)",
  [400, 401, 403].includes(await upload(fam, `${fam.id}/suite.png`))
);

/* ─── 4. Reports ─── */

let report;
{
  const r = await rest(
    fam,
    "POST",
    "community_reports",
    {
      reporter_id: fam.id,
      target_kind: "post",
      target_id: post.id,
      target_author_id: icon.id,
      target_excerpt: `${MARK} excerpt`,
      reason: "suite: please ignore",
    },
    { Prefer: "return=representation" }
  );
  report = r.data?.[0];
  check("fam: can report a post", r.status === 201 && !!report?.id, `status ${r.status}`);
}
{
  const r = await rest(icon, "GET", `community_reports?id=eq.${report.id}&select=id`);
  check("icon: CANNOT see fam's report (RLS)", r.data?.length === 0, `rows ${r.data?.length}`);
}
{
  const r = await rest(fam, "PATCH", `community_reports?id=eq.${report.id}`, {
    status: "resolved",
  });
  const still = await rest(fam, "GET", `community_reports?id=eq.${report.id}&select=status`);
  check(
    "fam: CANNOT decide their own report (RLS)",
    still.data?.[0]?.status === "open",
    `status now ${still.data?.[0]?.status}`
  );
}
{
  const r = await rest(admin, "GET", `community_reports?id=eq.${report.id}&select=id,target_excerpt`);
  check("admin: sees the report in the queue", r.data?.length === 1, `rows ${r.data?.length}`);
}
{
  await rest(admin, "PATCH", `community_reports?id=eq.${report.id}`, {
    status: "resolved",
    resolution_note: "suite: handled",
  });
  const after = await rest(admin, "GET", `community_reports?id=eq.${report.id}&select=status,resolved_by`);
  check(
    "admin: resolves (trigger stamps resolver)",
    after.data?.[0]?.status === "resolved" && after.data?.[0]?.resolved_by === admin.id,
    JSON.stringify(after.data?.[0] || {})
  );
}

/* ─── 5. Block hides, unblock restores ─── */

{
  await rest(fam, "POST", "user_blocks", {
    blocker_id: fam.id,
    blocked_id: icon.id,
    kind: "block",
  });
  const hidden = await rest(fam, "GET", `community_posts?id=eq.${post.id}&select=id`);
  check("fam blocks icon: post disappears for fam", hidden.data?.length === 0, `rows ${hidden.data?.length}`);
  const iconStill = await rest(icon, "GET", `community_posts?id=eq.${post.id}&select=id`);
  check("…but icon still sees their own post", iconStill.data?.length === 1);
  await rest(
    fam,
    "DELETE",
    `user_blocks?blocker_id=eq.${fam.id}&blocked_id=eq.${icon.id}&kind=eq.block`
  );
  const back = await rest(fam, "GET", `community_posts?id=eq.${post.id}&select=id`);
  check("fam unblocks: post is back", back.data?.length === 1, `rows ${back.data?.length}`);
}

/* ─── 6. DMs: request-gated, participants only, frozen ─── */

let requestId;
{
  const r = await rest(fam, "POST", "rpc/send_dm_request", { p_recipient: icon.id });
  requestId = r.data;
  check("fam: DM request via RPC", r.status === 200 && !!requestId, `status ${r.status}`);
  const again = await rest(fam, "POST", "rpc/send_dm_request", { p_recipient: icon.id });
  check("fam: repeat request is idempotent", again.data === requestId);
}
{
  const r = await rest(fam, "POST", "dm_messages", {
    request_id: requestId,
    sender_id: fam.id,
    body: `${MARK} too early`,
  });
  check("fam: CANNOT message before accept (RLS)", [401, 403].includes(r.status), `status ${r.status}`);
}
{
  const seen = await rest(icon, "GET", `dm_requests?id=eq.${requestId}&select=id,status`);
  check("icon: sees the incoming request", seen.data?.length === 1);
  await rest(icon, "PATCH", `dm_requests?id=eq.${requestId}`, { status: "accepted" });
  const after = await rest(icon, "GET", `dm_requests?id=eq.${requestId}&select=status`);
  check("icon: accepts", after.data?.[0]?.status === "accepted");
}
let message;
{
  const r = await rest(
    fam,
    "POST",
    "dm_messages",
    { request_id: requestId, sender_id: fam.id, body: `${MARK} Salam! Free for a call Sunday?` },
    { Prefer: "return=representation" }
  );
  message = r.data?.[0];
  check("fam: message lands after accept", r.status === 201 && !!message?.id, `status ${r.status}`);
  const read = await rest(icon, "GET", `dm_messages?request_id=eq.${requestId}&select=id,body`);
  check("icon: reads the thread", read.data?.some((m) => m.id === message.id));
}
{
  const r = await rest(buddy, "GET", `dm_messages?request_id=eq.${requestId}&select=id`);
  check("outsider: CANNOT read the thread (RLS)", r.data?.length === 0, `rows ${r.data?.length}`);
  const w = await rest(buddy, "POST", "dm_messages", {
    request_id: requestId,
    sender_id: buddy.id,
    body: `${MARK} intruder`,
  });
  check("outsider: CANNOT write into the thread (RLS)", [401, 403].includes(w.status), `status ${w.status}`);
}
{
  await rest(icon, "PATCH", `dm_messages?id=eq.${message.id}`, { body: "edited!" });
  const after = await rest(icon, "GET", `dm_messages?id=eq.${message.id}&select=body,read_at`);
  check(
    "recipient: cannot rewrite a message (freeze trigger)",
    after.data?.[0]?.body !== "edited!",
    `body now ${JSON.stringify(after.data?.[0]?.body)}`
  );
  await rest(icon, "PATCH", `dm_messages?id=eq.${message.id}`, {
    read_at: new Date().toISOString(),
  });
  const read = await rest(icon, "GET", `dm_messages?id=eq.${message.id}&select=read_at`);
  check("recipient: CAN mark read", !!read.data?.[0]?.read_at);
}

/* ─── 7. Money-talk pattern (client-side, advisory) ─── */

check(
  "money pattern: catches EN and UR",
  MONEY_PATTERN.test("send me Rs 5000 on easypaisa") &&
    MONEY_PATTERN.test("مجھے کچھ پیسے بھیج دیں") &&
    !MONEY_PATTERN.test("Chai at the park at 5?"),
  ""
);

console.log(`\n${failures} failures. Marker for cleanup: ${MARK}`);
process.exit(failures ? 1 : 0);
