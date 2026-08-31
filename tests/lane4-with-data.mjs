/* The screens I reported delivered, rendered WITH DATA.
 *
 * Every earlier browser check of mine saw these screens empty. An
 * empty screen exercises the empty branch and nothing else, so
 * "renders with no page error" was true of code paths that had never
 * run once: a place row with faces on it, a member request with a
 * person's name, a moment in the list, a pinned welcome post, the
 * weather line.
 *
 * That is the same shape as the 204 that let 47 fixture groups reach
 * real users — a thing that was never exercised looking exactly like
 * a thing that works. So this file makes the minimum real data each
 * path needs, looks at it, and removes it again.
 *
 * FIXTURES ARE PRIVATE OR SHORT-LIVED BY DESIGN. The one public group
 * this needs (a join request cannot be made against a private group)
 * exists for seconds and its removal is asserted, because a public
 * fixture is offered to real people under "Groups near you".
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (() => {
  const raw = process.env.BASE_URL;
  if (!raw) { console.error("BASE_URL is required — no default."); process.exit(2); }
  let u; try { u = new URL(raw); } catch { console.error("BASE_URL unusable: " + raw); process.exit(2); }
  if ((u.hostname === "localhost" || u.hostname === "127.0.0.1") && !u.port) {
    console.error("BASE_URL names no port: " + raw); process.exit(2);
  }
  return raw.replace(/\/$/, "");
})();

const raw = readFileSync("./.env.local", "utf8");
const g = (n) => { const l = raw.split(/\r?\n/).find((x) => x.startsWith(n)); return l.slice(l.indexOf("=") + 1).trim(); };
const SUPA = g("VITE_SUPABASE_URL"), ANON = g("VITE_SUPABASE_ANON_KEY");
const K = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

let fails = 0;
const check = (n, ok, note = "") => {
  if (!ok) fails++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(58), String(note).slice(0, 42));
};

const login = async (e) => (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: e, password: "SaathTest!2026" }),
})).json();
const H = (s) => ({ apikey: ANON, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" });
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

const owner = await login("smoke-icon@saathban.dev");   // Lahore, Model Town
const asker = await login("test-buddy@saathban.dev");

/* ── Fixtures ── */
const made = { groups: [], moments: [], checkins: [] };

const sweep = async (label) => {
  for (const id of made.checkins) await rest(owner, `outdoor_checkins?id=eq.${id}`, { method: "DELETE" });
  /* BY NAME, not only by the ids this run happens to hold. A run that
     died mid-way leaves rows that no later run knows the ids of, and a
     sweep that only clears its own bookkeeping cannot clear them —
     which is how the previous version failed its own before-check. */
  await rest(owner, `outdoor_moments?label=like.L4DATA*`, { method: "DELETE" });
  for (const g of ((await rest(owner, `groups?select=id&name=like.L4DATA*`)).body || [])) {
    await rpc(owner, "delete_group", { p_group: g.id });
  }
  for (const id of made.moments) await rest(owner, `outdoor_moments?id=eq.${id}`, { method: "DELETE" });
  for (const id of made.groups) await rpc(owner, "delete_group", { p_group: id });

  const leftG = (await rest(owner, `groups?select=id&name=like.L4DATA*`)).body;
  const leftM = (await rest(owner, `outdoor_moments?select=id&label=like.L4DATA*`)).body;
  const bad = (Array.isArray(leftG) ? leftG.length : -1) + (Array.isArray(leftM) ? leftM.length : -1);
  if (bad !== 0) {
    console.error(`SWEEP FAILED (${label}): groups=${leftG?.length} moments=${leftM?.length}`);
    console.error("A leaked public fixture is content in the app, not untidiness.");
    process.exit(3);
  }
};
await sweep("before");

const b = await chromium.launch({ channel: "msedge", headless: true });
const open = async (session, lang = "en") => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 1100 } });
  await ctx.addInitScript(([k, v, l]) => {
    localStorage.setItem(k, v); localStorage.setItem("saathban.app.lang", l);
  }, [K, JSON.stringify(session), lang]);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 130)));
  const go = async (path, settle = 2800) => {
    await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(settle);
    return (await page.evaluate(() => document.body.innerText)).trim();
  };
  return { page, ctx, errs, go };
};

try {
  /* ── 1. §3 faces, with a person actually at a place ──
     Model Town Park is in the owner's own city and area, so it is on
     the list they see. visibility 'connections' keeps this out of the
     wider board while it exists. */
  const PARK = "fa406969-748e-439d-b679-b80b94910432";
  /* Through the RPC, because outdoor_checkins has NO insert policy —
     the same shape as groups having no delete policy. A raw insert is
     refused 403, which is correct: the product path is the RPC, and a
     fixture that writes another way is testing a path no person can
     take. My first version did exactly that and reported it as the
     faces being broken. */
  const ci = await rpc(owner, "outdoor_check_in", { p_place: PARK, p_visibility: "connections" });
  if (ci.status === 200 && ci.body) made.checkins.push(ci.body);
  check("FIXTURE: somebody is checked in at a place", ci.status === 200, `HTTP ${ci.status}`);

  const me = await open(owner);
  const places = await me.go("/app/outdoor/places");
  check("§3 a place row renders a FACE, not just 'Quiet right now'",
    places.includes("Smoke"), places.includes("Smoke") ? "named" : "no face");
  /* FIRST name only, exactly — this is the assertion that catches a
     truncating split. "Smoke Icon is here" means the full name is
     being shown; a regex splitting on the letter s rather than on
     whitespace would render "Hassan Raza" as "Ha". The test account
     has no lowercase s, so only an exact match reveals it. */
  check("§3 the words show the FIRST name, not the full one",
    /Smoke is here/.test(places) && !/Smoke Icon is here/.test(places),
    (places.match(/Smoke[^\n]*/) || ["absent"])[0]);
  check("§3 the faces path renders with no page error", me.errs.length === 0, me.errs[0] || "");

  /* ── 2. §2.3 the weather line — never once asserted before ── */
  const whatson = await me.go("/app/outdoor", 4200);
  check("§2.3 the weather line renders for a known city",
    /\d+° in Lahore now/.test(whatson), (whatson.match(/\d+° in [^\n]*/) || ["absent"])[0]);

  /* ── 3. §8 a moment in the list ── */
  const mom = await rest(owner, "outdoor_moments", {
    method: "POST", headers: { ...H(owner), Prefer: "return=representation" },
    body: JSON.stringify({ profile_id: owner.user.id, label: "L4DATA at the chai stall", visibility: "board" }),
  });
  if (mom.status === 201) made.moments.push(mom.body[0].id);
  check("FIXTURE: a moment exists", mom.status === 201, `HTTP ${mom.status}`);

  const moments = await me.go("/app/outdoor/moments");
  check("§8 a live moment renders in the tab",
    moments.includes("L4DATA at the chai stall"), moments.includes("L4DATA") ? "shown" : "absent");
  check("§8 the owner is offered a way to end it early", /I've left/i.test(moments), "");

  /* ── 4. §8 the pinned welcome, through the real seeding path ── */
  const gid = (await rpc(owner, "create_group",
    { p_name: "L4DATA walkers", p_description: null, p_privacy: "invite_only" })).body;
  made.groups.push(gid);
  const seeded = await rpc(owner, "seed_group_welcome",
    { p_group: gid, p_body: "This is L4DATA walkers. We walk on ____ at ____." });
  check("FIXTURE: the welcome post is seeded and pinned", seeded.status === 200, `HTTP ${seeded.status}`);

  const groupPage = await me.go(`/app/groups/${gid}`);
  check("§8 the pinned welcome renders, marked as pinned",
    groupPage.includes("L4DATA walkers") && /Pinned/i.test(groupPage),
    /Pinned/i.test(groupPage) ? "marked" : "not marked");
  check("§3 the group states its member count", /Just you so far|\d+ people/.test(groupPage), "");

  /* ── 5. §7.1 a member request, with a person's NAME on it ──
     Needs a PUBLIC group: a private one refuses join requests by
     design. It lives for seconds and its removal is asserted. */
  const pubId = (await rpc(owner, "create_group",
    { p_name: "L4DATA open walkers", p_description: null, p_privacy: "anyone" })).body;
  made.groups.push(pubId);
  const asked = await rpc(asker, "request_to_join_group",
    { p_group: pubId, p_message: "I walk most mornings" });
  check("FIXTURE: somebody has asked to join", asked.status === 200, `HTTP ${asked.status}`);

  const manage = await me.go(`/app/groups/${pubId}/manage`);
  check("§7.1 a pending request renders with the person's NAME",
    /Test Buddy/.test(manage), /Test Buddy/.test(manage) ? "named" : "no name");
  check("§7.1 their message is shown, not just their name",
    /I walk most mornings/.test(manage), "");
  check("§7.1 approve and decline are both offered",
    /Let them in/i.test(manage) && /Not this time/i.test(manage), "");
  check("§7 the manage screen renders with data and no page error", me.errs.length === 0, me.errs[0] || "");

  await me.ctx.close();
} finally {
  await b.close();
  await sweep("after");
}

console.log(`\n${fails} failed.`);
process.exit(fails ? 1 : 0);
