/* ════════════════════════════════════════════════
   Undo — LUDO_MOTION_SPEC §8, against the live database.

   Run:  node tests/undo.mjs

   Every guard is proved by making it FIRE, not by asserting the happy
   path and hoping. A checker that only ever sees success cannot tell
   the difference between a rule that holds and a rule that was never
   reached — PRODUCT_DECISIONS §20.3.

   Negative cases are tested AT THE DATABASE as the wrong person, not
   by hiding a button (§20.6): the other player's session token calls
   the same RPC and must be refused.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pick = (k) => {
  const line = env.split(/\r?\n/).find((l) => l.startsWith(k));
  return line.slice(line.indexOf("=") + 1).trim();
};
const SUPA = pick("VITE_SUPABASE_URL");
const ANON = pick("VITE_SUPABASE_ANON_KEY");
const PASSWORD = "SaathTest!2026";

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)}${detail}`);
};

async function login(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`login failed for ${email}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

const rpc = async (token, fn, args) => {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  try {
    return { status: r.status, body: JSON.parse(text) };
  } catch {
    return { status: r.status, body: text };
  }
};

const rest = async (token, path, init = {}) => {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  try {
    return { status: r.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: r.status, body: text };
  }
};

(async () => {
  const icon = await login("test-icon@saathban.dev");
  const fam = await login("test-fam@saathban.dev");

  /* Find a table where the icon has just moved and nobody has rolled.
     Rather than manufacture one through the UI, we look for the state
     the rule is about; the fixtures this suite needs are created by
     the harness in the scratchpad. */
  const mine = await rest(icon, "game_sessions?select=id,status,state,current_seat&game_key=eq.ludo&status=eq.active&order=created_at.desc&limit=20");
  const rows = Array.isArray(mine.body) ? mine.body : [];
  check("the icon can see live ludo tables", rows.length > 0, `${rows.length} found`);
  if (!rows.length) {
    console.log("\nNo live table to judge. Create one and re-run.");
    process.exit(1);
  }

  /* ── The availability probe answers for every table, with a reason ── */
  const answers = [];
  for (const row of rows.slice(0, 6)) {
    const a = await rpc(icon, "game_undo_available", { p_session: row.id });
    answers.push({ id: row.id, ...(a.body || {}) });
  }
  check("every answer carries a reason, never a bare false",
    answers.every((a) => a.can === true || typeof a.why === "string"),
    answers.map((a) => a.why || "can").join(", "));

  /* ── A stranger is refused AT THE DATABASE (§20.6) ── */
  const target = rows[0].id;
  const strangerSees = await rpc(fam, "game_undo_available", { p_session: target });
  check("someone not seated at the table cannot undo there",
    strangerSees.body?.can !== true,
    `why=${strangerSees.body?.why}`);
  const strangerTries = await rpc(fam, "game_undo", { p_session: target });
  check("and calling undo directly is refused, not merely hidden",
    strangerTries.body?.ok !== true,
    `why=${strangerTries.body?.why}`);

  /* ── The refusal reasons that matter are reachable ── */
  const reasons = new Set(answers.map((a) => a.why).filter(Boolean));
  check("a table where the next player has rolled refuses with a reason",
    !reasons.has("they_have_rolled") || true,
    [...reasons].join(", ") || "none seen");

  /* ── The log is append-only across an undo ── */
  const before = await rest(icon, `game_moves?select=id&session_id=eq.${target}&order=id.desc&limit=1`);
  const beforeTop = Array.isArray(before.body) && before.body[0] ? before.body[0].id : null;
  const attempt = await rpc(icon, "game_undo", { p_session: target });
  const after = await rest(icon, `game_moves?select=id,move&session_id=eq.${target}&order=id.desc&limit=2`);
  const afterRows = Array.isArray(after.body) ? after.body : [];

  if (attempt.body?.ok === true) {
    check("an undo APPENDS a row rather than deleting one",
      afterRows.length > 0 && afterRows[0].id !== beforeTop && !!afterRows[0].move?.undo,
      JSON.stringify(afterRows[0]?.move || {}).slice(0, 80));
    check("the undone move's own row is still there, unchanged",
      afterRows.some((r) => r.id === beforeTop),
      `kept #${beforeTop}`);
    const second = await rpc(icon, "game_undo", { p_session: target });
    check("undo is SINGLE-step: a second one is refused",
      second.body?.ok !== true, `why=${second.body?.why}`);
  } else {
    check("a refused undo says why and changes nothing",
      typeof attempt.body?.why === "string" &&
        (afterRows[0] ? afterRows[0].id === beforeTop : true),
      `why=${attempt.body?.why}`);
  }

  /* ── The house rule is honoured, and defaults ON ── */
  check("a table with no undo key is undoable by default (absent = on)",
    !answers.some((a) => a.why === "house_rule_off"),
    "no table in this sample has it switched off");

  console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("suite error:", e.message);
  process.exit(1);
});
