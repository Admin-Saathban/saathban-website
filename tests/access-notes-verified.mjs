/* OUT_AND_ABOUT_SPEC §4 + §4.1, and migration 0065.
 *
 * The ruling: admin-seeded is what launches, and admins edit the
 * notes later. The consequence I built from it: a note nobody has
 * checked is NOT shown to anyone.
 *
 * That rule is worth a test of its own because it is the one that
 * protects a person from the harm §4 names — "if it says 'flat walk'
 * and there are steps, someone made a trip they could not complete."
 * A guess rendered in the same green as a checked fact IS that harm,
 * and no wording on the chip fixes it.
 *
 * Both directions are asserted, because a rule that only ever hides
 * things passes for the wrong reason:
 *   · an UNVERIFIED note must not reach an ordinary member
 *   · a VERIFIED note must
 *
 * Writes are admin-only at the database (0064), so the test also
 * proves that: an Icon attempting to write a note is refused.
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
  let body = null;
  try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  return { status: r.status, body };
};

const admin = await login("test-admin@saathban.dev");
const icon = await login("test-icon@saathban.dev");
if (!admin.access_token || !icon.access_token) { console.error("login failed"); process.exit(2); }

/* A place to hang the notes on. Any visible one will do — the rule
   under test is about the NOTE, not the place. */
const place = ((await rest(icon, "outdoor_places?select=id,name&is_hidden=is.false&limit=1")).body || [])[0];
if (!place) { console.error("FIXTURE FAILED: no place"); process.exit(2); }

const clean = async () => {
  for (const f of ["toilet", "benches"]) {
    await rest(admin, `outdoor_place_access?place_id=eq.${place.id}&feature=eq.${f}`, { method: "DELETE" });
  }
};
await clean();

/* ── 1. Writes are admin-only (0064) ── */
const iconWrite = await rest(icon, "outdoor_place_access", {
  method: "POST",
  headers: H(icon),
  body: JSON.stringify({ place_id: place.id, feature: "toilet", verified: true }),
});
check("an ordinary Icon cannot write an access note", iconWrite.status >= 400, `HTTP ${iconWrite.status}`);

/* ── 2. An UNVERIFIED note is invisible to an ordinary member ── */
const seedGuess = await rest(admin, "outdoor_place_access", {
  method: "POST",
  headers: { ...H(admin), Prefer: "return=representation" },
  body: JSON.stringify({ place_id: place.id, feature: "toilet", verified: false }),
});
check("FIXTURE: an admin can seed an unchecked note", seedGuess.status === 201, `HTTP ${seedGuess.status}`);

/* This is the query the place rows actually run (outdoorData
   fetchAccessNotes), not an approximation of it. */
const publicQuery = `outdoor_place_access?select=place_id,feature&verified=is.true&place_id=eq.${place.id}`;
const guessSeen = await rest(icon, publicQuery);
check("an UNCHECKED note never reaches a place row",
  Array.isArray(guessSeen.body) && guessSeen.body.every((r) => r.feature !== "toilet"),
  `${guessSeen.body?.length ?? guessSeen.status} rows`);

/* ── 3. Confirming it — the admin screen's one-tap action ── */
await rest(admin, `outdoor_place_access?place_id=eq.${place.id}&feature=eq.toilet`, {
  method: "PATCH",
  headers: H(admin),
  body: JSON.stringify({ verified: true, verified_at: new Date().toISOString() }),
});
const confirmedSeen = await rest(icon, publicQuery);
check("CONTROL: once confirmed, the SAME note does reach the place row",
  Array.isArray(confirmedSeen.body) && confirmedSeen.body.some((r) => r.feature === "toilet"),
  `${confirmedSeen.body?.length ?? confirmedSeen.status} rows`);

/* ── 4. And the unverified/verified split is per NOTE, not per place.
      A place with one checked note must not drag its unchecked ones
      into view alongside it — which is exactly what would happen if
      the filter were written per place instead of per row. ── */
await rest(admin, "outdoor_place_access", {
  method: "POST",
  headers: H(admin),
  body: JSON.stringify({ place_id: place.id, feature: "benches", verified: false }),
});
const mixed = await rest(icon, publicQuery);
const features = (mixed.body || []).map((r) => r.feature);
check("a checked note does not drag an unchecked one into view",
  features.includes("toilet") && !features.includes("benches"),
  features.join(",") || "none");

await clean();
console.log(`\n${failures} failed.`);
process.exit(failures ? 1 : 0);
