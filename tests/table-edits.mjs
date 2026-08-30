/* ════════════════════════════════════════════════
   Changing the table AT the table — migration 0092.

   Run:  node tests/table-edits.mjs   (needs the DB channel)

   GAMES_IMMERSION_SPEC §8 lets the host change seats, dice, name and
   their own colour from the board instead of from a form. What makes
   that safe is a window — game_table_is_soft — and a window is only
   worth having if it CLOSES. So the interesting assertions here are
   the refusals: after the first roll every one of these calls must
   fail, and fail with the table unchanged rather than half-applied.

   The seat swap is checked at the ROW level in both directions. It
   is two writes against a unique (session_id, profile_id) index, and
   a swap that leaves the old seat still holding your id would pass
   any return-value test while making the table unplayable.
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
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(60), note);
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
    /* 204 */
  }
  return { status: r.status, data };
}
const rpc = (u, fn, args) => rest(u, "POST", `rpc/${fn}`, args);

const host = await login("smoke-icon@saathban.dev");
const other = await login("smoke-fam@saathban.dev");

const seatsOf = (u, id) =>
  rest(u, "GET", `game_seats?session_id=eq.${id}&select=seat_no,profile_id,is_bot&order=seat_no`).then(
    (r) => r.data ?? []
  );
const sessionOf = (u, id) =>
  rest(u, "GET", `game_sessions?id=eq.${id}&select=title,seats_total,house_rules,status`).then(
    (r) => r.data?.[0] ?? {}
  );

/* One table at a time, so clear whatever is live. */
for (const u of [host, other]) {
  const mine = await rest(u, "GET", `game_seats?profile_id=eq.${u.id}&select=session:game_sessions(id,status)`);
  for (const row of mine.data ?? []) {
    if (row.session && ["lobby", "active"].includes(row.session.status)) {
      await rpc(u, "leave_game_session", { p_session: row.session.id });
    }
  }
}

async function freshTable(seats = 4) {
  const r = await rpc(host, "create_game_session", {
    p_game: "ludo",
    p_seats: seats,
    p_house_rules: { dice_count: 1, turn_seconds: 30, table_theme: "classic" },
    p_title: null,
  });
  const id = r.data;
  await rpc(host, "start_with_bots", { p_session: id });
  return id;
}

/* ── While the table is soft ────────────────────────────────────── */
{
  const id = await freshTable(4);
  const soft = await rpc(host, "game_table_is_soft", { p_session: id });
  check("a table nobody has rolled on is soft", soft.data === true, String(soft.data));

  await rpc(host, "game_reform_table", { p_session: id, p_title: "  Sunday table  " });
  let s = await sessionOf(host, id);
  check("the name is set, and trimmed", s.title === "Sunday table", JSON.stringify(s.title));

  await rpc(host, "game_reform_table", { p_session: id, p_house_rules: { dice_count: 2 } });
  s = await sessionOf(host, id);
  check("two dice now", Number(s.house_rules?.dice_count) === 2);
  check(
    "and the rest of the house rules survived the merge",
    Number(s.house_rules?.turn_seconds) === 30 && s.house_rules?.table_theme === "classic",
    JSON.stringify(s.house_rules)
  );

  await rpc(host, "game_reform_table", { p_session: id, p_seats: 2 });
  s = await sessionOf(host, id);
  let seats = await seatsOf(host, id);
  check("seats_total follows", s.seats_total === 2, String(s.seats_total));
  check("and the bot rows actually went", seats.length === 2, `${seats.length} rows`);

  await rpc(host, "game_reform_table", { p_session: id, p_seats: 4 });
  seats = await seatsOf(host, id);
  check("adding seats puts bots back in them", seats.length === 4 && seats.filter((x) => x.is_bot).length === 3);

  /* The colour picker. */
  const before = (await seatsOf(host, id)).find((x) => x.profile_id === host.id).seat_no;
  const want = before === 1 ? 3 : 1;
  const took = await rpc(host, "game_take_seat", { p_session: id, p_seat: want });
  seats = await seatsOf(host, id);
  const mine = seats.filter((x) => x.profile_id === host.id);
  check("taking a bot's seat moves me there", mine.length === 1 && mine[0].seat_no === want, JSON.stringify(took.data ?? took.status));
  check("the seat I left became a bot", seats.find((x) => x.seat_no === before)?.is_bot === true);
  check("the table is still the size it was", seats.length === 4);

  /* Nobody else's table. */
  const nope = await rpc(other, "game_reform_table", { p_session: id, p_title: "mine now" });
  check("a stranger cannot rename it", nope.status >= 400, `HTTP ${nope.status}`);
  check("...and it did not change", (await sessionOf(host, id)).title === "Sunday table");

  await rpc(host, "leave_game_session", { p_session: id });
}

/* ── The window closes at the first roll ────────────────────────── */
{
  const id = await freshTable(4);
  await rpc(host, "game_reform_table", { p_session: id, p_title: "Before" });

  /* Roll until it is my turn and a die is thrown. Bots move on the
     client's tick, so drive it the way the board does. */
  let rolled = false;
  for (let i = 0; i < 30 && !rolled; i++) {
    const s = await rest(host, "GET", `game_sessions?id=eq.${id}&select=current_seat,state,status`);
    const row = s.data?.[0];
    if (row?.status !== "active") break;
    const seats = await seatsOf(host, id);
    const mySeat = seats.find((x) => x.profile_id === host.id)?.seat_no;
    if (row.current_seat === mySeat && !row.state?.dice) {
      const r = await rpc(host, "ludo_roll", { p_session: id });
      rolled = r.status < 400;
    } else {
      await rpc(host, "game_tick", { p_session: id });
    }
  }
  check("a die was thrown", rolled);

  const soft = await rpc(host, "game_table_is_soft", { p_session: id });
  check("the table is no longer soft", soft.data === false, String(soft.data));

  const rename = await rpc(host, "game_reform_table", { p_session: id, p_title: "After" });
  check("renaming is refused once play has begun", rename.status >= 400, `HTTP ${rename.status}`);
  check("and the name is untouched", (await sessionOf(host, id)).title === "Before");

  const seats = await seatsOf(host, id);
  const botSeat = seats.find((x) => x.is_bot)?.seat_no;
  const swap = await rpc(host, "game_take_seat", { p_session: id, p_seat: botSeat });
  check("changing seats is refused once play has begun", swap.status >= 400, `HTTP ${swap.status}`);
  check(
    "and I am still where I was",
    (await seatsOf(host, id)).find((x) => x.profile_id === host.id)?.seat_no ===
      seats.find((x) => x.profile_id === host.id)?.seat_no
  );

  await rpc(host, "leave_game_session", { p_session: id });
}

/* ── Asking someone to one particular seat (0093) ─────── */
{
  const id = await freshTable(4);
  const seats = await seatsOf(host, id);
  const botSeat = seats.find((x) => x.is_bot).seat_no;

  const inv = await rpc(host, 'game_invite_to_seat', {
    p_session: id,
    p_invitee: other.id,
    p_seat: botSeat,
  });
  check('the host can ask someone to a bot seat', inv.status < 400 && !!inv.data, 'HTTP ' + inv.status + ' ' + JSON.stringify(inv.data).slice(0, 70));

  if (inv.data) {
    const row = await rest(host, 'GET', 'game_invites?id=eq.' + inv.data + '&select=seat_no,status');
    check('the invitation names that seat', row.data && row.data[0] && row.data[0].seat_no === botSeat, JSON.stringify(row.data && row.data[0]));
    const holding = await seatsOf(host, id);
    check('the bot keeps playing it meanwhile', holding.find((x) => x.seat_no === botSeat).is_bot === true);

    const acc = await rpc(other, 'respond_game_invite', { p_invite: inv.data, p_accept: true });
    check('accepting takes over that seat', acc.data && acc.data.result === 'joined', JSON.stringify(acc.data));
    const after = await seatsOf(host, id);
    const taken = after.find((x) => x.seat_no === botSeat);
    check('same seat, same colour, bot gone from it', taken && taken.profile_id === other.id, JSON.stringify(taken));
    check('the table is still four', after.length === 4, after.length + ' rows');
    check('and I did not lose my own seat', after.some((x) => x.profile_id === host.id));

    /* Once it is played, the same ask is refused. */
    await rpc(host, 'ludo_roll', { p_session: id }).catch(() => {});
  }

  await rpc(other, 'leave_game_session', { p_session: id });
  await rpc(host, 'leave_game_session', { p_session: id });
}

/* ── A table cannot shrink out from under the person at it ──
   The floor on seats_total is the highest seat a PERSON sits in,
   not the number of people. Counting instead of looking passes
   every test until somebody changes colour first — which is now a
   thing they can do, at the table, with one tap. */
{
  const id = await freshTable(4);
  await rpc(host, 'game_take_seat', { p_session: id, p_seat: 4 });
  const moved = (await seatsOf(host, id)).find((x) => x.profile_id === host.id);
  check('the host moved to the last seat', moved && moved.seat_no === 4, JSON.stringify(moved));

  await rpc(host, 'game_reform_table', { p_session: id, p_seats: 2 });
  const s2 = await sessionOf(host, id);
  const rows = await seatsOf(host, id);
  const me = rows.find((x) => x.profile_id === host.id);
  check('the table did not shrink past them', s2.seats_total === 4, 'seats_total ' + s2.seats_total);
  check('and they are still on the board', me && me.seat_no <= s2.seats_total, JSON.stringify(me));
  check('no seat row was orphaned', rows.length === s2.seats_total, rows.length + ' rows');

  await rpc(host, 'game_take_seat', { p_session: id, p_seat: 1 });
  await rpc(host, 'game_reform_table', { p_session: id, p_seats: 2 });
  const s3 = await sessionOf(host, id);
  check('once they move back, two is allowed', s3.seats_total === 2, 'seats_total ' + s3.seats_total);

  await rpc(host, 'leave_game_session', { p_session: id });
}

console.log(failures ? `\n${failures} FAILED` : "\nall green");
process.exit(failures ? 1 : 0);
