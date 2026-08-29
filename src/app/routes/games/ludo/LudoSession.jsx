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
import { fetchSession, startSession, roll, move, tick, rematch } from "./ludoRails.js";
import { SEAT_COLORS } from "./board.js";
import LudoBoard from "./LudoBoard.jsx";
import ChatPanel from "./ChatPanel.jsx";

const POLL_MS = 2500;

const RULE_KEYS = [
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
            {key === "safe_squares"
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

  if (!game) {
    return <BodyText muted role="status">···</BodyText>;
  }

  const seats = game.seats || [];
  const state = game.state || {};
  const rules = game.status === "lobby" ? game.house_rules : state.rules || game.house_rules;
  const mySeatRow = seats.find((s) => s.profile_id === myId);
  const currentRow = seats.find((s) => s.seat === game.current_seat);
  const isMyTurn = game.status === "playing" && currentRow?.profile_id === myId;
  const hasDice = state.dice != null;
  const legal = (state.legal || []).map(Number);
  const secondsLeft = game.turn_deadline
    ? Math.max(0, Math.ceil((new Date(game.turn_deadline).getTime() - now) / 1000))
    : null;
  const last = state.last;

  return (
    <>
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
              ? ` — ${t("ludo.seat.turn")}`
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
                    ? t("ludo.turn.choose", { dice: state.dice })
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
                      dice: last.dice,
                    })
                  : last.capture
                  ? t("ludo.last.capture", {
                      name: seatName(seats.find((s) => s.seat === last.seat), t),
                      dice: last.dice,
                    })
                  : t("ludo.last.moved", {
                      name: seatName(seats.find((s) => s.seat === last.seat), t),
                      dice: last.dice,
                    })}
              </BodyText>
            )}
          </Card>

          <LudoBoard
          mySeat={mySeatRow?.seat ?? null}
            state={{ ...state, turnSeat: game.current_seat }}
            seatsInPlay={game.target_seats}
            legal={legal}
            myTurnToMove={isMyTurn && hasDice}
            onPieceTap={(i) => act(() => move(game.id, i))}
          />

          {/* My controls: the honest ≥48px targets */}
          {isMyTurn && !hasDice && (
            <PrimaryBtn
              onClick={() => act(() => roll(game.id))}
              disabled={busy}
              style={{ width: "100%", minHeight: 64, fontSize: ts(22), marginTop: 12 }}
            >
              🎲 {t("ludo.turn.rollCta")}
            </PrimaryBtn>
          )}
          {isMyTurn && hasDice && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {legal.map((i) => {
                const p = Number(state.pieces?.[game.current_seat]?.[i] ?? 0);
                return (
                  <GhostBtn
                    key={i}
                    disabled={busy}
                    onClick={() => act(() => move(game.id, i))}
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
            state={{ ...state, turnSeat: -1 }}
            seatsInPlay={game.target_seats}
            legal={[]}
            myTurnToMove={false}
            onPieceTap={() => {}}
          />
        </>
      )}

      {/* Chat travels with every phase */}
      {mySeatRow && <ChatPanel sessionId={game.id} myId={myId} seats={seats} />}
    </>
  );
}
