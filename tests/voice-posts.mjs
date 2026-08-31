/* ════════════════════════════════════════════════
   Voice posts, end to end — POSTS_SPEC §7 and the moderation blocker.

   Run: BASE_URL=<url> node tests/voice-posts.mjs

   This records a REAL recording through the composer with a fake
   microphone, shares it, reports it as a second person, and then signs
   in as an admin to check the moderation queue can actually play it.
   That last step is the whole reason voice posts were held back, so it
   is the step that has to be seen rather than reasoned about.
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

/* Ids that already existed, so the sweep at the end deletes only what
   THIS run made. Both conditions — see tests/probes.mjs. */
const probesBefore = await snapshotProbes();
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
const raw = readFileSync("./.env.local", "utf8");
const g = (n) => { const l = raw.split(/\r?\n/).find((x) => x.startsWith(n)); return l.slice(l.indexOf("=") + 1).trim(); };
const SUPA = g("VITE_SUPABASE_URL"), ANON = g("VITE_SUPABASE_ANON_KEY");
const K = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

let fails = 0;
const check = (n, ok, note = "") => { if (!ok) fails++; console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(52), note); };

const login = async (email) => {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "SaathTest!2026" }),
  });
  return r.json();
};

/* A fake microphone, so the recorder has something to record. */
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

async function pageAs(email) {
  const s = await login(email);
  if (!s.access_token) throw new Error("login failed for " + email);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 900 },
    permissions: ["microphone"],
  });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [K, JSON.stringify(s)]);
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message.slice(0, 140)));
  return { ctx, p, session: s };
}

const MARK = "ZZ voice post probe";

/* ── 1. Record and share one, as the Icon ── */
{
  const { ctx, p } = await pageAs("test-icon@saathban.dev");
  await p.goto(BASE + "/app/community", { waitUntil: "networkidle" });
  await p.waitForTimeout(2400);
  await p.getByText("Say something to your neighbours").first().click();
  await p.waitForTimeout(800);

  await p.locator("textarea").first().fill(MARK);
  const rec = p.getByRole("button", { name: "Say it out loud" }).first();
  check("§7 the composer offers a recorder", (await rec.count()) > 0);
  await rec.click();
  await p.waitForTimeout(3200);                       // record ~3 seconds

  const stop = p.getByRole("button", { name: "Send", exact: true }).first();
  check("§7 recording shows a stop control", (await stop.count()) > 0);
  await stop.click();
  await p.waitForTimeout(1200);

  const body = await p.evaluate(() => document.body.innerText);
  check("§7 the recording plays back before sending", /Record it again/.test(body));

  await p.getByRole("button", { name: "Share", exact: true }).first().click();
  await p.waitForTimeout(4000);

  await p.goto(BASE + "/app/community", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  const after = await p.evaluate(() => document.body.innerText);
  check("§7 the voice post is in the feed", after.includes(MARK));
  const players = await p.locator('button[aria-label="Play the voice note"]').count();
  check("§7 it renders as a playable card", players > 0, `${players} player(s)`);
  check("no page errors while recording", p.errs.length === 0, [...new Set(p.errs)].slice(0, 2).join(" | "));
  await p.screenshot({ path: "tests/_shots/voice-post.png", fullPage: true });
  await ctx.close();
}

/* ── 2. What actually landed in the row ── */
const admin = await login("test-admin@saathban.dev");
const sb = createClient(SUPA, ANON, { global: { headers: { Authorization: `Bearer ${admin.access_token}` } } });
const { data: rows } = await sb
  .from("community_posts")
  .select("id, author_id, body, audio_path, audio_seconds")
  .like("body", `${MARK}%`)
  /* Newest first: an earlier run leaves a row with the same words, and
     reading the oldest one made a passing feature look broken. */
  .order("created_at", { ascending: false });
const post = (rows || [])[0];
check("§7 the row carries a recording", !!post?.audio_path, post?.audio_path || "none");
check("§7 one minute maximum is respected", post?.audio_seconds >= 1 && post?.audio_seconds <= 60, `${post?.audio_seconds}s`);

/* ── 3. Report it as somebody else ── */
if (post) {
  const { ctx, p } = await pageAs("test-fam@saathban.dev");
  await p.goto(BASE + "/app/community", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  const card = p.locator(`text=${MARK}`).first();
  if (await card.count()) {
    /* SCOPED TO THIS POST'S CARD, which is the whole point.

       By its exact accessible name, because "More" also matches the app
       bar's own tab and .first() then opened nothing. But the name alone
       was still wrong: EVERY post carries a "More actions" button, so
       .first() opened whichever post the feed happened to put at the
       top. Usually that was this one, so it usually worked — and about
       one run in three another lane's post was newer, the report landed
       on a stranger's post, and the query for THIS post's report found
       nothing. "no report" meant "reported the wrong thing".

       Worse, the check above it still passed: a menu existed, so "the
       post offers its menu" was green while the menu belonged to someone
       else. A check that confirms something happened without confirming
       the right thing happened — which is the shape of every bug found
       tonight. useFresh stamps each card with data-fresh=<post id>, so
       there is a real anchor to scope to; use it. */
    const cardRoot = p.locator(`[data-fresh="${post.id}"]`).first();
    await cardRoot.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    const dots = (await cardRoot.count())
      ? cardRoot.getByRole("button", { name: "More actions" }).first()
      : p.getByRole("button", { name: "More actions" }).first();
    check("the post offers its menu", (await dots.count()) > 0);
    await dots.click();
    await p.waitForTimeout(700);
    const rep = p.getByRole("button", { name: /Report this/ }).first();
    if (await rep.count()) { await rep.click(); await p.waitForTimeout(2500); }
  }
  await ctx.close();
}

const { data: reports } = await sb
  .from("community_reports")
  .select("id, target_kind, target_media_bucket, target_media_path, target_media_kind")
  .eq("target_id", post?.id || "00000000-0000-0000-0000-000000000000");
const rep = (reports || [])[0];
check("the report carries the recording's path", !!rep?.target_media_path, rep ? `${rep.target_media_bucket}/${rep.target_media_kind}` : "no report");

/* ── 4. THE BLOCKER: can a moderator actually hear it? ── */
{
  const { ctx, p } = await pageAs("test-admin@saathban.dev");
  await p.goto(BASE + "/app/admin/moderation", { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  const queue = await p.evaluate(() => document.body.innerText);
  check("the queue names it as a voice recording", /Reported voice recording/.test(queue));
  check("the queue no longer says nothing was captured", !/no excerpt captured/.test(queue));
  const listen = p.getByRole("button", { name: /Listen to it/ }).first();
  check("the moderator is offered a way to listen", (await listen.count()) > 0);
  if (await listen.count()) {
    await listen.click();
    /* WAIT FOR THE SRC, NOT 2.5 SECONDS.

       ReportedMedia signs a storage URL on demand, so the <audio> element
       exists before its source does. A fixed sleep made this fail about
       one run in three whenever signing took longer than the guess — and
       "no signed source" reads identically to a moderator who genuinely
       cannot hear the recording, which is the one thing this whole
       feature exists to guarantee. Waiting for the condition cannot be
       wrong about which of those it found. */
    await p.waitForFunction(() => {
      const a = document.querySelector("audio");
      return !!a && (a.currentSrc || a.src || "").length > 10;
    }, null, { timeout: 20000 }).catch(() => {});
    const playable = await p.evaluate(() => {
      const a = document.querySelector("audio");
      return a ? { present: true, src: (a.currentSrc || a.src || "").slice(0, 60) } : { present: false };
    });
    check("a real audio element with a signed source", playable.present && playable.src.length > 10, playable.src || "");
    await p.screenshot({ path: "tests/_shots/moderation-audio.png" });
  }
  check("no page errors in the queue", p.errs.length === 0, [...new Set(p.errs)].slice(0, 2).join(" | "));
  await ctx.close();
}

await sweepProbes(probesBefore);
console.log(fails ? `\n${fails} FAILED` : "\nVOICE POSTS OK — and a moderator can hear one");
await browser.close();
process.exit(fails ? 1 : 0);
