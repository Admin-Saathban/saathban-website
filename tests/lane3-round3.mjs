/* ════════════════════════════════════════════════
   The three "confirm by looking" items, looked at.

   MESSAGES_SPEC §9  — the drifted-faces row at the top of Chats
   POSTS_SPEC   §5  — tagging: told, removable, refusable
   MOTION/z-index   — is the bottom-bar collision actually resolved on
                      the DEPLOYED build, not just in my own layer

   Run: BASE_URL=<deployed> node tests/lane3-round3.mjs
        DRIFTED=1 as well, once a thread has been aged (see §9 below)
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { snapshotProbes, sweepProbes } from "./probes.mjs";

/* NO DEFAULT PORT. This file used to default to an assumed localhost
   port, and that cost a full run of tests/messages-arrival.mjs: every
   lane works in this one directory, the port was already taken, vite
   preview walked up to another one, and the neighbour sitting on the
   assumed port answered 200 to everything. The assertions then failed
   against a STALE BUILD and read exactly like a broken feature.

   An absent thing (my server on the port I assumed) reading as a
   legitimate one (a server answering 200) is the same shape as the
   other bugs found tonight. A default that silently points somewhere
   plausible is worse than no default. Read the port vite actually
   printed and pass it. */
const BASE = (process.env.BASE_URL || "").replace(new RegExp("/+$"), "");
if (!BASE) {
  console.error("Set BASE_URL — a deployed URL, or the port vite preview actually printed.");
  process.exit(2);
}
/* AND IT MUST BE A REAL URL. The empty check alone was not enough: a
   port-reading one-liner grepped vite`s output for localhost:[0-9]+,
   the output carries ANSI colour codes between the colon and the
   digits, so the port came back empty and BASE became "http://localhost:"
   — truthy, past the guard, and straight into ERR_CONNECTION_REFUSED.
   An absent thing reading as a legitimate one, this time inside the
   guard written to stop exactly that. Parse it. */
let _u;
try { _u = new URL(BASE); } catch { _u = null; }
if (!_u || !_u.hostname || (_u.protocol === "http:" && _u.hostname === "localhost" && !_u.port)) {
  console.error(`BASE_URL is not a usable URL: ${JSON.stringify(BASE)}`);
  process.exit(2);
}

/* See tests/probes.mjs — both conditions, and it clears the
   notifications this run's tags caused. */
const probesBefore = await snapshotProbes();
const raw = readFileSync("./.env.local", "utf8");
const g = (n) => { const l = raw.split(/\r?\n/).find((x) => x.startsWith(n)); return l.slice(l.indexOf("=") + 1).trim(); };
const SUPA = g("VITE_SUPABASE_URL"), ANON = g("VITE_SUPABASE_ANON_KEY");
const K = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

const FAM = "83df705b-914a-46de-81a7-4b511fc3b1a2";

let fails = 0;
const check = (n, ok, note = "") => { if (!ok) fails++; console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(56), note); };

const login = async (email) => {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "SaathTest!2026" }),
  });
  return r.json();
};

const browser = await chromium.launch({ channel: "msedge", headless: true });
async function pageAs(email, lang = "en") {
  const s = await login(email);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.addInitScript(([k, v, l]) => {
    localStorage.setItem(k, v);
    localStorage.setItem("saathban.app.lang", l);
    /* §9 shows at most once a day and rests after a dismissal. Both are
       cleared so the row's own rules are what is under test, not a
       leftover from the previous run. */
    localStorage.removeItem("saathban.msg.drifted.seen");
    localStorage.removeItem("saathban.msg.drifted.hushed");
  }, [K, JSON.stringify(s), lang]);
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message.slice(0, 140)));
  return { ctx, p, session: s };
}

const admin = await login("test-admin@saathban.dev");
const sb = createClient(SUPA, ANON, { global: { headers: { Authorization: `Bearer ${admin.access_token}` } } });

/* ─────────────── z-index, on the deployed build ─────────────── */
{
  const { ctx, p } = await pageAs("test-icon@saathban.dev");
  await p.goto(BASE + "/app/community/messages", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);

  /* The honest question is what a thumb HITS, not what innerText says:
     the app bar is still in the DOM behind an opaque layer, and reading
     the text would call this resolved either way. */
  const foot = await p.evaluate(() => {
    const el = document.elementFromPoint(195, 830);
    return {
      text: (el ? el.innerText || el.textContent : "").trim().slice(0, 30),
      inWorld: !!(el && el.closest('[data-world="messages"]')),
    };
  });
  check("z-index: the world owns the foot of the screen", foot.inWorld, JSON.stringify(foot));

  /* And the layers themselves, read off the live page rather than source. */
  const layers = await p.evaluate(() => {
    const world = document.querySelector('[data-world="messages"]');
    const fixed = [...document.querySelectorAll("body *")].filter((e) => getComputedStyle(e).position === "fixed");
    const bar = fixed.find((e) => e !== world && !world?.contains(e) && e.getBoundingClientRect().bottom >= window.innerHeight - 2);
    return { world: world ? Number(getComputedStyle(world).zIndex) : null, bar: bar ? Number(getComputedStyle(bar).zIndex) : null };
  });
  check("z-index: the world sits above the app bar", layers.world != null && (layers.bar == null || layers.world > layers.bar),
        `world=${layers.world} bar=${layers.bar}`);
  await ctx.close();
}

/* ─────────────── §9 the drifted row ───────────────

   AGEING IS NOT DONE HERE, and the reason is worth keeping. The first
   version of this test aged the thread with the ADMIN client, and
   dm_messages UPDATE is participant-only — an admin is not a
   participant, so RLS filtered the update to zero rows AND RETURNED
   SUCCESS. The rows never moved, the drifted row correctly did not
   appear, and a working feature looked broken because the test was.

   An UPDATE filtered by RLS matches nothing and succeeds silently. So
   ageing is done with a privileged connection before this runs, and
   DRIFTED=1 says it has been; without it these checks are skipped
   rather than reported as failures they are not.                    */
{
  const { ctx, p } = await pageAs("test-icon@saathban.dev");
  await p.goto(BASE + "/app/community/messages", { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  const body = await p.evaluate(() => document.body.innerText);

  if (!process.env.DRIFTED) {
    console.log("skip  §9 — needs a thread aged privileged first (DRIFTED=1)");
  } else {
    check("§9 the row appears for a conversation gone quiet", /Not heard from/.test(body));

    const ring = await p.evaluate(() => {
      const label = [...document.querySelectorAll("*")].find((e) => e.textContent?.trim() === "Not heard from");
      const row = label?.closest("section");
      if (!row) return { found: false };
      /* §9: no presence ring and no dot on these faces — they are
         people you have drifted from, not people who are active. */
      const dots = [...row.querySelectorAll("span")].filter((e) => {
        const st = getComputedStyle(e);
        return st.borderRadius === "50%" && e.getBoundingClientRect().width < 22 &&
               st.backgroundColor !== "rgba(0, 0, 0, 0)" && !e.textContent.trim();
      });
      return { found: true, dots: dots.length };
    });
    check("§9 no presence ring or dot on those faces", ring.found && ring.dots === 0, JSON.stringify(ring));

    const dismiss = p.getByRole("button", { name: /Hide these for now/ }).first();
    check("§9 it can be dismissed from the right", (await dismiss.count()) > 0);
    if (await dismiss.count()) {
      await dismiss.click();
      await p.waitForTimeout(900);
      const after = await p.evaluate(() => document.body.innerText);
      check("§9 dismissing removes it", !/Not heard from/.test(after));
      /* NOT a reload: pageAs() clears the hush key on every navigation
         so the row can be tested at all, which would wipe the very
         thing a reload is meant to prove. What persistence means here
         is that the dismissal was WRITTEN, so that is what is read. */
      const hushed = await p.evaluate(() => localStorage.getItem("saathban.msg.drifted.hushed"));
      check("§9 the dismissal is remembered", !!hushed && Number(hushed) > 0, hushed || "not written");
    }
    await p.screenshot({ path: "tests/_shots/drifted-row.png" });
  }
  await ctx.close();
}

/* ─────────────── §5 tagging ─────────────── */
{
  const { ctx, p } = await pageAs("test-fam@saathban.dev");
  await p.goto(BASE + "/app/settings", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  const s = await p.evaluate(() => document.body.innerText);
  check("§5 Settings offers the tagging switch", /Can people add your name/.test(s));
  await ctx.close();
}

const MARK = "ZZ tag probe";
let taggedPostId = null;
{
  const { ctx, p } = await pageAs("test-icon@saathban.dev");
  await p.goto(BASE + "/app/community", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  /* Wait for the row rather than for the clock — the feed is several
     queries deep and a fixed pause passed on one run and missed on the
     next, which is a flaky test rather than a flaky app. */
  const row = p.getByText("Say something to your neighbours").first();
  await row.waitFor({ state: "visible", timeout: 20000 });
  await row.click();
  await p.waitForTimeout(800);
  await p.locator("textarea").first().fill(MARK);
  await p.getByRole("button", { name: /With someone/ }).first().click();
  /* fetchMyPeople is an RPC and the picker only asks for it when opened,
     so wait for a NAME rather than for a duration — a fixed 1.8s passed
     once and missed once, which is a flaky test rather than a flaky app. */
  const person = p.getByRole("button", { name: /Test Fam/ }).first();
  await person.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  check("§5 the composer offers people to name", (await person.count()) > 0);
  if (await person.count()) await person.click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Share", exact: true }).first().click();
  await p.waitForTimeout(4500);

  await p.goto(BASE + "/app/community", { waitUntil: "networkidle" });
  await p.waitForTimeout(2800);
  const after = await p.evaluate(() => document.body.innerText);
  check("§5 the post says who is named", /With Test Fam/.test(after));
  check("§5 no silent tag failure", !/names could not be added/.test(after));
  await p.screenshot({ path: "tests/_shots/tagged-post.png" });
  await ctx.close();
}

{
  const { data: rows } = await sb.from("community_posts").select("id").like("body", `${MARK}%`).order("created_at", { ascending: false });
  taggedPostId = rows?.[0]?.id;
  const { data: tags } = await sb.from("post_tags").select("post_id, person_id").eq("post_id", taggedPostId || "");
  check("§5 the tag row exists", (tags || []).length === 1, `${(tags || []).length} tag(s)`);

  /* READ AS THEM, not as an admin. notifications is owner-only, so an
     admin token returns zero rows and "nobody was told" is
     indistinguishable from "I am not allowed to look". The first
     version of this check reported a working notification as missing
     for exactly that reason. */
  const famSession = await login("test-fam@saathban.dev");
  const famClient = createClient(SUPA, ANON, {
    global: { headers: { Authorization: `Bearer ${famSession.access_token}` } },
  });
  /* ASK FOR THIS POST'S NOTIFICATION, not for the newest four and a hope.

     This used to take the four most recent rows and look for one saying
     "mentioned you". Several lanes share this account and generate
     notifications constantly — the navigation lane's runs alone touched
     eleven of them in three hours — so four newer arrivals between the
     tag being created and this read would have pushed the real one off
     the end, and "nobody was told" would have been reported for a
     feature working perfectly.

     Windowed by recency is the same error as scoped by nothing: an
     answer that is absent from an arbitrary slice read as an answer that
     does not exist. It filters on the post id, which cannot be crowded
     out. Found because that lane noticed its own runs were marking this
     account's notifications read and asked whether it was propping up
     anyone else's green. It was not propping up mine — nothing here
     asserts read state — but the question was the right one. */
  const { data: notes } = await famClient.from("notifications")
    .select("title, link, created_at")
    .ilike("link", `%${taggedPostId || "nope"}%`)
    .order("created_at", { ascending: false });
  const told = (notes || []).find((n) => /mentioned you/i.test(n.title || ""));
  check("§5 the tagged person was told", !!told, told?.title || (notes || []).map((n) => n.title).join(" / "));
  check("§5 the notification lands on the post", !!told && told.link.includes(taggedPostId || "nope"), told?.link || "");
}

{
  const { ctx, p } = await pageAs("test-fam@saathban.dev");
  await p.goto(BASE + "/app/community", { waitUntil: "networkidle" });
  await p.waitForTimeout(2800);
  const off = p.getByRole("button", { name: /Take my name off/ }).first();
  check("§5 the person named is offered a way off", (await off.count()) > 0);
  if (await off.count()) {
    await off.click();
    await p.waitForTimeout(2500);
    const { data: tags } = await sb.from("post_tags").select("post_id").eq("post_id", taggedPostId || "");
    check("§5 removing the tag actually removes it", (tags || []).length === 0, `${(tags || []).length} left`);
  }
  check("no page errors", p.errs.length === 0, [...new Set(p.errs)].slice(0, 2).join(" | "));
  await ctx.close();
}

await sb.from("community_posts").delete().like("body", `${MARK}%`);
await sweepProbes(probesBefore);

console.log(fails ? `\n${fails} FAILED` : "\nROUND 3 OK");
await browser.close();
process.exit(fails ? 1 : 0);
