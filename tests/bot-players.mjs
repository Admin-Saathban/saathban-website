/* ════════════════════════════════════════════════
   Every game that CLAIMS a bot player must actually have one.

   Run:  node tests/bot-players.mjs

   Why this exists, and why it is a test rather than a guard:

   Two sibling defects were found hours apart. Ludo declared
   `timeout_style = 'bot_plays'` while its executor raised 'Roll first'
   at every bot — game_tick swallowed the exception, and every table
   with a bot in it froze silently (fixed in 0042d). Carrom declared
   `pass_turn` and had no bot player at all, yet start_with_bots seated
   bots in it anyway, making those tables unfinishable (fixed in 0043).

   Each fix guards a different proxy, and NEITHER catches the other's
   case: 0043's guard would have waved the broken ludo straight
   through, because ludo was declaring the right intent and failing to
   honour it. The property both fixes actually want — "a seat in this
   game can be played by something" — is not knowable from a
   declaration. A runtime predicate cannot ask whether an executor
   works. A test can: it fills a table with bots, ticks it, and demands
   the board actually move.

   So this is the instrument for that class. It runs against the LIVE
   database and needs the DB channel. Add nothing here about a specific
   game; it reads the registry, so a game added next month is covered
   the day it is registered.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";

const PASSWORD = process.env.TEST_PASSWORD || "SaathTest!2026";
const ACCOUNT = process.env.TEST_ACCOUNT || "smoke-icon@saathban.dev";

function envLocal(name) {
  if (process.env[name]) return process.env[name].trim();
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(name));
  return line ? line.slice(line.indexOf("=") + 1).replace(/\s/g, "") : null;
}
const SUPA = envLocal("VITE_SUPABASE_URL");
const ANON = envLocal("VITE_SUPABASE_ANON_KEY");
if (!SUPA || !ANON) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  process.exit(2);
}

let failures = 0;
const check = (name, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(52), String(note).slice(0, 90));
};

const session = await (
  await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: ACCOUNT, password: PASSWORD }),
  })
).json();
if (!session.access_token) {
  console.error(`${ACCOUNT}: login failed`);
  process.exit(2);
}
const H = {
  apikey: ANON,
  Authorization: `Bearer ${session.access_token}`,
  "Content-Type": "application/json",
};
const rpc = async (fn, args) => {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: H,
    body: JSON.stringify(args),
  });
  return { ok: r.ok, body: await r.json().catch(() => null) };
};
const rest = async (path) => (await fetch(`${SUPA}/rest/v1/${path}`, { headers: H })).json();
/* Clean up through the RPC, not a DELETE. game_sessions has exactly ONE
   policy — `sessions: viewers read`, SELECT only — so a DELETE matches
   zero rows and PostgREST answers 204: success-shaped, nothing removed.
   This suite quietly left a live table per game per run on the shared
   smoke account, which then counts against the one-live-table rule and
   shows as somebody's ACTIVE GAME card. leave_game_session handles both
   shapes we create: host-in-lobby routes to cancel_game_session, and on
   an active bot table the only human leaving takes humans to zero, which
   cancels it. Neither shape is lobby or active afterwards. */
const drop = (id) => rpc("leave_game_session", { p_session: id });

// The registry decides what gets tested — not a list maintained here.
const createdHere = [];
const games = await rest("games?select=key,name_en,kind,min_seats,timeout_style&enabled=eq.true");
const turnGames = games.filter((g) => g.kind === "turns");
console.log(`registry: ${turnGames.length} turn-based games\n`);

for (const g of turnGames) {
  const created = await rpc("create_game_session", {
    p_game: g.key,
    p_seats: g.min_seats,
    // A short turn so the tick has something lapsed to act on: game_tick
    // only moves a seat whose clock has run out, so a fresh 60s table
    // would correctly do nothing and look like a broken executor.
    p_house_rules: { turn_seconds: 1 },
  });
  if (!created.ok || !created.body) {
    check(`${g.key}: table created`, false, JSON.stringify(created.body).slice(0, 80));
    continue;
  }
  const id = created.body;
  createdHere.push(id);
  const bots = await rpc("start_with_bots", { p_session: id });

  if (g.timeout_style === "bot_plays") {
    // The claim: a bot can play this. Fill the table and demand a move.
    check(`${g.key}: claims bot_plays, so bots may be seated`, bots.ok, (bots.body?.message || "").slice(0, 70));
    if (bots.ok) {
      await new Promise((r) => setTimeout(r, 1600)); // let the turn lapse
      await rpc("game_tick", { p_session: id });
      const moves = await rest(`game_moves?select=id,by_bot&session_id=eq.${id}`);
      const botMoves = (moves || []).filter((m) => m.by_bot).length;
      // This is the assertion the declaration cannot make for itself.
      check(
        `${g.key}: a bot actually MOVED when ticked`,
        botMoves > 0,
        `${botMoves} bot moves — 0 means the executor cannot play its own bot`
      );
    }
  } else {
    // The claim: no bot player. Then a bot must never be seatable (0043).
    check(`${g.key}: no bot player, so bots are refused`, !bots.ok, bots.ok ? "SEATED — table would be unfinishable" : "refused");
    const seats = await rest(`game_seats?select=is_bot&session_id=eq.${id}`);
    check(`${g.key}: no bot seat left behind`, !(seats || []).some((s) => s.is_bot));
  }
  await drop(id);
}

/* A cleanup that is not verified is not a cleanup. Prove the suite left
   nothing live behind on the account it borrows — the exact failure this
   file shipped with. */
/* Scoped to tables THIS run created: another lane's litter on the
   shared account must not fail our suite, nor mask it. The account-wide
   number is printed as a note — it is also a live proof the query can
   see live tables at all. */
const mine = await rest(
  `game_sessions?select=id,status&created_by=eq.${session.user.id}&status=in.(lobby,active)`
);
const ours = (mine || []).filter((m) => createdHere.includes(m.id));
check(
  "suite leaves no live table behind",
  ours.length === 0,
  `${ours.length} of ours still live` +
    ` (account-wide live: ${(mine || []).length}` +
    `${(mine || []).length ? " — not ours, left for their owner" : ""})`
);

/* ── The invariant, not the route ──────────────────────────────────
   The two checks above exercise start_with_bots, because that is the
   door 0043 closed — and a test written from a fix inherits that
   fix's blind spot. leave_game_session seats a bot too (its active
   branch converts the leaver's seat) and nothing here would ever have
   noticed. So assert the END STATE instead, reached by any route:
   a live table in a game with no bot player must never contain a bot
   seat. This covers doors nobody has thought of yet.

   NOTE: this is expected to FAIL until 0044 lands — seven such tables
   exist right now, created through leave after 0043. That is the
   point: it is a live invariant violation, and it will go green when
   0044 remediates them rather than because anyone edited this file. */
const passTurnGames = games.filter((g) => g.timeout_style === "pass_turn").map((g) => g.key);
if (passTurnGames.length) {
  const live = await rest(
    `game_sessions?select=id,game_key,status,game_seats(is_bot)` +
      `&game_key=in.(${passTurnGames.join(",")})&status=in.(lobby,active)`
  );
  /* UNREADABLE IS NOT CLEAN. Every real session has seats, so an empty
     seat array means RLS hid them, not that none exist — and that is
     exactly what happens here: once this account's own seat is converted
     to a bot it is no longer a participant, so it can no longer read the
     seats of the very table that proves the bug. Counting that as "no
     bots found" is how this check first reported the invariant holding
     while seven violations sat in front of it. Blind rows are reported
     as unverifiable and FAIL the check; they are not passes. */
  const offenders = (live || []).filter((s) => (s.game_seats || []).some((seat) => seat.is_bot));
  const blind = (live || []).filter((s) => (s.game_seats || []).length === 0);
  check(
    "invariant: no live table in a bot-less game holds a bot seat",
    offenders.length === 0 && blind.length === 0,
    offenders.length || blind.length
      ? `${offenders.length} with a bot seat, ${blind.length} unverifiable (seats hidden by RLS — not clean)` +
        `; reachable via leave_game_session until 0044`
      : "none, by any route"
  );
}

/* A run that ends early must not read as a short clean one
   (agreement 11). */
console.log("\nsuite completed — all sections ran");

console.log(`\n${failures} failed.`);
process.exit(failures ? 1 : 0);
