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
import { useGameFeel, GameMotionStyles, Confetti } from "../../../lib/gameFeel.jsx";
import { SoundButton, SoundPanel } from "../SoundControls.jsx";
import { themeOf, themeVars } from "../themes.js";
import { SEAT_COLORS, povRotation } from "./board.js";
import LudoBoard from "./LudoBoard.jsx";
import Die, { DieFace } from "./Dice.jsx";
import SeatPlates from "./SeatPlates.jsx";
import ChatPanel from "./ChatPanel.jsx";
import QuickChat, { EmojiButton, ChatBubbles, BUBBLE_MS } from "../QuickChat.jsx";
import LudoCelebration from "./LudoCelebration.jsx";
import { screenCorner } from "./SeatPlates.jsx";
import { leaveSession } from "../../../lib/games.js";
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

  /* ── WHEN THERE IS ONLY ONE MOVE, PLAY IT ──────────────────────
     A turn with exactly one legal move is not a decision, it is a
     prompt to confirm what the rules already decided. Asking a person
     to tap a goti to be told the only thing that could happen is the
     kind of ceremony that makes an app feel like paperwork.

     ONE legal move means one across ALL the dice still in hand, not
     one for the die that happens to be picked up — otherwise a two
     dice turn would auto-play while the other die still had choices
     in it, and take the decision away rather than skip a non-decision.

     Fires once per roll: autoPlayed remembers the dice it acted on,
     so a re-render, a refetch or a realtime echo cannot play a second
     move. It never fires while the jota chooser is open, because that
     IS a real choice, and never for anyone but the player whose turn
     it is.

     House rule, on by default, and the player can switch it off if
     they would rather move every goti themselves. */
  const autoPlayed = useRef(null);
  const [autoNote, setAutoNote] = useState(false);
  /* Read off `game` rather than the `rules` const below it. Hooks
     have to sit above this component's early returns and `rules` is
     declared after them, so touching it here is a temporal dead zone
     error that blanks the whole board — which is exactly what it did.
     Same expression as `rules`, evaluated where it is safe. */
  const autoMove =
    (game?.status === "lobby"
      ? game?.house_rules
      : game?.state?.rules || game?.house_rules)?.auto_only_move !== false;
  useEffect(() => {
    if (!autoMove || !myTurnNow || busy || rolling || chooser) return;
    const dice = Array.isArray(game?.state?.dice) ? game.state.dice : null;
    if (!dice) return;
    const all = [];
    dice.forEach((d, i) => {
      if (d.used || d.wasted) return;
      (optionsByDie[i] || []).forEach((o) => all.push({ die: i, ...o }));
    });
    if (all.length !== 1) return;
    const key = `${game.id}:${diceKey}`;
    if (autoPlayed.current === key) return;
    autoPlayed.current = key;
    const only = all[0];
    setAutoNote(true);
    act(() => move(game.id, { piece: only.piece, die: only.die, split: only.split }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsByDie, myTurnNow, busy, rolling, chooser, autoMove, diceKey]);

  /* Said out loud, briefly. A board that moves by itself with no
     explanation is a board that has glitched, as far as the person
     watching it knows. */
  useEffect(() => {
    if (!autoNote) return undefined;
    const id = window.setTimeout(() => setAutoNote(false), 2600);
    return () => window.clearTimeout(id);
  }, [autoNote]);

  /* ── HOW BIG CAN THE BOARD BE? ────────────────────────────────
     The play screen is one viewport and nothing scrolls, so the board
     gets whatever is left after the rows above and below it have taken
     what they need. That is a measurement, not a guess: a fixed
     fraction of the height is right on exactly one phone and wrong on
     every other, and CSS alone cannot fit a SQUARE into a box whose
     width and height are both constrained without one axis winning.

     So the slot is measured and the board is given the largest square
     that fits inside it. On a tall phone that square is the full
     width; on a 667px one it is the height, and the board is smaller —
     which is the correct answer. A board that is smaller is still a
     board. A board with its bottom edge below the fold is not. */
  const fitRef = useRef(null);
  const [boardPx, setBoardPx] = useState(0);
  useEffect(() => {
    const el = fitRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const side = Math.max(140, Math.floor(Math.min(r.width, r.height)));
      setBoardPx((prev) => (Math.abs(prev - side) > 1 ? side : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    /* The URL bar collapsing changes dvh without resizing the element
       on some browsers, so the viewport itself is watched too. */
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [game?.status]);

  /* SHORT SCREENS GIVE UP THE ACTION ROW, NOT THE BOARD. Below this
     the emoji/chat/leave pills move into the top bar as icons rather
     than pushing the board off the bottom of the screen. */
  const [shortScreen, setShortScreen] = useState(false);
  useEffect(() => {
    const check = () => setShortScreen(window.innerHeight < 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
  const playing = game.status === "playing";
  const isMyTurn = playing && currentRow?.profile_id === myId;
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
  /* This 60 is NOT a stale twin of the 30 that new tables carry, and
     it must not be "fixed" to match. New ludo tables write
     turn_seconds: 30 into house_rules explicitly (ludoRails, and the
     setup screen since 388ac5b), so this fallback is only ever
     reached by an OLDER table that has no key at all — and for those,
     game_tick's own server-side fallback is 60. Lowering it to 30
     here would draw a ring emptying at 30 while the server went on
     waiting until 60: a clock that lies, and a player blamed for a
     turn they were told they had lost. The two numbers differ on
     purpose. */
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

      {/* THE COLUMN. During play it is the viewport: flex, no scroll,
          the board taking whatever the rows leave it. In the lobby and
          after the final whistle it scrolls like the page it is —
          those screens are reading, not playing. */}
      <div
        style={
          playing
            ? {
                display: "flex",
                flexDirection: "column",
                flex: "1 1 auto",
                minHeight: 0,
                overflow: "hidden",
                padding: "6px 12px 8px",
                maxWidth: 640,
                width: "100%",
                margin: "0 auto",
              }
            : { overflowY: "auto", padding: "16px 12px 64px", maxWidth: 640, width: "100%", margin: "0 auto" }
        }
      >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          margin: playing ? "0 0 4px" : "8px 0 10px",
          flex: "0 0 auto",
        }}
      >
        {/* THE WAY BACK. The app header is not on this screen — it is
            what the board used to slide underneath — so the door out
            lives here, inside the layout, where it can never overlap
            what it sits above. */}
        {playing && (
          <button
            type="button"
            onClick={() => navigate("/app/games")}
            aria-label={t("games.session.backCta")}
            style={{
              flex: "0 0 auto",
              width: 44,
              height: 44,
              borderRadius: 22,
              border: "none",
              background: "transparent",
              color: C.green,
              fontSize: 26,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ←
          </button>
        )}
        {/* The name of the game earns its space in the lobby, where
            there is no board yet. Once play starts the board IS the
            screen (§1) and the title is 30px the board should have. */}
        {game.status !== "playing" ? (
          <h1
            style={{
              fontFamily: meta.fonts.heading,
              fontSize: ts(30),
              fontWeight: 700,
              color: C.green,
              margin: 0,
            }}
          >
            {game.title || `🎲 ${t("ludo.title")}`}
          </h1>
        ) : (
          /* During play the row survives to hold the sound icon, and
             the width beside it is empty. A table's name costs nothing
             THERE, so §1 keeps its board and D1 keeps its name. An
             unnamed table renders the row exactly as before. */
          game.title && (
            <p
              style={{
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 700,
                color: C.greenMuted,
                margin: 0,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {game.title}
            </p>
          )
        )}
        {/* LEAVING LIVES UP HERE NOW, during play. It is a door, not
            an action of the game, and down in the action row it was a
            full-width pill costing the board about 70px of height on
            every screen. Requirement: on a short screen the leave
            control collapses into the bar rather than pushing the
            board off the bottom — so it does, on every screen, since
            the reasoning does not stop being true at 721px. Still a
            44px target, still labelled for a screen reader, still
            opens the same warm confirm. */}
        {playing && mySeatRow && (
          <button
            type="button"
            onClick={() => setLeaveAsk(true)}
            aria-label={t("ludo.ceremony.leaveCta")}
            title={t("ludo.ceremony.leaveCta")}
            style={{
              flex: "0 0 auto",
              width: 44,
              height: 44,
              borderRadius: 22,
              border: `1px solid ${C.line || "#E3D9C6"}`,
              background: C.white,
              color: C.textMain,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {/* DRAWN, NOT TYPED. 🚪 renders as a blank tofu box on
                anything without an emoji font for it — which included
                the browser this was verified in, so the control that
                leaves the game showed as a brown rectangle. A door
                with an arrow out of it costs eleven lines and renders
                identically everywhere. */}
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M12 12h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path
                d="m18 8.5 3.5 3.5L18 15.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <SoundButton
          onClick={() => setSoundOpen((v) => !v)}
          compact={playing}
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
          <div style={{ margin: playing ? "0 0 4px" : "0 0 10px", flex: "0 0 auto" }}>
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
              <BodyText
                muted
                style={{
                  margin: playing ? "4px 0 0" : "10px 0 0",
                  fontSize: ts(18),
                  /* ONE LINE on the play screen. This is the running
                     commentary — useful, never urgent — and when it
                     wrapped to three lines it took them off the
                     board. Ellipsis rather than a shorter sentence,
                     because the sentence is also read aloud. */
                  ...(playing
                    ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
                    : null),
                }}
              >
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
          <div style={{ flex: "0 0 auto" }}>
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
          </div>

          {/* THE SLOT. It takes every pixel the rows above and below
              do not, and the board inside it is the largest square
              that fits. min-height: 0 is what makes that true — a
              flex child's default min-height is its content, so
              without it the board would refuse to shrink and would
              push the roll button off the bottom instead, which is
              the whole bug in miniature. */}
          <div
            ref={fitRef}
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
            }}
          >
          <div
            style={{
              position: "relative",
              width: boardPx ? boardPx : "100%",
              maxWidth: "100%",
            }}
          >
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

          {/* The table's theme (C1). `rules` is the frozen house rules
              once play starts, so the board cannot change surface under
              anyone mid-game, and a table created before themes existed
              resolves to classic rather than crashing. The board's own
              SVG background is transparent, so this ground shows through
              it — that transparency is the whole seam. */}
          <div
            style={{
              ...themeVars(themeOf(rules)),
              background: "var(--sb-table-ground)",
              borderRadius: 20,
              padding: 8,
              boxShadow: "0 2px 12px var(--sb-table-glow)",
            }}
          >
          <LudoBoard
            mySeat={mySeatRow?.seat ?? null}
            state={state}
            seatsInPlay={game.target_seats}
            options={isMyTurn && hasDice ? options : []}
            currentSeat={game.current_seat}
            onPieceTap={tapPiece}
          />
          </div>
          <p style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}>
            {t("ludo.legend.flow")}
          </p>
          </div>
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
          {autoNote && (
            <BodyText role="status" style={{ margin: "6px 0 0", textAlign: "center", fontWeight: 700, color: C.green }}>
              {t("ludo.turn.autoPlayed")}
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

          {/* The roll button is the one honest ≥48px target left, and
              it stays. The MOVE LIST that used to sit under it is
              gone: "Move piece 1 · step 10 of 51" is the engine
              talking to itself, and a step count out of 51 is a debug
              log, not a game. The board says all of it better — the
              gotis that can move glow, and you tap the one you mean.

              That list was also the fallback for anyone who could not
              reliably hit a goti on a phone, which is a real concern
              and not one to wave away. It is answered where it should
              have been answered in the first place: the goti's hit
              target is r=42 in board units, about 50 CSS px at phone
              width and larger than the token it surrounds, so §10's
              48px floor is met by the thing you actually tap. */}
          {isMyTurn && !hasDice && !chooser && (
            <PrimaryBtn
              onClick={doRoll}
              disabled={busy || rolling}
              style={{
                width: "100%",
                /* Comfortably past the 48px floor without taking a
                   sixth of a small phone. */
                minHeight: 56,
                fontSize: ts(20),
                marginTop: 8,
                flex: "0 0 auto",
              }}
            >
              🎲 {t("ludo.turn.rollCta")}
            </PrimaryBtn>
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
          tableTitle={game.title}
          winnerSeat={game.winner_seat}
          myId={myId}
          seatName={seatName}
          sessionId={game.id}
          pieces={state.pieces}
          seatsInPlay={game.target_seats}
          busy={busy}
          onRematch={mySeatRow ? () => act(() => rematch(game.id)) : undefined}
          onBack={() => navigate("/app/games")}
        />
      )}

      {/* Chat travels with every phase */}
      {mySeatRow && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            /* ONE ROW during play. Wrapping is what turned three pills
               into three stacked rows and took roughly 200px off the
               board; off the play screen it may wrap as it always
               did. Leave is not here any more — it is in the bar. */
            flexWrap: playing ? "nowrap" : "wrap",
            margin: playing ? "8px 0 0" : "12px 0 0",
            flex: "0 0 auto",
          }}
        >
          <EmojiButton onSend={sayQuick} disabled={game.status === "finished"} />
          <QuickChat onSend={sayQuick} disabled={game.status === "finished"} />
          {!playing && game.status !== "finished" && (
            <GhostBtn onClick={() => setLeaveAsk(true)} style={{ minHeight: 52 }}>
              {t("ludo.ceremony.leaveCta")}
            </GhostBtn>
          )}
        </div>
      )}
      {/* THE THREAD STANDS DOWN ON A SHORT SCREEN. Its trigger is a
          full-width bar costing about 70px, and on a 667px phone that
          is 70px taken from the only thing on the screen that matters.
          Quick phrases and emoji stay — they are the two taps people
          actually use mid-game — and the full thread is a tap away
          again the moment the game ends or the screen is taller. */}
      {mySeatRow && !(playing && shortScreen) && (
        <div style={{ flex: "0 0 auto" }}>
          <ChatPanel sessionId={game.id} myId={myId} seats={seats} />
        </div>
      )}

      </div>

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
