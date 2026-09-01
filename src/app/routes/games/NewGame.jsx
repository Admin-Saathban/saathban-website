/* ════════════════════════════════════════════════
   New game — setting the table.

   This screen used to be a form: a "Players" label over number chips,
   three stacked text rows for who you were playing with, a paragraph
   about dice. It configured a game. Now it IS one: seat rows you add
   and remove, gotis you tap to take a colour, dice you tap to choose,
   a face per empty chair, and one round Start. Words on screen: the
   title, one caption, and Start.

   The tactile screen itself is SeatSetup (routes/games/setup/), owned
   by the ludo lane. THIS file owns what happens around it: who the
   people are, the sheet you pick them from, and the translation from
   "four chairs, these colours, these fillings" into a real session
   with real invites.

   WHAT START PROMISES. It always lands you on the board — never on a
   confirmation, never back here. A table of bots is playing by the
   time you arrive. A table with people in it is the waiting room, on
   the board, with their faces in their seats and the share link to
   hand. That rule is why there is no second screen: the board is the
   destination, and waiting is something that happens ON it.

   SEAT COLOUR persists as house_rules.seat_colours — an array indexed
   by seat, each entry an index into the four ludo colours. No schema
   change was needed: create_game_session stores house_rules verbatim,
   and freezing them at start means a colour cannot change under a
   player mid-game. Indices rather than hex, because the palette is a
   presentation choice that has already changed once; storing #D6A419
   would have pinned an old palette into the database for ever.
   ════════════════════════════════════════════════ */

import { startAmbience, stopAmbience } from "../../lib/sound.js";
import { useSoundUnlock } from "../../lib/gameFeel.jsx";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import {
  fetchGames,
  fetchGamesFinished,
  seatBots,
  createSession,
  fetchMySessions,
  liveSessionOf,
  liveSessionsOf,
  inviteToGame,
  createSeatLink,
  startWithBots,
} from "../../lib/games.js";
import { createShare } from "../community/communityData.js";
import { updateMyProfile } from "../profile/data.js";
import { TimerChoice, RememberChoice } from "./setup/RoomChoices.jsx";
import PeoplePicker from "./PeoplePicker.jsx";
import OneTableGate from "./OneTableGate.jsx";
import SeatSetup from "./setup/SeatSetup.jsx";
import { Switch as RuleSwitchBase } from "./setup/SeatSetup.jsx";
import ThemePicker from "./ThemePicker.jsx";
import { DEFAULT_THEME } from "./themes.js";
import { BodyText, GhostBtn } from "./ui.jsx";
import RoomScreen from "./setup/RoomScreen.jsx";
import { GameMotion } from "./GameUI.jsx";
import { GAME } from "./gameSurface.js";

/* The faces sheet. One tap seats someone and closes — this is a
   choice for ONE chair, so there is nothing to confirm and no
   multi-select to reason about. People already sitting at another
   chair are shown as taken rather than hidden, because a name that
   vanishes reads as a bug. */
function FacesSheet({ takenIds, onSeat, onClose, t, ts }) {
  const states = Object.fromEntries(takenIds.map((id) => [id, "picked"]));
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("games.setup.sheet.title")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(45,36,24,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sb-pop"
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "86vh",
          overflowY: "auto",
          background: C.bg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: "18px 16px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <h2 style={{ fontSize: ts(22), fontWeight: 800, color: C.brown, margin: 0 }}>
            {t("games.setup.sheet.title")}
          </h2>
          <GhostBtn onClick={onClose}>{t("games.setup.sheet.close")}</GhostBtn>
        </div>
        <PeoplePicker
          searchable
          states={states}
          onToggle={(person) => onSeat(person)}
        />
      </div>
    </div>
  );
}

export default function NewGame() {
  const { gameKey } = useParams();
  const { t, ts, lang, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();

  const [game, setGame] = useState(undefined);
  const [busy, setBusy] = useState(false);
  /* One live table at a time. The refusal belongs HERE, on Start — the
     moment the second table would actually come into being. */
  const [blockedBy, setBlockedBy] = useState(null);
  /* Every table in the way, not just the first — see OneTableGate. */
  const [blockedAll, setBlockedAll] = useState([]);
  /* Which chair is choosing a person, and who is sitting where. */
  const [sheetSeat, setSheetSeat] = useState(null);
  const [seated, setSeated] = useState({});
  /* The setup we were about to start when the gate stopped us, so
     clearing the gate resumes exactly that table rather than a
     default one. */
  const heldSetup = useRef(null);
  /* What this table is called. Optional forever: somebody opening a
     table because they want to play RIGHT NOW must not be stopped to
     title it, so this is never required and never validated at you. */
  const [title, setTitle] = useState("");
  /* The board everyone at this table will play on. Themes beyond the
     free two are EARNED by playing, and earned-ness is derived from
     finished tables rather than stored — so this is a count, not a
     balance, and there is nothing here to spend or lose. */
  const [theme, setTheme] = useState(DEFAULT_THEME);
  /* null until it has answered, so the room can wait for it rather
     than growing a row when it lands. */
  const [gamesFinished, setGamesFinished] = useState(null);

  /* Music from the room onward, not only from the board. Setting a
     table is part of the evening, and a silence that broke the
     moment you pressed Start would draw attention to the
     machinery. */
  /* THE ROOM NEEDS ITS OWN UNLOCK. useSoundUnlock lives inside
     useGameFeel, which the board uses and this screen does not — so
     the first tap in here never reached the audio context, the wish
     to play was remembered and nothing ever started it. Measured: 0
     oscillators in the room after a real tap, 4 on the board after
     the same tap. Same code, one missing hook.

     It takes the first tap somebody was making anyway; it never asks
     for one. */
  useSoundUnlock();

  useEffect(() => {
    startAmbience(gameKey);
    return () => stopAmbience();
  }, [gameKey]);

  useEffect(() => {
    let alive = true;
    fetchGames()
      .then((gs) => {
        if (!alive) return;
        setGame(gs.find((x) => x.key === gameKey) || null);
      })
      .catch(() => alive && setGame(null));
    return () => {
      alive = false;
    };
  }, [gameKey]);

  useEffect(() => {
    let alive = true;
    fetchGamesFinished(profile.id)
      .then((n) => alive && setGamesFinished(n))
      /* A count that will not load must not block setting up a game:
         the free boards are always there, so falling back to zero
         costs a person nothing they had. */
      .catch(() => alive && setGamesFinished(0));
    return () => {
      alive = false;
    };
  }, [profile.id]);

  /* Carrom passes turns rather than playing itself: a bot seat there
     is an empty chair with a clock, and start_with_bots refuses it
     server-side (0043). */
  const botsAllowed = !!game && game.timeout_style !== "pass_turn";
  const canPostOpen = profile.role === "saath_icon" || profile.is_org;

  /* The shared switch, with this screen's text size supplied once
     rather than at every call site. */
  const RuleSwitch = (p) => <RuleSwitchBase {...p} ts={ts} />;

  /* Ludo's two house rules, owned by the screen that offers them
     rather than by the shared setup component (§8.1). */
  /* ── THE HOUSE RULES, ALL FIVE, ALL ON ────────────────────────

     A six rolls again · jota · exact landing to get home · three
     sixes cancels the turn · you must take one before going home.
     Every one of them is how the game is played at a real table in
     Pakistan, which is why they are all on by default: a person who
     opens a table and presses Start should get the game they know.

     capture_before_home was the odd one out — its default was OFF
     everywhere, including in the engine — so it is written
     EXPLICITLY into house_rules from this room rather than left to
     a default that disagrees with the switch above it.

     REMEMBERED, IF ASKED. The choice sits on the host's own profile
     (settings.ludo_rules) and is loaded back the next time they
     open a room. Somebody who plays the same five rules every
     Sunday should set them once. */
  const [autoOnlyMove, setAutoOnlyMove] = useState(true);
  const [sixAgain, setSixAgain] = useState(true);
  const [jotaOn, setJotaOn] = useState(true);
  const [exactHome, setExactHome] = useState(true);
  const [threeSixes, setThreeSixes] = useState(true);
  const [captureFirst, setCaptureFirst] = useState(true);
  /* 20 / 30 / 45 / 60 seconds, or null for no clock at all. */
  const [turnSecs, setTurnSecs] = useState(30);
  /* "just this table" or "all my tables" */
  const [remember, setRemember] = useState(false);

  /* Whatever this host settled on last time. Loaded once, and only
     if they asked for it to be — an unasked-for memory is a table
     that changed its own rules behind somebody's back. */
  useEffect(() => {
    const saved = profile?.settings?.ludo_rules;
    if (!saved) return;
    setSixAgain(saved.extra_roll_on_six !== false);
    setJotaOn(saved.jota !== false);
    setExactHome(saved.exact_home !== false);
    setThreeSixes(saved.three_sixes !== false);
    setCaptureFirst(saved.capture_before_home !== false);
    if (saved.turn_seconds === null || typeof saved.turn_seconds === "number") {
      setTurnSecs(saved.turn_seconds);
    }
  }, [profile?.settings?.ludo_rules]);
  /* TEAMS, and an honest caveat. The owner has asked for the
     switch to live here with the other house rules and it does:
     the choice is made in the room, frozen with the rest of the
     rules at the first roll, and stored on the table as
     house_rules.teams.

     WHAT IT DOES NOT DO YET is pair the seats in the RULES. The
     engine decides a winner when one seat has four gotis home
     (ludo_advance), and making a pair win together is a change to
     the win condition in SQL, not a flag the board can read. So
     the row says plainly that the rules are coming rather than
     letting somebody set up a doubles game and find out at the
     end that it was scored as singles. A switch that lies about
     what a game is would be a worse thing to ship than a switch
     that is early. */
  const [teams, setTeams] = useState(false);

  /* The game's own name, in the reader's language. Read here rather
     than in the render because start() needs it too, for the
     table's default name. */
  const name = game ? (lang === "ur" ? game.name_ur : game.name_en) : "";

  const start = async (setup) => {
    if (busy || !game) return;
    const { seats, diceCount, colours, fill } = setup;

    /* A chair set to "person" with nobody chosen is an unanswered
       question, not a table. Open that chair's sheet rather than
       starting something the person did not mean. */
    const unchosen = fill.findIndex((f, seat) => seat > 0 && f === "person" && !seated[seat]);
    if (unchosen > 0) {
      setSheetSeat(unchosen);
      return;
    }

    const mine = await fetchMySessions(profile.id).catch(() => []);
    const inTheWayAll = liveSessionsOf(mine);
    const inTheWay = inTheWayAll[0] ?? null;
    if (inTheWay) {
      heldSetup.current = setup;
      setBlockedBy(inTheWay);
      setBlockedAll(inTheWayAll);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setBusy(true);
    try {
      const house = { seat_colours: colours };
      house.table_theme = theme;
      if (game.key === "ludo") {
        house.dice_count = diceCount;
        /* Written only when it is OFF. The client reads a missing key
           as "on", so an old table and a new one behave the same and
           the row keeps the shape it already had. */
        if (autoOnlyMove === false) house.auto_only_move = false;
        /* NO `undo` KEY. Undo is removed from ludo; a table created
           now simply does not carry the rule. Tables created before
           this still have it in their frozen rules and nothing reads
           it, which is the harmless half of leaving old rows
           alone. */
        /* Ludo's turn is 30 seconds, and it must be WRITTEN here rather
           than left to a default. The server's fallback is 60 —
           `coalesce((house_rules->>'turn_seconds')::int, 60)` in
           game_tick — so a table created without the key would count
           down from 30 on the board while the server waited 60: the bar
           empties, nothing happens, and the person is told twice that
           they ran out of time. The rails lane sets the same value for
           tables opened their way; this is the other door into the same
           room. */
        /* THE MOVE TIMER, chosen in this room. `relaxed` is null,
           and a null is written as a very large number rather than
           omitted: game_tick falls back to 30 when the key is
           missing, so leaving it out would give a relaxed table a
           thirty-second clock — the opposite of what was chosen. */
        house.turn_seconds = turnSecs === null ? 86400 : turnSecs;
        /* All five, written explicitly. capture_before_home's engine
           default is OFF, so a switch left to a default would
           silently disagree with what the room showed. */
        house.extra_roll_on_six = sixAgain;
        house.jota = jotaOn;
        house.exact_home = exactHome;
        house.three_sixes = threeSixes;
        house.capture_before_home = captureFirst;
        /* Written only when chosen, like the other two, so an old
           table and a new one keep the same shape. */
        if (teams) house.teams = true;
      }
      /* A NAME, ALWAYS. Naming is optional for the person and not
         for the table: the board shows the name and the history
         lists it, and "the fourth of nine identical Ludos" is what
         no name actually costs. So a table nobody titled is named
         after the game and whoever opened it.

         First name only — a table called "Ludo with Alexander
         Testing-Smith" is a name that gets ellipsed to nothing at
         390px. */
      const host = (profile.full_name || "").trim().split(/\s+/)[0];
      const named =
        title.trim() ||
        (host ? t("games.setup.defaultTitle", { game: name, host }) : name);
      const id = await createSession(game.key, seats, house, named);
      /* "Use these for all my future tables". Saved after the table
         is made rather than before, so a failure to create does not
         leave somebody's preferences changed by a game that never
         happened. */
      if (remember && game.key === "ludo") {
        updateMyProfile(profile.id, {
          settings: {
            ...(profile.settings || {}),
            ludo_rules: {
              extra_roll_on_six: sixAgain,
              jota: jotaOn,
              exact_home: exactHome,
              three_sixes: threeSixes,
              capture_before_home: captureFirst,
              turn_seconds: turnSecs,
            },
          },
        }).catch(() => {
          /* the table still opens; only the memory is lost */
        });
      }
      try {
        sessionStorage.setItem("saathban.app.freshTable", id);
      } catch {
        /* storage off — no glow, no harm */
      }

      const others = fill.map((f, seat) => ({ f, seat })).filter((o) => o.seat > 0);

      /* §17 — a chair held by a link. The link is made HERE, at
         creation, so the seat is held by a row from the moment the
         table exists rather than by the setup screen remembering an
         intention. Seats are 1-based on the server. */
      for (const o of others.filter((x) => x.f === "link")) {
        try {
          await createSeatLink(id, o.seat + 1);
        } catch {
          /* One link that would not be made must not strand the
             table: the chair simply stays empty and can be shared
             again from the table itself. */
        }
      }
      const invited = others.filter((o) => o.f === "person");
      const open = others.filter((o) => o.f === "open");
      const bots = others.filter((o) => o.f === "bot");

      for (const o of invited) {
        const person = seated[o.seat];
        if (!person) continue;
        // One refusal must not strand the table: the others still play.
        try {
          await inviteToGame(id, person.id);
        } catch {
          /* they simply won't have been asked */
        }
      }

      if (open.length && canPostOpen) {
        try {
          await createShare(profile.id, "game_open", id, {
            game_key: game.key,
            name_en: game.name_en,
            name_ur: game.name_ur,
            seats_total: seats,
            seats_taken: 1,
          });
        } catch {
          /* the table exists either way; it just isn't posted */
        }
      }

      /* THE BOTS SIT DOWN NOW, in the chairs the host gave them.

         This used to seat no bots at all whenever anybody was
         invited, because start_with_bots fills EVERY empty chair
         and starts the game — which would have slammed the door
         on the guest. The workaround was right and its cost was
         that a host who asked one daughter and chose two bots
         waited on a board with three empty seats.

         0100 seats named chairs without starting anything, so the
         board the host lands on already has its bots at it and
         the empty chairs are exactly the ones somebody is coming
         to. The table starts by itself when the last one fills. */
      if (botsAllowed && bots.length) {
        const botSeats = bots.map((o) => o.seat + 1);
        try {
          await seatBots(id, botSeats);
        } catch {
          /* the chairs stay empty and the board can fill them */
        }
      }

      /* ITEM 2: the BOARD, not a lobby page. Ludo has its own. */
      navigate(game.key === "ludo" ? `/app/games/ludo/${id}` : `/app/games/s/${id}`, {
        replace: true,
      });
    } catch {
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
      setBusy(false);
    }
  };

  /* Waiting for everything, and holding the room's height while it
     waits — a placeholder shorter than what replaces it is the
     growth this was meant to remove. */
  if (game === undefined || gamesFinished === null) {
    return (
      <RoomScreen>
        <GameMotion />
        {/* Nothing shaped like anything. A grey block that becomes a
            room is two states; an empty table the room arrives onto
            is one, and it is honest that nothing is ready yet rather
            than that something rectangular is. */}
        <div aria-hidden="true" style={{ minHeight: "72vh" }} />
        <BodyText muted role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
          …
        </BodyText>
      </RoomScreen>
    );
  }

  /* No such game — said plainly rather than as a dot that never
     resolves, which is what null-means-both produced. */
  if (game === null) {
    return (
      <RoomScreen>
        <GameMotion />
        <BodyText role="alert">{t("games.loadError")}</BodyText>
      </RoomScreen>
    );
  }

  const takenIds = Object.values(seated).map((p) => p.id);

  return (
    <RoomScreen>
      <GameMotion />
      {/* THE ROOM ARRIVES RATHER THAN APPEARING.

          Measured at 390px, this used to paint in three waves — a
          dot, a half-built screen, then the room — growing the page
          twice under whoever was looking at it. It reported a
          cumulative layout shift of ZERO the whole time, because each
          wave appended BELOW what was already there and displaced
          nothing. The metric cannot see a screen assembling itself;
          only a person can.

          Now it waits for everything and arrives once, on the same
          190ms the game's sheets use, so opening the room feels like
          the panels that later open on top of it. The reduced-motion
          rule that governs those governs this. */}
      <div className="sb-game-panel" style={{ background: "transparent", border: "none", boxShadow: "none" }}>
      {/* THE WAY OUT. GamesScreen carried a back link; the room
          has no app chrome at all now, so it has to carry its own
          — and it is a door rather than a decision, exactly like
          the one on the board. Backing out of setting a table
          never asks anything: nothing has been made yet. */}
      <button
        type="button"
        onClick={() => navigate("/app/games")}
        aria-label={t("games.board.backHome")}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          border: `1px solid ${GAME.glassEdge}`,
          background: GAME.glass,
          color: GAME.ink,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          marginBottom: 10,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15 5 L8 12 L15 19"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <h1
        style={{
          fontSize: ts(34),
          fontWeight: 800,
          color: "#F5EFE0",
          textAlign: "center",
          // Nastaliq descends far below the baseline: give the heading
          // the language's own line-height in RTL (a trimmed one clips
          // into the line beneath).
          lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.2,
          margin: "0 0 4px",
        }}
      >
        {name}
      </h1>
      {/* One line, and it is a promise rather than an instruction:
          the room does not end in a lobby and nobody has to press
          anything twice. */}
      <p
        style={{
          margin: `0 0 ${meta.dir === "rtl" ? 20 : 18}px`,
          textAlign: "center",
          fontSize: ts(16),
          color: "#9BA8C8",
        }}
      >
        {t("games.setup.subtitle")}
      </p>

      {/* A name is what makes a table findable a month later — "Sunday
          chai match" rather than the fourth of nine identical Ludos in
          a list. It sits above the chairs because it is about the
          OCCASION, not the setup. */}
      <label style={{ display: "block", marginBottom: 18 }}>
        <span
          style={{
            display: "block",
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 600,
            color: GAME.ink,
            marginBottom: 6,
          }}
        >
          {t("games.setup.nameLabel")}
        </span>
        <input
          type="text"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("games.setup.namePlaceholder")}
          dir={meta.dir}
          style={{
            width: "100%",
            minHeight: A11Y.minTapTargetPx,
            padding: "10px 14px",
            fontFamily: "inherit",
            fontSize: ts(A11Y.minBodyPx),
            color: GAME.ink,
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 12,
            textAlign: "start",
          }}
        />
        {/* Said here rather than buried in a policy: an open table's
            name is read by whoever joins it, including people the host
            has never met. */}
        <span
          style={{
            display: "block",
            fontSize: ts(15),
            color: GAME.inkMuted,
            marginTop: 6,
          }}
        >
          {t("games.setup.nameHint")}
        </span>
      </label>

      {blockedBy && (
        <OneTableGate
          live={blockedBy}
          all={blockedAll}
          /* The human name. This passed the raw key, so the card said
             "ludo" — one more reason each round of the gate looked
             like the one before it. */
          gameName={game && game.key === blockedBy.game_key ? (lang === "ur" ? game.name_ur : game.name_en) : blockedBy.game_key}
          onCleared={() => {
            setBlockedBy(null);
            const held = heldSetup.current;
            if (held) start(held);
          }}
          onDismiss={() => setBlockedBy(null)}
        />
      )}

      <SeatSetup
        me={profile}
        minSeats={game.min_seats}
        maxSeats={game.max_seats}
        busy={busy}
        seated={seated}
        botsAllowed={botsAllowed}
        canPostOpen={canPostOpen}
        showDice={game.key === "ludo"}
        /* §8.1: Ludo's rules, passed by Ludo. Carrom passes none
           and therefore shows none — a game cannot be asked about
           a rule it does not have. */
        rules={
          game.key === "ludo" ? (
            <>
              <RuleSwitch
                on={sixAgain}
                onToggle={() => setSixAgain((v) => !v)}
                label={t("ludo.rules.extraRoll")}
              />
              <RuleSwitch
                on={jotaOn}
                onToggle={() => setJotaOn((v) => !v)}
                label={t("ludo.rules.jota")}
              />
              <RuleSwitch
                on={exactHome}
                onToggle={() => setExactHome((v) => !v)}
                label={t("ludo.rules.exactHome")}
              />
              <RuleSwitch
                on={threeSixes}
                onToggle={() => setThreeSixes((v) => !v)}
                label={t("ludo.rules.threeSixes")}
              />
              <RuleSwitch
                on={captureFirst}
                onToggle={() => setCaptureFirst((v) => !v)}
                label={t("ludo.rules.captureFirst")}
              />
              <TimerChoice value={turnSecs} onPick={setTurnSecs} t={t} ts={ts} />
              <RememberChoice value={remember} onPick={setRemember} t={t} ts={ts} />
              <RuleSwitch
                on={autoOnlyMove}
                onToggle={() => setAutoOnlyMove((v) => !v)}
                label={t("games.setup.autoOnlyMove")}
              />

              {/* Only at a table with four chairs: two against two
                  needs four people, and a switch that cannot apply
                  is a question with no answer. */}
              <RuleSwitch
                on={teams}
                onToggle={() => setTeams((v) => !v)}
                label={t("games.setup.teams")}
                hint={t("games.setup.teamsNote")}
              />
            </>
          ) : null
        }
        extras={
          <ThemePicker value={theme} onPick={setTheme} gamesFinished={gamesFinished} />
        }
        onPickPeople={(seat) => setSheetSeat(seat)}
        onStart={start}
      />

      {sheetSeat != null && (
        <FacesSheet
          t={t}
          ts={ts}
          takenIds={takenIds}
          onClose={() => setSheetSeat(null)}
          onSeat={(person) => {
            setSeated((cur) => ({ ...cur, [sheetSeat]: person }));
            setSheetSeat(null);
          }}
        />
      )}
      </div>
    </RoomScreen>
  );
}
