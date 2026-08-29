/* ════════════════════════════════════════════════
   Community shares suite — migration 0018, real accounts, real RLS.

   Run:  node tests/community-shares.mjs
   Fixtures: the seeded test-* accounts (password SaathTest!2026),
   including test-icon2 (a second Icon, for the walk Join flow) and
   test-fam (in test-icon's circle → the Friends-tab connection case).

   Covers: the body constraint (text posts need words, shares don't),
   all four share payloads readable by the community, the walk flow
   (board outing + share, Join creates the joiner's OWN outing row,
   fam refused), event share against a real published event, and the
   Friends-tab connection set.

   Cleanup: tests/community-shares-cleanup.sql (service role).
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

const icon = await login("test-icon@saathban.dev");
const icon2 = await login("test-icon2@saathban.dev");
const fam = await login("test-fam@saathban.dev");
const admin = await login("test-admin@saathban.dev");

const MARK = `[shares ${Math.random().toString(36).slice(2, 8)}]`;
const REP = { Prefer: "return=representation" };

/* ─── Body constraint: text needs words, shares don't ─── */
{
  const empty = await rest(icon, "POST", "community_posts", {
    author_id: icon.id,
    body: "",
    post_type: "text",
  });
  check("text post with empty body: refused (constraint)", empty.status === 400, `status ${empty.status}`);
}

/* ─── Badge share ─── */
let badgePost;
{
  const r = await rest(
    icon,
    "POST",
    "community_posts",
    {
      author_id: icon.id,
      body: "",
      post_type: "badge",
      payload: { emoji: "🌅", name_en: `${MARK} First Light`, name_ur: "پہلی کرن" },
    },
    REP
  );
  badgePost = r.data?.[0];
  check("badge share: created with empty body", r.status === 201 && badgePost?.post_type === "badge");
  const seen = await rest(fam, "GET", `community_posts?id=eq.${badgePost.id}&select=post_type,payload`);
  check(
    "fam: reads badge payload (both language names)",
    seen.data?.[0]?.payload?.name_ur === "پہلی کرن",
    JSON.stringify(seen.data?.[0]?.payload || {})
  );
}

/* ─── Score share (score-level only, by construction) ─── */
{
  const r = await rest(
    icon,
    "POST",
    "community_posts",
    {
      author_id: icon.id,
      body: "",
      post_type: "score",
      payload: { points: 40, done: 4, total: 6, marker: MARK },
    },
    REP
  );
  check("score share: created", r.status === 201);
  const seen = await rest(fam, "GET", `community_posts?id=eq.${r.data?.[0]?.id}&select=payload`);
  const p = seen.data?.[0]?.payload || {};
  check(
    "score payload carries numbers only (no notes/meds keys)",
    p.points === 40 && p.done === 4 && !("mood" in p) && !("notes" in p)
  );
}

/* ─── Walk share + Join ─── */
let walkPost;
{
  const places = (await rest(icon, "GET", "outdoor_places?select=id,name&limit=1")).data;
  const place = places[0];
  const startsAt = new Date(Date.now() + 86_400_000).toISOString();

  const outing = await rest(
    icon,
    "POST",
    "outdoor_outings",
    {
      place_id: place.id,
      creator_id: icon.id,
      starts_at: startsAt,
      note: `${MARK} shareWalk`,
      visibility: "board",
    },
    REP
  );
  const share = await rest(
    icon,
    "POST",
    "community_posts",
    {
      author_id: icon.id,
      body: "",
      post_type: "walk",
      ref_id: outing.data?.[0]?.id,
      payload: { place_id: place.id, place_name: place.name, starts_at: startsAt, note: null },
    },
    REP
  );
  walkPost = share.data?.[0];
  check("walk: board outing + share created", outing.status === 201 && share.status === 201);

  const seen = await rest(fam, "GET", `community_posts?id=eq.${walkPost.id}&select=payload`);
  check("fam: sees the walk card data (place + time)", seen.data?.[0]?.payload?.place_name === place.name);

  // Join = the joiner's OWN outing row for the same place & time.
  const join = await rest(
    icon2,
    "POST",
    "outdoor_outings",
    {
      place_id: walkPost.payload.place_id,
      creator_id: icon2.id,
      starts_at: walkPost.payload.starts_at,
      visibility: "board",
    },
    REP
  );
  check("icon2: Join creates their own outing row", join.status === 201, `status ${join.status}`);

  const famJoin = await rest(fam, "POST", "outdoor_outings", {
    place_id: walkPost.payload.place_id,
    creator_id: fam.id,
    starts_at: walkPost.payload.starts_at,
    visibility: "board",
  });
  check("fam: CANNOT join (outings are Icon-only, RLS)", [401, 403].includes(famJoin.status), `status ${famJoin.status}`);

  const both = await rest(
    fam,
    "GET",
    `outdoor_outings?place_id=eq.${walkPost.payload.place_id}&starts_at=eq.${encodeURIComponent(
      walkPost.payload.starts_at
    )}&select=creator_id`
  );
  check(
    "the walk group is visible: both walkers' outings on the place",
    both.data?.length >= 2,
    `rows ${both.data?.length}`
  );
}

/* ─── Event share against a real published event ─── */
{
  const ev = await rest(
    admin,
    "POST",
    "events",
    {
      title: `${MARK} Chai & Carrom afternoon`,
      description: "suite event",
      venue: "Alhamra",
      city: "Lahore",
      event_date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
      start_time: "16:00",
      capacity: 30,
      is_published: true,
      created_by: admin.id,
    },
    REP
  );
  const event = ev.data?.[0];
  check("admin: seeded a published event", ev.status === 201 && !!event?.id, `status ${ev.status}`);

  const share = await rest(
    icon,
    "POST",
    "community_posts",
    {
      author_id: icon.id,
      body: "",
      post_type: "event",
      ref_id: event.id,
      payload: { title: event.title, event_date: event.event_date },
    },
    REP
  );
  check("event share: created with title/date snapshot", share.status === 201);
  const seen = await rest(fam, "GET", `community_posts?id=eq.${share.data?.[0]?.id}&select=payload`);
  check("fam: sees the event card data", (seen.data?.[0]?.payload?.title || "").includes("Chai & Carrom"));
}

/* ─── Friends tab: the connection set ─── */
{
  const conns = await rest(
    fam,
    "GET",
    `circle_members?or=(icon_id.eq.${fam.id},member_id.eq.${fam.id})&select=icon_id,member_id`
  );
  const set = new Set(
    (conns.data || []).map((r) => (r.icon_id === fam.id ? r.member_id : r.icon_id))
  );
  check("fam: connection set includes test-icon (in their circle)", set.has(icon.id));
  check("fam: connection set EXCLUDES test-icon2 (no relationship)", !set.has(icon2.id));
  // Friends filter = posts whose author is in this set: icon's badge
  // post qualifies, icon2's would not.
  check("friends filter would keep icon's share", set.has(badgePost.author_id));
}

console.log(`\n${failures} failures. Marker for cleanup: ${MARK}`);
process.exit(failures ? 1 : 0);
