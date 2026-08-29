/* ════════════════════════════════════════════════
   Community social suite — migration 0027, real accounts, real RLS.

   Run:  node tests/community-social.mjs
   Fixtures: the seeded test-* accounts (password SaathTest!2026).

   Covers: "Who's up for…?" activities (free-text + optional fields,
   limit-aware graceful joins, idempotency, own-post/past negatives,
   author notification), friend requests (send → notification with
   deep link → inbox → accept/decline, idempotent re-send, silent
   block no-op, pending-buddy gate), search fields, and the DM game
   attachment (participant-only, non-participant session refused).

   Cleanup: tests/community-social-cleanup.sql (service role / MCP).
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
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(62), note);
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
      Authorization: `Bearer ${user.token}`,
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
const rpc = (user, fn, args) => rest(user, "POST", `rpc/${fn}`, args);
const REP = { Prefer: "return=representation" };

const icon = await login("test-icon@saathban.dev");
const icon2 = await login("test-icon2@saathban.dev");
const fam = await login("test-fam@saathban.dev");
const pending = await login("test-buddy-pending@saathban.dev");

const socialNotes = (u) =>
  rest(u, "GET", "notifications?kind=eq.social&select=title,body,link&order=created_at.desc&limit=10").then(
    (r) => r.data ?? []
  );

/* ─── Activities: create, join, limit closes gracefully ─── */
let actPost;
{
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
  const r = await rest(
    icon,
    "POST",
    "community_posts",
    {
      author_id: icon.id,
      body: "",
      post_type: "activity",
      payload: { activity: "Chai at my place", place_id: null, place_name: null, starts_at: tomorrow, note: null, limit: 2 },
    },
    REP
  );
  actPost = r.data?.[0];
  check("activity post accepted (post_type activity)", r.status === 201, String(r.status));

  const own = await rpc(icon, "join_activity", { p_post: actPost.id });
  check("joining your own activity refused", own.status >= 400, String(own.status));

  const j1 = await rpc(icon2, "join_activity", { p_post: actPost.id });
  check("first join succeeds", j1.data?.joined === true && j1.data?.count === 1, JSON.stringify(j1.data));
  check("limit 2 (host + 1) now reads full", j1.data?.full === true);

  const again = await rpc(icon2, "join_activity", { p_post: actPost.id });
  check("re-join is idempotent, not an error", again.data?.joined === true && again.data?.count === 1);

  const j2 = await rpc(fam, "join_activity", { p_post: actPost.id });
  check("join past the limit closes GRACEFULLY (no error)", j2.status === 200 && j2.data?.joined === false && j2.data?.full === true, JSON.stringify(j2.data));

  const note = (await socialNotes(icon)).find((n) => /coming along/i.test(n.title));
  check("author notified someone is coming", !!note, note?.body ?? "none");

  const joins = await rest(icon2, "GET", `post_joins?post_id=eq.${actPost.id}&select=*`);
  check("joins readable to community (count for the card)", joins.data?.length === 1);
}

/* ─── Past activity refuses joins ─── */
let pastPost;
{
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  const r = await rest(
    icon,
    "POST",
    "community_posts",
    { author_id: icon.id, body: "", post_type: "activity", payload: { activity: "Old walk", starts_at: yesterday } },
    REP
  );
  pastPost = r.data?.[0];
  const j = await rpc(icon2, "join_activity", { p_post: pastPost.id });
  check("joining a past activity refused", j.status >= 400, String(j.status));
}

/* ─── No-limit, no-place, no-time activity ─── */
let openPost;
{
  const r = await rest(
    icon,
    "POST",
    "community_posts",
    { author_id: icon.id, body: "", post_type: "activity", payload: { activity: "Anyone for ludo?" } },
    REP
  );
  openPost = r.data?.[0];
  const j = await rpc(fam, "join_activity", { p_post: openPost.id });
  check("bare activity (no place/time/limit) joinable", j.data?.joined === true && j.data?.full === false, JSON.stringify(j.data));
}

/* ─── Friend requests ─── */
let reqId;
{
  const gate = await rpc(pending, "send_friend_request", { p_recipient: icon.id });
  check("pending buddy cannot send requests (community gate)", gate.status >= 400, String(gate.status));

  const r = await rpc(icon, "send_friend_request", { p_recipient: icon2.id });
  reqId = r.data;
  check("request sent, id returned", r.status === 200 && typeof reqId === "string", String(r.status));

  const dup = await rpc(icon, "send_friend_request", { p_recipient: icon2.id });
  check("re-sending returns the same request (idempotent)", dup.data === reqId);

  const self = await rpc(icon, "send_friend_request", { p_recipient: icon.id });
  check("self-request refused", self.status >= 400, String(self.status));

  const note = (await socialNotes(icon2)).find(
    (n) => /connection request/i.test(n.title) && n.link === "/app/community/connect"
  );
  check("recipient notified with the connect deep link", !!note);

  const inbox = await rest(icon2, "GET", `friend_requests?recipient_id=eq.${icon2.id}&status=eq.pending&select=*`);
  check("incoming request visible in the inbox", inbox.data?.some((x) => x.id === reqId));

  const wrongSide = await rpc(icon, "respond_friend_request", { p_request: reqId, p_accept: true });
  check("only the recipient can answer", wrongSide.status >= 400, String(wrongSide.status));

  const acc = await rpc(icon2, "respond_friend_request", { p_request: reqId, p_accept: true });
  check("recipient accepts", acc.status === 200 || acc.status === 204, String(acc.status));

  const connected = (await socialNotes(icon)).find((n) => /connected/i.test(n.title));
  check("requester notified of the acceptance", !!connected);

  const friends = await rest(icon, "GET", `friend_requests?status=eq.accepted&or=(requester_id.eq.${icon.id},recipient_id.eq.${icon.id})&select=*`);
  check("friendship on file (feeds the Friends tab + games)", friends.data?.some((x) => x.id === reqId));

  const after = await rpc(icon, "send_friend_request", { p_recipient: icon2.id });
  check("request to an existing friend is a no-op (same id back)", after.data === reqId);
}

/* ─── Decline: quiet, and re-requests stay quiet ─── */
{
  const r = await rpc(fam, "send_friend_request", { p_recipient: icon2.id });
  const famReq = r.data;
  const before = (await socialNotes(icon2)).length;
  await rpc(icon2, "respond_friend_request", { p_request: famReq, p_accept: false });
  const row = await rest(fam, "GET", `friend_requests?id=eq.${famReq}&select=status`);
  check("declined request stays on file as declined", row.data?.[0]?.status === "declined");
  const resend = await rpc(fam, "send_friend_request", { p_recipient: icon2.id });
  check("re-request after decline: same id, still declined", resend.data === famReq);
  const rowAfter = await rest(fam, "GET", `friend_requests?id=eq.${famReq}&select=status`);
  check("…and not flipped back to pending (no pestering)", rowAfter.data?.[0]?.status === "declined");
  const afterCount = (await socialNotes(icon2)).length;
  check("no new notification from the re-request", afterCount === before);
}

/* ─── Blocks make requests silently vanish ─── */
{
  // icon blocks fam; fam (eligible) asks icon — the sender must see
  // an ordinary "request sent" while nothing lands anywhere.
  await rest(icon, "POST", "user_blocks", { blocker_id: icon.id, blocked_id: fam.id, kind: "block" });
  const before = (await socialNotes(icon)).length;
  const r = await rpc(fam, "send_friend_request", { p_recipient: icon.id });
  check("request across a block: silent ordinary success", r.status === 200 && typeof r.data === "string", String(r.status));
  const row = await rest(fam, "GET", `friend_requests?requester_id=eq.${fam.id}&recipient_id=eq.${icon.id}&select=*`);
  check("…but nothing was written", (row.data ?? []).length === 0);
  const afterCount = (await socialNotes(icon)).length;
  check("…and the blocked side was not notified", afterCount === before);
  await rest(icon, "DELETE", `user_blocks?blocker_id=eq.${icon.id}&blocked_id=eq.${fam.id}&kind=eq.block`);
}

/* ─── Search fields: safe columns only ─── */
{
  const r = await rest(icon2, "GET", "safe_profiles?role=eq.saath_icon&or=(full_name.ilike.*test*,city.ilike.*test*)&select=id,full_name,city&limit=5");
  check("icon search by name/city works on safe fields", r.status === 200 && Array.isArray(r.data));
  const leak = await rest(icon2, "GET", "safe_profiles?select=phone&limit=1");
  check("phone is not reachable through safe_profiles", leak.status >= 400, String(leak.status));
}

/* ─── DM game attachment (ask A4) ─── */
{
  // An accepted thread between icon and fam (create or reuse).
  let thread = (await rest(icon, "GET", `dm_requests?or=(and(requester_id.eq.${icon.id},recipient_id.eq.${fam.id}),and(requester_id.eq.${fam.id},recipient_id.eq.${icon.id}))&status=eq.accepted&select=id`)).data?.[0];
  if (!thread) {
    const req = await rpc(icon, "send_dm_request", { p_recipient: fam.id });
    await rest(fam, "PATCH", `dm_requests?id=eq.${req.data}`, { status: "accepted" });
    thread = { id: req.data };
  }

  const sess = await rpc(icon, "create_game_session", { p_game: "race100", p_seats: 2, p_house_rules: { turn_seconds: 60 } });
  const att = await rest(icon, "POST", "dm_messages", { request_id: thread.id, sender_id: icon.id, body: null, game_session_id: sess.data }, REP);
  check("game-attachment message accepted (null body)", att.status === 201, String(att.status));

  const read = await rest(fam, "GET", `dm_messages?request_id=eq.${thread.id}&select=game_session_id&order=created_at.desc&limit=1`);
  check("other participant sees the attachment", read.data?.[0]?.game_session_id === sess.data);

  const famSess = await rpc(fam, "create_game_session", { p_game: "race100", p_seats: 2, p_house_rules: {} });
  const theft = await rest(icon, "POST", "dm_messages", { request_id: thread.id, sender_id: icon.id, body: null, game_session_id: famSess.data });
  check("attaching a session you're not part of refused", theft.status >= 400, String(theft.status));

  const bare = await rest(icon, "POST", "dm_messages", { request_id: thread.id, sender_id: icon.id, body: null });
  check("a message must be words or a game (both null refused)", bare.status >= 400, String(bare.status));

  if (att.data?.[0]?.id) {
    /* leave rows for cleanup SQL; nothing to do here */
  }
}

console.log(`\nposts created (for cleanup): ${[actPost?.id, pastPost?.id, openPost?.id].join(", ")}`);
console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
