/* ════════════════════════════════════════════════
   One Ludo session, all three phases:

   lobby    — seats as they fill, the join code shown large, and the
              HOUSE RULES panel visible to every seat before start
              (rules freeze into state at ludo_start)
   playing  — board + HUD: roll, choose a piece (board tap or the big
              ≥48px piece buttons), 60s countdown; when the clock runs
              out ANY client's tick() has the server play the stalled
              seat with the same bot heuristic
   finished — a warm winner note (no rankings of anyone else) and
              rematch: same seats, same rules; every client follows
              rematch_id to the new session

   The client only renders and asks — every rule lives in 0020_ludo.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { useSession } from "../../../lib/session.jsx";
import { Card, SectionLabel, BodyText, Pill, PrimaryBtn, GhostBtn } from "../../circle/ui.jsx";
import { fetchSession, startSession, roll, move, tick, rematch, legalFor } from "./ludoRails.js";
import { SEAT_COLORS, povRotation } from "./board.js";
import LudoBoard from "./LudoBoard.jsx";
import Die, { DieFace } from "./Dice.jsx";
import SeatPlates from "./SeatPlates.jsx";
import ChatPanel from "./ChatPanel.jsx";

const POLL_MS = 2500;

const RULE_KEYS = [
  ["dice_count", "ludo.rules.diceCount"],
  ["extra_roll_on_six", "ludo.rules.extraRoll"],
  ["capture_before_home", "ludo.rules.captureFirst"],
  ["exact_home", "ludo.rules.exactHome"],
  ["safe_squares", "ludo.rules.safeSquares"],
];

function RulesPanel({ rules }) {
  const { t, ts } = useI18n();
  return (
    <Card>
      <BodyText style={{ fontWeight: 700, marginBottom: 8 }}>🧾 {t("ludo.rules.title")}</BodyText>
      {RULE_KEYS.map(([key, labelKey]) => (
        <div key={key} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "6px 0" }}>
          <BodyText style={{ flex: 1, margin: 0 }}>{t(labelKey)}</BodyText>
          <BodyText muted style={{ margin: 0, fontSize: ts(18), fontWeight: 700 }}>
            {key === "dice_count"
              ? Number(rules[key]) === 2
                ? t("ludo.rules.diceTwo")
                : t("ludo.rules.diceOne")
              : key === "safe_squares"
              ? rules[key] === "none"
                ? t("ludo.rules.safeNone")
                : t("ludo.rules.safeStandard")
              : rules[key]
              ? t("circle.toggle.on")
              : t("circle.toggle.off")}
          </BodyText>
        </div>
      ))}
    </Card>
  );
}

function seatName(seatRow, t) {
  if (!seatRow) return "—";
  return seatRow.is_bot ? t("ludo.seat.bot") : seatRow.name || t("ludo.seat.someone");
}

/* What to show as "the number they rolled". A skipped turn carries
   the whole roll — the array of dice, none of them usable; a move
   carries the single die it actually spent. They are different shapes
   because they are different facts, and reading one as the other
   leaves a blank in the middle of the sentence. */
function rolledText(last) {
  if (!last) return "";
  if (Array.isArray(last.dice)) return last.dice.map((d) => d?.v ?? d).join(" + ");
  if (last.die != null) return String(last.die);
  return last.dice != null ? String(last.dice) : "";
}

function pieceWhere(p, t) {
  if (p === 0) return t("ludo.pos.yard");
  if (p <= 51) return t("ludo.pos.track", { n: p });
  if (p <= 56) return t("ludo.pos.column");
  return t("ludo.pos.home");
}

export default function LudoSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [game, setGame] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastTickRef = useRef(0);

  /* The die the player has picked up, and what it could do. The
     options come from the SERVER (ludo_desi_legal) — the same array
     the move RPC validates against — so the board can never offer
     something that would then be refused. */
  const [pickedDie, setPickedDie] = useState(0);
  /* Options for EVERY die still in hand, keyed by its index. Knowing
     about the other one matters: a die with nothing it can do is a
     dead end, and a dead end you can tap is worse than one you can't.
     The board marks it spent-for-nothing straight away rather than
     letting someone pick it up and find out. */
  const [optionsByDie, setOptionsByDie] = useState({});
  const [chooser, setChooser] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [tumble, setTumble] = useState([1, 1]);

  const load = async () => {
    const g = await fetchSession(sessionId);
    setGame(g);
    if (g?.status === "finished" && g.rematch_id) {
      navigate(`/app/games/ludo/${g.rematch_id}`, { replace: true });
    }
    return g;
  };

  useEffect(() => {
    let timer;
    let clock;
    load().catch(() => setError("ludo.errors.load"));
    timer = setInterval(async () => {
      try {
        const g = await load();
        // The rails' tick plays bot seats immediately and lapsed human
        // seats after their clock — call it in both situations.
        const botTurn =
          g?.status === "playing" &&
          g.seats?.find((x) => x.seat === g.current_seat)?.is_bot;
        const lapsed =
          g?.status === "playing" &&
          g.turn_deadline &&
          new Date(g.turn_deadline).getTime() < Date.now() - 500;
        if ((botTurn || lapsed) && Date.now() - lastTickRef.current > 3000) {
          lastTickRef.current = Date.now();
          await tick(sessionId).catch(() => {});
          await load().catch(() => {});
        }
      } catch {
        /* transient; the next poll retries */
      }
    }, POLL_MS);
    clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  /* Refetch the options whenever the dice change or the player picks
     up a different die. */
  const diceKey = JSON.stringify(game?.state?.dice ?? null);
  const myTurnNow =
    game?.status === "playing" &&
    game.seats?.find((x) => x.seat === game.current_seat)?.profile_id === myId;
  useEffect(() => {
    const st = game?.state;
    const dice = Array.isArray(st?.dice) ? st.dice : null;
    setChooser(null);
    if (!myTurnNow || !dice) {
      setOptionsByDie({});
      return undefined;
    }
    const open = dice.map((d, i) => ({ ...d, i })).filter((d) => !d.used && !d.wasted);
    if (!open.length) {
      setOptionsByDie({});
      return undefined;
    }
    let alive = true;
    Promise.all(
      open.map((d) =>
        legalFor(st, game.current_seat, game.target_seats, d.v)
          .then((o) => [d.i, o])
          .catch(() => [d.i, []])
      )
    ).then((pairs) => {
      if (!alive) return;
      const map = Object.fromEntries(pairs);
      setOptionsByDie(map);
      // Never leave a die in hand that can't do anything.
      const usable = open.filter((d) => (map[d.i] || []).length > 0).map((d) => d.i);
      if (usable.length && !usable.includes(pickedDie)) setPickedDie(usable[0]);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceKey, myTurnNow, game?.current_seat]);

  const act = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message || "ludo.errors.generic");
    } finally {
      setBusy(false);
    }
  };

  /* Roll with a tumble: the faces churn while the request is in
     flight and settle on whatever the server actually threw. The
     animation is decoration over a real wait, never a fake one. */
  const doRoll = async () => {
    if (rolling || busy) return;
    setRolling(true);
    const churn = setInterval(
      () => setTumble([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]),
      80
    );
    try {
      await act(() => roll(game.id));
    } finally {
      clearInterval(churn);
      setRolling(false);
    }
  };

  /* Tap a goti. If the die could do two different things with it —
     move the pair together, or send this one on alone — ask, rather
     than guessing which the person meant. */
  const tapPiece = (i) => {
    const mine = options.filter((o) => o.piece === i);
    if (!mine.length) return;
    if (mine.length === 1) {
      act(() => move(game.id, { piece: i, die: pickedDie, split: mine[0].split }));
      return;
    }
    setChooser({ piece: i, opts: mine });
  };

  if (!game) {
    return <BodyText muted role="status">···</BodyText>;
  }

  const seats = game.seats || [];
  const state = game.state || {};
  const rules = game.status === "lobby" ? game.house_rules : state.rules || game.house_rules;
  const mySeatRow = seats.find((s) => s.profile_id === myId);
  const currentRow = seats.find((s) => s.seat === game.current_seat);
  const isMyTurn = game.status === "playing" && currentRow?.profile_id === myId;
  const dice = Array.isArray(state.dice) ? state.dice : null;
  const hasDice = !!dice;
  const diceCount = Number(state.dice_count) || Number(rules.dice_count) || 1;
  const options = optionsByDie[pickedDie] || [];
  /* A die is "live" only if it is unspent AND has somewhere to go. */
  const liveDice = dice
    ? dice.map((d, i) => i).filter((i) => !dice[i].used && !dice[i].wasted && (optionsByDie[i] || []).length > 0)
    : [];
  const spendable = liveDice.length;
  const deadDice = dice
    ? dice.filter((d, i) => !d.used && (d.wasted || (optionsByDie[i] || []).length === 0))
    : [];
  const chain = Number(state.chain) || 0;
  const secondsLeft = game.turn_deadline
    ? Math.max(0, Math.ceil((new Date(game.turn_deadline).getTime() - now) / 1000))
    : null;
  const last = state.last;

  return (
    <>
      <style>{`
        @keyframes saath-tumble {
          0%   { transform: rotate(0deg)   scale(1);    }
          25%  { transform: rotate(-18deg) scale(1.08); }
          50%  { transform: rotate(14deg)  scale(0.94); }
          75%  { transform: rotate(-9deg)  scale(1.05); }
          100% { transform: rotate(0deg)   scale(1);    }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes saath-tumble { from, to { transform: none; } }
        }
      `}</style>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(30),
          fontWeight: 700,
          color: C.green,
          margin: "8px 0 10px",
        }}
      >
        🎲 {t("ludo.title")}
      </h1>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {t(error)}
        </BodyText>
      )}

      {/* Seat chips — colour + number + name, current turn marked in words */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {seats.map((s) => (
          <Pill
            key={s.seat}
            tone={game.status === "playing" && s.seat === game.current_seat ? "green" : "neutral"}
          >
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: SEAT_COLORS[s.seat],
                color: C.cream,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {s.seat + 1}
            </span>
            {seatName(s, t)}
            {s.profile_id === myId ? ` (${t("ludo.seat.you")})` : ""}
            {game.status === "playing" && s.seat === game.current_seat
              ? ` — ${s.profile_id === myId ? t("ludo.seat.yourTurn") : t("ludo.seat.turn")}`
              : ""}
          </Pill>
        ))}
      </div>

      {/* ── LOBBY ── */}
      {game.status === "lobby" && (
        <>
          <Card style={{ textAlign: "center" }}>
            <BodyText muted>{t("ludo.lobby.codeHint")}</BodyText>
            <p
              dir="ltr"
              style={{
                fontFamily: meta.fonts.heading,
                fontSize: ts(46),
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: C.green,
                margin: "4px 0 8px",
              }}
            >
              {game.join_code.replace(/(\d{3})(\d{3})/, "$1 $2")}
            </p>
            <BodyText muted style={{ margin: 0 }}>
              {t("ludo.lobby.seats", {
                filled: seats.length,
                total: game.target_seats,
              })}{" "}
              {t("ludo.lobby.botFill")}
            </BodyText>
          </Card>

          <RulesPanel rules={rules} />

          {game.created_by === myId ? (
            <PrimaryBtn onClick={() => act(() => startSession(game.id))} disabled={busy} style={{ width: "100%" }}>
              ▶ {t("ludo.lobby.startCta")}
            </PrimaryBtn>
          ) : (
            <BodyText muted>{t("ludo.lobby.waitHost")}</BodyText>
          )}
        </>
      )}

      {/* ── PLAYING ── */}
      {game.status === "playing" && (
        <>
          {/* Turn + countdown */}
          <Card style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <BodyText style={{ fontWeight: 700, margin: 0, flex: "1 1 180px" }}>
                {isMyTurn
                  ? hasDice
                    ? t("ludo.turn.choose", { dice: dice.map((d) => d.v).join(" + ") })
                    : t("ludo.turn.yours")
                  : t("ludo.turn.theirs", { name: seatName(currentRow, t) })}
              </BodyText>
              {secondsLeft != null && (
                <BodyText
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: ts(22),
                    color: secondsLeft <= 10 ? C.brown : C.green,
                  }}
                >
                  ⏱ {secondsLeft}s
                </BodyText>
              )}
            </div>
            {secondsLeft != null && (
              <div
                aria-hidden="true"
                style={{ height: 8, borderRadius: 4, background: C.cream, marginTop: 8, overflow: "hidden" }}
              >
                <div
                  style={{
                    width: `${Math.min(100, (secondsLeft / 60) * 100)}%`,
                    height: "100%",
                    background: secondsLeft <= 10 ? C.brown : C.sage,
                    borderRadius: 4,
                  }}
                />
              </div>
            )}
            {last && (
              <BodyText muted style={{ margin: "10px 0 0", fontSize: ts(18) }}>
                {last.skipped
                  ? t("ludo.last.skipped", {
                      name: seatName(seats.find((s) => s.seat === last.seat), t),
                      dice: rolledText(last),
                    })
                  : last.provisional
                  ? /* A move made on a chained six: it is on the board
                       in front of them, but it has not counted yet, and
                       saying "moved" would be a small lie. */
                    t("ludo.last.provisional", {
                      name: seatName(seats.find((s) => s.seat === last.seat), t),
                      dice: rolledText(last),
                    })
                  : last.capture
                  ? t("ludo.last.capture", {
                      name: seatName(seats.find((s) => s.seat === last.seat), t),
                      dice: rolledText(last),
                    })
                  : t("ludo.last.moved", {
                      name: seatName(seats.find((s) => s.seat === last.seat), t),
                      dice: rolledText(last),
                    })}
              </BodyText>
            )}
          </Card>

          {/* ── The four players, at the four corners, outside the
                 board. Yours follows your yard down to the near side. ── */}
          <SeatPlates
            where="top"
            seats={seats}
            seatsInPlay={game.target_seats}
            spin={povRotation(mySeatRow?.seat ?? null)}
            currentSeat={game.current_seat}
            myId={myId}
          />

          <LudoBoard
            mySeat={mySeatRow?.seat ?? null}
            state={state}
            seatsInPlay={game.target_seats}
            options={isMyTurn && hasDice ? options : []}
            currentSeat={game.current_seat}
            onPieceTap={tapPiece}
          >
            {/* ── The dice, in the middle, where thrown dice land ── */}
            {isMyTurn && !hasDice ? (
              <button
                type="button"
                onClick={doRoll}
                disabled={busy || rolling}
                aria-label={t("ludo.turn.rollCta")}
                style={{
                  width: "100%",
                  height: "100%",
                  minWidth: 64,
                  minHeight: 64,
                  borderRadius: "22%",
                  border: `3px solid ${C.green}`,
                  background: "#fffdf7",
                  cursor: busy || rolling ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: 0,
                  boxShadow: "0 3px 0 rgba(0,0,0,0.10)",
                }}
              >
                {Array.from({ length: diceCount }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      animation: rolling ? "saath-tumble 0.42s linear infinite" : undefined,
                      lineHeight: 0,
                    }}
                  >
                    <DieFace value={rolling ? tumble[i] || 1 : 6 - i * 5} size={diceCount === 2 ? 34 : 46} />
                  </span>
                ))}
              </button>
            ) : hasDice ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                {dice.map((d, i) => (
                  <Die
                    key={i}
                    value={d.v}
                    size={diceCount === 2 ? 34 : 48}
                    state={
                      d.used
                        ? "used"
                        : d.wasted || (isMyTurn && (optionsByDie[i] || []).length === 0)
                        ? "wasted"
                        : i === pickedDie
                        ? "selected"
                        : "ready"
                    }
                    label={
                      d.used
                        ? t("ludo.dice.used", { n: d.v })
                        : d.wasted || (isMyTurn && (optionsByDie[i] || []).length === 0)
                        ? t("ludo.dice.wasted", { n: d.v })
                        : t("ludo.dice.pick", { n: d.v })
                    }
                    onClick={
                      isMyTurn && spendable > 1 && liveDice.includes(i)
                        ? () => setPickedDie(i)
                        : undefined
                    }
                    disabled={busy}
                  />
                ))}
              </div>
            ) : null}
          </LudoBoard>

          <SeatPlates
            where="bottom"
            seats={seats}
            seatsInPlay={game.target_seats}
            spin={povRotation(mySeatRow?.seat ?? null)}
            currentSeat={game.current_seat}
            myId={myId}
          />

          {/* ── What to do next, in one sentence ── */}
          {isMyTurn && hasDice && (
            <BodyText style={{ fontWeight: 700, margin: "10px 0 0", textAlign: "center" }}>
              {spendable > 1 ? t("ludo.turn.pickDie") : t("ludo.turn.pickPiece")}
            </BodyText>
          )}
          {isMyTurn && deadDice.length > 0 && (
            <BodyText muted role="status" style={{ margin: "6px 0 0", textAlign: "center" }}>
              {t("ludo.dice.wastedNote", { n: deadDice.map((d) => d.v).join(", ") })}
            </BodyText>
          )}

          {/* ── The sixes chain, said plainly while it is still open ── */}
          {chain > 0 && (
            <Card style={{ marginTop: 10, borderColor: C.brown, background: "#fffaf2" }}>
              <BodyText style={{ margin: 0, fontWeight: 700 }}>
                🎲 {t("ludo.chain.count", { n: chain })}
              </BodyText>
              <BodyText muted style={{ margin: "4px 0 0" }}>
                {chain === 2 || chain === 5 || chain === 8
                  ? t("ludo.chain.careful")
                  : chain === 3 || chain === 6 || chain === 9
                  ? t("ludo.chain.onTheEdge")
                  : t("ludo.chain.holding")}
              </BodyText>
            </Card>
          )}
          {last?.chain_void && (
            <BodyText role="status" style={{ margin: "8px 0 0", fontWeight: 700, color: C.brown, textAlign: "center" }}>
              {t("ludo.chain.voided")}
            </BodyText>
          )}

          {/* ── Choosing between the pair and the single, when a goti
                 standing in a jota could do either ── */}
          {chooser && (
            <Card style={{ marginTop: 12, borderColor: C.green, borderWidth: 2 }}>
              <BodyText style={{ fontWeight: 700, margin: "0 0 8px" }}>
                {t("ludo.jota.chooseTitle")}
              </BodyText>
              {chooser.opts.map((o) => (
                <GhostBtn
                  key={`${o.kind}-${o.to}`}
                  disabled={busy}
                  onClick={() =>
                    act(() => move(game.id, { piece: chooser.piece, die: pickedDie, split: o.split }))
                  }
                  style={{ width: "100%", justifyContent: "flex-start", borderColor: C.green, marginBottom: 8 }}
                >
                  {o.kind === "pair"
                    ? t("ludo.jota.together", { n: Math.floor(dice[pickedDie].v / 2) })
                    : t("ludo.jota.alone", { n: dice[pickedDie].v })}
                </GhostBtn>
              ))}
              <GhostBtn onClick={() => setChooser(null)} style={{ width: "100%" }}>
                {t("outdoor.place.formCancel")}
              </GhostBtn>
            </Card>
          )}

          {/* The honest ≥48px targets. The board is the nice way to
              play; these are the way that never depends on how many
              pixels a goti happens to be. */}
          {isMyTurn && !hasDice && !chooser && (
            <PrimaryBtn
              onClick={doRoll}
              disabled={busy || rolling}
              style={{ width: "100%", minHeight: 64, fontSize: ts(22), marginTop: 12 }}
            >
              🎲 {t("ludo.turn.rollCta")}
            </PrimaryBtn>
          )}
          {isMyTurn && hasDice && !chooser && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {[...new Set(options.map((o) => o.piece))].map((i) => {
                const p = Number(state.pieces?.[game.current_seat]?.[i] ?? 0);
                return (
                  <GhostBtn
                    key={i}
                    disabled={busy}
                    onClick={() => tapPiece(i)}
                    style={{ justifyContent: "flex-start", borderColor: C.green, color: C.textMain }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: SEAT_COLORS[game.current_seat],
                        color: C.cream,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        marginInlineEnd: 10,
                      }}
                    >
                      {game.current_seat + 1}
                    </span>
                    {t("ludo.turn.movePiece", { n: i + 1 })} · {pieceWhere(p, t)}
                  </GhostBtn>
                );
              })}
            </div>
          )}

          <details style={{ marginTop: 14 }}>
            <summary
              style={{
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 600,
                color: C.greenMuted,
                cursor: "pointer",
                minHeight: A11Y.minTapTargetPx,
                display: "flex",
                alignItems: "center",
              }}
            >
              🧾 {t("ludo.rules.title")}
            </summary>
            <RulesPanel rules={rules} />
          </details>
        </>
      )}

      {/* ── FINISHED ── */}
      {game.status === "finished" && (
        <>
          <Card style={{ textAlign: "center", border: `2px solid ${C.sage}` }}>
            <p aria-hidden="true" style={{ fontSize: 52, margin: "0 0 6px" }}>🎉</p>
            <BodyText style={{ fontFamily: meta.fonts.heading, fontSize: ts(26), fontWeight: 700, color: C.green }}>
              {seats.find((s) => s.seat === game.winner_seat)?.profile_id === myId
                ? t("ludo.finished.youWon")
                : t("ludo.finished.won", {
                    name: seatName(seats.find((s) => s.seat === game.winner_seat), t),
                  })}
            </BodyText>
            <BodyText muted>{t("ludo.finished.note")}</BodyText>
            {mySeatRow && (
              <PrimaryBtn onClick={() => act(() => rematch(game.id))} disabled={busy} style={{ marginTop: 8 }}>
                🔁 {t("ludo.finished.rematchCta")}
              </PrimaryBtn>
            )}
          </Card>
          <LudoBoard
            mySeat={mySeatRow?.seat ?? null}
            state={state}
            seatsInPlay={game.target_seats}
            options={[]}
            currentSeat={-1}
            onPieceTap={() => {}}
          />
        </>
      )}

      {/* Chat travels with every phase */}
      {mySeatRow && <ChatPanel sessionId={game.id} myId={myId} seats={seats} />}
    </>
  );
}
