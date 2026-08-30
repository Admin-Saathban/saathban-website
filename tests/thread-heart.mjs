import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(/\/$/, "");
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
