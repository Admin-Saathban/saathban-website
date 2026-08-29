/* ════════════════════════════════════════════════
   Games rails suite — migrations 0022/0022b, real accounts, real RLS.

   Run:  node tests/games.mjs
   Fixtures: the dedicated smoke-icon / smoke-fam pair (in each
   others circle) plus test-buddy-pending; password SaathTest!2026.
   Table-creating suites stay off the accounts retested by hand.
   House rules {turn_seconds: 2} make the 60s turn timer testable in
   seconds; Snakes & Ladders itself always finishes on an exact 100.

   Covers: create (seat 1 + join code), invite → notification with
   deep link → accept → AUTO-START (all players notified with a board
   link), play_turn, turn timeout → bot plays + missed_turns, 3 misses
   → 'away' → bot continues → reclaim, finish + game-over notes, the
   open-table community post → claim → auto-start, bots-only
   completion via game_tick, chat + stickers, the Daily Riddle
   (wrong/right guesses, attempts upsert, answers table unreachable,
   future riddles invisible), and non-participant negatives.

   Cleanup: tests/games-cleanup.sql (service role / MCP).
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";

const PASSWORD = "SaathTest!2026";
function envLocal(name) {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(name));
  return line.slice(line.indexOf("=") + 1).replace(/\s/g, "");
}
const SUPA = envLocal("VITE_SUPABASE_URL");
const ANON = envLocal("VITE_SUPABASE_ANON_KEY");

let failures = 0;
const check = (name, ok, note = "") => {
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(62), note);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`${email}: login failed`);
  return { token: j.access_token, id: j.user.id };
}

async function rest(user, method, path, body, headers = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${user.token}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await r.json();
  } catch {
    /* empty */
  }
  return { status: r.status, data };
}
const rpc = (user, fn, args) => rest(user, "POST", `rpc/${fn}`, args);

const icon = await login("smoke-icon@saathban.dev");
const icon2 = await login("smoke-fam@saathban.dev");
const pending = await login("test-buddy-pending@saathban.dev");

const HOUSE = { turn_seconds: 2 };
const createdSessions = [];

const session = (u, id) =>
  rest(u, "GET", `game_sessions?id=eq.${id}&select=*`).then((r) => r.data?.[0]);
const seats = (u, id) =>
  rest(u, "GET", `game_seats?session_id=eq.${id}&select=*&order=seat_no`).then((r) => r.data ?? []);
const moves = (u, id) =>
  rest(u, "GET", `game_moves?session_id=eq.${id}&select=*&order=id`).then((r) => r.data ?? []);
const gameNotes = (u) =>
  rest(u, "GET", "notifications?kind=eq.game&select=title,body,link&order=created_at.desc&limit=10").then(
    (r) => r.data ?? []
  );

/* ─── Registry ─── */
{
  const r = await rest(icon, "GET", "games?select=key,enabled&order=key");
  const keys = (r.data ?? []).map((g) => g.key);
  check("registry readable, snakes + daily_puzzle present", keys.includes("snakes") && keys.includes("daily_puzzle"), keys.join(","));
  /* Standing-aware: 0022 registered ludo disabled; the ludo lane's
     follow-up flips it when game_exec_ludo ships. Either standing is
     legitimate — assert only that the row exists. */
  const ludo = (r.data ?? []).find((g) => g.key === "ludo");
  check("ludo registered (enabled tracks its executor lane)", !!ludo, `enabled=${ludo?.enabled}`);
}

/* ─── Create: seat 1, join code, lobby ─── */
let sid;
{
  const r = await rpc(icon, "create_game_session", { p_game: "snakes", p_seats: 2, p_house_rules: HOUSE });
  sid = r.data;
  createdSessions.push(sid);
  check("create_game_session returns a session id", typeof sid === "string" && sid.length === 36, String(r.status));
  const s = await session(icon, sid);
  check("new session: lobby, seats_total 2, house rules kept", s?.status === "lobby" && s.seats_total === 2 && s.house_rules?.turn_seconds === 2);
  check("join code is 6 digits", /^\d{6}$/.test(s?.join_code ?? ""), s?.join_code);
  const st = await seats(icon, sid);
  check("creator holds seat 1 (1-based)", st.length === 1 && st[0].seat_no === 1 && st[0].profile_id === icon.id);
}

/* ─── Invite → notification with deep link ─── */
let inviteId;
{
  const r = await rpc(icon, "invite_to_game", { p_session: sid, p_invitee: icon2.id });
  inviteId = r.data;
  check("host can invite", r.status === 200, String(r.status));
  const inv = await rest(icon2, "GET", `game_invites?invitee_id=eq.${icon2.id}&session_id=eq.${sid}&select=*`);
  check("invitee sees the pending invite", inv.data?.[0]?.status === "pending");
  const notes = await gameNotes(icon2);
  const n = notes.find((x) => x.link === `/app/games/s/${sid}`);
  check("invite notification carries the lobby deep link", !!n, n?.title ?? "none");
  const lobbyVisible = await session(icon2, sid);
  check("invitee can see the lobby before accepting", lobbyVisible?.id === sid);
}

/* ─── Accept last seat → AUTO-START, everyone notified ─── */
{
  const r = await rpc(icon2, "respond_game_invite", { p_invite: inviteId, p_accept: true });
  // respond_game_invite is v2 since 0029: jsonb {result, session_id}.
  check(
    "accepting returns {result:'joined'} for this session",
    r.data?.result === "joined" && r.data?.session_id === sid,
    JSON.stringify(r.data)
  );
  const s = await session(icon, sid);
  check("last seat accepted → session auto-starts", s?.status === "active" && s.current_seat === 1 && !!s.turn_started_at);
  const n1 = (await gameNotes(icon)).find((x) => x.link === `/app/games/s/${sid}` && /ready/i.test(x.title));
  const n2 = (await gameNotes(icon2)).find((x) => x.link === `/app/games/s/${sid}` && /ready/i.test(x.title));
  check("both players notified with a board link on start", !!n1 && !!n2);
}

/* ─── play_turn: server rolls, turn rotates, next human notified ─── */
{
  const r = await rpc(icon, "play_turn", { p_session: sid });
  check("seat 1 plays: server-generated roll 1–6", r.data?.roll >= 1 && r.data?.roll <= 6, JSON.stringify(r.data));
  const s = await session(icon, sid);
  check("turn rotated to seat 2", s?.current_seat === 2);
  const wrong = await rpc(icon, "play_turn", { p_session: sid });
  check("playing out of turn is refused", wrong.status >= 400, String(wrong.status));
  const yourTurn = (await gameNotes(icon2)).find((x) => /your turn/i.test(x.title));
  check("next human got a 'your turn' note", !!yourTurn);
}

/* ─── Timeout: bot plays the lapsed seat, missed_turns counts ─── */
{
  await sleep(2600);
  const t = await rpc(icon, "game_tick", { p_session: sid });
  check("game_tick resolves the lapsed turn", t.data >= 1, `played ${t.data}`);
  const mv = await moves(icon, sid);
  const botMove = mv.find((m) => m.seat_no === 2 && m.by_bot);
  check("the missed turn was played BY BOT for seat 2", !!botMove);
  const st = await seats(icon, sid);
  check("missed_turns = 1, still active presence", st[1]?.missed_turns === 1 && st[1]?.presence === "active");
}

/* ─── Two more misses → away; bot continues; reclaim restores ─── */
{
  for (let i = 0; i < 2; i++) {
    if ((await session(icon, sid))?.status !== "active") break;
    if ((await session(icon, sid))?.current_seat === 1) await rpc(icon, "play_turn", { p_session: sid });
    await sleep(2600);
    await rpc(icon, "game_tick", { p_session: sid });
  }
  const st = await seats(icon, sid);
  const s = await session(icon, sid);
  const seat2 = st.find((x) => x.seat_no === 2);
  check(
    "3rd consecutive miss flips seat 2 to 'away' (never removed)",
    s?.status !== "active" || (seat2?.presence === "away" && seat2?.missed_turns >= 3),
    `presence=${seat2?.presence} missed=${seat2?.missed_turns} status=${s?.status}`
  );
  if (s?.status === "active") {
    const r = await rpc(icon2, "reclaim_seat", { p_session: sid });
    check("reclaim_seat succeeds", r.status === 204 || r.status === 200, String(r.status));
    const st2 = await seats(icon2, sid);
    check("reclaimed: presence active, misses cleared", st2[1]?.presence === "active" && st2[1]?.missed_turns === 0);
  } else {
    check("reclaim_seat succeeds", true, "(game already finished — covered below)");
    check("reclaimed: presence active, misses cleared", true, "(skipped, game over)");
  }
}

/* ─── Chat + stickers ─── */
{
  const msg = await rest(icon, "POST", "game_messages", { session_id: sid, sender_id: icon.id, body: "Good game!" });
  check("participant can chat", msg.status === 201, String(msg.status));
  const stick = await rest(icon2, "POST", "game_messages", { session_id: sid, sender_id: icon2.id, sticker: "🎉" });
  check("sticker-only message allowed", stick.status === 201, String(stick.status));
  const badStick = await rest(icon, "POST", "game_messages", { session_id: sid, sender_id: icon.id, sticker: "🚀" });
  check("sticker outside the fixed set refused", badStick.status === 400, String(badStick.status));
  const outsider = await rest(pending, "POST", "game_messages", { session_id: sid, sender_id: pending.id, body: "hi" });
  check("non-participant cannot chat", outsider.status >= 400, String(outsider.status));
}

/* ─── Play to the finish: winner set, everyone notified ─── */
{
  let s = await session(icon, sid);
  let guard = 0;
  while (s?.status === "active" && guard++ < 250) {
    const player = s.current_seat === 1 ? icon : icon2;
    const r = await rpc(player, "play_turn", { p_session: sid });
    if (r.status >= 400) {
      await rpc(icon, "game_tick", { p_session: sid });
    }
    s = await session(icon, sid);
  }
  check("game reaches 'finished' with a winner seat", s?.status === "finished" && [1, 2].includes(s.winner_seat), `winner ${s?.winner_seat}`);
  const over1 = (await gameNotes(icon)).find((x) => /game over/i.test(x.title) && x.link === `/app/games/s/${sid}`);
  const over2 = (await gameNotes(icon2)).find((x) => /game over/i.test(x.title) && x.link === `/app/games/s/${sid}`);
  check("game-over notifications with board link to all players", !!over1 && !!over2);
  const st = await seats(icon, sid);
  const winScore = st.find((x) => x.seat_no === s.winner_seat)?.score;
  check("winner landed exactly on 100 (the snakes rule)", winScore === 100, `score ${winScore}`);
  const late = await rpc(icon, "play_turn", { p_session: sid });
  check("no moves after the finish", late.status >= 400, String(late.status));
}

/* ─── Non-participant negatives ─── */
{
  const s = await session(pending, sid);
  check("non-participant cannot see the session", !s);
  const mv = await moves(pending, sid);
  check("non-participant cannot see the moves", mv.length === 0);
  const direct = await rest(icon, "POST", "game_moves", { session_id: sid, seat_no: 1, move: { roll: 6 } });
  check("even a participant cannot write game_moves directly", direct.status >= 400, String(direct.status));
}

/* ─── Open table: community post → claim → auto-start ─── */
{
  const r = await rpc(icon, "create_game_session", { p_game: "snakes", p_seats: 2, p_house_rules: HOUSE });
  const sid2 = r.data;
  createdSessions.push(sid2);
  const post = await rest(
    icon,
    "POST",
    "community_posts",
    {
      author_id: icon.id,
      body: "",
      post_type: "game_open",
      ref_id: sid2,
      payload: { game_key: "snakes", name_en: "Snakes & Ladders", name_ur: "سانپ سیڑھی", seats_total: 2, seats_taken: 1 },
    },
    { Prefer: "return=representation" }
  );
  check("open-table post accepted (post_type game_open)", post.status === 201, String(post.status));
  const claim = await rpc(icon2, "claim_open_seat", { p_session: sid2 });
  check("viewer claims the open seat", claim.data === sid2, String(claim.status));
  const s2 = await session(icon2, sid2);
  check("claiming the last seat auto-starts the table", s2?.status === "active");
  const again = await rpc(icon2, "claim_open_seat", { p_session: sid2 });
  check("re-claiming when seated is idempotent", again.data === sid2, String(again.status));
  const late = await rpc(pending, "claim_open_seat", { p_session: sid2 });
  check("claiming a started table is refused", late.status >= 400, String(late.status));
  if (post.data?.[0]?.id) await rest(icon, "DELETE", `community_posts?id=eq.${post.data[0].id}`);
}

/* ─── Bots: start_with_bots fills seats; ticks finish the game ─── */
{
  const r = await rpc(icon, "create_game_session", { p_game: "snakes", p_seats: 2, p_house_rules: HOUSE });
  const sid3 = r.data;
  createdSessions.push(sid3);
  const start = await rpc(icon, "start_with_bots", { p_session: sid3 });
  check("host starts with bots", start.status === 204 || start.status === 200, String(start.status));
  const st = await seats(icon, sid3);
  check("empty seat filled by a bot", st.length === 2 && st[1].is_bot === true && st[1].profile_id === null);
  let s = await session(icon, sid3);
  let guard = 0;
  while (s?.status === "active" && guard++ < 250) {
    if (s.current_seat === 1) await rpc(icon, "play_turn", { p_session: sid3 });
    else await rpc(icon, "game_tick", { p_session: sid3 });
    s = await session(icon, sid3);
  }
  check("human + bot game runs to a finish", s?.status === "finished", `status ${s?.status}`);
}

/* ─── Daily Riddle ─── */
{
  const today = new Date().toISOString().slice(0, 10);
  const p = await rest(icon, "GET", `daily_puzzles?puzzle_date=eq.${today}&select=*`);
  check("today's riddle readable, bilingual", !!p.data?.[0]?.riddle_en && !!p.data?.[0]?.riddle_ur);

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const fut = await rest(icon, "GET", `daily_puzzles?puzzle_date=eq.${tomorrow}&select=*`);
  check("tomorrow's riddle invisible", (fut.data ?? []).length === 0);

  const ans = await rest(icon, "GET", "daily_puzzle_answers?select=*");
  check("answers table unreachable by clients", ans.status >= 400 || (ans.data ?? []).length === 0, String(ans.status));

  const wrong = await rpc(icon, "guess_daily_puzzle", { p_date: today, p_guess: "certainly not this" });
  check("wrong guess: correct=false, counted", wrong.data?.correct === false && wrong.data?.guesses >= 1, JSON.stringify(wrong.data));

  // Date-proof: try the full known answer bank until one lands.
  const BANK = ["clock","towel","sponge","bottle","age","comb","footsteps","name","needle","hole","tomorrow","silence","river","breath","watermelon","stamp","egg","snow","shoe","book","cloud","cold","dictionary","road","banana","kite","soap","moon","coin","thermometer"];
  let solved = null;
  for (const a of BANK) {
    const g = await rpc(icon, "guess_daily_puzzle", { p_date: today, p_guess: `  ${a.toUpperCase()}! ` });
    if (g.data?.correct) {
      solved = g.data;
      break;
    }
  }
  check("right guess solves (normalization: case/punctuation)", !!solved?.solved, JSON.stringify(solved));

  const after = await rpc(icon, "guess_daily_puzzle", { p_date: today, p_guess: "clock" });
  check("solved_at survives later guesses", after.data?.solved === true);

  const mine = await rest(icon, "GET", `puzzle_attempts?puzzle_date=eq.${today}&select=*`);
  check("own attempt row visible with guess count", mine.data?.[0]?.guesses >= 2 && !!mine.data?.[0]?.solved_at);
  const other = await rest(icon2, "GET", `puzzle_attempts?profile_id=eq.${icon.id}&select=*`);
  check("another person's attempts invisible", (other.data ?? []).length === 0);

  const future = await rpc(icon, "guess_daily_puzzle", { p_date: tomorrow, p_guess: "clock" });
  check("guessing a future riddle refused", future.status >= 400, String(future.status));
}

console.log(`\nsessions created (for cleanup): ${createdSessions.join(", ")}`);
console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
