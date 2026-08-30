/* GROUPS_SPEC §4 — the sentence a lane will get wrong.
 *
 *   "A group event IS an Out & about happening. There is not a second
 *    events system. It inherits the group's privacy. A private group's
 *    event is visible only to members and must never appear in the
 *    city-wide Out & about list."
 *
 * Built the simple way this leaks a private group's meeting place and
 * time to the whole city, because the existing outings read policy
 * says:
 *
 *   visibility = 'board'  →  anyone with community access may read it
 *
 * and the community writer hardcodes exactly that. So the failure is
 * the DEFAULT, not an edge case.
 *
 * THIS TEST IS WRITTEN BEFORE THE FEATURE. It is expected to fail
 * first, and the way it fails is the point: if it passes on day one,
 * it is not testing anything.
 *
 * Every "cannot read" assertion is paired with a control that SHOULD
 * read, because a suite where everything is invisible passes for the
 * wrong reason:
 *   · a member of the private group must see the event
 *   · a public group's event must still reach the city-wide list
 */

const SUPA = process.env.SUPA, KEY = process.env.KEY;
let failures = 0;
const check = (n, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(66), String(note).slice(0, 44));
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
const rpc = async (s, fn, args) => {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: "POST", headers: H(s), body: JSON.stringify(args) });
  const t = await r.text();
  let body = null;
  try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  return { status: r.status, body };
};

const owner = await login("smoke-icon@saathban.dev");   // creates the groups
const member = await login("smoke-fam@saathban.dev");   // in the private group
const stranger = await login("test-buddy@saathban.dev"); // in neither

/* ── Fixture. Every write is checked: a silently refused setup makes
      every assertion below vacuous, which is the failure mode that
      has cost this project the most. ── */
const must = async (label, res, want = [200, 201, 204]) => {
  if (!want.includes(res.status)) {
    console.error(`FIXTURE FAILED ${label}: HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`);
    process.exit(2);
  }
  return res;
};

/* Clean up anything a previous run left.

   Delete the OUTINGS BY NOTE, not by group_id. A mutation run — the
   way you prove this test can still fail — is precisely the run that
   writes rows with group_id null, and a cleanup keyed on group_id
   walks straight past them. Those orphans then match the "readable as
   text" assertion on the NEXT run and report a leak that isn't there.
   Cleaning by the S4TEST prefix catches every row the file can
   create, however it was mutated. */
const sweep = async () => {
  await rest(owner, `outdoor_outings?note=like.S4TEST*`, { method: "DELETE" });
  for (const g of (await rest(owner, `groups?select=id&name=like.S4TEST*`)).body || []) {
    await rest(owner, `outdoor_outings?group_id=eq.${g.id}`, { method: "DELETE" });
    await rest(owner, `groups?id=eq.${g.id}`, { method: "DELETE" });
  }
};
await sweep();

/* Created the way the APP creates them — through create_group, not a
   raw insert. `groups` has no insert policy at all (correctly: an Icon
   check and the creator's membership row both live in the function),
   so a test that inserted directly would be testing a path no user
   can take. */
const mk = async (name, privacy) => {
  const r = await must(`create ${privacy} group`,
    await rpc(owner, "create_group", { p_name: name, p_description: null, p_privacy: privacy }));
  return { id: r.body };
};

const priv = await mk("S4TEST private walkers", "invite_only");
const pub = await mk("S4TEST public walkers", "anyone");
console.log(`fixture: private ${priv.id.slice(0, 8)}, public ${pub.id.slice(0, 8)}`);

/* The member joins the private group; the stranger joins neither.
   Invited then accepted, again because that is the real path. */
const inv = await must("invite the member",
  await rpc(owner, "invite_to_group", { p_group: priv.id, p_invitee: member.user.id }));
await must("member accepts",
  await rpc(member, "respond_group_invite", { p_invite: inv.body, p_accept: true }));

/* A place to meet at, and the two events. */
const place = ((await rest(owner, "outdoor_places?select=id&limit=1")).body || [])[0];
if (!place) { console.error("FIXTURE FAILED: no place to meet at"); process.exit(2); }

const mkEvent = async (group, note) =>
  (await must(`create event for ${note}`,
    await rest(owner, "outdoor_outings", {
      method: "POST",
      headers: { ...H(owner), Prefer: "return=representation" },
      body: JSON.stringify({
        place_id: place.id,
        creator_id: owner.user.id,
        starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
        note,
        visibility: "board",     // what the ordinary writer produces
        group_id: group.id,      // …and the group it belongs to
      }),
    }), [201])).body[0];

const privEvent = await mkEvent(priv, "S4TEST private meeting place and time");
const pubEvent = await mkEvent(pub, "S4TEST public walk");

/* ── The controls first. If these fail, the refusals below mean
      nothing, because everything would be hidden from everyone. ── */
const memberSees = await rest(member, `outdoor_outings?select=id,note&id=eq.${privEvent.id}`);
check("CONTROL: a member of the private group CAN read its event",
  Array.isArray(memberSees.body) && memberSees.body.length === 1,
  `${memberSees.body?.length ?? memberSees.status} rows`);

const strangerSeesPublic = await rest(stranger, `outdoor_outings?select=id&id=eq.${pubEvent.id}`);
check("CONTROL: a public group's event DOES reach a non-member",
  Array.isArray(strangerSeesPublic.body) && strangerSeesPublic.body.length === 1,
  `${strangerSeesPublic.body?.length ?? strangerSeesPublic.status} rows`);

/* ── §4: the four paths a private group's event must not travel ── */

// 1. Direct URL — asking for the row by its id, which is what a
//    pasted or guessed link does.
const direct = await rest(stranger, `outdoor_outings?select=id,note,starts_at,place_id&id=eq.${privEvent.id}`);
check("a non-member cannot read the private event BY DIRECT ID",
  !Array.isArray(direct.body) || direct.body.length === 0,
  `${direct.body?.length ?? direct.status} rows`);

// 2. The city-wide list — the What's on query itself.
const cityWide = await rest(stranger,
  `outdoor_outings?select=id,note&canceled_at=is.null&starts_at=gt.${new Date().toISOString()}&limit=200`);
const leaked = (Array.isArray(cityWide.body) ? cityWide.body : []).filter((o) => o.id === privEvent.id);
check("the private event NEVER appears in the city-wide Out & about list",
  leaked.length === 0, `${leaked.length} leaked of ${cityWide.body?.length ?? "?"} listed`);

// 3. The note itself — the meeting place and time in words. Checked
//    separately because a filtered id list can still leak the text
//    through a different column selection.
const byNote = await rest(stranger, `outdoor_outings?select=id,note&note=like.*private meeting place*`);
check("the meeting place and time are not readable as text",
  !Array.isArray(byNote.body) || byNote.body.length === 0,
  `${byNote.body?.length ?? byNote.status} rows`);

// 4. A stranger with no account at all.
const anon = await rest(null, `outdoor_outings?select=id&id=eq.${privEvent.id}`);
check("a signed-out stranger reads nothing", anon.status === 401, `HTTP ${anon.status}`);

/* 5. The group row itself must not hand over the group either — a
      private group is "Hidden" per §1 screen 3. */
const groupRow = await rest(stranger, `groups?select=id,name&id=eq.${priv.id}`);
check("a non-member cannot read the private GROUP row",
  !Array.isArray(groupRow.body) || groupRow.body.length === 0,
  `${groupRow.body?.length ?? groupRow.status} rows`);

/* 6. §6 — private group content never leaves the group, so the event
      must not surface as a community post either. */
const asPost = await rest(stranger, `community_posts?select=id,payload&limit=200`);
const postLeak = (Array.isArray(asPost.body) ? asPost.body : [])
  .filter((p) => JSON.stringify(p.payload || {}).includes(privEvent.id));
check("the private event does not surface as a community post",
  postLeak.length === 0, `${postLeak.length} leaked`);

/* 7. The same check against the row the APP's writer produces.
      Everything above tested a row this file inserted; if
      createGroupEvent ever stopped setting group_id, all of it would
      still pass while the product leaked. So: write one the way the
      store does — same columns, same order — and re-ask the two
      questions that matter. */
const viaStore = await must("write an event the way the app does",
  await rest(owner, "outdoor_outings", {
    method: "POST",
    headers: { ...H(owner), Prefer: "return=representation" },
    body: JSON.stringify({
      place_id: place.id,
      creator_id: owner.user.id,
      starts_at: new Date(Date.now() + 4 * 86400000).toISOString(),
      note: "S4TEST written by the store path",
      visibility: "board",
      group_id: priv.id,
    }),
  }), [201]);
const storeEvent = viaStore.body[0];

const strangerDirect2 = await rest(stranger, `outdoor_outings?select=id&id=eq.${storeEvent.id}`);
check("the store-written event is also hidden by direct id",
  !Array.isArray(strangerDirect2.body) || strangerDirect2.body.length === 0,
  `${strangerDirect2.body?.length ?? strangerDirect2.status} rows`);

const memberDirect2 = await rest(member, `outdoor_outings?select=id&id=eq.${storeEvent.id}`);
check("CONTROL: and the member still sees the store-written event",
  Array.isArray(memberDirect2.body) && memberDirect2.body.length === 1,
  `${memberDirect2.body?.length ?? memberDirect2.status} rows`);

/* ── Tidy up ── */
await sweep();

console.log(`\n${failures} failed.`);
process.exit(failures ? 1 : 0);
