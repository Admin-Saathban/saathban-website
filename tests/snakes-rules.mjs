/* ════════════════════════════════════════════════
   Snakes & Ladders — rules conformance, one test per rule.

   Run:  node tests/snakes-rules.mjs        (needs the DB channel)

   tests/snakes-board.mjs already checks the MAP: that the drawn board
   and the played board agree, and that the jumps are sane. This file
   checks the RULES — what the engine does with that map when someone
   plays. They are different failures: a correct map played by a wrong
   engine is still a wrong game.

   HOW IT ASSERTS, and why this way. The engine rolls its own dice
   inside game_exec_snakes, so there is no seam to inject a chosen roll
   through, and a client cannot write game_seats.score. Staging a
   position would need privileged access no other suite in tests/ has.
   So instead this plays REAL games to completion with bots and asserts
   every rule over the whole observed trace. That is a stronger test
   than a staged one — it is the actual engine under its actual dice —
   with one hazard: a trace that happens not to contain the
   interesting case would pass vacuously. So each rule that depends on
   observing something ALSO asserts that it was observed, and fails as
   "never exercised" rather than passing on an empty set.

   The rules being asserted are written down in GAMES_CONTRACT.md under
   "Rules of record — Snakes & Ladders". If you change one there,
   this file should fail until you change it here too. That is the
   point of both.
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";

const PASSWORD = process.env.TEST_PASSWORD || "SaathTest!2026";
const ACCOUNT = process.env.TEST_ACCOUNT || "smoke-icon@saathban.dev";
/* Games are DRAWN UNTIL the trace contains every case the rules need,
   not a fixed number of them. Random dice do not guarantee that two
   games contain a six, a jump, a finish and — the rare one — an
   overshoot that can actually distinguish "stays put" from "bounces
   back". A fixed count made this suite flaky: it passed on most runs
   and failed on some with "never exercised", which is a test telling
   you about its own dice rather than about the engine.

   So: play until satisfied, up to a budget. If the budget runs out the
   suite says which case it never saw, which is a real answer either
   way — that case is either vanishingly rare or unreachable, and both
   are worth knowing. */
const MIN_GAMES = Number(process.env.GAMES || 2);
const MAX_GAMES = Number(process.env.MAX_GAMES || 10);

function envLocal(name) {
  if (process.env[name]) return process.env[name].trim();
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(name));
  return line ? line.slice(line.indexOf("=") + 1).replace(/\s/g, "") : null;
}
const SUPA = envLocal("VITE_SUPABASE_URL");
const ANON = envLocal("VITE_SUPABASE_ANON_KEY");

let failures = 0;
const check = (name, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(58), String(note).slice(0, 92));
};

const auth = await (
  await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: ACCOUNT, password: PASSWORD }),
  })
).json();
if (!auth.access_token) {
  console.error(`${ACCOUNT}: login failed`);
  process.exit(2);
}
const H = {
  apikey: ANON,
  Authorization: `Bearer ${auth.access_token}`,
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
/* Cleanup goes through the RPC: game_sessions is SELECT-only under RLS,
   so a DELETE returns 204 and removes nothing. */
const drop = (id) => rpc("leave_game_session", { p_session: id });

/* ── The board, read from the LIVE function, never hardcoded here ──
   snakes-board.mjs proves this function agrees with the drawing; this
   file only needs to know what it says. */
const jump = {};
for (let c = 1; c <= 100; c++) {
  const r = await rpc("snakes_board_jump", { p_cell: c });
  jump[c] = r.body;
}
const sources = Object.keys(jump).map(Number).filter((c) => jump[c] !== c);

/* ── Play real games to completion and keep every move ── */
const trace = [];
let humanMove = null;

/* What the assertions below need to have SEEN to mean anything. */
const satisfied = () => {
  const seen = trace.flatMap((g) => g.moves.map((m) => m.move));
  return {
    "a finished game": trace.some((g) => g.session?.status === "finished"),
    "a six": seen.some((m) => m.roll === 6),
    "a jump": seen.some((m) => !m.stuck && m.via),
    "a declined overshoot": seen.some((m) => m.stuck),
    "an overshoot that tells the finish rules apart":
      seen.some((m) => m.stuck && 200 - m.from - m.roll !== m.from),
  };
};
const missing = () => Object.entries(satisfied()).filter(([, ok]) => !ok).map(([k]) => k);

for (let n = 0; n < MAX_GAMES; n++) {
  if (n >= MIN_GAMES && missing().length === 0) break;
  const created = await rpc("create_game_session", {
    p_game: "snakes",
    p_seats: 2,
    p_house_rules: { turn_seconds: 1 },
  });
  if (!created.ok || !created.body) {
    check("a snakes table could be opened", false, JSON.stringify(created.body).slice(0, 70));
    break;
  }
  const id = created.body;
  await rpc("start_with_bots", { p_session: id });

  /* On the first table, take one turn AS THE PERSON before letting the
     ticker run. Every other move in this trace is a bot's, and a suite
     that only ever exercises the bot path would pass just as happily
     if the human path were broken. The engine ignores p_by_bot, so the
     two should be the same code — but "should be" is the claim under
     test, not the premise. */
  if (n === 0) {
    const seats0 = await rest(`game_seats?select=seat_no,profile_id&session_id=eq.${id}`);
    const mySeat = (seats0 || []).find((x) => x.profile_id === auth.user.id);
    const sess0 = (await rest(`game_sessions?select=current_seat&id=eq.${id}`))[0];
    if (mySeat && sess0?.current_seat === mySeat.seat_no) {
      const played = await rpc("play_turn", { p_session: id, p_payload: null });
      humanMove = { ok: played.ok, move: played.body, seat: mySeat.seat_no };
    } else {
      humanMove = { skipped: `not my turn (seat ${mySeat?.seat_no}, current ${sess0?.current_seat})` };
    }
  }

  let session = null;
  for (let t = 0; t < 90; t++) {
    await new Promise((r) => setTimeout(r, 1100)); // let the 1s turn lapse
    await rpc("game_tick", { p_session: id });
    session = (await rest(`game_sessions?select=status,winner_seat&id=eq.${id}`))[0];
    if (session?.status === "finished") break;
  }
  const moves = await rest(
    `game_moves?select=seat_no,by_bot,move,created_at&session_id=eq.${id}&order=created_at.asc`
  );
  const seats = await rest(`game_seats?select=seat_no,score,is_bot&session_id=eq.${id}`);
  trace.push({ id, session, moves: moves || [], seats: seats || [] });
  await drop(id);
}
const games = trace.filter((g) => g.moves.length);
const rows = games.flatMap((g) => g.moves.map((m) => m.move));
console.log(`\nplayed ${games.length} games, ${rows.length} moves\n`);
check("real games were played", rows.length > 0, `${rows.length} move rows`);
check("every rule below had a case to judge", missing().length === 0,
  missing().length ? `never seen in ${games.length} games: ${missing().join("; ")}` : "");

/* ════ RULE 1 — the finish is EXACT, and an overshoot STAYS PUT ════
   Recorded rule: a roll that would take you past 100 is not played.
   You do not bounce back off 100, and you do not move at all; the move
   is logged as `stuck` with the number you still need. */
{
  const stuck = rows.filter((m) => m.stuck);
  check("rule 1: an overshoot was actually exercised", stuck.length > 0,
    `${stuck.length} stuck moves`);
  check("rule 1: an overshooting roll never moves the piece",
    stuck.every((m) => m.to === m.from && m.landed === m.from && m.score === m.from),
    stuck.find((m) => m.to !== m.from) ? JSON.stringify(stuck.find((m) => m.to !== m.from)) : "");
  /* Bouncing would land you on 100 - (from + roll - 100), i.e.
     200 - from - roll. That is a DIFFERENT square from staying put in
     every case but one: from 99 with a roll of 2, the bounce comes
     back to 99, which is exactly where staying put leaves you. Those
     moves cannot tell the two rules apart, so asserting over them
     reports a failure that says nothing. Judge the rule only on the
     moves that can actually distinguish it. */
  const tells = stuck.filter((m) => 200 - m.from - m.roll !== m.from);
  check("rule 1: it does NOT bounce back off 100",
    tells.length > 0 && tells.every((m) => m.to === m.from),
    tells.length === 0
      ? "never exercised: every overshoot seen was 99+2, where bouncing and staying agree"
      : `${tells.length} distinguishing overshoots`);
  check("rule 1: `need` is the exact number still wanted",
    stuck.every((m) => m.need === 100 - m.from && m.need >= 1 && m.need <= 5),
    stuck.map((m) => `${m.from}+${m.roll} need ${m.need}`).slice(0, 3).join(" | "));
  check("rule 1: only genuine overshoots are refused",
    stuck.every((m) => m.from + m.roll > 100),
    "");
  check("rule 1: nothing ever stands beyond 100",
    rows.every((m) => m.to <= 100 && m.landed <= 100 && m.from <= 100), "");
}

/* ════ RULE 2 — a jump resolves in ONE hop ════
   Landing on a ladder foot or a snake head moves you once. The
   destination is never itself a jump, so one application is the whole
   answer and no chain is being silently truncated. */
{
  check("rule 2: no jump destination is itself a jump square",
    sources.every((s) => jump[jump[s]] === jump[s]),
    sources.filter((s) => jump[jump[s]] !== jump[s]).join(",") || "");
  const jumped = rows.filter((m) => !m.stuck && m.via);
  check("rule 2: a jump was actually exercised", jumped.length > 0, `${jumped.length} jumps`);
  check("rule 2: every played jump matches the board exactly",
    jumped.every((m) => m.to === jump[m.landed]), "");
  check("rule 2: a landed piece is never left ON a jump square",
    rows.filter((m) => !m.stuck).every((m) => jump[m.to] === m.to), "");
  check("rule 2: `via` names the direction honestly",
    jumped.every((m) => (m.via === "ladder" && m.to > m.landed) || (m.via === "snake" && m.to < m.landed)),
    "");
  check("rule 2: a non-jump landing reports no via",
    rows.filter((m) => !m.stuck && !m.via).every((m) => m.to === m.landed), "");
}

/* ════ RULE 3 — squares 1 and 100 carry no jump ════
   You cannot be thrown off the first square, and the last square is
   won by landing on it, never by being carried there or away. */
{
  check("rule 3: square 1 has no jump", jump[1] === 1, `jump(1) = ${jump[1]}`);
  check("rule 3: square 100 has no jump", jump[100] === 100, `jump(100) = ${jump[100]}`);
  check("rule 3: no ladder can carry a piece to 100",
    !sources.some((s) => jump[s] === 100), "a ladder to 100 would bypass the exact finish");
  check("rule 3: no snake can throw a piece off 100",
    !sources.includes(100), "");
  check("rule 3: no play ever jumped from or to those squares",
    rows.filter((m) => !m.stuck).every((m) => !(m.landed === 1 && m.to !== 1) && !(m.landed === 100 && m.to !== 100)),
    "");
}

/* ════ RULE 4 — a six does NOT earn another roll ════
   Deliberate, and different from ludo. The engine returns no `again`,
   so the rails rotate the turn after every roll whatever it showed.
   Asserted structurally: no seat ever moves twice in a row. */
{
  const sixes = rows.filter((m) => m.roll === 6);
  check("rule 4: a six was actually rolled", sixes.length > 0, `${sixes.length} sixes`);
  let doubled = null;
  for (const g of games) {
    for (let i = 1; i < g.moves.length; i++) {
      if (g.moves[i].seat_no === g.moves[i - 1].seat_no) {
        doubled = `${g.id.slice(0, 8)} seat ${g.moves[i].seat_no} moved twice in a row`;
      }
    }
  }
  check("rule 4: no seat ever takes two turns in a row", doubled === null, doubled || "");
  check("rule 4: the engine never returns `again`",
    rows.every((m) => m.again === undefined),
    "an `again` in a move payload would mean the rule had changed");
  const afterSix = [];
  for (const g of games) {
    g.moves.forEach((m, i) => {
      if (m.move.roll === 6 && g.moves[i + 1]) afterSix.push(g.moves[i + 1].seat_no !== m.seat_no);
    });
  }
  check("rule 4: the turn passes after a six like any other roll",
    afterSix.length > 0 && afterSix.every(Boolean), `${afterSix.length} sixes with a following move`);
}

/* ════ RULE 5 — first to 100 ENDS the game; there are no placements ════
   Recorded choice: the table finishes the moment someone lands on 100.
   Nobody plays on for second place. (Deliberate: no leaderboards, and
   a game that keeps going after it is decided asks the person who
   already lost to keep rolling.) */
{
  const done = games.filter((g) => g.session?.status === "finished");
  check("rule 5: a game actually reached its end", done.length > 0,
    `${done.length}/${games.length} finished`);
  check("rule 5: finishing sets a winner seat",
    done.every((g) => g.session.winner_seat != null), "");
  check("rule 5: the winning move is the LAST move",
    done.every((g) => {
      const win = g.moves.findIndex((m) => m.move.to === 100);
      return win >= 0 && win === g.moves.length - 1;
    }),
    "a move after the win would mean placements continue");
  check("rule 5: the winner is the seat that reached 100",
    done.every((g) => g.moves[g.moves.length - 1].seat_no === g.session.winner_seat), "");
  check("rule 5: every other seat is left short of 100",
    done.every((g) => g.seats.filter((s) => s.seat_no !== g.session.winner_seat)
                        .every((s) => s.score < 100)), "");
}

/* ════ RULE 6 — a bot plays legally, and declines what it cannot do ════
   Snakes gives a player no choice, so "legality" here is exactly one
   thing: when the only roll available would overshoot, the bot must
   decline to move and pass the turn — not move anyway, not stall the
   table (the failure ludo had in 0042d). */
{
  const bots = games.flatMap((g) => g.moves.filter((m) => m.by_bot));
  check("rule 6: bots actually played", bots.length > 0, `${bots.length} bot moves`);
  check("rule 6: every roll a bot made is a real die",
    bots.every((m) => Number.isInteger(m.move.roll) && m.move.roll >= 1 && m.move.roll <= 6), "");
  check("rule 6: a bot advances by exactly its roll, then the board",
    bots.filter((m) => !m.move.stuck)
        .every((m) => m.move.landed === m.move.from + m.move.roll && m.move.to === jump[m.move.landed]),
    "");
  const declined = bots.filter((m) => m.move.stuck);
  check("rule 6: a bot met an impossible move", declined.length > 0, `${declined.length} declined`);
  check("rule 6: it declined rather than moving anyway",
    declined.every((m) => m.move.to === m.move.from), "");
  let stalled = null;
  for (const g of games) {
    g.moves.forEach((m, i) => {
      if (m.move.stuck && g.moves[i + 1] && g.moves[i + 1].seat_no === m.seat_no) {
        stalled = `${g.id.slice(0, 8)} seat ${m.seat_no} kept the turn after declining`;
      }
    });
  }
  check("rule 6: declining passes the turn, never stalls the table", stalled === null, stalled || "");
  check("rule 6: a seat's final score matches its last move",
    games.every((g) =>
      g.seats.every((s) => {
        const mine = g.moves.filter((m) => m.seat_no === s.seat_no);
        return mine.length === 0 || mine[mine.length - 1].move.score === s.score;
      })),
    "the log and the board must not disagree");
}

/* ════ RULE 7 — a person plays by exactly the same rules ════
   game_exec_snakes takes p_by_bot and never reads it, so a human turn
   and a bot turn run identical code. Asserted rather than assumed,
   because "the parameter is ignored" is the kind of fact that stops
   being true in a later edit without anyone noticing. */
{
  check("rule 7: a human turn was actually taken",
    !!humanMove && !humanMove.skipped, humanMove?.skipped || "");
  if (humanMove && !humanMove.skipped) {
    const m = humanMove.move;
    check("rule 7: play_turn accepted a person's turn", humanMove.ok, JSON.stringify(m).slice(0, 70));
    check("rule 7: the person's roll is a real die",
      Number.isInteger(m?.roll) && m.roll >= 1 && m.roll <= 6, `roll ${m?.roll}`);
    check("rule 7: the person obeys the board and the exact finish",
      m?.stuck ? m.to === m.from : m?.landed === m.from + m.roll && m.to === jump[m.landed],
      JSON.stringify(m).slice(0, 70));
    const hrow = games[0]?.moves.find((r) => !r.by_bot);
    check("rule 7: it is logged as a person's move, not a bot's",
      !!hrow && hrow.seat_no === humanMove.seat, hrow ? `seat ${hrow.seat_no}` : "no non-bot row");
    check("rule 7: the person gets no extra roll either",
      !hrow || games[0].moves.indexOf(hrow) === games[0].moves.length - 1 ||
        games[0].moves[games[0].moves.indexOf(hrow) + 1].seat_no !== hrow.seat_no,
      "");
  }
}

/* A cleanup that is not verified is not a cleanup — but verify only
   what THIS RUN made.

   The obvious check is "the account has no live tables", and it is
   wrong in both directions on a shared fixture account. Another lane
   running its own suite at the same time fails mine for no reason (it
   did: seven live carrom tables from a concurrent run), and worse, a
   genuine leak of my own would hide inside that same noise. Ask the
   precise question instead: are the tables I created gone? */
const mine = trace.map((g) => g.id);
const left = mine.length
  ? await rest(`game_sessions?select=id,status&id=in.(${mine.join(",")})&status=in.(lobby,active)`)
  : [];
check("suite leaves no live table behind", (left || []).length === 0,
  `${(left || []).length} of ${mine.length} still live`);

console.log(`\n${failures} failed.`);
process.exit(failures ? 1 : 0);
