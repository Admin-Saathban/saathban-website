/* ════════════════════════════════════════════════
   Carrom rules conformance — the rules as IMPLEMENTED, asserted.

   Run:  node tests/carrom-rules.mjs

   Carrom's rules live in two places and both are the engine:

     · src/app/routes/games/carrom/physics.js — resolveShot() decides
       what a shot did: fouls, the queen, the penalty, whether you
       shoot again, and whether that was the winning shot.
     · game_exec_carrom (migration 0024) — the server re-derives the
       score, "again", and the winner from the end state it is handed,
       and rejects a claim to a coin that is not pocketed and yours.

   The server is deliberately a validator, not a simulator: it never
   replays the physics. So a rule can be broken in two distinct ways —
   the client can decide it wrongly, or the client can decide it
   rightly and hand the server something the server refuses. Both are
   covered here: part A drives resolveShot directly (no database), part
   B drives the live RPCs with crafted payloads.

   The rules being asserted are written out in GAMES_CONTRACT.md under
   "Carrom — the rules as implemented". If you change one, change it
   there too; a contract that describes intentions is how ludo came to
   declare a bot player it did not have.

   Part B needs the DB channel (two accounts, one throwaway table per
   case, all left clean).
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import {
  initialLayout,
  resolveShot,
  OWNER_OF,
} from "../src/app/routes/games/carrom/physics.js";

let failures = 0;
const check = (name, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(58), String(note).slice(0, 80));
};

/* ─────────────────────────────────────────────────────────────
   Part A — the rules themselves, driven directly.

   resolveShot() runs a physical simulation, so these cases are built
   by placing the board in the state the rule is about and asking for
   the outcome, rather than by hoping a launch angle produces it.
   ───────────────────────────────────────────────────────────── */

console.log("── Part A · the rules, driven directly ──\n");

/* A board where nothing moves: the striker is launched with no power,
   so the only changes are the ones we stage. */
const still = { angle: 0, power: 0, x: 0.5, y: 0.88 };

/* Build a state from a description: which coins are already pocketed,
   where the queen is, and whether she has been covered. */
function boardWith({ whitePocketed = 0, blackPocketed = 0, queen = "board", queenCovered = false } = {}) {
  const s = initialLayout();
  let w = 0;
  let b = 0;
  s.pieces = s.pieces.map((p) => {
    if (p.owner === "w" && w < whitePocketed) { w++; return { ...p, pocketed: true }; }
    if (p.owner === "b" && b < blackPocketed) { b++; return { ...p, pocketed: true }; }
    if (p.id === "q" && queen === "pocketed") return { ...p, pocketed: true };
    return p;
  });
  s.queenCovered = queenCovered;
  s.queenPocketed = queen === "pocketed";
  return s;
}

/* Drop a named piece into a pocket by placing it on top of one, then
   letting the resolver see it. The corner pocket sits at (0,0). */
function sink(state, ids) {
  const set = new Set(ids);
  return {
    ...state,
    pieces: state.pieces.map((p) => (set.has(p.id) ? { ...p, x: 0.001, y: 0.001 } : p)),
  };
}
const own = (state, colour) => state.pieces.filter((p) => p.owner === colour && !p.pocketed);

/* ── 1. Pocket one of your own, cleanly → you shoot again ── */
{
  const start = boardWith();
  const mine = own(start, "w")[0];
  const r = resolveShot(sink(start, [mine.id]), still, 0);
  check("pocket your own coin → you shoot again", r.continues === true, `continues=${r.continues}`);
  check("…and it is credited as scored", r.outcome.scored.includes(mine.id), r.outcome.scored.join(","));
  check("…and it is not a foul", r.outcome.foul === false);
}

/* ── 2. Pocket nothing → the turn passes ── */
{
  const r = resolveShot(boardWith(), still, 0);
  check("pocket nothing → the turn passes", r.continues === false);
  check("…and nothing is claimed", r.outcome.scored.length === 0);
}

/* ── 3. Pocket an opponent coin → foul, turn passes, it stays down ── */
{
  const start = boardWith();
  const theirs = own(start, "b")[0];
  const r = resolveShot(sink(start, [theirs.id]), still, 0);
  check("pocket an opponent coin → foul", r.outcome.foul === true, r.outcome.foulReason || "");
  check("…the turn passes", r.continues === false);
  const stillDown = r.endState.pieces.find((p) => p.id === theirs.id)?.pocketed;
  check("…and their coin stays down (no return for this foul)", stillDown === true);
}

/* ── 4. Striker in a pocket → foul, and the penalty returns a coin ── */
{
  // One of mine already down, so there is a coin available to return.
  const start = boardWith({ whitePocketed: 1 });
  const r = resolveShot(sink(start, ["striker"]), { ...still, x: 0.001, y: 0.001 }, 0);
  check("striker pocketed → foul", r.outcome.foul === true, r.outcome.foulReason || "");
  check("…the turn passes", r.continues === false);
  const downNow = r.endState.pieces.filter((p) => p.owner === "w" && p.pocketed).length;
  check("…and one of my pocketed coins is returned to the board", downNow === 0, `${downNow} still down`);
}

/* ── 5. Striker foul with NOTHING of mine pocketed → no penalty owed ── */
{
  const start = boardWith();
  const r = resolveShot(sink(start, ["striker"]), { ...still, x: 0.001, y: 0.001 }, 0);
  check("striker foul with nothing of mine down → no coin returns", r.outcome.foul === true);
  const downNow = r.endState.pieces.filter((p) => p.owner === "w" && p.pocketed).length;
  check("…and the board is unchanged for my colour", downNow === 0, `${downNow} down`);
}

/* ── 6. Striker foul in the SAME shot as one of my own ──
   The penalty may never contradict the claim: game_exec_carrom refuses
   any coin claimed as scored that is not pocketed in the end state, so
   returning the very coin being claimed makes a legal shot fail
   outright. Two branches, both asserted. */
{
  // (a) nothing of mine was down before, so this shot's coin is the only
  //     thing available: it goes back AND is not scored.
  const start = boardWith();
  const mine = own(start, "w")[0];
  const r = resolveShot(sink(start, [mine.id]), { ...still, x: 0.999, y: 0.001 }, 0);
  check(
    "striker foul + my only coin: that coin is the one that returns",
    r.endState.pieces.find((p) => p.id === mine.id)?.pocketed === false
  );
  check(
    "…and it is NOT scored (a foul pays its own penalty)",
    r.outcome.scored.length === 0,
    "scored=[" + r.outcome.scored.join(",") + "]"
  );
  check("…still a foul", r.outcome.foul === true, r.outcome.foulReason || "");
  check("…and the turn still passes", r.continues === false);

  // (b) one of mine was already down: THAT one returns, and this shot's
  //     coin stays pocketed and scored — so the claim the server checks
  //     still matches the board it is checked against.
  const start2 = boardWith({ whitePocketed: 1 });
  const already = start2.pieces.find((p) => p.owner === "w" && p.pocketed);
  const fresh = own(start2, "w")[0];
  const r2 = resolveShot(sink(start2, [fresh.id]), { ...still, x: 0.999, y: 0.001 }, 0);
  check(
    "striker foul with an older coin down: the older one returns",
    r2.endState.pieces.find((p) => p.id === already.id)?.pocketed === false
  );
  check(
    "…this shot's coin stays down and scored",
    r2.outcome.scored.includes(fresh.id) &&
      r2.endState.pieces.find((p) => p.id === fresh.id)?.pocketed === true,
    "scored=[" + r2.outcome.scored.join(",") + "]"
  );
  const claimedOk = r2.outcome.scored.every(
    (id) => r2.endState.pieces.find((p) => p.id === id)?.pocketed === true
  );
  check("…so every claimed coin is pocketed — the server will accept it", claimedOk);
}

/* ── 7. Queen, uncovered → she returns to the centre ── */
{
  const start = boardWith();
  const r = resolveShot(sink(start, ["q"]), still, 0);
  const q = r.endState.pieces.find((p) => p.id === "q");
  check("queen pocketed alone → not covered", r.endState.queenCovered === false, r.outcome.queen);
  check("…she returns to the centre", q.pocketed === false && q.x === 0.5 && q.y === 0.5);
  check("…and the turn passes (nothing of mine scored)", r.continues === false);
}

/* ── 8. Queen, covered in the same shot → she stays down ── */
{
  const start = boardWith();
  const mine = own(start, "w")[0];
  const r = resolveShot(sink(start, ["q", mine.id]), still, 0);
  const q = r.endState.pieces.find((p) => p.id === "q");
  check("queen + one of mine in the same shot → covered", r.endState.queenCovered === true, r.outcome.queen);
  check("…and she stays pocketed", q.pocketed === true);
  check("…and I shoot again", r.continues === true);
}

/* ── 9. Last coin with the queen uncovered ──
   The interaction the simplified rules have to answer: you cannot
   win, and (before the fix) you could never cover her either, because
   covering needs one of your own coins and you have none. */
{
  const start = boardWith({ whitePocketed: 5 }); // one white left
  const last = own(start, "w")[0];
  const r = resolveShot(sink(start, [last.id]), still, 0);
  check("last coin down, queen never covered → not a win", r.winner === null, String(r.winner));
  // With no coins left, the queen must still be coverable by someone
  // who has nothing left to cover her with.
  const after = { ...r.endState, pieces: r.endState.pieces };
  const r2 = resolveShot(sink(after, ["q"]), still, 0);
  check(
    "with no coins left, pocketing the queen covers her",
    r2.endState.queenCovered === true,
    `queen=${r2.outcome.queen}`
  );
  check("…and that is the winning shot", r2.winner === 0, String(r2.winner));
}

/* ── 10. The win condition ── */
{
  const start = boardWith({ whitePocketed: 5, queen: "pocketed", queenCovered: true });
  const last = own(start, "w")[0];
  const r = resolveShot(sink(start, [last.id]), still, 0);
  check("all my coins down + queen covered → I win", r.winner === 0, String(r.winner));
  const q = r.endState.pieces.find((p) => p.id === "q");
  check("…the covered queen stays down", q.pocketed === true);
}

/* ── 11. Owner mapping is stable (seat 1 → white, seat 2 → black) ── */
check("seat 0 plays white, seat 1 plays black", OWNER_OF[0] === "w" && OWNER_OF[1] === "b");

/* ─────────────────────────────────────────────────────────────
   Part B — the live engine: what the server does with a payload.
   ───────────────────────────────────────────────────────────── */

if (process.env.PART === "A") {
  console.log("\n[Part B skipped: PART=A — the live half needs the DB channel]");
  console.log("\n" + failures + " failed.");
  process.exit(failures ? 1 : 0);
}

console.log("\n── Part B · the live engine ──\n");

function envLocal(name) {
  if (process.env[name]) return process.env[name].trim();
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(name));
  return line ? line.slice(line.indexOf("=") + 1).replace(/\s/g, "") : null;
}
const SUPA = envLocal("VITE_SUPABASE_URL");
const ANON = envLocal("VITE_SUPABASE_ANON_KEY");
const PASSWORD = process.env.TEST_PASSWORD || "SaathTest!2026";
const HOST_ACCOUNT = process.env.TEST_ACCOUNT || "smoke-icon@saathban.dev";
const GUEST_ACCOUNT = process.env.TEST_ACCOUNT_2 || "smoke-fam@saathban.dev";

if (!SUPA || !ANON) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  process.exit(2);
}

async function signIn(email) {
  const s = await (
    await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  ).json();
  if (!s.access_token) {
    console.error(`${email}: login failed`);
    process.exit(2);
  }
  const H = { apikey: ANON, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" };
  return {
    id: s.user.id,
    rpc: async (fn, args) => {
      const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(args) });
      return { ok: r.ok, body: await r.json().catch(() => null) };
    },
    rest: async (path) => (await fetch(`${SUPA}/rest/v1/${path}`, { headers: H })).json(),
  };
}

const host = await signIn(HOST_ACCOUNT);
const guest = await signIn(GUEST_ACCOUNT);
/* Clean up through the RPC: game_sessions is SELECT-only under RLS, so a
   DELETE answers 204 and removes nothing (tests/bot-players.mjs). */
const drop = (id) => host.rpc("leave_game_session", { p_session: id });
const created = [];

/* A two-human carrom table, ready to play. */
async function table({ turnSeconds = 60 } = {}) {
  const c = await host.rpc("create_game_session", {
    p_game: "carrom",
    p_seats: 2,
    p_house_rules: { turn_seconds: turnSeconds },
  });
  if (!c.ok || !c.body) return null;
  created.push(c.body);
  const joined = await guest.rpc("claim_open_seat", { p_session: c.body });
  if (!joined.ok) return null;
  await host.rpc("carrom_init", { p_session: c.body, p_state: initialLayout() });
  return c.body;
}

/* Whose turn is it, and what does the board look like? */
async function seatNow(id) {
  const [s] = await host.rest(`game_sessions?select=current_seat,status,state&id=eq.${id}`);
  return s;
}
const playerFor = (seatNo) => (seatNo === 1 ? host : guest);

/* Build the payload the client would send for a staged outcome. */
function payloadFrom(state, mover, ids) {
  const r = resolveShot(sink(state, ids), still, mover);
  return { shot: still, outcome: r.outcome, endState: r.endState, resolved: r };
}

/* ── B1. Pocket-and-continue is the server's decision too ── */
{
  const id = await table();
  if (!id) check("B1: table ready", false);
  else {
    const before = await seatNow(id);
    const me = playerFor(before.current_seat);
    const colour = before.current_seat === 1 ? "w" : "b";
    const mover = before.current_seat - 1;
    const mine = before.state.pieces.find((p) => p.owner === colour && !p.pocketed);
    const p = payloadFrom(before.state, mover, [mine.id]);
    const res = await me.rpc("play_turn", { p_session: id, p_payload: p });
    check("B1: a clean pocket is accepted", res.ok, JSON.stringify(res.body).slice(0, 70));
    const after = await seatNow(id);
    check("B1: the server keeps the turn with the scorer", after.current_seat === before.current_seat,
      `seat ${before.current_seat} → ${after.current_seat}`);
    const seats = await host.rest(`game_seats?select=seat_no,score&session_id=eq.${id}`);
    const scored = seats.find((s) => s.seat_no === before.current_seat)?.score;
    check("B1: the score is credited server-side", scored === 1, `score=${scored}`);
    await drop(id);
  }
}

/* ── B2. A foul passes the turn, whatever the client hoped ── */
{
  const id = await table();
  if (!id) check("B2: table ready", false);
  else {
    const before = await seatNow(id);
    const me = playerFor(before.current_seat);
    const mover = before.current_seat - 1;
    const oppColour = before.current_seat === 1 ? "b" : "w";
    const theirs = before.state.pieces.find((p) => p.owner === oppColour && !p.pocketed);
    const p = payloadFrom(before.state, mover, [theirs.id]);
    const res = await me.rpc("play_turn", { p_session: id, p_payload: p });
    check("B2: a fouling shot is accepted as a shot", res.ok, JSON.stringify(res.body).slice(0, 70));
    const after = await seatNow(id);
    check("B2: the turn passes on a foul", after.current_seat !== before.current_seat,
      `seat ${before.current_seat} → ${after.current_seat}`);
    await drop(id);
  }
}

/* ── B3. The server refuses a claim it cannot see on the board ── */
{
  const id = await table();
  if (!id) check("B3: table ready", false);
  else {
    const before = await seatNow(id);
    const me = playerFor(before.current_seat);
    const mover = before.current_seat - 1;
    const colour = before.current_seat === 1 ? "w" : "b";
    const oppColour = colour === "w" ? "b" : "w";
    const mine = before.state.pieces.find((p) => p.owner === colour && !p.pocketed);
    const theirs = before.state.pieces.find((p) => p.owner === oppColour && !p.pocketed);

    // (a) claiming a coin that is not pocketed at all
    const honest = payloadFrom(before.state, mover, [mine.id]);
    const liar = { ...honest, outcome: { ...honest.outcome, scored: [mine.id, theirs.id] } };
    const res = await me.rpc("play_turn", { p_session: id, p_payload: liar });
    check("B3: a claim to a coin that is not pocketed is refused", !res.ok,
      res.ok ? "ACCEPTED" : (res.body?.message || "").slice(0, 50));

    // (b) the control: the same shot, claimed honestly, is accepted —
    //     proof the refusal above is the claim and not the shape.
    const ok = await me.rpc("play_turn", { p_session: id, p_payload: honest });
    check("B3: the same shot claimed honestly is accepted", ok.ok, JSON.stringify(ok.body).slice(0, 60));
    await drop(id);
  }
}

/* ── B4. The winning shot ends the game, server-side ── */
{
  const id = await table();
  if (!id) check("B4: table ready", false);
  else {
    const before = await seatNow(id);
    const me = playerFor(before.current_seat);
    const colour = before.current_seat === 1 ? "w" : "b";
    // Stage the end: everything of mine down but one, queen covered.
    const staged = {
      ...before.state,
      queenCovered: true,
      queenPocketed: true,
      pieces: before.state.pieces.map((p, i) => {
        if (p.id === "q") return { ...p, pocketed: true };
        if (p.owner === colour) return { ...p, pocketed: i !== 1 }; // leave one up
        return p;
      }),
    };
    const last = staged.pieces.find((p) => p.owner === colour && !p.pocketed);
    const endState = {
      ...staged,
      pieces: staged.pieces.map((p) => (p.id === last.id ? { ...p, pocketed: true } : p)),
    };
    const res = await me.rpc("play_turn", {
      p_session: id,
      p_payload: {
        shot: still,
        outcome: { scored: [last.id], foul: false, queen: "none", foulReason: null },
        endState,
      },
    });
    check("B4: the winning shot is accepted", res.ok, JSON.stringify(res.body).slice(0, 70));
    const after = await seatNow(id);
    check("B4: the session is finished", after.status === "finished", after.status);
    await drop(id);
  }
}

/* ── B5. A lapsed turn is a MISSED turn — never a bot shot ── */
{
  const id = await table({ turnSeconds: 1 });
  if (!id) check("B5: table ready", false);
  else {
    const before = await seatNow(id);
    await new Promise((r) => setTimeout(r, 1800));
    const ticked = await host.rpc("game_tick", { p_session: id });
    check("B5: the tick is accepted", ticked.ok, JSON.stringify(ticked.body).slice(0, 60));
    const after = await seatNow(id);
    check("B5: a lapsed turn passes to the other player", after.current_seat !== before.current_seat,
      `seat ${before.current_seat} → ${after.current_seat}`);
    const moves = await host.rest(`game_moves?select=id,by_bot&session_id=eq.${id}`);
    const botMoves = (moves || []).filter((m) => m.by_bot).length;
    check("B5: no bot shot was played", botMoves === 0, `${botMoves} bot moves`);
    check("B5: the table is still live, not finished", after.status === "active", after.status);
    await drop(id);
  }
}

/* ── B6. And a bot can never be seated here at all (0043) ── */
{
  const c = await host.rpc("create_game_session", { p_game: "carrom", p_seats: 2, p_house_rules: { turn_seconds: 60 } });
  if (!c.ok || !c.body) check("B6: table created", false);
  else {
    created.push(c.body);
    const bots = await host.rpc("start_with_bots", { p_session: c.body });
    check("B6: carrom refuses to seat a bot", !bots.ok, bots.ok ? "SEATED — table would be unfinishable" : (bots.body?.message || "refused").slice(0, 50));
    const seats = await host.rest(`game_seats?select=is_bot&session_id=eq.${c.body}`);
    check("B6: no bot seat left behind", !(seats || []).some((s) => s.is_bot));
    await drop(c.body);
  }
}

/* ── The suite cleans up after itself, and proves it ── */
const live = await host.rest(
  `game_sessions?select=id,status&created_by=eq.${host.id}&status=in.(lobby,active)`
);
check("suite leaves no live table behind", (live || []).length === 0,
  `${(live || []).length} live: ${(live || []).map((m) => m.id.slice(0, 8)).join(", ")}`);

console.log(`\n${failures} failed.`);
process.exit(failures ? 1 : 0);
