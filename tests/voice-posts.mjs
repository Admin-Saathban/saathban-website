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

const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(/\/$/, "");
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
    /* By its exact accessible name: "More" also matches the app bar's
       own tab, and .first() then opened nothing. */
    const dots = p.getByRole("button", { name: "More actions" }).first();
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
    await p.waitForTimeout(2500);
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

console.log(fails ? `\n${fails} FAILED` : "\nVOICE POSTS OK — and a moderator can hear one");
await browser.close();
process.exit(fails ? 1 : 0);
