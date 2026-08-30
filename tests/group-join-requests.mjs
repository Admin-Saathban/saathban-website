/* GROUPS_SPEC §7.1 — Member requests, end to end.
 *
 * The RPC and table are Lane 2's (migration 0086); the screen is
 * mine. This is the seam between us, so it is tested from my side
 * rather than assumed: I bind to their names, and if those names or
 * their behaviour move, this fails here instead of in front of a
 * person trying to join a walking group.
 *
 * The decline behaviour is the part worth pinning down. Three of us
 * argued about it and landed on: no bell notification, but the row is
 * KEPT with status 'declined' so the place they asked can show "not
 * this time" honestly, and the partial unique index is on pending
 * only so a declined row does not lock them out of asking again.
 * Silence plus a permanent block would be a dead end, and this
 * project's rule is that empty states are doors.
 */

const SUPA = process.env.SUPA, KEY = process.env.KEY;
let failures = 0;
const check = (n, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(62), String(note).slice(0, 38));
};
const login = async (e) =>
  (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, password: "SaathTest!2026" }),
  })).json();
const H = (s) => ({ apikey: KEY, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" });
const rest = async (s, p, init = {}) => {
  const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: H(s), ...init });
  const t = await r.text(); let body = null;
  try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  return { status: r.status, body };
};
const rpc = async (s, fn, args) => {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: "POST", headers: H(s), body: JSON.stringify(args) });
  const t = await r.text(); let body = null;
  try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  return { status: r.status, body };
};
const must = async (label, res, want = [200, 201, 204]) => {
  if (!want.includes(res.status)) {
    console.error(`FIXTURE FAILED ${label}: HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`);
    await bail(2);
  }
  return res;
};

const owner = await login("smoke-icon@saathban.dev");
const asker = await login("test-buddy@saathban.dev");

/* ── Fixtures must not outlive the run ──
   These groups are public, and a public group is offered to real
   people on the search screen. See 0069's header. */
const sweep = async (label) => {
  const rows = (await rest(owner, `groups?select=id,name&name=like.S7TEST*`)).body;
  for (const g of (Array.isArray(rows) ? rows : [])) {
    await rpc(owner, "delete_group", { p_group: g.id });
  }
  const left = (await rest(owner, `groups?select=id&name=like.S7TEST*`)).body;
  const n = Array.isArray(left) ? left.length : -1;
  if (n !== 0) {
    /* Loud, and non-zero exit: a leaked public fixture is content in
       the app, not untidiness. */
    console.error(`SWEEP FAILED (${label}): ${n} S7TEST group(s) still present.`);
    console.error("They are visible to real people under \"Groups near you\". Remove them before leaving this.");
    process.exit(3);
  }
};
await sweep("before");

/* Any early exit sweeps too — a fixture failure used to leave the
   groups it had already made. */
const bail = async (code) => { await sweep("bail"); process.exit(code); };

const pub = (await must("public group", await rpc(owner, "create_group",
  { p_name: "S7TEST open walkers", p_description: null, p_privacy: "anyone" }))).body;
const priv = (await must("private group", await rpc(owner, "create_group",
  { p_name: "S7TEST closed walkers", p_description: null, p_privacy: "invite_only" }))).body;

/* ── Asking ── */
const ask = await rpc(asker, "request_to_join_group", { p_group: pub, p_message: "I walk most mornings" });
check("somebody can ask to join a PUBLIC group", ask.status === 200 && !!ask.body, `HTTP ${ask.status}`);

const askPriv = await rpc(asker, "request_to_join_group", { p_group: priv, p_message: null });
check("a PRIVATE group cannot be asked to join", askPriv.status >= 400, `HTTP ${askPriv.status}`);

/* Asking twice is IDEMPOTENT rather than an error: the same request
   id comes back and no second row appears. That is the kinder
   behaviour and the one to keep — a person who taps twice, or comes
   back next week unsure whether it sent, should not meet an error
   telling them off for asking. Noted because I expected a refusal
   here and was wrong; the refusal would have been worse. */
const twice = await rpc(asker, "request_to_join_group", { p_group: pub, p_message: null });
check("asking twice returns the same request, and adds no second row",
  twice.status === 200 && twice.body === ask.body, `HTTP ${twice.status}`);

/* ── The screen's read path ── */
const queue = await rest(owner, `group_join_requests?select=id,requester_id,message,status&group_id=eq.${pub}&status=eq.pending`);
check("the group's admin can LIST pending requests (table-level select)",
  Array.isArray(queue.body) && queue.body.length === 1, `${queue.body?.length ?? queue.status} rows`);

const nosey = await rest(asker, `group_join_requests?select=id&group_id=eq.${pub}&status=eq.pending`);
check("CONTROL: the requester sees only their OWN row, not the queue",
  Array.isArray(nosey.body) && nosey.body.every((r) => r.id === ask.body),
  `${nosey.body?.length ?? nosey.status} rows`);

const count = await rpc(owner, "group_pending_request_count", { p_group: pub });
check("the badge count matches the queue", count.body === 1, String(count.body));

/* ── Declining: the row stays, and asking again is possible ── */
const declined = await rpc(owner, "respond_join_request", { p_request: ask.body, p_approve: false });
check("an admin can decline", declined.status < 400, `HTTP ${declined.status}`);

const afterDecline = await rest(asker, `group_join_requests?select=id,status&id=eq.${ask.body}`);
check("the declined row is KEPT, so the asker can see what happened",
  Array.isArray(afterDecline.body) && afterDecline.body[0]?.status === "declined",
  afterDecline.body?.[0]?.status || "gone");

const notMember = await rest(asker, `group_members?select=member_id&group_id=eq.${pub}&member_id=eq.${asker.user.id}`);
check("declining did NOT quietly add them to the group",
  Array.isArray(notMember.body) && notMember.body.length === 0, `${notMember.body?.length} rows`);

const askAgain = await rpc(asker, "request_to_join_group", { p_group: pub, p_message: null });
check("a declined person can ask again — not a dead end",
  askAgain.status === 200 && !!askAgain.body, `HTTP ${askAgain.status}`);

/* ── Approving: membership is created inside the function ── */
const approved = await rpc(owner, "respond_join_request", { p_request: askAgain.body, p_approve: true });
check("an admin can approve", approved.status < 400, `HTTP ${approved.status}`);

const nowMember = await rest(owner, `group_members?select=member_id,role&group_id=eq.${pub}&member_id=eq.${asker.user.id}`);
check("approving creates the membership row atomically",
  Array.isArray(nowMember.body) && nowMember.body.length === 1, `${nowMember.body?.length} rows`);

/* ── And a stranger cannot answer somebody else's request ── */
const outsider = await login("test-fam@saathban.dev");
const ask2 = await rpc(outsider, "request_to_join_group", { p_group: pub, p_message: null });
if (ask2.status === 200) {
  const hijack = await rpc(asker, "respond_join_request", { p_request: ask2.body, p_approve: true });
  check("an ordinary member cannot approve requests for the group",
    hijack.status >= 400, `HTTP ${hijack.status}`);
}

/* ── §7.3: closing a group, and handing it over ──
   0069 exists because there was NO delete path at all — not even
   for the owner — which is also why this suite quietly accumulated
   47 public fixture groups into the search screen. The rule being
   asserted is that it is owner-only: a co-admin helps run a group,
   they do not get to end it. */
await rpc(owner, "set_group_co_admin", { p_group: pub, p_member: asker.user.id, p_make: true });

const coAdminDeletes = await rpc(asker, "delete_group", { p_group: pub });
check("a CO-ADMIN cannot close somebody else's group",
  coAdminDeletes.status >= 400, `HTTP ${coAdminDeletes.status}`);

const handToStranger = await rpc(owner, "transfer_group_ownership",
  { p_group: pub, p_to: "00000000-0000-4000-8000-000000000000" });
check("a group cannot be handed to someone who is not in it",
  handToStranger.status >= 400, `HTTP ${handToStranger.status}`);

const stillThere = await rest(owner, `groups?select=id&id=eq.${pub}`);
check("CONTROL: the group survived both refusals",
  Array.isArray(stillThere.body) && stillThere.body.length === 1,
  `${stillThere.body?.length} rows`);

const ownerDeletes = await rpc(owner, "delete_group", { p_group: priv });
check("CONTROL: the OWNER can close their own group",
  ownerDeletes.status < 400, `HTTP ${ownerDeletes.status}`);

const gone = await rest(owner, `groups?select=id&id=eq.${priv}`);
check("and it is actually gone, not merely reported gone",
  Array.isArray(gone.body) && gone.body.length === 0, `${gone.body?.length} rows`);

await sweep("after");
console.log(`\n${failures} failed.`);
process.exit(failures ? 1 : 0);
