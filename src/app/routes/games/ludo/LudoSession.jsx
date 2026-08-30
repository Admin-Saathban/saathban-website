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
import { COLORS as C } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { useSession } from "../../../lib/session.jsx";
import { Card, SectionLabel, BodyText, Pill, PrimaryBtn, GhostBtn } from "../../circle/ui.jsx";
import { fetchSession, startSession, roll, move, tick, rematch, legalFor } from "./ludoRails.js";
import { useGameFeel, GameMotionStyles, Confetti } from "../../../lib/gameFeel.jsx";
import { SoundButton, SoundPanel } from "../SoundControls.jsx";
import { SEAT_COLORS, povRotation } from "./board.js";
import LudoBoard from "./LudoBoard.jsx";
import Die, { DieFace } from "./Dice.jsx";
import SeatPlates from "./SeatPlates.jsx";
import ChatPanel from "./ChatPanel.jsx";
import QuickChat, { EmojiButton, ChatBubbles, BUBBLE_MS } from "../QuickChat.jsx";
import LudoCelebration from "./LudoCelebration.jsx";
import { screenCorner } from "./SeatPlates.jsx";
import { leaveSession, boastToPeople } from "../../../lib/games.js";
import { sendChat, fetchChat } from "./ludoRails.js";

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
  /* A question about dice that no longer exist is not a question. */
  useEffect(() => {
    if (!Array.isArray(game?.state?.dice)) setChooser(null);
  }, [game?.state?.dice]);
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

  /* ── The small ceremonies ──
     Arriving, starting, and leaving are moments, not state changes.
     Each is brief, each is skippable by doing nothing, and each is
     announced to a screen reader as a status rather than an alert. */
  const [ceremony, setCeremony] = useState(null); // "setting" | "start" | null
  const [leaveAsk, setLeaveAsk] = useState(false);
  const [shared, setShared] = useState(false);
  const [bubbles, setBubbles] = useState([]);
  const seenChat = useRef(new Set());
  const startedOnce = useRef(false);

  /* "Setting the table…" while the seats are still filling, and
     "Khelte hain!" the moment play begins — once, not on every poll. */
  useEffect(() => {
    if (game?.status === "lobby") {
      setCeremony((c) => (c === null ? "setting" : c));
      return undefined;
    }
    if (game?.status === "playing" && !startedOnce.current) {
      startedOnce.current = true;
      setCeremony("start");
      const h = setTimeout(() => setCeremony(null), 1800);
      return () => clearTimeout(h);
    }
    if (game?.status !== "lobby") setCeremony((c) => (c === "setting" ? null : c));
    return undefined;
  }, [game?.status]);

  /* New chat lines float by their sender's corner for a few seconds.
     Only messages that arrive AFTER this screen opened — replaying the
     history as bubbles would be a wall of noise on join. */
  useEffect(() => {
    if (!game?.id) return undefined;
    let alive = true;
    let primed = false;
    const tick = async () => {
      try {
        const rows = await fetchChat(game.id);
        if (!alive) return;
        const fresh = [];
        for (const m of rows) {
          if (seenChat.current.has(m.id)) continue;
          seenChat.current.add(m.id);
          if (primed) fresh.push(m);
        }
        primed = true;
        if (fresh.length) {
          const add = fresh.slice(-3).map((m) => ({
            id: m.id,
            text: m.body,
            seat: (game.seats || []).find((x) => x.profile_id === m.sender_id)?.seat ?? 0,
          }));
          setBubbles((b) => [...b, ...add]);
          setTimeout(() => {
            setBubbles((b) => b.filter((x) => !add.some((a) => a.id === x.id)));
          }, BUBBLE_MS);
        }
      } catch {
        /* the bubbles are a grace note; the chat panel is the record */
      }
    };
    tick();
    const h = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.seats?.length]);

  const sayQuick = async (text) => {
    // Mine appears at once; the poll will simply find it already seen.
    const mine = { id: `local-${Date.now()}`, text, seat: mySeatRow?.seat ?? 0 };
    setBubbles((b) => [...b, mine]);
    setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== mine.id)), BUBBLE_MS);
    try {
      await sendChat(game.id, text);
    } catch {
      /* said out loud locally either way — the panel shows the truth */
    }
  };

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

  const [soundOpen, setSoundOpen] = useState(false);

  /* Ludo keeps its last move in state rather than fetching the move
     log, so the feel hook watches a key instead of an id. Pieces plus
     the last move is a sound key: the pieces array cannot come back
     identical two moves running, so no real move is ever swallowed
     as "no change". */
  const ludoState = game?.state || {};
  useGameFeel({
    gameKey: "ludo",
    lastMove: ludoState.last,
    eventKey: ludoState.last ? JSON.stringify([ludoState.last, ludoState.pieces]) : null,
    // this screen calls the active state "playing"; the hook speaks rails
    status: game?.status === "playing" ? "active" : game?.status,
    winnerSeat: game?.winner_seat ?? null,
    mySeatNo: game?.seats?.find((x) => x.profile_id === myId)?.seat ?? null,
    currentSeat: game?.current_seat ?? null,
  });

  if (!game) {
    return <BodyText muted role="status">···</BodyText>;
  }

  const seats = game.seats || [];
  const state = game.state || {};
  const rules = game.status === "lobby" ? game.house_rules : state.rules || game.house_rules;
  const mySeatRow = seats.find((s) => s.profile_id === myId);
  const currentRow = seats.find((s) => s.seat === game.current_seat);
  const isMyTurn = game.status === "playing" && currentRow?.profile_id === myId;
  /* WHERE THE DICE LIVE — settled by LUDO_UI_SPEC §3, "next to their
     own avatar, not in the board's middle". Two users had asked for
     opposite things (a die per person; dice in the middle where thrown
     dice land) and this was a mode for a while so neither answer was
     destroyed while they decided. The spec decided. The middle tray is
     gone rather than kept behind a flag, because a branch nobody runs
     is not a preserved option, it is untested code. */

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
  /* What sits at one player's corner: their rolled dice while it is
     their turn, an empty die for whoever is about to roll, and
     nothing at all for the seats waiting their go — four idle dice on
     screen would say "four things to tap" when only one is live.

     A die that is unspent but has nowhere legal to go reads as
     "wasted", not "ready": offering it as a choice would be inviting
     a tap that can only be refused. */
  const diceForSeat = (seat) => {
    if (seat !== game.current_seat || !dice) return [];
    return dice.map((d, i) => ({
      v: d.v,
      state: d.used
        ? "used"
        : d.wasted || (optionsByDie[i] || []).length === 0
        ? "wasted"
        : i === pickedDie
        ? "selected"
        : "ready",
    }));
  };

  const chain = Number(state.chain) || 0;
  const turnSeconds = Number(game.house_rules?.turn_seconds) || 60;
  const secondsLeft = game.turn_deadline
    ? Math.max(0, Math.ceil((new Date(game.turn_deadline).getTime() - now) / 1000))
    : null;
  const last = state.last;

  return (
    <>
      {/* saath-tumble and every other games animation now live in
          lib/gameFeel.jsx, under ONE reduced-motion rule. The old
          version disabled itself by redefining the same keyframes
          inside a media query, which worked only because the later
          definition wins — a source reorder away from silently
          animating again for people who asked it not to. */}
      <GameMotionStyles />
      <Confetti active={game.status === "finished" && game.winner_seat === mySeatRow?.seat} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          margin: game.status === "playing" ? "0 0 4px" : "8px 0 10px",
        }}
      >
        {/* The name of the game earns its space in the lobby, where
            there is no board yet. Once play starts the board IS the
            screen (§1) and the title is 30px the board should have. */}
        {game.status !== "playing" && (
          <h1
            style={{
              fontFamily: meta.fonts.heading,
              fontSize: ts(30),
              fontWeight: 700,
              color: C.green,
              margin: 0,
            }}
          >
            🎲 {t("ludo.title")}
          </h1>
        )}
        <SoundButton
          onClick={() => setSoundOpen((v) => !v)}
          compact={game.status === "playing"}
        />
      </div>

      {soundOpen && <SoundPanel onClose={() => setSoundOpen(false)} />}

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {t(error)}
        </BodyText>
      )}

      {/* Seat chips — who is here so far. Only in the lobby: once
          play starts the seat plates carry all of this on the players
          themselves, and a second row of the same facts is board the
          phone does not have to give away (§1). */}
      {game.status === "lobby" && (
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
      )}

      {/* ── LOBBY ── */}
      {game.status === "lobby" && (
        <>
          {/* ── Setting the table ──
                 Waiting for seats to fill is not dead time, it is the
                 moment before a game. Said once, warmly, above the
                 code — not a spinner, because nothing is loading. */}
          {ceremony === "setting" && (
            <div role="status" className="sb-ceremony" style={{ textAlign: "center", margin: "4px 0 12px" }}>
              <p style={{ margin: 0, fontFamily: meta.fonts.heading, fontSize: ts(26), fontWeight: 700, color: C.green }}>
                {t("ludo.ceremony.setting")}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: ts(17), color: C.textMuted }}>
                {t("ludo.ceremony.settingNote")}
              </p>
            </div>
          )}

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
          {/* Whose turn, and what just happened. No card and no
              countdown bar: the clock is drawn on the player (§2) and
              the border was costing the board ninety pixels. */}
          <div style={{ margin: "0 0 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {/* Whose turn is said by the ring, the bouncing arrow and
                  the plate's own "your turn" line (§2/§3). Repeating it
                  here in full cost a line the board needed — so during
                  play only the ACTIONABLE half survives: which dice you
                  are holding and must now spend. */}
              {isMyTurn && hasDice && (
                <BodyText style={{ fontWeight: 700, margin: 0, flex: "1 1 180px" }}>
                  {t("ludo.turn.choose", { dice: dice.map((d) => d.v).join(" + ") })}
                </BodyText>
              )}
            </div>
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
          </div>

          {/* ── The four players, at the four corners, outside the
                 board. Yours follows your yard down to the near side. ── */}
          <SeatPlates
            where="top"
            seats={seats}
            seatsInPlay={game.target_seats}
            spin={povRotation(mySeatRow?.seat ?? null)}
            currentSeat={game.current_seat}
            myId={myId}
            diceFor={diceForSeat}
            onRoll={doRoll}
            canRoll={isMyTurn && !hasDice && !busy && !rolling}
            onPickDie={isMyTurn && spendable > 1 && !busy ? setPickedDie : undefined}
            rolling={rolling}
            secondsLeft={secondsLeft}
            turnSeconds={turnSeconds}
          />

          <div style={{ position: "relative" }}>
          {/* Remarks float by the speaker's corner — the corner they
              are actually sitting at after the POV rotation. */}
          <ChatBubbles
            bubbles={bubbles}
            cornerOf={(seat) => screenCorner(seat, povRotation(mySeatRow?.seat ?? null))}
          />

          {/* "Setting the table…" and "Khelte hain!" — brief, warm,
              and never in the way of a tap. */}
          {ceremony === "start" && (
            <div
              role="status"
              className="sb-ceremony"
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: "#fffdf5cc",
                borderRadius: 20,
                pointerEvents: "none",
                textAlign: "center",
                padding: 16,
              }}
            >
              <p style={{ margin: 0, fontFamily: meta.fonts.heading, fontSize: ts(30), fontWeight: 700, color: C.green }}>
                {t("ludo.ceremony.start")}
              </p>
              <p style={{ margin: 0, fontSize: ts(17), color: C.textMuted }}>
                {t("ludo.ceremony.startNote")}
              </p>
            </div>
          )}

          <LudoBoard
            mySeat={mySeatRow?.seat ?? null}
            state={state}
            seatsInPlay={game.target_seats}
            options={isMyTurn && hasDice ? options : []}
            currentSeat={game.current_seat}
            onPieceTap={tapPiece}
          />
          <p style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}>
            {t("ludo.legend.flow")}
          </p>
          </div>

          <SeatPlates
            where="bottom"
            seats={seats}
            seatsInPlay={game.target_seats}
            spin={povRotation(mySeatRow?.seat ?? null)}
            currentSeat={game.current_seat}
            myId={myId}
            diceFor={diceForSeat}
            onRoll={doRoll}
            canRoll={isMyTurn && !hasDice && !busy && !rolling}
            onPickDie={isMyTurn && spendable > 1 && !busy ? setPickedDie : undefined}
            rolling={rolling}
            secondsLeft={secondsLeft}
            turnSeconds={turnSeconds}
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
          {chooser && dice && dice[pickedDie] && (
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
        </>
      )}

      {/* ── FINISHED — the "Well Played" screen (§8) ──
             It covers the board rather than sitting on it. The board
             has nothing left to say once the game is over, and leaving
             it behind a dialog asks the eye to keep reading a finished
             position. */}
      {game.status === "finished" && (
        <LudoCelebration
          seats={seats}
          winnerSeat={game.winner_seat}
          myId={myId}
          seatName={seatName}
          busy={busy}
          shared={shared}
          onShare={
            mySeatRow
              ? () =>
                  act(async () => {
                    await boastToPeople("win", game.id, {
                      game: t("ludo.title"),
                      link: `/app/games/ludo/${game.id}`,
                    });
                    setShared(true);
                  })
              : undefined
          }
          onRematch={mySeatRow ? () => act(() => rematch(game.id)) : undefined}
          onBack={() => navigate("/app/games")}
        />
      )}

      {/* Chat travels with every phase */}
      {mySeatRow && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", margin: "12px 0 0" }}>
          <EmojiButton onSend={sayQuick} disabled={game.status === "finished"} />
          <QuickChat onSend={sayQuick} disabled={game.status === "finished"} />
          {game.status !== "finished" && (
            <GhostBtn onClick={() => setLeaveAsk(true)} style={{ minHeight: 52 }}>
              {t("ludo.ceremony.leaveCta")}
            </GhostBtn>
          )}
        </div>
      )}
      {mySeatRow && <ChatPanel sessionId={game.id} myId={myId} seats={seats} />}

      {/* Leaving is a decision, so it is asked as one — warmly, and
          with the seat's fate stated rather than implied. */}
      {leaveAsk && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("ludo.ceremony.leaveTitle")}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(45,36,24,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{ background: C.white, borderRadius: 22, padding: "26px 22px", maxWidth: 460, width: "100%" }}>
            <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(26), fontWeight: 700, color: C.green, margin: "0 0 10px" }}>
              {t("ludo.ceremony.leaveTitle")}
            </h2>
            <p style={{ fontSize: ts(19), lineHeight: 1.55, color: C.textMain, margin: "0 0 20px" }}>
              {t("ludo.ceremony.leaveBody")}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={async () => {
                  setLeaveAsk(false);
                  // Navigate first: a guest loses read access to the
                  // session the instant they leave, so staying here
                  // would only show them a door closing on them.
                  try { await leaveSession(game.id); } catch { /* already gone is fine */ }
                  navigate("/app/games");
                }}
                style={{
                  flex: "1 1 160px",
                  minHeight: 56,
                  borderRadius: 50,
                  border: "none",
                  background: C.green,
                  color: C.cream,
                  fontSize: ts(19),
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {t("ludo.ceremony.leaveConfirm")}
              </button>
              <button
                type="button"
                onClick={() => setLeaveAsk(false)}
                style={{
                  flex: "1 1 160px",
                  minHeight: 56,
                  borderRadius: 50,
                  border: `2px solid ${C.warmGray}`,
                  background: C.white,
                  color: C.textMain,
                  fontSize: ts(19),
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {t("ludo.ceremony.leaveStay")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
