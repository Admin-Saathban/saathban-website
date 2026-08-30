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

/* Ids that already existed, so the sweep at the end deletes only what
   THIS run made. Both conditions — see tests/probes.mjs. */
const probesBefore = await snapshotProbes();
const raw = readFileSync("./.env.local", "utf8");
const g = (n) => { const l = raw.split(/\r?\n/).find(x=>x.startsWith(n)); return l.slice(l.indexOf("=")+1).trim(); };
const SUPA=g("VITE_SUPABASE_URL"), ANON=g("VITE_SUPABASE_ANON_KEY");
const K=`sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;
const login = async (email) => {
  const r=await fetch(`${SUPA}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:ANON,"Content-Type":"application/json"},body:JSON.stringify({email,password:"SaathTest!2026"})});
  return r.json();
};
const b=await chromium.launch({channel:"msedge",headless:true});
let fails=0; const check=(n,ok,note="")=>{if(!ok)fails++;console.log((ok?"PASS":"FAIL").padEnd(5),n.padEnd(52),note);};

async function as(email) {
  const s = await login(email);
  const ctx=await b.newContext({viewport:{width:390,height:900}});
  await ctx.addInitScript(([k,v])=>localStorage.setItem(k,v),[K,JSON.stringify(s)]);
  const p=await ctx.newPage();
  await p.goto(BASE+"/app/community",{waitUntil:"networkidle"}); await p.waitForTimeout(2600);
  return { ctx, p };
}

/* THE FIXTURE THIS SUITE USED TO BORROW.

   It created nothing and asserted straight against the feed, so it was
   passing on a "ZZ help" row that tests/post-types.mjs had left behind
   on a shared account. Three suites had no cleanup, the debris built up
   to twenty-two posts, and this one quietly depended on it — the moment
   the account was swept clean, three checks failed. It had never tested
   a help post it made; it tested whatever happened to still be there.

   A test that passes because of another test's litter is not passing.
   It makes its own ask now, and sweepProbes removes it at the end. */
const icon = await login("test-icon@saathban.dev");
const iconSb = createClient(SUPA, ANON, { global: { headers: { Authorization: `Bearer ${icon.access_token}` } } });
async function makeHelpPost() {
  const { data, error } = await iconSb.from("community_posts").insert({
    author_id: icon.user.id,
    body: "ZZ help — I cannot manage the ladder any more",
    post_type: "text",
    visibility: "public",
    style_tag: "help",
    help_wanted: 1,
  }).select("id").single();
  if (error) { console.error("could not create the help fixture:", error.message); process.exit(1); }
  return data.id;
}
const helpId = await makeHelpPost();
check("the help fixture exists", !!helpId, helpId);

// The author sees "This is sorted" on their own ask (§6 — you do not offer to yourself)
{
  const { ctx, p } = await as("test-icon@saathban.dev");
  const t = await p.evaluate(()=>document.body.innerText);
  check("author of a help post sees the done control", /This is sorted/.test(t), "§6.2");
  check("author is NOT offered 'I can help' on their own", !/I can help/.test(t));
  await ctx.close();
}

// A neighbour sees the offer button, and offering flips it to "coming"
{
  const { ctx, p } = await as("test-fam@saathban.dev");
  let t = await p.evaluate(()=>document.body.innerText);
  check("a neighbour sees 'I can help'", /I can help/.test(t), "§6.1 Asked");
  await p.screenshot({ path: "tests/_shots/help-asked.png", fullPage: true });
  const btn = p.getByRole("button", { name: "I can help", exact: true }).first();
  if (await btn.count()) {
    await btn.click(); await p.waitForTimeout(2600);
    t = await p.evaluate(()=>document.body.innerText);
    check("offering says who is coming", /is coming|You said you would come/.test(t), "§6.1 Someone's coming");
    await p.screenshot({ path: "tests/_shots/help-coming.png", fullPage: true });
    // put it back
    const undo = p.getByRole("button", { name: /change your mind/i }).first();
    if (await undo.count()) { await undo.click(); await p.waitForTimeout(2000); }
  } else { check("offer button clickable", false, "not found"); }
  await ctx.close();
}
await sweepProbes(probesBefore);
console.log(fails?`\n${fails} FAILED`:"\nHELP POST OK");
await b.close();
process.exit(fails?1:0);
