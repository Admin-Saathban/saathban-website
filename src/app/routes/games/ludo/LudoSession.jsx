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
import { APP_COLORS as C, A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { useSession } from "../../../lib/session.jsx";
import { Card, SectionLabel, BodyText, Pill, PrimaryBtn, GhostBtn } from "../../circle/ui.jsx";
/* NO UNDO. `game_undo` and `game_undo_available` are still in the
   database and are called from nowhere: the owner has removed
   taking a move back from ludo, and a client that no longer
   offers it must not keep asking the server whether it could.
   The RPCs are left standing rather than dropped because a
   migration that removes a function is the one kind that cannot
   be rolled back cheaply, and nothing costs anything while no
   caller exists. */
import { fetchSession, startSession, roll, move, tick, rematch, legalFor } from "./ludoRails.js";
import { tableIsSoft, reformTable, fetchSeatInvites, seen } from "./ludoRails.js";
import SeatSheet, { TableName } from "./TableEdits.jsx";
import { useGameFeel, GameMotionStyles, Confetti } from "../../../lib/gameFeel.jsx";
import { GAME, NO_SELECT } from "../gameSurface.js";
import { GameBtn, GamePill, GamePanel, GameMotion, FlashLine, useBackToClose } from "../GameUI.jsx";
import InfoPanel from "../../../components/InfoPanel.jsx";
import { SoundButton, SoundPanel } from "../SoundControls.jsx";
import GameSettings from "./GameSettings.jsx";
import { stopAllSound, resumeSound, startAmbience, stopAmbience, playSound } from "../../../lib/sound.js";
import { themeOf, themeVars } from "../themes.js";
import { useGameFullscreen } from "../fullscreen.js";
import { SEAT_COLORS, povRotation } from "./board.js";
import LudoBoard from "./LudoBoard.jsx";
import PlayerCard from "./PlayerCard.jsx";
import SeatPlates from "./SeatPlates.jsx";
import ChatPanel from "./ChatPanel.jsx";
/* EmojiButton and QuickChat are gone from this screen. Emoji live
   inside the chat's own keyboard now, and the chat opens from the
   particle on your own circle — the row of pills under the board
   was costing about seventy pixels of the only thing on the screen
   that matters. The bubbles stay: a remark still floats by its
   speaker's corner. */
import { ChatBubbles, BUBBLE_MS } from "../QuickChat.jsx";
import { readMutes } from "../tableMutes.js";
import LudoCelebration from "./LudoCelebration.jsx";
import { screenCorner } from "./SeatPlates.jsx";
import { leaveSession } from "../../../lib/games.js";
import { fetchChat } from "./ludoRails.js";
import CollisionNote from "../CollisionNote.jsx";

/* HOW LONG SOMEBODY ELSE'S THROW TAKES TO WATCH.

   A THROW IS 700ms OF CUBE, AND THE BEAT HAS TO CLEAR IT. The
   dice animation loops every 700ms and only lands square at the
   end of a loop, so a hold shorter than one full turn would stop
   the cube mid-air and cut the settle. 1400 is two throws' worth
   of clock for one throw's worth of turning: the die tumbles, it
   comes down, and THEN there is the beat a person leaves before
   reaching for a piece.

   BOT_GAP is that plus room for the walk, so one bot's turn is
   finished being watched before the next is asked for. */
/* Where one person's "talk me through it" is remembered. */
const HINTS_KEY = "sb-ludo-hints";

/* SOMEBODY ELSE'S THROW, IN TWO PARTS.

   It was one: the dice tumbled for the whole hold and the board
   was applied the moment it ended, so the die went from turning
   straight to gone and the number it landed on was never on the
   screen as a still object. The owner's words — he sees the goti
   move without ever seeing what the bot got.

   BOT_THROW is the cube turning (one full 700ms loop, so it stops
   square). BOT_HOLD is the number sitting there afterwards, lit,
   with nothing else happening. Only then is the move applied and
   the goti walks.

   BOT_GAP has to clear all of it plus the walk, or the next bot's
   tick interrupts the last one's number. */
const BOT_THROW = 700;
/* How long a rolled number sits on the table before anything else
   moves. One number, used by a bot's throw and by an auto-played
   move alike, because it is the same promise to the same eye. */
const HOLD_MS = 800;
const BOT_HOLD = HOLD_MS;
const BOT_BEAT = BOT_THROW + BOT_HOLD;
const BOT_GAP = 3600;

/* Everything the play screen draws from, as one string. If two
   polls produce the same one, the second is not a render. */
function sameBoard(a, b) {
  if (!a || !b) return false;
  return sig(a) === sig(b);
}
function sig(g) {
  return JSON.stringify([
    g.status,
    g.current_seat,
    g.winner_seat,
    g.turn_deadline,
    g.title,
    g.rematch_id,
    g.target_seats,
    g.state,
    (g.seats || []).map((x) => [x.seat, x.profile_id, x.is_bot, x.presence, x.name, x.avatar]),
  ]);
}

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

/* ── THE THREE CONTROLS AT THE TOP OF THE GAME ────────────────

   The owner placed these by dragging at 390x640: leave at the far
   left, sound and settings together on the right. Solid dark
   squares, 40px, radius 12, a white glyph and no text label on any
   of them.

   The POSITIONS are honoured as an arrangement rather than as
   pixel coordinates — leave alone on the left, the other two
   together on the right — because a 390x640 layout hard-coded in
   absolute pixels is a layout that is wrong on every other phone,
   and the thing he was placing was the arrangement.

   No labels is the part that matters most: three round pills with
   words in them across the top of a board is a toolbar, and a
   toolbar is the app. ── */
function TopBtn({ onClick, label, children, btnRef = null }) {
  return (
    <button
      ref={btnRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        flex: "0 0 auto",
        width: 40,
        height: 40,
        borderRadius: 12,
        border: "none",
        background: "#1E2226",
        color: "#FFFFFF",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastTickRef = useRef(0);

  /* The die the player has picked up, and what it could do. The
     options come from the SERVER (ludo_desi_legal) — the same array
     the move RPC validates against — so the board can never offer
     something that would then be refused. */
  /* §8 — IS THIS TABLE STILL SOFT? Set, but not yet played: the
     window in which its seats, its name, its size and its dice can
     still be changed by tapping them. The server owns the answer
     (game_table_is_soft) and refuses the writes regardless; this
     only decides whether to OFFER the taps, because a control that
     is going to be refused should not be drawn.

     It starts false, so a table mid-game never flashes its editing
     affordances for one render while the answer is in flight. */
  const [soft, setSoft] = useState(false);
  const [seatSheet, setSeatSheet] = useState(null);
  const [seatInvites, setSeatInvites] = useState([]);
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
  /* ── WHOSE NUMBER IS BEING HELD UP, AND FOR HOW LONG ───────────

     The 800ms where a thrown number sits lit and nothing else
     moves. It lives HERE rather than inside the die because the
     die is replaced twice during a single throw — once when a
     tappable <button> becomes a tumbling <span>, once when the
     answer arrives and the plate rebuilds its row from real dice
     — so nothing the die remembers about its own past survives
     the transition it would need to watch.

     The session is the thing that resolves a throw, so it is the
     thing that knows. A seat number, not a boolean: at a table of
     four the hold belongs to whoever threw. */
  const [landingSeat, setLandingSeat] = useState(null);
  /* TRUE WHILE MY OWN THROW IS BEING READ. Nothing on the board
     may be offered while this is up — see doRoll. */
  const [rollHeld, setRollHeld] = useState(false);
  /* Up for a moment after any throw of mine, so a turn that ends
     with nothing to do still shows what was thrown. */
  /* Whether my own just-thrown number is still being read. `load`
     is declared above the state, so it reaches this through a ref
     — the same reason, and the same shape, as isSilentRef. */
  const deadHoldRef = useRef(false);
  /* A turn of mine that ended with nothing to do, parked until the
     number has been seen. */
  const deadStateRef = useRef(0);
  const [deadHold, setDeadHold] = useState(false);
  deadHoldRef.current = deadHold;
  const landingTimer = useRef(0);
  const holdNumber = (seat) => {
    if (seat == null) return;
    window.clearTimeout(landingTimer.current);
    setLandingSeat(seat);
    landingTimer.current = window.setTimeout(() => setLandingSeat(null), HOLD_MS + 240);
  };
  useEffect(() => () => window.clearTimeout(landingTimer.current), []);
  const [tumble, setTumble] = useState([1, 1]);
  /* Somebody else is throwing: { seat, die }. While this is set the
     board is deliberately one move behind the server. */
  const [botThrow, setBotThrow] = useState(null);
  /* THE MOMENT, IN WORDS. One line, named, and it leaves.

     A capture and a goti reaching home are the two things in this
     game that are worth saying out loud, and both used to pass in
     silence — a piece simply appeared back in its yard, or
     stopped being on the board. The strip has room for exactly one
     line and these are the two that earn it. */
  const [moment, setMoment] = useState(null);
  /* seat number -> the name to say. seatName takes a row. */
  const whoAt = (seat) =>
    seatName((game?.seats || []).find((x) => x.seat === seat), t);

  /* A GOTI REACHED HOME. 0113 puts it on the move record, so this
     is the engine's own answer rather than a piece count the client
     re-derived and could disagree about.

     Read off game.state rather than the `state` and `last` consts,
     which are declared several hundred lines below: a hook cannot
     reach forward, and doing it blanks the whole board with a
     temporal dead zone error. Second time in this file — there is a
     comment about the first one still standing further down. */
  const homeKey = game?.state?.last?.home ? JSON.stringify(game.state.last) : null;
  useEffect(() => {
    if (!homeKey || game?.state?.last?.seat == null) return;
    setMoment({
      key: homeKey,
      text: t("ludo.moment.home", { who: whoAt(game.state.last.seat) }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeKey]);

  const shownMoveRef = useRef(undefined);
  const botHoldRef = useRef(0);
  /* The moment the cube stops turning, halfway through the hold. */
  const botSettleRef = useRef(0);
  /* Whose sounds this viewer has silenced, reachable from `load`. */
  const isSilentRef = useRef(null);
  /* True while a move is waiting for its throw to finish. Nothing
     fetches or ticks past it: the board is deliberately one move
     behind the server for that beat, and reading ahead is how the
     held board gets thrown away. */
  const holdingRef = useRef(false);
  /* seat → the number it last threw; see lastDieBySeat below. */
  const lastDiceRef = useRef({});

  /* THE REMATCH THIS SCREEN HAS ALREADY SEEN.

     Following rematch_id used to happen inside load(), which runs on
     mount and again on every poll — so a table that already had a
     rematch bounced you off it the instant you arrived. Two things
     broke because of that, and they looked unrelated:

       - A finished board could not be looked at. You tapped it, saw
         it for a frame, and were thrown into the next game.
       - A notification for THIS table opened a DIFFERENT one, which
         reads as the app losing your game.

     A rematch is worth following when it happens WHILE YOU ARE
     WATCHING — everyone at the table moves to the new board together,
     which is the point. It is not worth following when it happened
     hours ago and you have come back to look at the old one.

     So the id seen on the first load is remembered and never
     followed. Only an id that APPEARS afterwards moves you. */
  const rematchOnArrival = useRef(undefined);


  /* The soft window and who is being waited for. Re-read whenever
     the board reloads: the window closes on the FIRST ROLL, which
     may be a bot's, and a stale `true` would leave a tap on screen
     that the server has already begun refusing. */
  const softClosed = useRef(false);
  const refreshTable = async () => {
    const isSoft = await tableIsSoft(sessionId);
    if (!isSoft) softClosed.current = true;
    setSoft(isSoft);
    setSeatInvites(isSoft ? await fetchSeatInvites(sessionId) : []);
  };
  /* Touched on the poll, at most every ten seconds. The board
     polls every 2.5s and the grace window is ninety, so this is
     as sparse as it can be and still keep a reader present. */
  const lastSeenPing = useRef(0);
  const ping = () => {
    const now = Date.now();
    if (now - lastSeenPing.current < 10000) return;
    lastSeenPing.current = now;
    seen(sessionId);
  };

  const load = async () => {
    const g = await fetchSession(sessionId);
    /* A BOT'S MOVE IS HELD BACK FOR ITS OWN THROW.

       The board would otherwise show the finished position at the
       same instant the die appears, so nobody ever sees a bot roll.
       The new state waits in a ref while the dice tumble beside
       that seat and a beat passes; then it is applied and the goti
       walks, exactly as a person's move does.

       Only for a move somebody else made, only once per move, and
       never on the first sight of a table — arriving at a board is
       not somebody's turn. */
    const mv = g?.state?.last;
    const key = mv ? JSON.stringify(mv) : null;
    const mover = mv?.seat;
    const moverRow = mover != null ? (g.seats || []).find((x) => x.seat === mover) : null;
    const mine = (g.seats || []).find((x) => x.profile_id === myId)?.seat;
    /* Read off every board that goes past, so a seat's face
       survives the next player's turn. Recorded BEFORE the hold, so
       the die is on the plate while its owner is throwing it. */
    if (mv && mv.seat != null && mv.die) lastDiceRef.current[mv.seat] = mv.die;
    const first = shownMoveRef.current === undefined;
    if (first) shownMoveRef.current = key;
    if (
      !first &&
      key &&
      key !== shownMoveRef.current &&
      moverRow &&
      mover !== mine &&
      g.status === "playing"
    ) {
      shownMoveRef.current = key;
      holdingRef.current = true;
      setBotThrow({ seat: mover, die: mv.die || null, phase: "throwing" });
      /* THE SAME NOISE A PERSON'S THROW MAKES.

         It made none. The dice sound existed and had exactly one
         caller in the whole app — the PREVIEW BUTTON in sound
         settings — so the one place a die is actually thrown was
         silent, for bots and for people alike. Half of why a bot's
         turn read as "the board just changed" is that nothing
         announced it had begun.

         Under this viewer's mute for that seat, like every other
         sound a seat makes. */
      if (!isSilentRef.current?.(mover)) playSound("dice");
      window.clearTimeout(botHoldRef.current);
      /* THE CUBE STOPS, AND THE NUMBER STAYS. Phase two puts the
         die on the plate showing what was actually thrown — the
         face comes from lastDiceRef, which was written a few
         lines above from this same move — and the plate's own
         landing animation lights it. Nothing else moves for
         BOT_HOLD. */
      botSettleRef.current = window.setTimeout(() => {
        setBotThrow((b) => (b ? { ...b, phase: "settled" } : b));
        holdNumber(mover);
      }, BOT_THROW);
      botHoldRef.current = window.setTimeout(() => {
        holdingRef.current = false;
        setBotThrow(null);
        setGame(g);
      }, BOT_BEAT);
      return g;
    }
    /* ── MY TURN MUST NOT END WHILE MY NUMBER IS BEING READ ───────

       The one throw that most needs showing is the one that costs
       the turn: everything in the yard, a six needed, a three
       thrown. The server ends a turn with no legal move at once,
       so the next board — with somebody else to play — arrived
       before the number had been on screen for a single frame, and
       the plate stopped drawing dice the moment it was not my turn
       any more.

       So a board that takes the turn away from me is parked for
       the rest of the hold. Exactly the treatment somebody else's
       move already gets, for the same reason: a thing worth
       watching is worth not being interrupted. */
    if (deadHoldRef.current && mine != null && g?.current_seat !== mine) {
      window.clearTimeout(deadStateRef.current);
      deadStateRef.current = window.setTimeout(() => {
        setGame((prev) => (prev && sameBoard(prev, g) ? prev : g));
      }, 700);
      return g;
    }
    shownMoveRef.current = key;
    /* NOTHING CHANGED, SO NOTHING RE-RENDERS.

       fetchSession builds a fresh object every 2.5 seconds whether
       or not a single field differs, and setGame with a new object
       is a re-render of the whole play screen. Most polls of most
       games change nothing at all — somebody is thinking.

       The signature is the fields the screen actually draws from.
       Cheap to build, and it cannot go stale the way a hand-written
       list of comparisons does, because it is one string. */
    setGame((prev) => (prev && sameBoard(prev, g) ? prev : g));
    if (g?.status === "playing") ping();
    /* Ask until it is settled. The window only ever closes, so
       one 'no' is final and the polling stops paying for it. */
    if (!softClosed.current) refreshTable();
    const seen = g?.rematch_id ?? null;
    if (rematchOnArrival.current === undefined) {
      rematchOnArrival.current = seen;
    } else if (g?.status === "finished" && seen && seen !== rematchOnArrival.current) {
      navigate(`/app/games/ludo/${seen}`, { replace: true });
    }
    return g;
  };

  useEffect(() => {
    let timer;
    /* A different table is a different arrival. React keeps this
       component mounted when only the :sessionId param changes, so
       without this the second table would inherit the first's memory
       of what its rematch was — and either follow a rematch it should
       not, or refuse to follow one it should. */
    rematchOnArrival.current = undefined;
    softClosed.current = false;
    shownMoveRef.current = undefined;
    window.clearTimeout(botHoldRef.current);
    window.clearTimeout(botSettleRef.current);
    window.clearTimeout(deadStateRef.current);
    holdingRef.current = false;
    setBotThrow(null);
    /* The plates' remembered faces, the bot pacemaker's clock and
       the presence throttle. All three are per-table and all three
       used to survive into the next one — see the note on the
       second reset effect below for why that matters and why it is
       in two pieces. */
    lastDiceRef.current = {};
    lastTickRef.current = 0;
    lastSeenPing.current = 0;
    load().catch(() => setError("ludo.errors.load"));
    timer = setInterval(async () => {
      try {
        /* Somebody else's move is on screen being thrown. Reading
           ahead here is what discarded it. */
        if (holdingRef.current) return;
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
        /* ONE TURN AT A TIME, AND SLOWLY ENOUGH TO WATCH.

           This asked game_tick for everything it could play, and
           game_tick loops until it reaches a human — so at a table
           with three bots one call played three turns and the board
           was handed the position they left behind. Three moves
           collapsed into one state change, and a walk animation has
           nothing to walk.

           0112 lets the caller cap it. The board asks for ONE, which
           makes it the pacemaker: the bot's move arrives on its own,
           its dice are shown tumbling, and only then does the goti
           walk. A turn you cannot watch is not a turn.

           BOT_BEAT is the whole ceremony — the throw and the pause
           after it — and the gap between ticks is that plus the
           walk, so the next bot never interrupts the last one. */
        if ((botTurn || lapsed) && Date.now() - lastTickRef.current > BOT_GAP) {
          lastTickRef.current = Date.now();
          await tick(sessionId, 1).catch(() => {});
          await load().catch(() => {});
        }
      } catch {
        /* transient; the next poll retries */
      }
    }, POLL_MS);
    return () => {
      clearInterval(timer);
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
  /* ── ABOVE `if (!game) return`, AND THAT IS THE WHOLE POINT ────

     This sat next to the thing it controls, three hundred lines
     down, which is past the early return this screen makes while
     the table is still loading. So the first render ran N hooks and
     the second ran N+1, React threw "rendered more hooks than
     during the previous render", and the board came up blank.

     Third time this file has blanked the board with a passing
     build, and the third different way: a const read before its
     declaration, twice, and now a hook below a return. All three
     have the same cause — this component is two thousand lines
     long, so "put it where it is used" and "put it where React
     needs it" point in different directions. React wins. Every
     hook in this file belongs above line 1092. */
  const [hints, setHints] = useState(() => {
    try {
      /* ABSENT OR ANYTHING LEGACY MEANS OFF. The switch is newer
         than the behaviour it governs, so a phone that has been
         running this app for weeks may hold a value written
         before the key existed, or by an older shape of it. Only
         the exact string a person's own tap writes counts as on;
         everything else — missing, "true", "1 ", a leftover from
         some earlier experiment — reads as off, which is the
         default the owner asked for and the safe direction to be
         wrong in. */
      return window.localStorage.getItem(HINTS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const putHints = (v) => {
    setHints(v);
    try {
      window.localStorage.setItem(HINTS_KEY, v ? "1" : "0");
    } catch {
      /* private mode; the switch still works for this sitting */
    }
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  /* ── WHICH SIDE THE MENU FALLS FROM ───────────────────────────

     The panel was pinned to the trailing edge and the control
     column is not always there: in Urdu the whole layout flips, so
     the hamburger sat on one side of the screen and its own menu
     dropped down the other. A menu has to fall from the button
     that opened it or it is not that button's menu.

     Measured off the control itself rather than assumed from the
     writing direction, so it stays true whatever else moves. */
  const settingsBtnRef = useRef(null);
  const [panelSide, setPanelSide] = useState("end");
  const openSettings = () => {
    try {
      const r = settingsBtnRef.current?.getBoundingClientRect();
      if (r) setPanelSide(r.left + r.width / 2 > window.innerWidth / 2 ? "right" : "left");
    } catch {
      /* no layout to read: the trailing edge is the safe default */
    }
    setSettingsOpen(true);
  };
  /* The leaving question answers to back as well. It is the one
     panel on this screen where a stray back press would do the
     very thing the panel exists to ask about. */
  useBackToClose(leaveAsk, () => setLeaveAsk(false));

  /* ── AND THE BACK GESTURE ASKS THE SAME QUESTION THE DOOR DOES ──

     The door confirms; the back gesture just left. So the owner
     backed out of a table believing he had quit it, and then got
     "your move" notifications from a game that was still running
     with his seat in it — which is not a notification bug at all.
     Leaving nulls the seat's profile_id and the turn notifications
     are keyed on profile_id (0114), so they stop the moment somebody
     actually leaves. He was never leaving. One missing confirm
     produced a defect that looked like it lived somewhere else
     entirely.

     IT HAS TO RE-ARM, which is why this is not simply another
     useBackToClose. That hook exists to CLOSE something: it pops
     the surface off its stack and, with nothing left behind it,
     releases the history entry. Right for a sheet, wrong for a
     guard — a guard that fires once has moved the problem to the
     second press. So the arming is state: back disarms it and
     raises the question, and dismissing the question arms it again.

     It sits UNDERNEATH every sheet on this screen, because it
     registers first and that hook runs the innermost surface. Back
     with the chat open closes the chat; back with nothing open asks
     whether you meant to leave. */
  const [backGuard, setBackGuard] = useState(true);
  /* ── READ OFF `game`, NOT OFF `atTable` ────────────────────────

     `atTable` is declared six hundred lines below this, and a hook
     argument is evaluated DURING RENDER — so naming it here threw
     "Cannot access before initialization" and blanked the board on
     the deployed build. Fourth time this file has done it, and the
     third distinct way; the build passed every time.

     The same expression, evaluated where it is safe. See the
     identical note on `autoMove`, which is the same fix for the
     same reason — and the reason there are now two of these is
     that a rule I wrote down one round ago was not enough on its
     own. Every hook in this component must read only from state
     and props declared above it, never from the derived consts in
     the render body. */
  const liveTable = game?.status === "playing" || game?.status === "lobby";
  useBackToClose(liveTable && backGuard, () => {
    setBackGuard(false);
    setLeaveAsk(true);
  });
  useEffect(() => {
    /* Armed again once the question is gone — and never while it is
       up, or the guard would take the press meant for the panel. */
    if (!leaveAsk) setBackGuard(true);
  }, [leaveAsk]);

  /* THE WHOLE SCREEN, FOR AS LONG AS THIS TABLE IS OPEN.

     Every other piece of chrome was already gone from the play
     screen — no app header, no page scroll, 100dvh — and the
     owner's Android still showed the system status bar above the
     game, which is the one thing layout cannot reach. Held from
     mount to unmount, so it is released by leaving, by back, and
     by opening any other screen; see fullscreen.js for what
     happens when the browser says no.

     Unconditional rather than tied to `playing`: a lobby is still
     inside a table, and dropping out of fullscreen at the moment
     the game starts would be the screen jumping under somebody
     just as they were about to be counted in. */
  useGameFullscreen(true);
  /* The chat sheet, and whose card is open. Both are opened from
     the circles at the corners: a person's circle opens their card,
     the particle on your own opens the chat. */
  const [chatOpen, setChatOpen] = useState(false);
  const [cardSeat, setCardSeat] = useState(null);
  const [unread, setUnread] = useState(0);
  /* 3, 2, 1, then 0 — which means "over, show the greeting". */
  const [countdown, setCountdown] = useState(null);
  /* Did this screen watch the game leave the lobby? */
  const wasLobby = useRef(false);
  const [bubbles, setBubbles] = useState([]);
  const seenChat = useRef(new Set());
  const startedOnce = useRef(false);

  /* ── WHAT A SECOND TABLE USED TO INHERIT FROM THE FIRST ─────────

     React keeps this component MOUNTED when only the :sessionId
     param changes — which is exactly what a rematch is — so every
     ref in this file survives the end of a game unless something
     clears it. Several did not, and each one made the second table
     behave unlike the first:

     · startedOnce / wasLobby — the two flags guarding the count-in.
       Both stayed true, so the second game was never counted in: no
       "3, 2, 1", no greeting, the board simply began.
     · seenChat — every chat id ever seen on this screen, growing
       for as long as the tab is open and consulted on every poll.
     · bubbles / ceremony — the last table's remarks and its dimming
       overlay, carried over the new one's opening.

     WHY THIS IS A SECOND EFFECT rather than four more lines in the
     one above. Those refs are declared here, three hundred lines
     BELOW the poll effect, and reaching upward for a const that is
     defined further down this file is the exact shape of the
     temporal-dead-zone fault that has blanked this board twice —
     both times with a passing build, both times only caught by
     opening a table. It is safe in an effect BODY and not safe in a
     dependency array, and a rule with an exception in it is a rule
     that gets broken at four in the morning. So: the reset lives
     below what it resets, and nothing reaches up. */
  useEffect(() => {
    startedOnce.current = false;
    wasLobby.current = false;
    seenChat.current = new Set();
    setBubbles([]);
    setCeremony(null);
  }, [sessionId]);

  /* "Setting the table…" while the seats are still filling, and
     "Khelte hain!" the moment play begins — once, not on every poll. */
  useEffect(() => {
    if (game?.status === "lobby") {
      wasLobby.current = true;
      setCeremony((c) => (c === null ? "setting" : c));
      return undefined;
    }
    if (game?.status === "playing" && !startedOnce.current) {
      startedOnce.current = true;
      /* COUNT THE TABLE IN ONLY WHEN THE TABLE IS ACTUALLY STARTING.

         "3… 2… 1…" over a dimmed board is right when the last seat
         fills. It is wrong when someone reopens a game they have been
         playing for ten minutes, and this effect cannot tell the
         difference on its own: startedOnce is per-mount, so every
         return to the screen looked like a beginning.

         Two ways to be sure it is a beginning — we watched it leave
         the lobby, or the table says it started seconds ago. The
         second covers the person who arrives by link at the moment
         play begins and never saw the lobby at all. */
      const sawLobby = wasLobby.current;
      const startedMs = game.started_at ? Date.now() - new Date(game.started_at).getTime() : Infinity;
      if (!sawLobby && !(startedMs >= 0 && startedMs < 8000)) {
        /* Mid-game arrival. No ceremony, no dimmed board — they are
           here to play, not to be welcomed to something already in
           progress. */
        return undefined;
      }
      /* §9: THE COUNTDOWN. Three, two, one over a dimmed board, then
         the table's own greeting. It is not decoration — a game that
         begins the instant the last seat fills begins without the
         people at it, and three seconds is how long it takes to look
         up from a phone and notice that something has started. */
      setCeremony("start");
      setCountdown(3);
      const ticks = [
        setTimeout(() => setCountdown(2), 800),
        setTimeout(() => setCountdown(1), 1600),
        setTimeout(() => setCountdown(0), 2400),
        /* The greeting holds for a second and a half after the
           count reaches zero. It used to be one second, which is
           not long enough to read two lines. */
        setTimeout(() => setCeremony(null), 3900),
      ];
      return () => ticks.forEach(clearTimeout);
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
          /* MUTED PEOPLE DO NOT FLOAT. A card's "their emoji"
             switch has to reach the bubbles as well as the sheet,
             or muting somebody would silence them in the place
             nobody was looking and leave them shouting over the
             board. Read live rather than cached: a mute set
             mid-game applies to the next line, not the next
             session. */
          const muted = readMutes(game.id);
          const heard = fresh.filter(
            (m) => m.sender_id === myId || !muted[m.sender_id]?.emoji
          );
          const others = heard.filter((m) => m.sender_id !== myId).length;
          if (others) setUnread((n) => n + others);
          const add = heard.slice(-3).map((m) => ({
            id: m.id,
            text: m.body,
            seat: (game.seats || []).find((x) => x.profile_id === m.sender_id)?.seat ?? 0,
          }));
          if (!add.length) return;
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

  /* Mine appears at once; the poll will simply find it already seen. */
  const bubbleLocally = (text) => {
    const mine = { id: `local-${Date.now()}`, text, seat: mySeatRow?.seat ?? 0 };
    setBubbles((b) => [...b, mine]);
    setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== mine.id)), BUBBLE_MS);
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
     animation is decoration over a real wait, never a fake one.

     LUDO_MOTION_SPEC §4: SEVEN FACES OVER 700ms, DECELERATING. It was
     a flat 80ms interval, which reads as a slot machine rather than
     as a thrown die — a real die arrives at its answer, it does not
     stop dead. The gaps below sum to 700 and grow as they go, so the
     faces visibly slow into the result.

     Two honesties are kept. The animation never finishes before the
     server has answered: if the request is still in flight after the
     seven faces, the churn continues at the slowest gap rather than
     settling on a number nobody has rolled yet. And it never CUTS
     short either — a reply that arrives in 90ms still gets the full
     tumble, because a die that stops the instant you let go of it
     looks like it was never thrown. */
  const TUMBLE_GAPS = [55, 65, 80, 95, 115, 140, 150]; // 700ms
  const doRoll = async () => {
    if (rolling || busy) return;
    setRolling(true);
    /* THE DICE LEAVE THE HAND HERE, not when the server answers.
       The sound is part of the tap's response, and a noise that
       waited on the network would be the lag all over again in
       a form you could hear. */
    playSound("dice");

    let stopped = false;
    const face = () => 1 + Math.floor(Math.random() * 6);
    const churn = (i) => {
      if (stopped) return;
      setTumble([face(), face()]);
      const gap = TUMBLE_GAPS[Math.min(i, TUMBLE_GAPS.length - 1)];
      window.setTimeout(() => churn(i + 1), gap);
    };
    churn(0);
    const floor = new Promise((r) => window.setTimeout(r, 700));

    try {
      /* Both, not either: the throw takes as long as the slower of
         the animation and the answer.

         NOT through act(), which set `busy` and greyed the whole
         board for the length of the round trip. The dice are
         already tumbling — that IS the response to the tap — and
         there is nothing on the board a person could break by
         touching it while the throw is in the air. */
      await Promise.all([
        roll(game.id).then(() => load()).catch((err) => {
          setError(err.message || "ludo.errors.generic");
        }),
        floor,
      ]);
    } finally {
      stopped = true;
      setRolling(false);
      /* ── THE HOLD IS PART OF THE THROW, NOT OF THE RECONCILE ──

         A bot's number was held because its whole move is held
         back and released as one; mine was not, because my roll
         takes the optimistic path — the answer lands, the board
         updates, the halos appear, and the glow was left to
         decorate a turn that had already moved on. The owner's
         recording is unambiguous side by side, which is why he
         called it asymmetric rather than missing.

         So the throw now ends the way somebody else's does: the
         cube stops, the number sits lit, and NOTHING is offered
         until that is over. `rollHeld` is what the board reads to
         keep its halos to itself for those 800ms. */
      setRollHeld(true);
      window.setTimeout(() => setRollHeld(false), HOLD_MS);
      /* ── A DEAD ROLL IS THE ONE THAT MOST NEEDS SHOWING ────────

         First turn, everything in the yard, he needs a six: he
         throws a three and the turn is gone before the number is
         on the screen. The server ends a turn with no legal move
         immediately, so the board went straight past the one piece
         of information he actually wanted — what it cost him.

         `deadRoll` holds the board's own reading of the throw for
         the length of the hold plus a beat, so the number sits
         lit, a line says there was nothing to do with it, and only
         then does the table move on. */
      setDeadHold(true);
      window.setTimeout(() => setDeadHold(false), HOLD_MS + 500);
      /* The cube has come to rest. Hold the number up before
         anything else is allowed to happen — including the
         auto-played move, which waits out the same HOLD_MS.

         Read off `game` rather than `mySeatRow`, which is declared
         below this. It would be safe here — doRoll runs from a tap,
         long after render — but that is the precise distinction this
         file has blanked the board over four times, and a rule with
         an exception is a rule nobody keeps at 4am. */
      holdNumber(
        (game?.seats || []).find((x) => x.profile_id === myId)?.seat ??
          game?.current_seat ??
          null
      );
    }
  };

  /* Tap a goti. If the die could do two different things with it —
     move the pair together, or send this one on alone — ask, rather
     than guessing which the person meant. */
  /* A DROP NAMES ITS OWN DESTINATION, so unlike a tap there is
     nothing left to ask: the option carried back by the board is the
     exact move, pair or single, that the goti was let go on. That is
     also why dropping is disabled while the jota question is open —
     the question would be answered twice, once by each hand. */
  /* ── THE TAP MOVES THE GOTI. THE SERVER IS TOLD AFTERWARDS. ──

     Every move used to go: setBusy(true), await the move RPC, await
     a full refetch, and only then did the board have a new position
     to walk to. Two round trips before the goti twitched, with the
     board greyed out for both of them. On a phone on Pakistani
     mobile data that is most of a second of nothing, every single
     turn — and it is the largest part of what the owner means by
     "tapping a goti does not move it at once".

     The option the board hands back already carries `to`, the exact
     square the server will put the piece on: it came FROM the
     server (ludo_desi_legal) and the move RPC validates against the
     same list. So the destination is not a guess — it is the
     server's own answer, arriving early.

     What is NOT applied locally is anything the option does not
     state: a capture, the turn passing, an extra roll. Those arrive
     with the real state a moment later and reconcile quietly, which
     is the right way round — the piece the person is watching moves
     now, and the consequences catch up.

     If the server refuses, load() overwrites the guess with the
     truth and the goti steps back. That has to be possible and it
     has to be rare; it is rare because the option came from the
     server in the first place. */
  const sendMove = (piece, option, dieIndex = pickedDie) => {
    setGame((g) => {
      if (!g?.state?.pieces || g.current_seat == null) return g;
      /* WHOSE GOTI, NOT WHOSE TURN. At a team table where both
         partners have captured, a roll may move either of the
         team's gotis — so the option says which seat it belongs
         to, and the optimistic update has to move that one. It
         used to assume current_seat, which at a sharing table
         would have moved MY goti on screen and the partner's on
         the server: the board would have corrected itself a
         moment later, which is the worst way for it to be wrong. */
      const seat = option.owner ?? g.current_seat;
      const pieces = g.state.pieces.map((row, s2) =>
        s2 === seat ? row.map((p, i) => (i === piece ? option.to : p)) : row
      );
      /* The die is spent, so it stops being offered while the
         answer is in flight. */
      const dice = Array.isArray(g.state.dice)
        ? g.state.dice.map((d, i) => (i === dieIndex ? { ...d, used: true } : d))
        : g.state.dice;
      return { ...g, state: { ...g.state, pieces, dice } };
    });
    /* No setBusy: the board stays live. A second tap during the
       flight is answered by the options list, which the local state
       has already emptied for that die. */
    move(game.id, { piece, die: dieIndex, split: option.split, owner: option.owner ?? null })
      .then(() => load())
      .catch((err) => {
        setError(err.message || "ludo.errors.generic");
        load().catch(() => {});
      });
  };

  const dropPiece = (i, option) => {
    if (!option) return;
    sendMove(i, option);
  };

  const tapPiece = (i) => {
    const mine = options.filter((o) => o.piece === i);
    if (!mine.length) return;
    if (mine.length === 1) {
      sendMove(i, mine[0]);
      return;
    }
    /* THE PAIR'S FIRST MOVE IS THE ONLY TIME INTENT IS AMBIGUOUS.

       Two of your gotis on one square that have never moved together
       could be a jota you are building or two pieces that happen to
       share a square, and nothing on the board can tell us which. So
       we ask — once. The engine is what makes "once" true rather than
       a flag we keep: ludo_desi_legal offers both a "pair" and a
       "single" for a virgin stack, and after the pair has moved
       together it offers pair moves only. There is no second ask to
       suppress, and no state to get wrong.

       Which of the two moves alone used to be arbitrary, because the
       gotis were interchangeable. They are not any more — each one
       carries its own number now — so the person choosing "just one"
       is offered the choice of which. */
    const seat = game.current_seat;
    const square = Number(state.pieces?.[seat]?.[i] ?? 0);
    const mates = (state.pieces?.[seat] || [])
      .map((p, idx) => (Number(p) === square ? idx : -1))
      .filter((idx) => idx >= 0 && options.some((o) => o.piece === idx && o.kind === "single"));
    setChooser({ piece: i, opts: mine, mates });
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
    /* THE NUMBER IS READ FIRST, EVEN WHEN NOBODY HAS TO CHOOSE.

       This was the path the owner was on: one legal move, so the
       board played it the instant the dice landed and the turn was
       over before he had seen what he threw. The hold is not a
       decoration on the tumble, it is the part of a throw where
       you find out what happened — so it belongs here most of all,
       because this is the one path with nothing else to slow it
       down.

       Cleaned up on the way out: a table left mid-hold would
       otherwise send a move from a screen nobody is on. */
    const held = window.setTimeout(() => sendMove(only.piece, only, only.die), HOLD_MS);
    return () => window.clearTimeout(held);
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
  /* THE PLAYERS SIT AT THE BOARD, NOT AT THE SCREEN'S EDGES.

     The two rows of circles used to be siblings of the board's slot,
     so the slot took every pixel between them and the circles were
     pinned to the top and bottom of the phone — with two hundred
     pixels of empty table between each row and the board it belongs
     to. Side by side with the recording that is the loudest
     remaining difference: theirs sit within a few pixels of the
     wood.

     So the rows moved INSIDE the slot and the whole group centres
     together. The board is then measured against what is left after
     them, which is what these two refs are for — a constant would
     be wrong the moment a name wraps or the text size is turned
     up. */
  const topRailRef = useRef(null);
  const bottomRailRef = useRef(null);
  const [boardPx, setBoardPx] = useState(0);
  useEffect(() => {
    const el = fitRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const rails =
        (topRailRef.current?.offsetHeight || 0) +
        (bottomRailRef.current?.offsetHeight || 0);
      /* Two pixels of slack, so a rounded-up board can never grow
         the slot it was measured from and start the loop. */
      const side = Math.max(140, Math.floor(Math.min(r.width, r.height - rails - 2)));
      setBoardPx((prev) => (Math.abs(prev - side) > 1 ? side : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (topRailRef.current) ro.observe(topRailRef.current);
    if (bottomRailRef.current) ro.observe(bottomRailRef.current);
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

  /* ── §8: THE MOVE YOU CAN TAKE BACK ────────────────────────────
     The button is only on screen while the server says it is
     available, so it is never a dead control — and the server is
     asked rather than guessed, because the answer changes the moment
     the next player rolls and this screen is not the one that would
     notice.

     When it is refused anyway — the answer went stale between seeing
     the button and pressing it — the reason is explained rather than
     announced. That is what §11's dismissing panel is for: it leaves
     on its own, it pauses if you are still reading it, and it cannot
     carry an action, which is right, because there is nothing left to
     do about a move the table has already moved past. */
  /* UNDO IS GONE. It used to sit here: a probe on every roll asking
     the server whether the last move could be taken back, a button
     under the board, and a panel explaining each of the four ways
     the answer could be no. Removed on the owner's ruling — with it
     goes one RPC per roll per player, which the board was paying
     for on every turn of every game. */

  /* §7: THE GAME TAKES ITS SOUND WITH IT WHEN IT GOES.

     Effects are fired as one-shot nodes that outlive whatever
     scheduled them, so a capture flourish begun the instant somebody
     tapped Leave carried on playing over the games list. Suspending
     the audio context on unmount is the only thing that catches
     sounds already in flight — stopping sources one at a time races
     them and loses.

     Resumed on mount for the next table, so leaving one game and
     opening another is not silent. */
  /* And the table's own room tone, asked for on arrival and taken
     away on the way out. It cannot start until somebody has touched
     the page — startAmbience remembers the wish and the first tap
     begins it, which is the browser's rule and not one anybody
     should have explained to them. */
  useEffect(() => {
    resumeSound();
    startAmbience("ludo");
    return () => {
      stopAmbience();
      stopAllSound();
    };
  }, []);

  const [soundOpen, setSoundOpen] = useState(false);

  /* Ludo keeps its last move in state rather than fetching the move
     log, so the feel hook watches a key instead of an id. Pieces plus
     the last move is a sound key: the pieces array cannot come back
     identical two moves running, so no real move is ever swallowed
     as "no change". */
  const ludoState = game?.state || {};
  /* WHOSE SOUNDS THIS VIEWER HAS TURNED OFF. Read fresh on every
     render rather than held in state: the switch is a tap away on
     the card and it should apply to the next move, not the next
     visit. localStorage reads are cheap and the list is four
     people long at most. */
  const isSilent = (seat) => {
    const row = (game?.seats || []).find((x) => x.seat === seat);
    const pid = row?.profile_id;
    if (!pid || pid === myId) return false;
    return readMutes(game.id)[pid]?.sounds === true;
  };
  /* THROUGH A REF, DELIBERATELY. `load` is declared several hundred
     lines above this and closes over whatever it names; reaching
     for `isSilent` by name from up there is the exact shape of the
     temporal-dead-zone fault that has blanked this board twice
     (the build passes; opening a table is what catches it). A ref
     is assigned during render and read during an effect, which is
     an order that cannot invert. */
  isSilentRef.current = isSilent;

  useGameFeel({
    gameKey: "ludo",
    isSilent,
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
  /* Waiting is a state of the table, not a different screen. */
  const waiting = game.status === "lobby";
  const atTable = playing || waiting;
  /* Seats whose person is not answering, so the bot is playing them. */
  const awaySeats = (seats || []).filter((r) => !r.is_bot && r.presence === "away");
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
  /* WHAT EACH SEAT LAST THREW.

     The engine keeps only the LAST move on the table, so this is
     accumulated as the moves go past rather than read off the
     state: seat by seat, the number that seat came up with. An
     idle die then shows a real face instead of a blank one, which
     is what a die that has been thrown looks like lying on a
     table.

     A ref, not state: it changes on the same poll that changes the
     board, and a second render for it would be a second render for
     nothing. */
  const lastDieBySeat = lastDiceRef.current;

  /* WHICH SEAT IS MID-THROW. Mine while I am rolling; a bot's
     while its own throw is being shown (see the bot beat). */
  /* ONLY WHILE THE CUBE IS ACTUALLY TURNING. In the settled half
     of somebody else's throw this goes back to null, which is
     what lets the plate draw a still die showing the number they
     threw — and what makes the die's own landing animation fire,
     because that is armed by the edge out of `rolling`. */
  const rollingSeat = rolling
    ? mySeatRow?.seat ?? null
    : botThrow && botThrow.phase !== "settled"
    ? botThrow.seat
    : null;

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

  /* ── WHOSE NUMBERS ARE SHARED ──────────────────────────────

     The same condition the engine uses, read from the same field:
     a team table of four, and both partners have taken somebody.
     captured_by is not new state invented for teams — it has
     always been there for capture-before-home, which is why the
     rule could be specified this way at all.

     Recomputed rather than sent: the server would have to add a
     field to every board fetch to say something both sides can
     already work out, and a second copy of a fact is a second
     thing that can be wrong. */
  const sharingSeats = (() => {
    if (!rules?.teams || game.target_seats !== 4) return null;
    const cap = Array.isArray(state.captured_by) ? state.captured_by : [];
    return [0, 1, 2, 3].filter((n) => cap[n] === true && cap[(n + 2) % 4] === true);
  })();

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
  /* The deadline, not the count. SeatPlates does the counting, so
     nothing on this screen re-renders on a one-second clock. */
  const last = state.last;
  /* NARRATION IS OFF UNLESS ASKED FOR.

     "Bot rolled 5 and moved" is the board describing itself to
     somebody who is watching it happen. The dice tumble and the
     token travels; that IS the feedback, and everybody at the
     table already knows how ludo works. A running line under a
     board people have played for fifty years is the app
     explaining the obvious, and it costs the board height to do
     it.

     House rules can turn it on for anyone who wants it — someone
     playing at arm's length, or with the sound off, may. What
     stays regardless is the rare and the consequential: somebody
     leaving, and the countdown. Those announce themselves once
     and leave. */
  const narrate = rules?.narrate === true;

  /* ── MOVE HINTS, AND THEY ARE OFF ─────────────────────────────

     "Tap the goti you'd like to move". "Tap a die, then tap the
     goti it should move". "The 2 had nowhere to go, so it goes
     unused". Three sentences teaching ludo to somebody who has
     played it for sixty years, once per turn, for ever.

     WHAT IS NOT A HINT, and therefore is not behind this switch:
     whose turn it is, and what actually happened. A capture, a
     goti reaching home and somebody winning are results — the
     board changed and the person is owed a sentence saying why.
     The line that says a bot has taken a seat stays too: that is
     the table changing who you are playing, and hiding it would
     be the game keeping something from you.

     A PREFERENCE, NOT A HOUSE RULE. It is how one person likes to
     be spoken to, so it belongs to them and not to the table —
     the host does not get to decide whether everybody else is
     coached. Kept in localStorage rather than on the profile: it
     is a display setting, it must survive a signed-out reload, and
     it is not worth a round trip. */

  /* §8 — WHAT MAY BE TAPPED, and by whom.

     Anyone at the table may take an empty seat (it is their own
     colour they are choosing). Only the person who opened it may
     re-size it, rename it, change the dice or ask someone else
     in — those change the table for everybody at it. The server
     draws exactly this line; this is the same line drawn in
     pixels so nobody taps into a refusal. */
  /* SETTINGS LOCK WHEN PLAY STARTS, and `soft` alone was not
     enough to say when that is.

     game_table_is_soft asks the SERVER, which answers on a poll
     — so for up to one poll after the first roll the client still
     believed the table was editable, and the owner saw a green +
     on the die offering two-dice mode in the middle of a game.
     Worse, the badge is drawn beside dice that have already been
     thrown, which is the exact moment changing their number
     would be nonsense.

     Three local facts close that window without waiting for a
     round trip: dice in hand, a move already made, or a piece
     off its yard. Any of them means the game has begun, whatever
     the last poll said. The server refuses these edits anyway
     (0092); this is about not OFFERING what will be refused. */
  const anyPieceMoved = (state?.pieces || []).some((row) => (row || []).some((p) => p > 0));
  const begun = hasDice || !!state?.last || anyPieceMoved;
  const editable = soft && playing && !!mySeatRow && !begun;
  /* THE CLOCK IS HELD, SO NO CLOCK IS DRAWN (0094). Before the
     first roll, at a table holding nobody but bots, the server
     does not take the opening turn — the person is still setting
     the table. A ring emptying over that would be the clock that
     lies, twice warned against in this file: it would count to
     zero and nothing would happen. Both conditions are the
     server's, restated here rather than guessed. */
  const clockHeld =
    soft && seats.every((x) => x.is_bot || x.profile_id === myId);
  const iAmHost = game.created_by === myId;
  /* name-by-seat, for "waiting for {name}" in the seat itself. */
  const pendingBySeat = {};
  for (const inv of seatInvites) {
    if (inv.name) pendingBySeat[inv.seat] = inv.name;
  }
  const platePins = {
    /* MY OWN SEAT IS ALWAYS TAPPABLE, everyone else's only while
       the table is soft. The difference is what the tap can do:
       on my own seat there is always the marks I wear on my four
       gotis, which are mine rather than the table's; on anybody
       else's there is only what §8 allows before the first roll. */
    onTapSeat:
      editable || mySeatRow
        ? (seat) => {
            if (editable || seat === mySeatRow?.seat) setSeatSheet(seat);
          }
        : undefined,
    pendingBySeat,
    /* A PERSON'S CIRCLE OPENS THEIR CARD; a bot's or an empty
       chair's opens the seat, which is the host's to manage. A bot
       has no profile and a profile is not a chair, so the two never
       compete for the same tap. */
    onOpenProfile: (seat) => setCardSeat(seat),
    onOpenChat: () => {
      setUnread(0);
      setChatOpen(true);
    },
    unread,
    /* onToggleSpare is gone with the badge it drew. The dice count
       is chosen in the setup room and frozen with the rest of the
       house rules at the first roll — the board does not offer it
       at all now, rather than offering it and then refusing. */
  };

  return (
    <>
      {/* saath-tumble and every other games animation now live in
          lib/gameFeel.jsx, under ONE reduced-motion rule. The old
          version disabled itself by redefining the same keyframes
          inside a media query, which worked only because the later
          definition wins — a source reorder away from silently
          animating again for people who asked it not to. */}
      <GameMotionStyles />
      <GameMotion />
      <Confetti active={game.status === "finished" && game.winner_seat === mySeatRow?.seat} />

      {/* THE COLUMN. During play it is the viewport: flex, no scroll,
          the board taking whatever the rows leave it. In the lobby and
          after the final whistle it scrolls like the page it is —
          those screens are reading, not playing. */}
      <div
        style={
          atTable
            ? {
                /* BORDER-BOX, and it is the whole bug.

                   This column was content-box with 12px of side
                   padding, so width:100% measured 390 on a 390-wide
                   phone and the padding pushed its contents to 402.
                   The board was then measured against THAT and drawn
                   374 wide starting at x=20 — a margin on the left,
                   the green and red zones running off the right, and
                   at the opponent's seat a plate pushed far enough
                   off-screen that one of its two dice was cut in
                   half. One box model, two "bugs" that were the same
                   bug. */
                ...NO_SELECT,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                flex: "1 1 auto",
                minHeight: 0,
                overflow: "hidden",
                /* §2: edge to edge, with EVEN margins. The old 12px
                   was even too — it was the box model that made it
                   lopsided. */
                padding: `4px ${GAME.edge}px 6px`,
                maxWidth: 640,
                width: "100%",
                margin: "0 auto",
              }
            : { boxSizing: "border-box", overflowY: "auto", padding: "16px 12px 64px", maxWidth: 640, width: "100%", margin: "0 auto" }
        }
      >
      {/* ── THE THREE CONTROLS, IN A COLUMN ON THE RIGHT ──────────

           They were a row across the top: the door at the left edge
           and the other two at the right, with the table's name
           between them. The owner's ruling is a vertical column
           pinned to the top-right, door topmost, evenly spaced.

           Which also buys the board back a whole row of height —
           the bar was 40px plus its margins across the full width,
           and the column occupies 40px of width down the side of a
           board that is square and therefore has room there. ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "row-reverse",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          /* ── THE CHROME STARTS BELOW THE TITLE LINE ───────────
               A column flush with the very top of the screen sits
               in the same band as the table's name and, on a phone
               with a notch, under the system clock. Dropped so it
               begins clear of both. ── */
          paddingTop: 48,
          /* THE ROW GETS ITS OWN INSET, and the board does not.

             GAME.edge is 6px because §2 wants the board edge to edge,
             which is right for a board and wrong for a 44px round
             control: at 6px from the screen edge, on a dark ground, a
             white circle reads as CLIPPED. Nothing was actually
             overflowing — measured on the deployed table, no element
             crossed the viewport at all — it simply had no room to
             sit in, which is what the owner has been seeing on every
             game screen. */
          paddingInline: 8,
          margin: playing ? "0 0 4px" : "8px 0 10px",
          flex: "0 0 auto",
        }}
      >
        {/* §8.2 — one line, on the board, never a screen before it. */}
        <CollisionNote />
        {/* ONE WAY OUT (§2). The back chevron that used to sit here
            is gone: it left a live game instantly and without asking,
            which made the control that abandons your table the one
            that looked most like browser furniture. The door below
            asks first, and is the only thing on this screen that
            navigates. */}
        {/* The name of the game earns its space in the lobby, where
            there is no board yet. Once play starts the board IS the
            screen (§1) and the title is 30px the board should have. */}
        {/* THE NAME IS A LINE OF TEXT, IN EVERY STATE.

            The lobby drew it as a heading and play drew it as an
            editable field — so "Name this table" sat over a live
            board as a dashed input box, which is a form control on
            a table. The room names the table; the board says what
            it is called. */}
        <TableName title={game.title} />

        {/* THE BUG: THE DOOR WAS ONLY THERE DURING PLAY.

            `playing` is game.status === "playing", and the host now
            arrives at the board BEFORE that — they wait on it while
            the seats fill, which is the flow the owner ruled. In
            that state this rendered nothing at all, so the bar held
            a sound button and a gap where the way out should be. A
            control that is absent is indistinguishable from one that
            is dead, and "tapping it does nothing" is what an absent
            control looks like when you know it is supposed to be
            there.

            The other half of the report — "and the game continues in
            the background" — is the behaviour, not the bug: the
            table stays yours and resumes exactly where it was. That
            is what the door is FOR. Giving up the seat is a
            different act with a different control and its own
            confirm.

            atTable, so it is there whenever there is a board to
            leave. */}
        {/* ── THE DOOR, ALONE, IN THE OPPOSITE CORNER ─────────────
             Owner's ruling. The two settings controls keep their
             column; the way out stands by itself where nothing
             else can be pressed by mistake for it. ── */}
        {atTable && (
          <TopBtn onClick={() => setLeaveAsk(true)} label={t("ludo.back")}>
            {/* DRAWN, NOT TYPED. A door emoji is a blank tofu box
                on anything without a font for it, which included
                the browser this was first verified in. */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
          </TopBtn>
        )}

        {/* Sound and settings sit together on the right, in the
            order the owner placed them. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "0 0 auto" }}>
          {/* THE DOOR IS NOT IN THIS COLUMN — see the other corner
              below. Leaving is a different kind of act from turning
              the sound down, and stacking it with two settings
              controls made a three-tall tower of chrome down one
              edge of a square board. */}
          {false && atTable && (
            <TopBtn onClick={() => setLeaveAsk(true)} label={t("ludo.back")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M18 12H10m0 0 3-3m-3 3 3 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </TopBtn>
          )}
          <TopBtn
            onClick={() => setSoundOpen((v) => !v)}
            label={t("games.sound.title")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor" />
              <path
                d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </TopBtn>
          {/* THE HAMBURGER, matching the app's More icon — three
              lines, and nothing else. */}
          <TopBtn
            btnRef={settingsBtnRef}
            onClick={openSettings}
            label={t("ludo.settings.title")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              {[6, 12, 18].map((y) => (
                <rect key={y} x={3} y={y - 1} width={18} height={2} rx={1} fill="currentColor" />
              ))}
            </svg>
          </TopBtn>
        </div>

      </div>

      {soundOpen && <SoundPanel onClose={() => setSoundOpen(false)} />}

      {/* §8: tapped a seat. Everything in here is about that seat. */}
      {seatSheet != null && (
        <SeatSheet
          sessionId={game.id}
          seat={seatSheet}
          row={seats.find((x) => x.seat === seatSheet)}
          seats={seats}
          seatsTotal={game.target_seats}
          iAmHost={iAmHost}
          myId={myId}
          rules={rules}
          joinCode={game.join_code}
          soft={soft}
          onClose={() => setSeatSheet(null)}
          onChanged={async () => {
                await load();
          }}
        />
      )}

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {t(error)}
        </BodyText>
      )}

      {/* Seat chips — who is here so far. Only in the lobby: once
          play starts the seat plates carry all of this on the players
          themselves, and a second row of the same facts is board the
          phone does not have to give away (§1). */}
      {/* The lobby's roll-call of seat chips is gone. The plates
          around the board say who is at it, in the chairs they are
          actually in — a second list above the board was the same
          facts twice, and it was the half that did not show you
          WHERE anybody was sitting. */}

      {/* THE LOBBY PAGE IS GONE (item 2).

          It was a ceremony card, the join code at 46px, a seat
          count and a Start button — a whole screen explaining that
          a table was not full yet, shown instead of the table. The
          board says all of it by having an empty chair in it, and
          the chair says whose it is.

          Start is gone with it too, and that is item 3: the game
          begins by itself when the last seat fills, through the
          countdown, rather than waiting for the host to press
          something. */}
      {/* ── PLAYING ── */}
      {atTable && (
        <>
          {/* THE SLOT, and everything that sits at the board is in
              it: the far players, the board, and you. It takes every
              pixel the bar above and the line below do not, and
              centres the three of them as one group.

              min-height: 0 is what makes that true — a flex child's
              default min-height is its content, so without it the
              board would refuse to shrink and would push the bottom
              row off the screen instead. */}
          <div
            ref={fitRef}
            style={{
              boxSizing: "border-box",
              flex: "1 1 auto",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
            }}
          >
          <div ref={topRailRef} style={{ flex: "0 0 auto", width: "100%" }}>
          <SeatPlates
            where="top"
            compact={playing && shortScreen}
            seats={seats}
            seatsInPlay={game.target_seats}
            spin={povRotation(mySeatRow?.seat ?? null)}
            currentSeat={game.current_seat}
            sharingSeats={sharingSeats}
            landingSeat={landingSeat}
            myId={myId}
            diceFor={diceForSeat}
            onRoll={doRoll}
            canRoll={isMyTurn && !hasDice && !busy && !rolling}
            onPickDie={isMyTurn && spendable > 1 && !busy ? setPickedDie : undefined}
            rollingSeat={rollingSeat}
            tumbleFaces={tumble}
            lastDieBySeat={lastDieBySeat}
            turnDeadline={clockHeld ? null : game.turn_deadline}
            turnSeconds={turnSeconds}
            {...platePins}
            diceCount={diceCount}
          />
          </div>

          <div
            style={{
              boxSizing: "border-box",
              position: "relative",
              width: boardPx ? boardPx : "100%",
              maxWidth: "100%",
              /* §2: the board is an object on a table, so it casts a
                 shadow onto it. */
              filter: playing ? "drop-shadow(0 10px 22px rgba(0,0,0,0.55))" : undefined,
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
          {/* ── THE TABLE BEING SET ─────────────────────────────

                 THE BOARD IS NEVER WASHED OUT. This drew a sheet of
                 near-white at 80% over the whole board and put the
                 greeting on it in thirty-pixel Saathban green with a
                 grey line under — cream, green and grey, over a
                 bleached board, on a midnight table. The owner said
                 it looks like an error page, and an error page is
                 exactly what a pale full-screen wash with large
                 coloured type on it looks like.

                 So the wash is gone entirely: the board stays at
                 full strength and the greeting arrives as one small
                 midnight panel over it, in the same surface as the
                 chat, the profile cards and the settings sheet, with
                 a bar of this player's own seat colour down its
                 leading edge.

                 THE COUNTDOWN KEEPS ITS DIM, and only its dim. The
                 two moments are not the same: counting a table in is
                 asking everyone to stop and look up, and the board
                 going quiet under it is the point. But it dims to
                 the table's own blue-black rather than to brown, and
                 the ribbon that was Saathban green is gone with the
                 rest of the app's colours. ── */}
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
                background: countdown > 0 ? "rgba(6,10,20,0.62)" : "transparent",
                borderRadius: 20,
                pointerEvents: "none",
                textAlign: "center",
                padding: 16,
              }}
            >
              {countdown > 0 ? (
                <>
                  {/* THE RIBBON. A band across the dimmed board with
                      the count sitting on it — the shape a banner has
                      at a gathering, which is what this moment is. */}
                  <div
                    style={{
                      background: GAME.panel,
                      border: `1px solid ${GAME.panelEdge}`,
                      color: GAME.ink,
                      padding: "8px 18px",
                      borderRadius: 999,
                      textAlign: "center",
                      fontSize: ts(A11Y.minBodyPx),
                      fontWeight: 700,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                    }}
                  >
                    {t("ludo.ceremony.countdownBanner")}
                  </div>
                  <p
                    aria-live="polite"
                    style={{
                      margin: "10px 0 0",
                      fontFamily: meta.fonts.heading,
                      fontSize: ts(64),
                      lineHeight: 1,
                      fontWeight: 800,
                      color: GAME.ink,
                      textShadow: "0 6px 24px rgba(0,0,0,0.6)",
                    }}
                  >
                    {countdown}
                  </p>
                </>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    gap: 12,
                    maxWidth: "86%",
                    padding: "14px 18px 14px 14px",
                    borderRadius: 18,
                    background: GAME.panel,
                    border: `1px solid ${GAME.panelEdge}`,
                    boxShadow: "0 18px 44px rgba(0,0,0,0.58)",
                    textAlign: "start",
                  }}
                >
                  {/* YOUR colour, on the panel that welcomes YOU.
                      A seat that has not been taken yet — a watcher,
                      a table opened by link — gets the table's own
                      gold rather than a fifth colour nobody owns. */}
                  <span
                    aria-hidden="true"
                    style={{
                      flex: "0 0 auto",
                      width: 4,
                      borderRadius: 2,
                      background:
                        mySeatRow?.seat != null ? SEAT_COLORS[mySeatRow.seat] : GAME.gold,
                    }}
                  />
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: meta.fonts.heading,
                        fontSize: ts(22),
                        fontWeight: 700,
                        color: GAME.ink,
                      }}
                    >
                      {t("ludo.ceremony.start")}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: ts(16), lineHeight: 1.4, color: GAME.inkMuted }}>
                      {t("ludo.ceremony.startNote")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* The table's theme (C1). `rules` is the frozen house rules
              once play starts, so the board cannot change surface under
              anyone mid-game, and a table created before themes existed
              resolves to classic rather than crashing. The board's own
              SVG background is transparent, so this ground shows through
              it — that transparency is the whole seam. */}
          {/* NO CARD. The board IS the surface.

              This was a themed panel — a cream ground, eight
              pixels of padding, a rounded corner and a glow —
              wrapped around the board, and against the reference
              it is the single loudest difference: ours floated in
              a white tray in the middle of a dark field, theirs
              is a board on a table. The timber frame drawn inside
              the SVG is the board's edge; it does not need a
              second one around it.

              The div stays because it carries the theme variables
              the board reads, but it no longer paints anything of
              its own. */}
          <div style={{ ...themeVars(themeOf(rules)) }}>
          <LudoBoard
            mySeat={mySeatRow?.seat ?? null}
            isSilent={isSilent}
            onCapture={(seats) => {
              const taker = game.current_seat;
              const victim = seats.find((x) => x !== taker) ?? seats[0];
              setMoment({
                key: `cap-${Date.now()}`,
                text: t("ludo.moment.took", {
                  who: whoAt(taker),
                  whose: whoAt(victim),
                }),
              });
            }}
            state={state}
            seatsInPlay={game.target_seats}
            /* NOTHING IS OFFERED WHILE THE NUMBER IS BEING READ.
               rollHeld is up for the 800ms after my own cube comes
               to rest; the halos, the drag targets and the taps all
               come from this list, so emptying it for that moment is
               the whole of "and only then may his move options
               appear". */
            options={isMyTurn && hasDice && !rollHeld ? options : []}
            currentSeat={game.current_seat}
            sharingSeats={sharingSeats}
            landingSeat={landingSeat}
            onPieceTap={tapPiece}
            onPieceDrop={dropPiece}
            dragDisabled={!!chooser}
          />
          </div>
          <p style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}>
            {t("ludo.legend.flow")}
          </p>
          </div>

          <div ref={bottomRailRef} style={{ flex: "0 0 auto", width: "100%" }}>
          <SeatPlates
            where="bottom"
            compact={playing && shortScreen}
            seats={seats}
            seatsInPlay={game.target_seats}
            spin={povRotation(mySeatRow?.seat ?? null)}
            currentSeat={game.current_seat}
            sharingSeats={sharingSeats}
            landingSeat={landingSeat}
            myId={myId}
            diceFor={diceForSeat}
            onRoll={doRoll}
            canRoll={isMyTurn && !hasDice && !busy && !rolling}
            onPickDie={isMyTurn && spendable > 1 && !busy ? setPickedDie : undefined}
            rollingSeat={rollingSeat}
            tumbleFaces={tumble}
            lastDieBySeat={lastDieBySeat}
            turnDeadline={clockHeld ? null : game.turn_deadline}
            turnSeconds={turnSeconds}
            {...platePins}
            diceCount={diceCount}
          />
          </div>
          </div>

          {/* ── THE MESSAGE STRIP ────────────────────────────────

                 EVERY LINE UNDER THE BOARD IS AN OVERLAY, and the
                 strip that holds them is a fixed height that is
                 there whether or not anything is being said.

                 This is the whole of the board shaking. A message
                 appearing added a line to the column; the board's
                 slot is flex:1 and gets what is left, so the board
                 was re-measured a few pixels smaller and redrawn —
                 every time somebody rolled a six. It looked like a
                 shake because it WAS one: the board really did
                 change size, twice, a second apart.

                 Reserving the space once and floating the contents
                 in it means nothing that appears or disappears can
                 move anything. The strip is usually empty, and an
                 empty strip costs the board 58px exactly once.

                 Not pinned over the table, because on a 667px phone
                 there is no table under the board to pin to — it
                 would land on the players. Reserved, then floated
                 inside the reservation.

                 pointer-events pass through it, so a line drifting
                 over a control cannot eat a tap; the one thing in
                 here that IS a control takes them back. ── */}
          <div
            style={{
              position: "relative",
              flex: "0 0 auto",
              width: "100%",
              height: playing ? 58 : undefined,
              margin: playing ? "2px 0 0" : "0 0 10px",
            }}
          >
          <div
            style={
              playing
                ? {
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }
                : undefined
            }
          >
          <div style={{ margin: playing ? "0 0 4px" : "0 0 10px", flex: "0 0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {/* Whose turn is said by the ring, the bouncing arrow and
                  the plate's own "your turn" line (§2/§3). Repeating it
                  here in full cost a line the board needed — so during
                  play only the ACTIONABLE half survives: which dice you
                  are holding and must now spend. */}
              {/* "You rolled 4" is deleted, not moved. The die is on
                  the screen showing a 4 — saying it again in words
                  cost the board a whole line to repeat something the
                  player is already looking at. The instruction below
                  survives because it says what to DO, which the die
                  does not. */}
            </div>
            {/* ONE MESSAGE AT A TIME. This line is the running
                commentary — "admin test rolled 6 and moved" — and
                it was stacking under an instruction and over a
                chain card, three messages deep. It is the least
                urgent of the three, so it stands down whenever
                either of the others is speaking. */}
            {narrate && last && !(isMyTurn && hasDice) && chain === 0 && awaySeats.length === 0 && (
              <BodyText
                muted
                style={{
                  margin: playing ? "4px 0 0" : "10px 0 0",
                  color: playing ? GAME.inkMuted : undefined,
                  fontSize: ts(18),
                  /* ONE LINE on the play screen. This is the running
                     commentary — useful, never urgent — and when it
                     wrapped to three lines it took them off the
                     board. Ellipsis rather than a shorter sentence,
                     because the sentence is also read aloud. */
                  /* NEVER TRUNCATED. This was one line with an
                     ellipsis, and it produced "admin test rolled 6
                     and moved — but the sixes h…" — a sentence cut
                     off exactly where its meaning was. Two lines,
                     wrapped, is four pixels of board and a message
                     that finishes. */
                  ...(playing
                    ? {
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 2,
                        overflow: "hidden",
                        lineHeight: 1.35,
                      }
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
          {/* SOMEBODY'S SEAT IS BEING PLAYED FOR THEM.

              One line, and only while it is true. The table keeps
              atTable either way — the bot takes the turn — but a game
              that quietly changes who it is against without saying so
              is a game that has lied to the people still at it. Named
              rather than counted, because "1 player away" is a
              statistic and "Ammi's seat" is a person. */}
          {/* ONE LINE AT A TIME. This sat UNDER the running
              commentary, so a table with somebody genuinely away
              showed two sentences stacked below the board —
              "Bot rolled 3 and moved." over "Test Icon stepped
              away…" — which is the stack item 8 is about.

              It is also the rarer and more important of the two,
              so it wins and the commentary stands down, rather
              than both being shown and the board losing the
              height twice. */}
          {/* The two moments that earn the line, before anything
              else that wants it. */}
          {moment && (
            <FlashLine keyed={moment.key} ms={2800}>
              {moment.text}
            </FlashLine>
          )}
          {!moment && playing && awaySeats.length > 0 && (
            <FlashLine keyed={awaySeats.map((r) => r.seat).join(",")} ms={5200}>
              {t("ludo.table.botTookOver", {
                names: awaySeats.map((r) => r.name || t("ludo.seat.someone")).join(", "),
              })}
            </FlashLine>
          )}

          {/* THE PERMANENT INSTRUCTION IS DELETED.

              "Tap a die, then tap the goti it should move" sat under
              the board on every turn of every game for ever. A
              sentence that is always there is not read after the
              second time — it becomes furniture, and this furniture
              was costing the board height it needed more.

              It says it once, when it becomes true, and then stops.
              Keyed on the dice, so a new roll says it again. */}
          {hints && isMyTurn && hasDice && (
            <FlashLine keyed={diceKey}>
              {spendable > 1 ? t("ludo.turn.pickDie") : t("ludo.turn.pickPiece")}
            </FlashLine>
          )}

          {/* "Only one move was possible — played it for you."

              I classified this as a RESULT and left it outside the
              hints switch, on the reasoning that the board had
              changed without the person touching it and they were
              owed a sentence. The owner has ruled it commentary,
              and the ruling is right: the goti visibly moved, so
              the board already said it. Only a capture, a goti
              reaching home and somebody winning are results. */}
          {hints && autoNote && (
            <BodyText role="status" style={{ margin: "6px 0 0", textAlign: "center", fontWeight: 700, color: "#8FE3B0" }}>
              {t("ludo.turn.autoPlayed")}
            </BodyText>
          )}
          {/* "The 2 had nowhere to go, so it goes unused." A dim die
              already says it, and a person who has played ludo does
              not need the sentence. */}
          {/* "Nothing to do with that one." NOT a hint: it is the
              result of a throw, and the only one the board cannot
              show by moving something. It appears for the length of
              the hold and goes. */}
          {deadHold && isMyTurn && spendable === 0 && hasDice && (
            <FlashLine keyed={diceKey} ms={1200}>
              {t("ludo.turn.noMove")}
            </FlashLine>
          )}
          {hints && isMyTurn && deadDice.length > 0 && (
            <BodyText muted role="status" style={{ margin: "6px 0 0", textAlign: "center", color: GAME.inkMuted }}>
              {t("ludo.dice.wastedNote", { n: deadDice.map((d) => d.v).join(", ") })}
            </BodyText>
          )}

          {/* ── The sixes chain, said plainly while it is still open ──

              DRESSED FOR THIS TABLE. This was a cream card with brown
              ink, which is the app's card — and on a dark board it
              read as a page torn out of another screen and laid on
              the felt. Same words, same shape, the table's own
              colours. ── */}
          {/* ONE LINE, NEVER A STACK. This was a bordered card with
              two paragraphs in it — a heading and a sentence —
              sitting under the board, which is exactly the shape
              the owner ruled against: one line at a time, in the
              game's palette, never stacking. It had been dressed in
              the table's colours and left as two lines, which fixed
              the colour and not the complaint.

              And it says ONE thing at a time. On a plain run the
              count is the news; at two, three, five, six, eight and
              nine the WARNING is, and it already implies the run —
              nobody reading "one more six and all three are void"
              needs to be told separately that their sixes are
              counting. */}
          {/* THE WARNING ALWAYS; THE COUNT ONLY IF ASKED FOR.

              Eighteen turns played with hints off, and the one
              thing the table still said was "Six number 1" — a
              scoreboard for a run that has not gone anywhere. The
              die on the screen is already showing a six.

              At two, three, five, six, eight and nine it stops
              being a count and becomes a warning: ludo_chain_stands
              voids the whole run at three, six and nine, so those
              lines are telling somebody they are about to lose
              moves they have already made. That is a result, and
              results are never behind a switch. */}
          {chain > 0 && (hints || chain % 3 === 2 || chain % 3 === 0) && (
            <FlashLine keyed={chain} ms={4200}>
              {chain === 2 || chain === 5 || chain === 8
                ? t("ludo.chain.careful")
                : chain === 3 || chain === 6 || chain === 9
                ? t("ludo.chain.onTheEdge")
                : `🎲 ${t("ludo.chain.count", { n: chain })}`}
            </FlashLine>
          )}
          {/* The run collapsing IS a rare event, so it announces
             itself briefly and leaves — in the table's ink, not the
             app's brown. */}
          {last?.chain_void && (
            <FlashLine keyed={JSON.stringify(last)} ms={3600}>
              {t("ludo.chain.voided")}
            </FlashLine>
          )}

          </div>
          </div>

          {/* ── THE JOTA QUESTION, AS TWO WORDS AND TWO WORDS ──

                 It was a bordered card with a heading, a sentence
                 of explanation, a primary button naming half the
                 die, a second heading asking WHICH goti, two more
                 buttons for that, and a cancel. Seven things, to
                 answer a question with two answers.

                 Two choices on one line. The rulebook explains
                 what a jota is; a person mid-turn does not need it
                 explained again, and the ones who do not know are
                 not going to learn it from a caption over a
                 button.

                 WHICH goti is not asked any more either. Nothing
                 is drawn on a goti now, so the two on that square
                 are identical pins — asking a person to choose
                 between two things they cannot tell apart is a
                 question with no content. "Move one" moves the one
                 they tapped.

                 Tapping the board again dismisses it, so there is
                 nothing to cancel. ── */}
          {chooser && dice && dice[pickedDie] && (
            <div
              style={{
                position: "absolute",
                insetInline: 12,
                bottom: 92,
                zIndex: 30,
                display: "flex",
                gap: 10,
              }}
            >
              {chooser.opts.some((o) => o.kind === "pair") && (
                <GameBtn
                  onClick={() =>
                    sendMove(chooser.piece, chooser.opts.find((o) => o.kind === "pair"))
                  }
                  style={{ flex: "1 1 0", minHeight: 56 }}
                >
                  {t("ludo.jota.asJota")}
                </GameBtn>
              )}
              {chooser.opts.some((o) => o.kind === "single") && (
                <GamePill
                  onClick={() =>
                    sendMove(chooser.piece, chooser.opts.find((o) => o.kind === "single"))
                  }
                  style={{ flex: "1 1 0", minHeight: 56, justifyContent: "center" }}
                >
                  {t("ludo.jota.moveOne")}
                </GamePill>
              )}
            </div>
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
          {/* THE ROLL BAR IS DELETED (item 6).

              The recording has no roll button: the die beside your
              face IS the control, and tapping it is the whole
              gesture. Ours had both — a tappable die on the plate
              and a brass button under the board repeating it —
              which is two controls for one action, the second one
              taking height from the board.

              Nothing is lost by removing it. SeatDie has been the
              roll button since it was written; onRoll and canRoll
              were already wired to the same doRoll this called. The
              button existed because of a fair worry about tap
              targets on a phone, and the die answers it: 44px in a
              tray that lights gold when it is waiting for you. */}
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

      {/* THE PILL ROW IS GONE FROM THE TABLE. It held Emoji, Chat
          and — on a table that had not started — Leave, and it took
          a row's height off the board on every screen. Emoji now
          live in the chat's keyboard, chat opens from the particle
          on your own circle, and leaving is the door in the bar.

          What survives is the ONE explicit quit: giving up your
          seat, which is a decision about the table rather than
          about which screen you are looking at, and which still
          gets asked as one. It only appears before the game has
          started, where it is a table you are dissolving rather
          than a game you are walking out of. */}
      {mySeatRow && !playing && game.status !== "finished" && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            margin: "10px 0 0",
            flex: "0 0 auto",
          }}
        >
          <GamePill onClick={() => setLeaveAsk(true)}>
            {t("ludo.ceremony.leaveCta")}
          </GamePill>
        </div>
      )}

      </div>

      {/* THE CHAT, opened by the particle on your own circle. It
          travels with every phase of the table, so a remark before
          the game starts and one after it ends land in the same
          thread. */}
      {mySeatRow && (
        <ChatPanel
          sessionId={game.id}
          myId={myId}
          seats={seats}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onSent={bubbleLocally}
        />
      )}

      {/* A PLAYER'S CARD. Yours is your photo, your name and the
          colour you were dealt; anybody else's is how much of them
          reaches you. */}
      {cardSeat != null && (
        <PlayerCard
          sessionId={game.id}
          seat={cardSeat}
          row={seats.find((x) => x.seat === cardSeat)}
          isMe={seats.find((x) => x.seat === cardSeat)?.profile_id === myId}
          myProfileId={myId}
          myName={profile?.full_name}
          myAvatarPath={profile?.avatar_url}
          onClose={() => setCardSeat(null)}
          onNameChanged={load}
        />
      )}

      {/* Leaving is a decision, so it is asked as one — warmly, and
          with the seat's fate stated rather than implied. */}
      {/* The settings menu: sound, how you like to be spoken to,
          this table, and the rulebook. NO DOOR — leaving is the
          button in the top bar, and it was in both places. */}
      {settingsOpen && (
        <GameSettings
          side={panelSide}
          rules={rules}
          editable={editable}
          onClose={() => setSettingsOpen(false)}
          hints={hints}
          onHints={putHints}
        />
      )}

      {/* ── LEAVING, IN THE GAME'S OWN STYLE ──

             It was the app's white card with brown ink and a
             Saathban-green button, sitting on a midnight table:
             a page from another screen laid on the felt at the
             one moment a person is deciding something.

             Midnight now, like the chat and both profile cards.
             One warm line that says both true things — the bot
             plays your seat, and the table is still yours — and
             two buttons that say what they do. ── */}
      {leaveAsk && (
        <>
          <GameMotion />
          <div
            className="sb-veil-in"
            onClick={() => setLeaveAsk(false)}
            style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.55)" }}
            aria-hidden="true"
          />
          <div
            className="sb-panel-in"
            role="dialog"
            aria-modal="true"
            aria-label={t("ludo.ceremony.leaveTitle")}
            style={{
              ...NO_SELECT,
              position: "fixed",
              insetInline: 0,
              bottom: 0,
              zIndex: 81,
              background: GAME.panel,
              border: "none",
              borderRadius: "18px 18px 0 0",
              boxShadow: GAME.panelShadow,
              padding: "22px 18px calc(22px + env(safe-area-inset-bottom))",
            }}
          >
            <h2
              style={{
                fontFamily: meta.fonts.heading,
                fontSize: ts(24),
                fontWeight: 700,
                color: GAME.ink,
                margin: "0 0 8px",
              }}
            >
              {t("ludo.ceremony.leaveTitle")}
            </h2>
            <p style={{ fontSize: ts(17), lineHeight: 1.55, color: GAME.inkMuted, margin: "0 0 20px" }}>
              {t("ludo.ceremony.leaveBody")}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <GameBtn
                onClick={async () => {
                  setLeaveAsk(false);
                  /* Navigate after, not before: a leaver loses read
                     access to the session the instant the seat is
                     handed over, and staying here would only show
                     them a door closing on them. */
                  try {
                    await leaveSession(game.id);
                  } catch {
                    /* already gone is fine */
                  }
                  navigate("/app/games");
                }}
                style={{ flex: "1 1 0", minHeight: 56 }}
              >
                {t("ludo.ceremony.leaveConfirm")}
              </GameBtn>
              <GamePill
                onClick={() => setLeaveAsk(false)}
                style={{ flex: "1 1 0", minHeight: 56, justifyContent: "center" }}
              >
                {t("ludo.ceremony.leaveStay")}
              </GamePill>
            </div>
          </div>
        </>
      )}

    </>
  );
}
