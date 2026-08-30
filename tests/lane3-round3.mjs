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

const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(/\/$/, "");
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
      await p.reload({ waitUntil: "networkidle" });
      await p.waitForTimeout(2800);
      const back = await p.evaluate(() => document.body.innerText);
      check("§9 it stays away afterwards", !/Not heard from/.test(back));
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
  await p.getByText("Say something to your neighbours").first().click();
  await p.waitForTimeout(800);
  await p.locator("textarea").first().fill(MARK);
  await p.getByRole("button", { name: /With someone/ }).first().click();
  await p.waitForTimeout(1800);
  const person = p.getByRole("button", { name: /Test Fam/ }).first();
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

  const { data: notes } = await sb.from("notifications")
    .select("title, link").eq("profile_id", FAM)
    .order("created_at", { ascending: false }).limit(4);
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

console.log(fails ? `\n${fails} FAILED` : "\nROUND 3 OK");
await browser.close();
process.exit(fails ? 1 : 0);
