/* ════════════════════════════════════════════════
   The Messages world arrives from the edge that was touched — §1.

   The navigation lane fixed arrivalClass's stateless fallback and
   verified it on the four screens they own. Messages is the fifth
   consumer and it is mine, so it gets checked here rather than assumed
   from their run.

   THE CASE THAT WAS BROKEN is a landing with NO location state — a
   pasted URL or a refresh. Before the fix that returned a bare
   sb-full-right, so in Urdu the world flew in from the edge nobody had
   touched. Both scripts are checked, because the whole bug was that
   one of them looked right.

   Reading the CLASS, not the animation: the class is the decision, and
   asserting on a computed animation-name would pass just as well with
   the wrong class if both keyframes existed.

   Run: BASE_URL=<deployed|http://localhost:PORT> node tests/messages-arrival.mjs
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

/* NO DEFAULT PORT, ON PURPOSE. This started as
   `process.env.BASE_URL || "http://localhost:4173"` and spent a run
   testing ANOTHER LANE`S BUILD: every lane works in this same
   directory, 4173 was already taken, and `vite preview` quietly walked
   up to 4178 while the test kept talking to whatever sat on 4173. That
   server answered 200 to everything, so nothing looked wrong — the Urdu
   assertions just failed against a stale build and read exactly like a
   broken feature.

   Same shape as the other three this evening: an absent thing (my server
   on the port I assumed) read as a legitimate one (a server answering
   200). A default that silently points somewhere plausible is worse than
   no default. */
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
const g = (n) => { const l = raw.split(/\r?\n/).find((x) => x.startsWith(n)); return l.slice(l.indexOf("=") + 1).trim(); };
const SUPA = g("VITE_SUPABASE_URL"), ANON = g("VITE_SUPABASE_ANON_KEY");
const K = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;

let fails = 0;
const check = (n, ok, note = "") => { if (!ok) fails++; console.log((ok ? "PASS" : "FAIL").padEnd(5), n.padEnd(56), note); };

const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "test-icon@saathban.dev", password: "SaathTest!2026" }),
});
const session = await r.json();

const browser = await chromium.launch({ channel: "msedge", headless: true });

/* The world container is found by its own marker, not by nth-child:
   MessagesWorld sets data-world="messages" on the element that wears
   the arrival class. */
const arrivalOf = async (lang) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.addInitScript(([k, v, l]) => {
    localStorage.setItem(k, v);
    localStorage.setItem("saathban.app.lang", l);
  }, [K, JSON.stringify(session), lang]);
  const p = await ctx.newPage();
  /* Landed on DIRECTLY. goto is a fresh document load, so history state
     is null — which is the stateless case the fix is about. */
  await p.goto(BASE + "/app/community/messages", { waitUntil: "networkidle" });
  await p.waitForSelector('[data-world="messages"]', { timeout: 20000 }).catch(() => {});
  const out = await p.evaluate(() => {
    const el = document.querySelector('[data-world="messages"]');
    const wrap = document.querySelector("[dir]");
    return {
      cls: el ? el.className : "(world not found)",
      dir: wrap ? wrap.getAttribute("dir") : "(no [dir])",
      state: history.state?.usr ? JSON.stringify(history.state.usr) : "null",
    };
  });
  await ctx.close();
  return out;
};

const en = await arrivalOf("en");
const ur = await arrivalOf("ur");

check("en: the world renders at all", en.cls !== "(world not found)", en.cls);
check("en: page direction is ltr", en.dir === "ltr", `dir=${en.dir}`);
check("en: no location state on a pasted URL", en.state === "null", `state=${en.state}`);
check("en: arrives from the right", /\bsb-full-right\b/.test(en.cls), en.cls);

check("ur: the world renders at all", ur.cls !== "(world not found)", ur.cls);
check("ur: page direction is rtl", ur.dir === "rtl", `dir=${ur.dir}`);
check("ur: no location state on a pasted URL", ur.state === "null", `state=${ur.state}`);
/* THE REGRESSION. Before the helper fix this was sb-full-right too. */
check("ur: arrives from the LEFT, mirrored", /\bsb-full-left\b/.test(ur.cls), ur.cls);

check("the two scripts do not agree", en.cls !== ur.cls, `${en.cls} vs ${ur.cls}`);

console.log(fails ? `\n${fails} FAILED` : "\nMESSAGES ARRIVAL OK — both scripts, stateless landing");
await browser.close();
process.exit(fails ? 1 : 0);
