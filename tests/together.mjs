/* ════════════════════════════════════════════════
   Together-layer suite — migrations 0029/0029b/0029c, real accounts,
   real RLS.

   Run:  node tests/together.mjs   (after tests/together-setup.sql —
   it wipes prior together-state AND plants one poisoned fixture: an
   accepted "friendship" between test-icon and the PENDING buddy,
   inserted with service role, which every surface must then OMIT).

   Covers: the picker RPC (labels, vetting gate, block gate), invite
   idempotency + single notification, decline → quiet host note +
   idempotent re-answer, accept-on-filled grace, claim consuming the
   caller's own invite (0029c), join-by-code (wrong/finished/full/
   already-seated/rate-limit), riddle_people pre/post-solve veil,
   cheer/nudge with the one-per-day cap, warmth (incl. the 0029b
   veil + stranger negative), boast fan-out + retry dedupe.
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
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(64), note);
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
const rpc = (u, fn, args) => rest(u, "POST", `rpc/${fn}`, args);

const icon = await login("test-icon@saathban.dev");
const icon2 = await login("test-icon2@saathban.dev");
const fam = await login("test-fam@saathban.dev");
const pending = await login("test-buddy-pending@saathban.dev");

const notes = (u, kind) =>
  rest(u, "GET", `notifications?kind=eq.${kind}&select=title,body,link&order=created_at.desc&limit=15`).then(
    (r) => r.data ?? []
  );
const HOUSE = { turn_seconds: 60, target: 20 };
const today = new Date().toISOString().slice(0, 10);

/* Friendship icon↔icon2 for the connection graph. */
{
  const r = await rpc(icon, "send_friend_request", { p_recipient: icon2.id });
  await rpc(icon2, "respond_friend_request", { p_request: r.data, p_accept: true });
}

/* ─── 1. The picker ─── */
{
  const r = await rpc(icon, "game_people", {});
  const rows = r.data ?? [];
  const fam_ = rows.find((p) => p.id === fam.id);
  const icon2_ = rows.find((p) => p.id === icon2.id);
  check("picker: circle member present with 'circle' label", fam_?.how === "circle", fam_?.how);
  check("picker: friend present with 'friend' label", icon2_?.how === "friend", icon2_?.how);
  check(
    "picker: PENDING-buddy 'friend' (planted fixture) is OMITTED — vetting gate",
    !rows.some((p) => p.id === pending.id),
    `rows: ${rows.length}`
  );

  await rest(icon, "POST", "user_blocks", { blocker_id: icon.id, blocked_id: fam.id, kind: "block" });
  const blocked = await rpc(icon, "game_people", {});
  check("picker: a blocked person never appears", !(blocked.data ?? []).some((p) => p.id === fam.id));
  await rest(icon, "DELETE", `user_blocks?blocker_id=eq.${icon.id}&blocked_id=eq.${fam.id}&kind=eq.block`);

  const gate = await rpc(pending, "game_people", {});
  check("picker: pending buddy cannot even open it", gate.status >= 400 || (gate.data ?? []).length === 0, String(gate.status));
}

/* ─── 2. Invite idempotency ─── */
let sid;
{
  const r = await rpc(icon, "create_game_session", { p_game: "race100", p_seats: 3, p_house_rules: HOUSE });
  sid = r.data;
  const before = (await notes(icon2, "game")).length;
  const i1 = await rpc(icon, "invite_to_game", { p_session: sid, p_invitee: icon2.id });
  const i2 = await rpc(icon, "invite_to_game", { p_session: sid, p_invitee: icon2.id });
  check("rapid double-invite returns the same invite", i1.data === i2.data && !!i1.data);
  const after = (await notes(icon2, "game")).length;
  check("…and notifies exactly once", after === before + 1, `${before}→${after}`);
  const stranger = await rpc(icon, "invite_to_game", { p_session: sid, p_invitee: pending.id });
  check("inviting an ineligible person fails server-side", stranger.status >= 400, String(stranger.status));
}

/* ─── 3. Decline: quiet host note, idempotent ─── */
{
  const inv = (await rest(icon2, "GET", `game_invites?session_id=eq.${sid}&invitee_id=eq.${icon2.id}&select=id`)).data?.[0];
  const r = await rpc(icon2, "respond_game_invite", { p_invite: inv.id, p_accept: false });
  check("decline returns {result:'declined'}", r.data?.result === "declined", JSON.stringify(r.data));
  const hostNote = (await notes(icon, "game")).find((n) => /seat opened up/i.test(n.title));
  check("host quietly told the seat is free (with link)", hostNote?.link === `/app/games/s/${sid}`);
  const beforeHost = (await notes(icon, "game")).length;
  const again = await rpc(icon2, "respond_game_invite", { p_invite: inv.id, p_accept: true });
  check("re-answering a decided invite is idempotent", again.data?.result === "declined");
  check("…and never re-notifies the host", (await notes(icon, "game")).length === beforeHost);
}

/* ─── 4. Accept on a table that filled meanwhile ─── */
{
  const r = await rpc(icon, "create_game_session", { p_game: "race100", p_seats: 2, p_house_rules: HOUSE });
  const s2 = r.data;
  await rpc(icon, "invite_to_game", { p_session: s2, p_invitee: fam.id });
  await rpc(icon, "start_with_bots", { p_session: s2 }); // table fills without fam
  const inv = (await rest(fam, "GET", `game_invites?session_id=eq.${s2}&invitee_id=eq.${fam.id}&select=id`)).data?.[0];
  const res = await rpc(fam, "respond_game_invite", { p_invite: inv.id, p_accept: true });
  check(
    "accepting a filled table: graceful {result:'filled'} + makings of a new one",
    res.data?.result === "filled" && res.data?.game_key === "race100" && res.data?.seats_total === 2,
    JSON.stringify(res.data)
  );
}

/* ─── 5. 0029c: claim consumes the caller's own pending invite ─── */
{
  const r = await rpc(icon, "create_game_session", { p_game: "race100", p_seats: 2, p_house_rules: HOUSE });
  const s3 = r.data;
  await rpc(icon, "invite_to_game", { p_session: s3, p_invitee: fam.id });
  // Lobby is now full-by-invites (1 seat + 1 pending). Fam arrives
  // via a stale deep link and hits CLAIM, not respond:
  const claim = await rpc(fam, "claim_open_seat", { p_session: s3 });
  check("claim with own pending invite = accept (not 'already started')", claim.data === s3, String(claim.status));
  const s = (await rest(fam, "GET", `game_sessions?id=eq.${s3}&select=status`)).data?.[0];
  check("…and the table auto-started", s?.status === "active");
}

/* ─── 6. Join by code ─── */
{
  const r = await rpc(icon, "create_game_session", { p_game: "race100", p_seats: 2, p_house_rules: HOUSE });
  const s4 = r.data;
  const code = (await rest(icon, "GET", `game_sessions?id=eq.${s4}&select=join_code`)).data?.[0]?.join_code;
  check("host can read the 6-digit code", /^\d{6}$/.test(code ?? ""), code);

  const j1 = await rpc(icon2, "join_by_code", { p_code: `${code.slice(0, 3)} ${code.slice(3)}` });
  check("code joins (spaces tolerated) and fills the table", j1.data?.result === "joined" && j1.data?.session_id === s4, JSON.stringify(j1.data));
  const j2 = await rpc(icon2, "join_by_code", { p_code: code });
  check("re-entering the code when already seated just opens it", j2.data?.result === "joined" && j2.data?.session_id === s4);
  const j3 = await rpc(fam, "join_by_code", { p_code: code });
  check("a third person on a started table: kind no_table (code retired)", j3.data?.result === "no_table", JSON.stringify(j3.data));

  const wrong = await rpc(fam, "join_by_code", { p_code: "000001" });
  check("a wrong code: kind no_table, no enumeration", wrong.data?.result === "no_table");

  const gate = await rpc(pending, "join_by_code", { p_code: code });
  check("ineligible account gets the clear eligibility error", gate.status >= 400, String(gate.status));

  let limited = false;
  for (let i = 0; i < 14; i++) {
    const g = await rpc(fam, "join_by_code", { p_code: "999999" });
    if (g.status >= 400) {
      limited = true;
      break;
    }
  }
  check("guess rate limit trips server-side", limited);
}

/* ─── 7. Riddle together: the veil, then the strip ─── */
{
  const BANK = ["clock","towel","sponge","bottle","age","comb","footsteps","name","needle","hole","tomorrow","silence","river","breath","watermelon","stamp","egg","snow","shoe","book","cloud","cold","dictionary","road","banana","kite","soap","moon","coin","thermometer"];
  const solve = async (u) => {
    for (const a of BANK) {
      const g = await rpc(u, "guess_daily_puzzle", { p_date: today, p_guess: a });
      if (g.data?.correct) return true;
    }
    return false;
  };

  const preTouch = await rpc(fam, "riddle_touch", { p_to: icon.id, p_date: today, p_kind: "cheer", p_sticker: "👏" });
  check("touching before you solve is refused", preTouch.status >= 400, String(preTouch.status));

  check("icon solves (fixture)", await solve(icon));
  const famPre = await rpc(fam, "riddle_people", { p_date: today });
  check(
    "pre-solve: a COUNT only, no names",
    famPre.data?.solved === false && famPre.data?.solved_count >= 1 && !famPre.data?.people,
    JSON.stringify(famPre.data)
  );

  check("fam solves too", await solve(fam));
  const famPost = await rpc(fam, "riddle_people", { p_date: today });
  const iconRow = famPost.data?.people?.find((p) => p.id === icon.id);
  check("post-solve strip: names + solved state", famPost.data?.solved === true && iconRow?.solved === true);
  check(
    "…and NEVER answers or guess counts",
    !JSON.stringify(famPost.data).includes("guesses") && !JSON.stringify(famPost.data).includes("answer")
  );

  const beforeIcon = (await notes(icon, "social")).length;
  const cheer = await rpc(fam, "riddle_touch", { p_to: icon.id, p_date: today, p_kind: "cheer", p_sticker: "👏" });
  check("cheer sends", cheer.data?.sent === true);
  const shabash = (await notes(icon, "social")).find((n) => /shabash/i.test(n.title) && n.link === "/app/games/puzzle");
  check("solver got the Shabash notification with a link", !!shabash);
  const cheer2 = await rpc(fam, "riddle_touch", { p_to: icon.id, p_date: today, p_kind: "cheer" });
  check("second cheer same day: {sent:false}, capped", cheer2.data?.sent === false);
  check("…and no duplicate notification", (await notes(icon, "social")).length === beforeIcon + 1);

  const wrongKind = await rpc(fam, "riddle_touch", { p_to: icon.id, p_date: today, p_kind: "nudge" });
  check("nudging a solver is refused (suggests a cheer)", wrongKind.status >= 400);

  const nudge = await rpc(icon, "riddle_touch", { p_to: icon2.id, p_date: today, p_kind: "nudge" });
  check("nudge to a non-solver sends", nudge.data?.sent === true);
  const waiting = (await notes(icon2, "social")).find((n) => /riddle is waiting/i.test(n.title));
  check("non-solver got the gentle invitation", !!waiting);
  const nudge2 = await rpc(icon, "riddle_touch", { p_to: icon2.id, p_date: today, p_kind: "nudge" });
  check("ONE nudge per person per day — server-enforced", nudge2.data?.sent === false);

  const strangerTouch = await rpc(fam, "riddle_touch", { p_to: icon2.id, p_date: today, p_kind: "nudge" });
  check("touching a non-connection is refused", strangerTouch.status >= 400, String(strangerTouch.status));
}

/* ─── 8. Warmth ─── */
{
  const veiled = await rpc(icon2, "person_warmth", { p_profile: icon.id });
  check("0029b veil: unsolved caller sees solved_today = null", veiled.status === 200 && veiled.data?.solved_today === null, JSON.stringify(veiled.data?.solved_today));
  const seen = await rpc(fam, "person_warmth", { p_profile: icon.id });
  check("solved caller sees the fact + badge cards", seen.data?.solved_today === true && Array.isArray(seen.data?.badges));
  const stranger = await rpc(pending, "person_warmth", { p_profile: icon.id });
  check("a stranger/ineligible gets nothing", stranger.status >= 400, String(stranger.status));
}

/* ─── 9. Boast: fan-out once, silent retries ─── */
{
  const before2 = (await notes(icon2, "social")).length;
  const b1 = await rpc(icon, "boast_to_people", { p_kind: "riddle", p_ref: today, p_payload: {} });
  check("boast reaches the connections", b1.data >= 2, `sent ${b1.data}`);
  const cracked = (await notes(icon2, "social")).find((n) => /cracked today's riddle/i.test(n.title));
  check("friend received it with the puzzle link", cracked?.link === "/app/games/puzzle");
  const b2 = await rpc(icon, "boast_to_people", { p_kind: "riddle", p_ref: today, p_payload: {} });
  check("retry boast: 0 sent, nothing duplicated", b2.data === 0 && (await notes(icon2, "social")).length === before2 + 1);
}

/* ─── 10. RLS negatives on the raw tables ─── */
{
  const touches = await rest(icon2, "GET", `riddle_touches?from_id=eq.${fam.id}&select=*`);
  check("another person's riddle touches are invisible", (touches.data ?? []).length === 0);
  const tries = await rest(fam, "GET", "code_tries?select=*");
  check("code_tries is unreachable by clients", tries.status >= 400 || (tries.data ?? []).length === 0, String(tries.status));
  const boasts = await rest(icon2, "GET", `boasts?profile_id=eq.${icon.id}&select=*`);
  check("another person's boasts are invisible", (boasts.data ?? []).length === 0);
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall green");
process.exit(failures ? 1 : 0);
