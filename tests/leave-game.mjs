/* ════════════════════════════════════════════════
   Leaving a table — migrations 0040/0041.

   Run:  node tests/leave-game.mjs   (needs the DB channel)

   Every branch of leave_game_session, including the distinction 0041
   adds: a guest leaving a LOBBY has their seat DELETED, while a player
   leaving a game IN PLAY has their seat CONVERTED TO A BOT. Those are
   different sentences to the person and different rows on the server,
   so both are asserted at the row level, not just by return value —
   a navigate-only "leave" would pass a return-value-only test.
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
async function rest(user, method, path, body) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${user.token}`,
      "Content-Type": "application/json",
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
const rpc = (u, fn, args) => rest(u, "POST", `rpc/${fn}`, args);

const host = await login("smoke-icon@saathban.dev");
const guest = await login("smoke-fam@saathban.dev");

const seatsOf = (u, id) =>
  rest(u, "GET", `game_seats?session_id=eq.${id}&select=seat_no,profile_id,is_bot&order=seat_no`).then(
    (r) => r.data ?? []
  );
const statusOf = (u, id) =>
  rest(u, "GET", `game_sessions?id=eq.${id}&select=status`).then((r) => r.data?.[0]?.status);

/* Everyone starts with a clear board — the one-table rule means a
   stale live session would block every create below. */
for (const u of [host, guest]) {
  const mine = await rest(u, "GET", `game_seats?profile_id=eq.${u.id}&select=session:game_sessions(id,status)`);
  for (const row of mine.data ?? []) {
    if (row.session && ["lobby", "active"].includes(row.session.status)) {
      await rpc(u, "leave_game_session", { p_session: row.session.id });
    }
  }
}

const newTable = async (seats = 2) => {
  const r = await rpc(host, "create_game_session", { p_game: "snakes", p_seats: seats, p_house_rules: {} });
  return r.data;
};
const seatGuest = async (id) => {
  await rpc(host, "invite_to_game", { p_session: id, p_invitee: guest.id });
  const inv = await rest(guest, "GET", `game_invites?session_id=eq.${id}&invitee_id=eq.${guest.id}&select=id`);
  await rpc(guest, "respond_game_invite", { p_invite: inv.data[0].id, p_accept: true });
};

/* ─── 1. Guest leaves a lobby: the seat is really gone ─── */
{
  const id = await newTable(3); // 3 seats so it stays a lobby after the guest joins
  await seatGuest(id);
  const before = await seatsOf(host, id);
  const r = await rpc(guest, "leave_game_session", { p_session: id });
  check("guest leaving a lobby → left/released", r.data?.result === "left" && r.data?.seat === "released", JSON.stringify(r.data));
  const after = await seatsOf(host, id);
  check("…and the seat row is DELETED, not merely abandoned", after.length === before.length - 1, `${before.length} → ${after.length}`);
  check("…the table itself stands for everyone else", (await statusOf(host, id)) === "lobby");
  const again = await rpc(guest, "leave_game_session", { p_session: id });
  check("leaving twice is idempotent", again.data?.result === "not_seated", JSON.stringify(again.data));
  await rpc(host, "cancel_game_session", { p_session: id });
}

/* ─── 2. Host leaves a lobby: the table is called off ─── */
{
  const id = await newTable(3);
  await seatGuest(id);
  const r = await rpc(host, "leave_game_session", { p_session: id });
  check("host leaving a lobby → cancelled", r.data?.result === "cancelled", JSON.stringify(r.data));
  check("…and no seat detail is claimed (the sentence is about the table)", r.data?.seat === undefined);
  check("…the table is cancelled", (await statusOf(host, id)) === "cancelled");
  const over = await rpc(guest, "leave_game_session", { p_session: id });
  check("leaving a called-off table reports 'over'", over.data?.result === "over", JSON.stringify(over.data));
}

/* ─── 3. Leaving a game IN PLAY: the seat becomes a bot ─── */
{
  const id = await newTable(2);
  await seatGuest(id); // 2 seats filled → auto-starts
  check("table is in play", (await statusOf(host, id)) === "active");
  const r = await rpc(guest, "leave_game_session", { p_session: id });
  check("leaving a live game → left/bot", r.data?.result === "left" && r.data?.seat === "bot", JSON.stringify(r.data));
  const after = await seatsOf(host, id);
  const converted = after.find((s) => s.is_bot === true && s.profile_id === null);
  check("…the seat STAYS, played by a bot (never a hole)", !!converted && after.length === 2, JSON.stringify(after));
  check("…and the game carries on for the person still there", (await statusOf(host, id)) === "active");

  /* ─── 4. Last human out calls the table off ─── */
  const last = await rpc(host, "leave_game_session", { p_session: id });
  check("last human leaving → cancelled", last.data?.result === "cancelled", JSON.stringify(last.data));
  check("…the table is cancelled rather than left to bots", (await statusOf(host, id)) === "cancelled");
}

/* ─── 5. A stranger's table is not leavable ─── */
{
  const id = await newTable(3);
  const r = await rpc(guest, "leave_game_session", { p_session: id });
  check("someone not seated gets 'not_seated', not an error", r.status === 200 && r.data?.result === "not_seated", JSON.stringify(r.data));
  await rpc(host, "cancel_game_session", { p_session: id });
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
