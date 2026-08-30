/* ════════════════════════════════════════════════
   The composer seam, from BOTH sides.

   The navigation lane moved the composer above the log row on Home by
   splitting it out as <PostComposer /> and giving Feed composer={false},
   with three CustomEvents carrying the optimistic row, the landing and
   the failure. That is a sound design and it touches my §7 and §11
   rules, so it needs proving rather than accepting.

   Two paths now exist and only one of them was ever covered:

     /app/community   Feed renders its own composer, share() inline
     /app/home        PostComposer renders it, Feed listens on events

   Every existing post test drives the first. This drives the SECOND,
   which is the one that could quietly lose voice posts, the §11
   highlight, or the no-toast rule.

   Run: BASE_URL=<deployed> node tests/composer-seam.mjs
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(/\/$/, "");
const raw = readFileSync("./.env.local", "utf8");
const g = (n) => { const l = raw.split(/\r?\n/).find((x) => x.startsWith(n)); return l.slice(l.indexOf("=") + 1).trim(); };
const SUPA = g("VITE_SUPABASE_URL"), ANON = g("VITE_SUPABASE_ANON_KEY");
const K = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

let fails = 0;
const created = [];   // only these are ever deleted
const check = (n, ok, note = "") => { if (!ok) fails++; console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(58), note); };

const login = async (email) => {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "SaathTest!2026" }),
  });
  return r.json();
};

const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

const session = await login("test-icon@saathban.dev");
const sb = createClient(SUPA, ANON, { global: { headers: { Authorization: `Bearer ${session.access_token}` } } });

const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, permissions: ["microphone"] });
await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [K, JSON.stringify(session)]);
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message.slice(0, 140)));

const home = async () => {
  await p.goto(BASE + "/app/home", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
};

await home();
const rowText = "Say something to your neighbours";
const row = p.getByText(rowText).first();
await row.waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
check("the composer is on Home at all", (await row.count()) > 0);

/* NAVIGATION_SPEC §4 — the composer sits ABOVE the log row. Compared by
   position on the page rather than by reading the source, because the
   whole point of the change was the order a person sees. */
const order = await p.evaluate((label) => {
  const all = [...document.querySelectorAll("body *")];
  const composer = all.find((e) => e.textContent?.trim() === label);
  /* The LOG ROW specifically, found by the greeting that now lives
     inside it — the first attempt matched anything containing
     "Today", which caught a calendar strip ABOVE the composer and
     reported the order backwards. */
  /* The DEEPEST element carrying the greeting. querySelectorAll is in
     document order, so ancestors come first — taking the first match
     found a wrapper starting at y=0 and reported the order backwards. */
  const logs = all.filter((e) => /Good (morning|afternoon|evening)/i.test(e.textContent || ""));
  const log = logs[logs.length - 1];
  if (!composer) return { ok: false, why: "composer not found" };
  if (!log) return { ok: true, why: "no log row on this account to compare against" };
  return {
    ok: composer.getBoundingClientRect().top < log.getBoundingClientRect().top,
    why: `composer@${Math.round(composer.getBoundingClientRect().top)} log@${Math.round(log.getBoundingClientRect().top)}`,
  };
}, rowText);
check("§4 the composer sits above the day's log", order.ok, order.why);

/* ── A post through the NEW path ── */
const MARK = "ZZ seam probe";
await row.click();
await p.waitForTimeout(900);
await p.locator("textarea").first().fill(MARK);
await p.getByRole("button", { name: "Share", exact: true }).first().click();

/* §11 — it lands ON the post, HIGHLIGHTED. The mark is the CLASS
   .sb-fresh; data-fresh holds the post id so useFresh can find the
   node to scroll to. Looking for [data-fresh="true"] matches nothing
   ever — which is also what my own MOTION_CSS was doing, and is how
   that dead rule was found. useFresh clears the mark
   after 2.6 seconds, so this is watched from the moment Share is
   pressed rather than sampled once afterwards: the first version
   looked at 4.5s, by which time a working highlight had already
   finished and "0 marked" meant "too late", not "absent". */
let sawFresh = 0;
for (let i = 0; i < 24; i++) {
  await p.waitForTimeout(250);
  const n = await p.evaluate(() => document.querySelectorAll(".sb-fresh").length).catch(() => 0);
  if (n > sawFresh) sawFresh = n;
  if (sawFresh) break;
}
await p.waitForTimeout(2500);

const after = await p.evaluate(() => document.body.innerText);
check("a post made from Home reaches the feed", after.includes(MARK));
{
  const { data: t } = await sb.from("community_posts").select("id").like("body", MARK + "%");
  for (const r of t || []) created.push(r.id);
}
check("§11 no 'Shared' toast on the way", !/Shared\b/.test(after));
check("§11 the new post is highlighted where it landed", sawFresh > 0, `${sawFresh} marked`);

/* ── §7 through the new path: a voice post with NO words ── */
await home();
await p.getByText(rowText).first().click();
await p.waitForTimeout(900);
const rec = p.getByRole("button", { name: "Say it out loud" }).first();
check("§7 the recorder survived the move", (await rec.count()) > 0);
if (await rec.count()) {
  await rec.click();
  await p.waitForTimeout(3000);
  await p.getByRole("button", { name: "Send", exact: true }).first().click();
  await p.waitForTimeout(1200);
  /* No words at all — the §7 rule that Share must still be live. */
  const shareBtn = p.getByRole("button", { name: "Share", exact: true }).first();
  const disabled = await shareBtn.isDisabled().catch(() => true);
  check("§7 a wordless voice post can still be shared", !disabled);
  if (!disabled) {
    const before = new Date().toISOString();
    await shareBtn.click();
    await p.waitForTimeout(6000);

    /* If the share was refused, the composer stays open holding the
       words and a failure toast is on screen. Read it rather than
       inferring from an absent row — "it did not save" and "it saved
       somewhere I did not look" are different problems. */
    const screen = await p.evaluate(() => document.body.innerText);
    const failed = /did not|could not|try again|Retry/i.test(screen);

    const { data: rows } = await sb
      .from("community_posts")
      .select("id, body, audio_path, created_at")
      .eq("author_id", session.user.id)
      .gt("created_at", before)
      .order("created_at", { ascending: false });
    const newest = (rows || [])[0];
    if (newest?.id) created.push(newest.id);
    check("§7 a wordless voice post is actually created", !!newest,
          failed ? "refused — screen says: " + screen.slice(0, 90).replace(/\n/g, " ") : "no new row and no refusal shown");
    if (newest) {
      check("§7 it saved with a recording and no words", !!newest.audio_path && !(newest.body || "").trim(),
            `audio=${!!newest.audio_path} body="${newest.body}"`);
    }
  }
}

/* ── The OLD path still works, since Feed keeps its own composer ── */
await p.goto(BASE + "/app/community", { waitUntil: "networkidle" });
await p.waitForTimeout(2600);
const stillThere = await p.getByText(rowText).first().count();
check("/app/community keeps its own composer", stillThere > 0);

check("no page errors on either path", errs.length === 0, [...new Set(errs)].slice(0, 2).join(" | "));

/* Clean up ONLY what this test made. The first version removed the
   audio of the three newest posts by this author whatever they were,
   which on a shared test account is somebody else's data — a cleanup
   that can destroy more than it created is worse than none. */
const madeIds = [...new Set(created)];
for (const id of madeIds) {
  const { data: row } = await sb.from("community_posts").select("audio_path").eq("id", id).maybeSingle();
  if (row?.audio_path) await sb.storage.from("post-audio").remove([row.audio_path]);
  await sb.from("community_posts").delete().eq("id", id);
}
await sb.from("community_posts").delete().like("body", MARK + "%");
console.log(fails ? `\n${fails} FAILED` : "\nCOMPOSER SEAM OK — both paths");
await browser.close();
process.exit(fails ? 1 : 0);
