import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
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
const raw = readFileSync("./.env.local", "utf8");
const g = (n) => { const l = raw.split(/\r?\n/).find(x=>x.startsWith(n)); return l.slice(l.indexOf("=")+1).trim(); };
const SUPA=g("VITE_SUPABASE_URL"), ANON=g("VITE_SUPABASE_ANON_KEY");
const K=`sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;
const r=await fetch(`${SUPA}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:ANON,"Content-Type":"application/json"},body:JSON.stringify({email:"test-icon@saathban.dev",password:"SaathTest!2026"})});
const s=await r.json();
const b=await chromium.launch({channel:"msedge",headless:true});
const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.addInitScript(([k,v])=>localStorage.setItem(k,v),[K,JSON.stringify(s)]);
const p=await ctx.newPage(); const errs=[];
p.on("pageerror",e=>errs.push(e.message.slice(0,140)));
await p.goto(BASE+"/app/people/83df705b-914a-46de-81a7-4b511fc3b1a2/chat",{waitUntil:"networkidle"});
await p.waitForTimeout(2600);
const hearts = await p.locator('button[aria-label="Like this message"], button[aria-label="Remove your like"]').count();
console.log("heart buttons in the thread:", hearts);
if (hearts > 0) {
  const first = p.locator('button[aria-label="Like this message"]').first();
  const before = await first.getAttribute("aria-pressed");
  await first.click(); await p.waitForTimeout(1400);
  const after = await p.locator('button[aria-label="Remove your like"]').count();
  console.log("aria-pressed before:", before, "| hearts now showing as given:", after);
  // put it back so the thread is left as found
  if (after > 0) { await p.locator('button[aria-label="Remove your like"]').first().click(); await p.waitForTimeout(1200); }
  const restored = await p.locator('button[aria-label="Remove your like"]').count();
  console.log("after tapping again (should be 0):", restored);
}
console.log("page errors:", errs.length ? [...new Set(errs)].join(" | ") : "none");
await p.screenshot({ path: "tests/_shots/thread-heart.png" });
await b.close();
