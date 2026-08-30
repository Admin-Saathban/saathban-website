/* GROUPS_SPEC §6 — "Yes for public groups you have joined. No for
 * private ones. Private group content never leaves the group."
 *
 * This one is easy to get wrong in the opposite direction from §4,
 * and the reason is worth stating: it is NOT a permission rule. A
 * member may read their own private group's posts — that is what
 * membership means, and no RLS policy will stop them. It is a FEED
 * COMPOSITION rule, so it can only be broken by the feed asking the
 * wrong question, and it will look correct in every RLS test ever
 * written.
 *
 * That is why 0067 puts it in a named predicate,
 * group_post_in_main_feed(), rather than in whichever query happens
 * to build the feed today. This test asks that predicate directly,
 * as the member themselves, with both a public and a private group
 * they belong to — so a future feed that forgets to call it is a
 * change to one function, not a silent leak.
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
  const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: H(s), ...init });
  const t = await r.text();
  let body = null; try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  return { status: r.status, body };
};
const rpc = async (s, fn, args) => {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: "POST", headers: H(s), body: JSON.stringify(args) });
  const t = await r.text();
  let body = null; try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  return { status: r.status, body };
};
const must = async (label, res, want = [200, 201, 204]) => {
  if (!want.includes(res.status)) {
    console.error(`FIXTURE FAILED ${label}: HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 180)}`);
    await bail(2);
  }
  return res;
};

const owner = await login("smoke-icon@saathban.dev");
const stranger = await login("test-buddy@saathban.dev");

/* ── Fixtures must not outlive the run ──
   These groups are public, and a public group is offered to real
   people on the search screen. See 0069's header. */
const sweep = async (label) => {
  const rows = (await rest(owner, `groups?select=id,name&name=like.S6TEST*`)).body;
  for (const g of (Array.isArray(rows) ? rows : [])) {
    await rpc(owner, "delete_group", { p_group: g.id });
  }
  const left = (await rest(owner, `groups?select=id&name=like.S6TEST*`)).body;
  const n = Array.isArray(left) ? left.length : -1;
  if (n !== 0) {
    /* Loud, and non-zero exit: a leaked public fixture is content in
       the app, not untidiness. */
    console.error(`SWEEP FAILED (${label}): ${n} S6TEST group(s) still present.`);
    console.error("They are visible to real people under \"Groups near you\". Remove them before leaving this.");
    process.exit(3);
  }
};
await sweep("before");

/* Any early exit sweeps too — a fixture failure used to leave the
   groups it had already made. */
const bail = async (code) => { await sweep("bail"); process.exit(code); };

const mk = async (name, privacy) =>
  (await must(`create ${privacy}`, await rpc(owner, "create_group",
    { p_name: name, p_description: null, p_privacy: privacy }))).body;

const pub = await mk("S6TEST open walkers", "anyone");
const priv = await mk("S6TEST closed walkers", "invite_only");

/* The owner is a member of BOTH — that is the whole point. If this
   were a permission rule, both would be readable and both would be
   "correct"; only the feed rule tells them apart. */
const canReadPub = await rest(owner, `group_posts?select=id&group_id=eq.${pub}`);
const canReadPriv = await rest(owner, `group_posts?select=id&group_id=eq.${priv}`);
check("CONTROL: the member may READ both groups' posts (membership)",
  canReadPub.status === 200 && canReadPriv.status === 200,
  `${canReadPub.status}/${canReadPriv.status}`);

const inPub = await rpc(owner, "group_post_in_main_feed", { p_group: pub });
check("a PUBLIC group they joined reaches the main feed", inPub.body === true, String(inPub.body));

const inPriv = await rpc(owner, "group_post_in_main_feed", { p_group: priv });
check("a PRIVATE group NEVER reaches the main feed", inPriv.body === false, String(inPriv.body));

/* And a public group you have NOT joined is not your feed either —
   §6 says "public groups YOU HAVE JOINED", not every public group. */
const strangerPub = await rpc(stranger, "group_post_in_main_feed", { p_group: pub });
check("a public group you have NOT joined stays out of your feed",
  strangerPub.body === false, String(strangerPub.body));

/* §8 — one pinned post per group, enforced by the index rather than
   by the RPC alone. Pinning a second must move the pin, not add one. */
const post = async (group, body) =>
  (await must("post", await rest(owner, "group_posts", {
    method: "POST", headers: { ...H(owner), Prefer: "return=representation" },
    body: JSON.stringify({ group_id: group, author_id: owner.user.id, body }),
  }), [201])).body[0];

const p1 = await post(pub, "S6TEST first");
const p2 = await post(pub, "S6TEST second");
await rpc(owner, "pin_group_post", { p_post: p1.id });
await rpc(owner, "pin_group_post", { p_post: p2.id });
const pinned = await rest(owner, `group_posts?select=id,pinned_at&group_id=eq.${pub}&pinned_at=not.is.null`);
check("a group has at most ONE pinned post, and pinning moves it",
  Array.isArray(pinned.body) && pinned.body.length === 1 && pinned.body[0].id === p2.id,
  `${pinned.body?.length} pinned`);

/* A member who does not run the group cannot pin. */
const strangerPin = await rpc(stranger, "pin_group_post", { p_post: p1.id });
check("somebody who does not run the group cannot pin a post",
  strangerPin.status >= 400, `HTTP ${strangerPin.status}`);

await sweep("after");
console.log(`\n${failures} failed.`);
process.exit(failures ? 1 : 0);
