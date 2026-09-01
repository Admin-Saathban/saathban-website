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
import PeoplePicker from "./PeoplePicker.jsx";
import OneTableGate from "./OneTableGate.jsx";
import SeatSetup from "./setup/SeatSetup.jsx";
import { Switch as RuleSwitchBase } from "./setup/SeatSetup.jsx";
import ThemePicker from "./ThemePicker.jsx";
import { DEFAULT_THEME } from "./themes.js";
import { GamesScreen, BodyText, GhostBtn } from "./ui.jsx";
import { GameMotion } from "./GameUI.jsx";

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
  const [autoOnlyMove, setAutoOnlyMove] = useState(true);
  const [undoOn, setUndoOn] = useState(true);

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
        /* Same shape as auto-move: written only when OFF, because
           client and server both read a missing key as on, so an old
           table and a new one behave alike. */
        if (undoOn === false) house.undo = false;
        /* Ludo's turn is 30 seconds, and it must be WRITTEN here rather
           than left to a default. The server's fallback is 60 —
           `coalesce((house_rules->>'turn_seconds')::int, 60)` in
           game_tick — so a table created without the key would count
           down from 30 on the board while the server waited 60: the bar
           empties, nothing happens, and the person is told twice that
           they ran out of time. The rails lane sets the same value for
           tables opened their way; this is the other door into the same
           room. */
        house.turn_seconds = 30;
      }
      const id = await createSession(game.key, seats, house, title);
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
      <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")} game>
        <GameMotion />
        {/* Nothing shaped like anything. A grey block that becomes a
            room is two states; an empty table the room arrives onto
            is one, and it is honest that nothing is ready yet rather
            than that something rectangular is. */}
        <div aria-hidden="true" style={{ minHeight: "72vh" }} />
        <BodyText muted role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
          …
        </BodyText>
      </GamesScreen>
    );
  }

  /* No such game — said plainly rather than as a dot that never
     resolves, which is what null-means-both produced. */
  if (game === null) {
    return (
      <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")} game>
        <GameMotion />
        <BodyText role="alert">{t("games.loadError")}</BodyText>
      </GamesScreen>
    );
  }

  const name = lang === "ur" ? game.name_ur : game.name_en;
  const takenIds = Object.values(seated).map((p) => p.id);

  return (
    <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")} game>
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
      <h1
        style={{
          fontSize: ts(28),
          fontWeight: 800,
          color: C.brown,
          textAlign: "center",
          // Nastaliq descends far below the baseline: give the heading the
          // language's own line-height in RTL (a trimmed one clips into the
          // line beneath), and room under it either way.
          lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.25,
          margin: meta.dir === "rtl" ? "0 0 16px" : "0 0 10px",
        }}
      >
        {name}
      </h1>

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
            color: C.textMain,
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
            color: C.textMain,
            background: C.white,
            border: `2px solid ${C.warmGray}`,
            borderRadius: 14,
            textAlign: "start",
          }}
        />
        {/* Said here rather than buried in a policy: an open table's
            name is read by whoever joins it, including people the host
            has never met. */}
        <span
          style={{
            display: "block",
            fontSize: ts(A11Y.minBodyPx),
            color: C.textMuted,
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
                on={autoOnlyMove}
                onToggle={() => setAutoOnlyMove((v) => !v)}
                label={t("games.setup.autoOnlyMove")}
              />
              <RuleSwitch
                on={undoOn}
                onToggle={() => setUndoOn((v) => !v)}
                label={t("games.setup.undoOn")}
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
    </GamesScreen>
  );
}
