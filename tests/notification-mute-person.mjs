/* OUT_AND_ABOUT_SPEC §6.1 — "mute this person", on the kinds where
 * it matters most.
 *
 * The control this asserts is easy to lose: my screen shows the
 * person-mute only when `notifications.created_by` is set, so if the
 * writer stops setting it the button does not break — it silently
 * disappears, which reads as deliberate. That is exactly how it was
 * shipped: dm sat at 0 of 104 rows because DM notifications come from
 * a trigger rather than from social_notify, so a fix to the obvious
 * writer would have left it dead.
 *
 * So this test writes a REAL direct message and then asks the
 * notification the recipient actually received whether it knows who
 * caused it. It is deliberately end-to-end rather than a check of the
 * function body, because the function body was never the thing in
 * doubt — which writer runs was.
 */

const SUPA = process.env.SUPA, KEY = process.env.KEY;
let failures = 0;
const check = (n, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(60), String(note).slice(0, 40));
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

const sender = await login("smoke-icon@saathban.dev");
const recipient = await login("smoke-fam@saathban.dev");

/* Find a thread these two already share. This test does not create
   one: DMs are request-gated, and a test that forced a thread into
   existence would be testing a path no person can take. */
/* The thread table is dm_requests — the request IS the thread here,
   which is what "DMs are request-gated" looks like in the schema. */
const threads = await rest(sender, "dm_requests?select=id&limit=20");
let threadId = null;
for (const t of (Array.isArray(threads.body) ? threads.body : [])) {
  const mine = await rest(recipient, `dm_requests?select=id&id=eq.${t.id}`);
  if (Array.isArray(mine.body) && mine.body.length === 1) { threadId = t.id; break; }
}

if (!threadId) {
  console.log("SKIP  no shared DM thread between the smoke accounts — nothing to send");
  console.log("\n0 failed.");
  process.exit(0);
}

/* The trigger de-duplicates: one UNREAD "X sent you a message" per
   thread, so a second message while the first is unread correctly
   creates nothing. Clearing the recipient's unread DM notifications
   first is therefore part of the fixture, not a workaround — without
   it this test would report a missing notification that the product
   deliberately did not send. */
await rest(recipient, "notifications?kind=eq.dm&read_at=is.null", {
  method: "PATCH", headers: H(recipient),
  body: JSON.stringify({ read_at: new Date().toISOString() }),
});

/* Remember the newest DM notification the recipient has, so "a new
   one arrived" can be asserted by IDENTITY rather than by filtering
   on a timestamp. An ISO timestamp in a PostgREST query string is a
   URL-encoding trap — it silently returns nothing rather than
   erroring, which reads exactly like the feature being broken. That
   is what it looked like here for two runs. */
const newestBefore = ((await rest(recipient,
  "notifications?select=id&kind=eq.dm&order=created_at.desc&limit=1")).body || [])[0]?.id || null;
const sent = await rest(sender, "dm_messages", {
  method: "POST", headers: { ...H(sender), Prefer: "return=representation" },
  body: JSON.stringify({ request_id: threadId, sender_id: sender.user.id, body: "N61TEST hello" }),
});
check("FIXTURE: a real direct message is sent", sent.status === 201,
  sent.status === 201 ? "" : JSON.stringify(sent.body).slice(0, 90));

/* The notification the RECIPIENT received. Read as them, so RLS is
   part of what is being asserted. */
await new Promise((r) => setTimeout(r, 1200));
const notes = await rest(recipient,
  "notifications?select=id,kind,created_by,created_at&kind=eq.dm&order=created_at.desc&limit=1");
const row = (notes.body || [])[0];

check("a NEW DM notification reaches the recipient",
  !!row && row.id !== newestBefore, row ? "new row" : `${notes.status}`);
check("and it knows WHO caused it, so the person can be muted",
  !!row?.created_by, row?.created_by ? "created_by set" : "created_by NULL");
check("and that person is the sender, not whoever wrote the row",
  row?.created_by === sender.user.id,
  row?.created_by === sender.user.id ? "the sender" : String(row?.created_by).slice(0, 12));

/* The mute itself is the same user_blocks row the feed writes — so
   muting from a notification must be visible to the feed's own
   notion of muted, or there are two ideas of "muted" to keep in step. */
if (row?.created_by) {
  await rest(recipient, `user_blocks?blocker_id=eq.${recipient.user.id}&blocked_id=eq.${row.created_by}&kind=eq.mute`, { method: "DELETE" });
  const mute = await rest(recipient, "user_blocks", {
    method: "POST", headers: H(recipient),
    body: JSON.stringify({ blocker_id: recipient.user.id, blocked_id: row.created_by, kind: "mute" }),
  });
  check("muting from a notification writes the shared user_blocks row",
    mute.status === 201, `HTTP ${mute.status}`);
  /* Put it back: a mute left behind would quietly change what every
     other suite sees between these two accounts. */
  await rest(recipient, `user_blocks?blocker_id=eq.${recipient.user.id}&blocked_id=eq.${row.created_by}&kind=eq.mute`, { method: "DELETE" });
  const gone = await rest(recipient, `user_blocks?select=blocked_id&blocker_id=eq.${recipient.user.id}&blocked_id=eq.${row.created_by}&kind=eq.mute`);
  check("CLEANUP: the test's own mute is removed again",
    Array.isArray(gone.body) && gone.body.length === 0, `${gone.body?.length} left`);
}

await rest(sender, `dm_messages?body=like.N61TEST*`, { method: "DELETE" });
console.log(`\n${failures} failed.`);
process.exit(failures ? 1 : 0);
