import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(/\/$/, "");
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
console.log(fails?`\n${fails} FAILED`:"\nHELP POST OK");
await b.close();
process.exit(fails?1:0);
