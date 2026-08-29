/* ════════════════════════════════════════════════
   Desi Ludo — the jota, the wall, and the sixes chain (0042 / 0042b).

   Run:  node tests/ludo-jota.mjs     (no DB channel needed)

   Every assertion here is against a SYNTHETIC board handed to the pure
   rule functions, so the suite creates no session, disturbs nobody's
   game, and can run while another lane holds the channel. That is the
   point: the interesting cases — a jota resting on an enemy jota, a
   chain voiding at exactly three sixes, a pair reaching 56 but not 57 —
   are ones you could play for an hour without meeting once. Waiting for
   dice to produce them is not testing.

   ludo_desi_legal is the single gate: game_exec_ludo validates every
   incoming move against the very array the client drew its choices
   from. So testing legal + apply IS testing the move RPC's rules.
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
  return j.access_token;
}
let TOKEN;
async function rpc(fn, args) {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/* ── board helpers ──────────────────────────────────────────────
   progress: 0 = yard, 1..51 = the shared track, 52..56 = the home
   column, 57 = home. Seat s stands on absolute square
   (s * 13 + p - 1) % 52, so seat 0's p maps to abs p-1 and the eight
   safe squares are abs 0, 8, 13, 21, 26, 34, 39, 47. */
const RULES = {
  extra_roll_on_six: true,
  capture_before_home: false,
  exact_home: true,
  safe_squares: "standard",
};
const board = (rows) => {
  const b = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (const [seat, pieces] of Object.entries(rows)) b[seat] = pieces;
  return b;
};
const desi = (rows, extra = {}) => ({
  pieces: board(rows),
  captured_by: [true, true, true, true],
  rules: RULES,
  ruleset: "desi",
  dice_count: 2,
  pairs_moved: {},
  chain: 0,
  last: null,
  ...extra,
});
const classic = (rows, extra = {}) => {
  const s = desi(rows, extra);
  delete s.ruleset;
  delete s.dice_count;
  return s;
};

const legal = (state, seat, die, seats = 4) =>
  rpc("ludo_desi_legal", { p_state: state, p_seat: seat, p_seats: seats, p_die: die });

async function apply(state, seat, piece, die, split = false, seats = 4) {
  const out = await rpc("ludo_desi_apply", {
    p_state: state,
    p_seat: seat,
    p_seats: seats,
    p_piece: piece,
    p_die: die,
    p_split: split,
  });
  return Array.isArray(out) ? out[0] : out;
}

/* Options for one piece, as a compact set of "kind:to" strings — what
   the person is actually offered for that goti. */
const forPiece = (opts, piece) =>
  opts.filter((o) => o.piece === piece).map((o) => `${o.kind}:${o.to}`).sort();

async function main() {
  TOKEN = await login("test-icon@saathban.dev");

  // ── 1. A pair is recognised, and a virgin pair may do either thing ──
  {
    const s = desi({ 0: [5, 5, 0, 0] });
    const o = await legal(s, 0, 4);
    check("virgin pair, die 4: offers BOTH the pair move and the split",
      forPiece(o, 0).join(",") === "pair:7,single:9", forPiece(o, 0).join(","));
    const odd = await legal(s, 0, 3);
    check("virgin pair, odd die: no pair move, but the split still stands",
      forPiece(odd, 0).join(",") === "single:8", forPiece(odd, 0).join(","));
  }

  // ── 2. A moved pair: even dice only, half the die, no free split ──
  {
    const s = desi({ 0: [5, 5, 0, 0] }, { pairs_moved: { "0:5": true } });
    check("moved pair, die 3: nothing — it may not split off a plain square",
      forPiece(await legal(s, 0, 3), 0).length === 0);
    check("moved pair, die 2: advances 1", forPiece(await legal(s, 0, 2), 0).join(",") === "pair:6");
    check("moved pair, die 4: advances 2", forPiece(await legal(s, 0, 4), 0).join(",") === "pair:7");
    check("moved pair, die 6: advances 3, and only as a pair",
      forPiece(await legal(s, 0, 6), 0).join(",") === "pair:8");
  }

  // ── 3. A moved pair may split on a safe square or in the home column ──
  {
    const onStar = desi({ 0: [9, 9, 0, 0] }, { pairs_moved: { "0:9": true } });
    check("moved pair standing on a star: the split is available again",
      forPiece(await legal(onStar, 0, 3), 0).join(",") === "single:12");
    const inHome = desi({ 0: [54, 54, 0, 0] }, { pairs_moved: { "0:54": true } });
    check("moved pair inside the home column: may split there too",
      forPiece(await legal(inHome, 0, 3), 0).includes("single:57"));
  }

  // ── 4. The wall ──
  // Seat 1's jota sits on absolute square 20 (its own progress 8).
  {
    const wall = desi(
      { 0: [18, 0, 0, 0], 1: [8, 8, 0, 0] },
      { pairs_moved: { "1:8": true } }
    );
    check("wall: a single may not PASS an enemy jota (die 5 would go beyond)",
      forPiece(await legal(wall, 0, 5), 0).length === 0);
    check("wall: nor land beyond it (die 4)",
      forPiece(await legal(wall, 0, 4), 0).length === 0);
    check("wall: but landing EXACTLY on it is allowed — it rests there",
      forPiece(await legal(wall, 0, 3), 0).join(",") === "single:21");
    check("a jota walls even while still virgin",
      forPiece(await legal(desi({ 0: [18, 0, 0, 0], 1: [8, 8, 0, 0] }), 0, 5), 0).length === 0);
  }
  {
    // Absolute 21 is a star, so a jota standing there walls nobody.
    const onSafe = desi({ 0: [18, 0, 0, 0], 1: [9, 9, 0, 0] });
    check("a jota on a SAFE square walls nobody",
      forPiece(await legal(onSafe, 0, 5), 0).join(",") === "single:23");
  }
  {
    const own = desi({ 0: [18, 20, 20, 0] });
    check("your own jota never blocks you",
      forPiece(await legal(own, 0, 5), 0).join(",") === "single:23");
  }
  {
    const pairVsWall = desi(
      { 0: [19, 19, 0, 0], 1: [8, 8, 0, 0] },
      { pairs_moved: { "0:19": true, "1:8": true } }
    );
    check("a jota passes an enemy jota freely",
      forPiece(await legal(pairVsWall, 0, 6), 0).join(",") === "pair:22");
  }

  // ── 5. Killing ──
  {
    // Seat 0's pair at 19 takes die 4 → 21, which is absolute 20: the
    // square seat 1's jota stands on.
    const s = desi(
      { 0: [19, 19, 0, 0], 1: [8, 8, 0, 0] },
      { pairs_moved: { "0:19": true, "1:8": true } }
    );
    const r = await apply(s, 0, 0, 4, false);
    const b = r.o_state.pieces;
    check("a jota KILLS a jota: both victims go home",
      b[1][0] === 0 && b[1][1] === 0 && r.o_capture === true,
      JSON.stringify(b[1]));
    check("...and the killing pair lands together", b[0][0] === 21 && b[0][1] === 21);
    check("...and the dead pair's moved-flag is cleared",
      r.o_state.pairs_moved["1:8"] === undefined);
  }
  {
    // A lone piece arriving on an enemy jota.
    const s = desi({ 0: [18, 0, 0, 0], 1: [8, 8, 0, 0] });
    const r = await apply(s, 0, 0, 3, false);
    check("a SINGLE landing on an enemy jota kills nothing — it rests",
      r.o_capture === false && r.o_state.pieces[1][0] === 8 && r.o_state.pieces[1][1] === 8);
    check("...and the resting single is on the square, coexisting",
      r.o_state.pieces[0][0] === 21);
  }
  {
    // Two singles arriving one at a time cannot become a killing jota.
    const s = desi({ 0: [21, 18, 0, 0], 1: [8, 8, 0, 0] });
    const r = await apply(s, 0, 1, 3, false);
    check("two singles stacking on an occupied square still kill nothing",
      r.o_capture === false && r.o_state.pieces[1][0] === 8);
    check("...though they are now a pair, and a VIRGIN one",
      r.o_state.pieces[0][0] === 21 && r.o_state.pieces[0][1] === 21 &&
      r.o_state.pairs_moved["0:21"] === undefined);
  }
  {
    // The ordinary capture is untouched.
    const s = desi({ 0: [18, 0, 0, 0], 1: [8, 0, 0, 0] });
    const r = await apply(s, 0, 0, 3, false);
    check("a single still takes a lone single",
      r.o_capture === true && r.o_state.pieces[1][0] === 0);
    check("...and a capture is recorded, for capture_before_home",
      r.o_state.captured_by[0] === true);
  }
  {
    // Absolute 21 is a star: nothing dies there.
    const s = desi({ 0: [18, 0, 0, 0], 1: [9, 0, 0, 0] });
    const r = await apply(s, 0, 0, 4, false);
    check("no capture on a safe square",
      r.o_capture === false && r.o_state.pieces[1][0] === 9);
  }

  // ── 6. Home ──
  {
    const s = desi({ 0: [54, 54, 0, 0] }, { pairs_moved: { "0:54": true } });
    check("a pair may move within the home column (die 4 → 56)",
      forPiece(await legal(s, 0, 4), 0).includes("pair:56"));
    check("but a pair may NOT take the last square — that is entered as singles",
      !forPiece(await legal(s, 0, 6), 0).some((o) => o.startsWith("pair:57")));
    const one = desi({ 0: [55, 0, 0, 0] });
    check("exact_home: 55 + 4 overshoots and is refused",
      forPiece(await legal(one, 0, 4), 0).length === 0);
    check("exact_home: 55 + 2 lands home",
      forPiece(await legal(one, 0, 2), 0).join(",") === "single:57");
  }

  // ── 7. The virgin → moved transition, end to end ──
  {
    const s = desi({ 0: [5, 5, 0, 0] });
    const moved = await apply(s, 0, 0, 4, false);
    check("moving a pair together marks it moved",
      moved.o_state.pairs_moved["0:7"] === true && moved.o_state.pairs_moved["0:5"] === undefined);
    check("...and it can no longer split off a plain square",
      forPiece(await legal(moved.o_state, 0, 3), 0).length === 0);
    // Reach a star, then split, and the flag should go.
    const onStar = await apply(moved.o_state, 0, 0, 4, false);   // 7 → 9, absolute 8
    check("a moved pair can walk onto a star", onStar.o_state.pieces[0][0] === 9);
    const split = await apply(onStar.o_state, 0, 0, 3, true);
    check("splitting on the star clears the pair's moved-flag",
      split.o_state.pairs_moved["0:9"] === undefined &&
      split.o_state.pieces[0][0] === 12 && split.o_state.pieces[0][1] === 9);
  }

  // ── 8. Leaving the yard ──
  {
    const s = desi({ 0: [0, 0, 0, 0] });
    check("only a six brings a piece out", (await legal(s, 0, 5)).length === 0);
    const six = await legal(s, 0, 6);
    check("a six offers all four pieces, each onto the start square",
      six.length === 4 && six.every((o) => o.kind === "out" && o.to === 1));
  }

  // ── 9. The sixes chain ──
  {
    for (const [n, stands] of [[1, true], [2, true], [3, false], [4, true],
                               [5, true], [6, false], [7, true], [9, false], [10, true]]) {
      check(`a chain of ${n} ${stands ? "stands" : "counts for nothing"}`,
        (await rpc("ludo_chain_stands", { p_len: n })) === stands);
    }
    const withProv = (chain) => ({
      ...desi({ 0: [1, 0, 0, 0] }),
      prov: board({ 0: [30, 30, 0, 0] }),
      chain,
    });
    const voided = await rpc("ludo_resolve_chain", { p_state: withProv(3) });
    check("a chain voided at three leaves the committed board untouched",
      voided.pieces[0][0] === 1 && voided.prov === undefined &&
      voided.chain === 0 && voided.chain_void === true);
    const redeemed = await rpc("ludo_resolve_chain", { p_state: withProv(4) });
    check("a fourth six redeems the whole chain — the provisional board is promoted",
      redeemed.pieces[0][0] === 30 && redeemed.pieces[0][1] === 30 &&
      redeemed.prov === undefined && redeemed.chain_void === false);
    const nine = await rpc("ludo_resolve_chain", { p_state: withProv(9) });
    check("nine voids as three does", nine.pieces[0][0] === 1 && nine.chain_void === true);
    const none = await rpc("ludo_resolve_chain", { p_state: desi({ 0: [1, 0, 0, 0] }) });
    check("resolving with no chain open is harmless",
      none.pieces[0][0] === 1 && none.chain === 0);
  }

  // ── 10. Mid-chain moves land on the provisional board only ──
  {
    const s = { ...desi({ 0: [10, 0, 0, 0] }), prov: board({ 0: [10, 0, 0, 0] }), chain: 1 };
    const r = await apply(s, 0, 0, 3, false);
    check("a move during a chain touches the provisional board",
      r.o_state.prov[0][0] === 13);
    check("...and leaves the committed board exactly as it was",
      r.o_state.pieces[0][0] === 10);
  }

  // ── 11. An old table finishes under the old rules ──
  {
    const s = classic({ 0: [5, 5, 0, 0] });
    check("classic: two pieces on a square are not a jota — no pair move",
      forPiece(await legal(s, 0, 4), 0).join(",") === "single:9");
    check("classic: and an odd die moves them normally",
      forPiece(await legal(s, 0, 3), 0).join(",") === "single:8");
    const walled = classic({ 0: [18, 0, 0, 0], 1: [8, 8, 0, 0] });
    check("classic: an enemy pair walls nothing",
      forPiece(await legal(walled, 0, 5), 0).join(",") === "single:23");
    const r = await apply(classic({ 0: [19, 19, 0, 0], 1: [8, 8, 0, 0] }), 0, 0, 4);
    check("classic: a piece landing on a stack takes only what a single takes",
      r.o_state.pieces[0][0] === 23 && r.o_state.pieces[0][1] === 19);
    const cbh = classic({ 0: [50, 0, 0, 0] }, {
      captured_by: [false, false, false, false],
      rules: { ...RULES, capture_before_home: true },
    });
    check("classic: capture_before_home still bars the home column",
      forPiece(await legal(cbh, 0, 4), 0).length === 0);
  }

  // ── 12. capture_before_home holds under Desi too ──
  {
    const s = desi({ 0: [50, 50, 0, 0] }, {
      captured_by: [false, false, false, false],
      rules: { ...RULES, capture_before_home: true },
      pairs_moved: { "0:50": true },
    });
    check("desi: a pair may not slip into the home column uncaptured either",
      forPiece(await legal(s, 0, 4), 0).length === 0);
  }

  console.log("");
  console.log(failures === 0 ? "ALL GREEN" : `${failures} FAILING`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
