/* One game session: the lobby (join code, invites, open-table post,
   start-with-bots) and the live board. The board here is the rails'
   reference game, Race to 100 — ludo renders its own under
   routes/games/ludo/. Turn timing is server-owned; this page shows
   the countdown and calls game_tick() when it hits zero so a lapsed
   turn resolves immediately instead of at the next cron minute. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { pushToast, useToastThenGo } from "../../lib/feedback.jsx";
import { useSession } from "../../lib/session.jsx";
import {
  fetchGames,
  fetchSession,
  fetchMoves,
  fetchChat,
  sendChat,
  playTurn,
  gameTick,
  reclaimSeat,
  inviteToGame,
  tableIsSoft,
  inviteToSeat,
  respondInvite,
  fetchMyInvites,
  fetchSessionInvites,
  fetchNames,
  createSession,
  gamePeople,
  boastToPeople,
  startWithBots,
  claimOpenSeat,
  cancelSession,
  leaveSession,
  GAME_STICKERS,
} from "../../lib/games.js";
import PeoplePicker from "./PeoplePicker.jsx";
import ShareTableButton from "./ShareTableButton.jsx";
import TablePresence from "./TablePresence.jsx";
/* The waiting room shows the table you are waiting AT. Ludo's board
   lives on its own screen once play starts, so the rails page had
   nothing to show and became the lobby purgatory this redesign exists
   to kill. Rendered here greyed and inert — no state, no options, no
   tap handler — it is scenery, and the real board takes over the
   moment the game begins. */
import LudoBoard from "./ludo/LudoBoard.jsx";
/* The quick-chat sheet belongs to the games lane (routes/games/ludo/).
   Imported rather than copied: two lists of ten phrases would drift
   within a day, and the Urdu is theirs. If it is promoted to
   routes/games/ later, this import is the only line that changes. */
import QuickChat from "./QuickChat.jsx";
/* Carrom has its own board on the rails; ludo has its own route.
   Everything else is the reference Race to 100 board below. */
import CarromRailsController from "./carrom/CarromRailsController.jsx";
import SnakesBoard from "./snakes/SnakesBoard.jsx";
import { SEAT_COLORS, SEAT_INK } from "./seatColors.js";
import { Navigate } from "react-router-dom";
import { createShare } from "../community/communityData.js";
import { GamesScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn, TableHeading } from "./ui.jsx";
import SeatLinks from "./SeatLinks.jsx";
import { useGameFeel, GameMotionStyles, Confetti } from "../../lib/gameFeel.jsx";
import { SoundButton, SoundPanel } from "./SoundControls.jsx";
import StickerPicker from "../../assets/stickers/StickerPicker.jsx";
import { Sticker, parseStickerRef, stickerRef } from "../../assets/stickers/stickers.jsx";

const POLL_MS = 2500;

export default function SessionPage() {
  const { sessionId } = useParams();
  const { t, ts, lang } = useI18n();
  const { profile } = useSession();

  const [session, setSession] = useState(null);
  const [games, setGames] = useState([]);
  const [moves, setMoves] = useState([]);
  const [chat, setChat] = useState([]);
  const [myInvite, setMyInvite] = useState(null); // my pending invite here
  const [pendingInvites, setPendingInvites] = useState([]); // host's view
  /* §8 — IS THIS TABLE STILL SOFT? A table opened by tapping a
     game is 'active' from its first instant, so everything this
     page gated on status === 'lobby' simply never renders for one.
     For ludo that did not matter, because the board grew its own
     seat sheet; for snakes and carrom it meant there was no way
     left to ask a person to a table AT ALL — the setup form that
     used to do it is gone from the home, and this picker was
     behind a lobby that no longer happens.

     A regression I introduced with the quick table, found because
     the smoke suite still drove the old form. */
  const [soft, setSoft] = useState(false);
  /* People this person may ask, for the soft-table invite above. */
  const [askable, setAskable] = useState([]);
  const [filledInfo, setFilledInfo] = useState(null); // respond → 'filled'
  const [inviteNames, setInviteNames] = useState({}); // invitee id → name
  const [loadError, setLoadError] = useState(false);
  const [notMine, setNotMine] = useState(false); // RLS: not a table I'm at
  const [busy, setBusy] = useState(false);
  /* The moment a lobby becomes a game. Shown once, briefly, and never
     replayed on a refresh of an already-running table. */
  const [started, setStarted] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const wasLobby = useRef(false);
  const toastThenGo = useToastThenGo();
  const [now, setNow] = useState(Date.now());
  const tickedFor = useRef(null);
  // Set the instant a leave or a call-off starts. A guest loses read access
  // to the session the moment the RPC lands, so a poll arriving between that
  // and the route change would read null and paint "this table is private to
  // its players" on the way out. This flag — not the navigate — is the fix.
  const leaving = useRef(false);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    if (leaving.current) return;   // on our way out: never read a dead row
    try {
      const [s, m, c] = await Promise.all([
        fetchSession(sessionId),
        fetchMoves(sessionId),
        fetchChat(sessionId),
      ]);
      setSession(s);
      setMoves(m);
      setChat(c);
      setLoadError(false);
      setNotMine(!s);
      /* OUTSIDE THE LOBBY BRANCH, which is where I first put it —
         inside an `if (status === "lobby")` whose whole purpose
         this check is to survive. A §8 table is never in a lobby,
         so it was asked about softness exactly never. */
      if (s) tableIsSoft(sessionId).then(setSoft).catch(() => {});
      if (s && s.created_by === profile.id) {
        gamePeople()
          .then((list) => {
            const seated = new Set((s.seats || []).map((x) => x.profile_id).filter(Boolean));
            setAskable((list || []).filter((p) => !seated.has(p.id)));
          })
          .catch(() => {});
      }
      if (s?.status === "lobby") {
        const [mine, all] = await Promise.all([
          fetchMyInvites(profile.id).catch(() => []),
          fetchSessionInvites(sessionId).catch(() => []),
        ]);
        setMyInvite(mine.find((i) => i.session_id === sessionId) ?? null);
        setPendingInvites(all);
        if (all.length) {
          setInviteNames(await fetchNames(all.map((i) => i.invitee_id)).catch(() => ({})));
        }
      } else {
        setMyInvite(null);
      }
    } catch {
      setLoadError(true);
    }
  }, [sessionId, profile.id]);

  useEffect(() => {
    fetchGames().then(setGames).catch(() => {});
    refresh();
    const poll = setInterval(refresh, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [refresh]);

  useEffect(() => {
    if (session?.status === "lobby") wasLobby.current = true;
    if (session?.status === "active" && wasLobby.current) {
      wasLobby.current = false;
      setStarted(true);
      const h = setTimeout(() => setStarted(false), 1800);
      return () => clearTimeout(h);
    }
    return undefined;
  }, [session?.status]);

  const game = useMemo(
    () => games.find((g) => g.key === session?.game_key),
    [games, session]
  );
  const gameName = game ? (lang === "ur" ? game.name_ur : game.name_en) : "";
  const mySeat = session?.seats.find((s) => s.profile_id === profile.id);
  const isHost = session?.created_by === profile.id;
  /* Seats a bot is holding, 0-based the way inviteToSeat wants. */
  const botSeats = (session.seats || [])
    .filter((x) => x.is_bot)
    .map((x) => x.seat_no - 1);
  const [soundOpen, setSoundOpen] = useState(false);

  /* Sound and haptics for this table. Reads the move log rather than
     these components' handlers, so a bot's move is as audible as
     yours — see lib/gameFeel.jsx. */
  useGameFeel({
    gameKey: session?.game_key,
    moves,
    status: session?.status,
    winnerSeat: session?.winner_seat,
    mySeatNo: mySeat?.seat_no ?? null,
    currentSeat: session?.current_seat ?? null,
  });

  // Visible countdown, and the zero-crossing tick (once per turn).
  const turnSeconds = Number(session?.house_rules?.turn_seconds) || 60;
  const secondsLeft = useMemo(() => {
    if (session?.status !== "active" || !session.turn_started_at) return null;
    const deadline = new Date(session.turn_started_at).getTime() + turnSeconds * 1000;
    return Math.max(0, Math.ceil((deadline - now) / 1000));
  }, [session, turnSeconds, now]);

  useEffect(() => {
    if (session?.status !== "active" || secondsLeft !== 0) return;
    const key = `${session.current_seat}:${session.turn_started_at}`;
    if (tickedFor.current === key) return;
    tickedFor.current = key;
    gameTick(sessionId).then(refresh).catch(() => {});
  }, [secondsLeft, session, sessionId, refresh]);

  const act = async (fn, doneMsg) => {
    if (busy) return; // the same control can't fire twice
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (doneMsg) pushToast(doneMsg);
    } catch {
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
    }
    setBusy(false);
  };

  /* Leaving and calling off both end with this page gone, so neither can use
     act() — act() refreshes after the call, and by then the row may be unreadable.
     Set the flag FIRST, then say it and go through the shared toast host, which
     survives the route change and stays readable on the games home. */
  const callOff = async () => {
    if (busy || !session) return;
    setBusy(true);
    leaving.current = true;
    try {
      await cancelSession(session.id);
      toastThenGo(t("games.wait.calledOffToast"), "/app/games", { replace: true });
    } catch {
      leaving.current = false;    // still here after all
      setBusy(false);
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
    }
  };

  const leaveTable = async () => {
    if (busy || !session) return;
    // At a table in play the seat becomes a bot rather than vanishing, so the
    // others aren't stranded — the honest line differs from a lobby's.
    const inPlay = session.status === "active";
    setBusy(true);
    leaving.current = true;
    try {
      const res = await leaveSession(session.id);
      // left | cancelled | not_seated | over — every one of them means this
      // page is no longer somewhere to stand. Only a throw keeps us here.
      const gone = res?.result === "left" && inPlay;
      toastThenGo(
        gone ? t("games.wait.leftBotPlays") : t("games.wait.leftToast"),
        "/app/games",
        { replace: true }
      );
    } catch {
      leaving.current = false;
      setBusy(false);
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
    }
  };

  /* Invitee answers. 'filled' is not an error — it opens the
     start-your-own door. */
  const answerInvite = async (accept) => {
    if (!myInvite || busy) return;
    setBusy(true);
    try {
      const r = await respondInvite(myInvite.id, accept);
      if (r.result === "filled") {
        setFilledInfo(r);
      } else if (r.result === "declined") {
        // Nothing left to do here: say so, then take them home. The
        // shared host is app-wide, so the line survives the trip.
        toastThenGo(t("games.lobby.declinedQuiet"), "/app/games", { delay: 1400, tone: "info" });
        return;
      }
      await refresh();
    } catch {
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
    }
    setBusy(false);
  };

  /* "Start your own with the same people": a fresh table of the same
     game and size, inviting this table's humans who are connected to
     me (the server would refuse the rest — filter, never fail). */
  const startSameTable = async () => {
    if (busy) return;
    const info = filledInfo ?? { game_key: session?.game_key, seats_total: session?.seats_total };
    if (!info.game_key) return;
    setBusy(true);
    try {
      const id = await createSession(info.game_key, info.seats_total);
      const mine = new Set((await gamePeople().catch(() => [])).map((p) => p.id));
      const others = (session?.seats ?? [])
        .map((s) => s.profile_id)
        .filter((pid) => pid && pid !== profile.id && mine.has(pid));
      for (const pid of others) {
        try {
          await inviteToGame(id, pid);
        } catch {
          /* skip the unwilling */
        }
      }
      navigate(`/app/games/s/${id}`);
    } catch {
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
      setBusy(false);
    }
  };

  if (notMine && !session) {
    return (
      <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
        <BodyText style={{ fontWeight: 600 }}>{t("games.board.notYours")}</BodyText>
        <PrimaryBtn onClick={() => navigate("/app/games")}>{t("games.board.backHome")}</PrimaryBtn>
      </GamesScreen>
    );
  }
  if (loadError && !session) {
    return (
      <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
        <BodyText role="alert">{t("games.loadError")}</BodyText>
        <PrimaryBtn onClick={() => navigate("/app/games")}>{t("games.board.backHome")}</PrimaryBtn>
      </GamesScreen>
    );
  }
  if (!session) {
    // Loading, or the fetch failed: say so and offer a retry — a page
    // with nothing but "Back to games" reads as broken.
    return (
      <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
        {loadError ? (
          <>
            <BodyText role="alert" style={{ fontWeight: 600 }}>{t("games.loadError")}</BodyText>
            <PrimaryBtn onClick={refresh}>{t("games.board.retryCta")}</PrimaryBtn>
          </>
        ) : (
          <BodyText muted role="status">{t("games.ceremony.setting")}</BodyText>
        )}
      </GamesScreen>
    );
  }
  // After every hook: a ludo table lives on the ludo lane's own screen —
  // never the generic board (which reads as Race to 100).
  // The LOBBY stays on the rails (invite card, picker, spoken code —
  // ludo's own screen has none of those); the board is ludo's.
  // Called off: an invite deep-link is exactly how someone arrives here,
  // and they deserve a sentence rather than a broken table.
  if (session.status === "cancelled") {
    return (
      <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
        {confirmLeave && (
        <Card style={{ borderColor: C.brown, borderWidth: 2 }}>
          <p style={{ fontSize: ts(21), fontWeight: 700, margin: "0 0 6px" }}>
            {t("games.ceremony.leaveTitle")}
          </p>
          <BodyText muted style={{ marginBottom: 12 }}>
            {session.status === "active"
              ? t("games.ceremony.leaveInPlay")
              : t("games.ceremony.leaveLobby")}
          </BodyText>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <PrimaryBtn onClick={() => setConfirmLeave(false)}>
              {t("games.ceremony.stay")}
            </PrimaryBtn>
            <GhostBtn
              disabled={busy}
              onClick={() => {
                setConfirmLeave(false);
                leaveTable();
              }}
            >
              {t("games.ceremony.leaveConfirm")}
            </GhostBtn>
          </div>
        </Card>
      )}

      {started && (
        <div
          role="status"
          style={{
            textAlign: "center",
            fontFamily: "inherit",
            fontSize: ts(26),
            fontWeight: 800,
            color: C.green,
            background: C.white,
            border: `2.5px solid ${C.green}`,
            borderRadius: 18,
            padding: "10px 16px",
            marginBottom: 12,
          }}
        >
          🎲 {t("games.ceremony.start")}
        </div>
      )}
      <TableHeading title={session?.title} gameName={gameName} ts={ts} style={{ margin: "0 0 12px" }} />
        <Card>
          <BodyText style={{ margin: 0, fontWeight: 600 }}>{t("games.wait.calledOff")}</BodyText>
        </Card>
      </GamesScreen>
    );
  }

  if (session.game_key === "ludo" && session.status !== "lobby") {
    return <Navigate to={`/app/games/ludo/${session.id}`} replace />;
  }

  return (
    <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
      <GameMotionStyles />
      {/* Confetti falls only for the person who won. A table where the
          loser's screen throws a party for someone else is a table
          that rubs it in. Everyone hears the warm figure; only the
          winner gets the paper. */}
      <Confetti active={session.status === "finished" && session.winner_seat === mySeat?.seat_no} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <TableHeading title={session.title} gameName={gameName} ts={ts} />
        <SoundButton onClick={() => setSoundOpen((v) => !v)} />
      </div>

      {/* §17 — chairs held by a link, and one action each: send it. */}
      {session.status === "lobby" && mySeat && (
        <SeatLinks sessionId={session.id} gameName={gameName} />
      )}

      {soundOpen && <SoundPanel onClose={() => setSoundOpen(false)} />}

      {/* The table filled while an invite waited: warm, with a door. */}
      {filledInfo && (
        <Card style={{ borderColor: C.olive, borderWidth: 2 }}>
          <p style={{ fontSize: ts(21), fontWeight: 700, margin: "0 0 4px" }}>
            {t("games.lobby.filledTitle")}
          </p>
          <BodyText muted>{t("games.lobby.filledBody")}</BodyText>
          <PrimaryBtn disabled={busy} onClick={startSameTable}>
            {t("games.lobby.filledAgainCta")}
          </PrimaryBtn>
        </Card>
      )}

      {/* Invitee's own door: accept or quietly decline. */}
      {session.status === "lobby" && myInvite && !mySeat && !filledInfo && (
        <Card style={{ borderColor: C.green, borderWidth: 2 }}>
          <p style={{ fontSize: ts(21), fontWeight: 700, margin: "0 0 10px" }}>
            ✉️ {t("games.lobby.invitedTitle")}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <PrimaryBtn disabled={busy} onClick={() => answerInvite(true)}>
              {t("games.lobby.acceptCta")}
            </PrimaryBtn>
            <GhostBtn disabled={busy} onClick={() => answerInvite(false)}>
              {t("games.lobby.declineCta")}
            </GhostBtn>
          </div>
        </Card>
      )}

      {/* ASKING SOMEONE TO A TABLE THAT IS ALREADY PLAYING (§8).

          The lobby below is where invites used to live, and a §8
          table never has one: it opens active, with bots in every
          seat but yours. So the invite comes here instead, for as
          long as the table is still soft — nobody has played it —
          and it names a SEAT a bot is holding (0093). The bot goes
          on playing that seat until the person arrives, so asking
          somebody never stalls the game for the people already at
          it.

          ITS OWN LIST, not the lobby's `pickerStates`. That const
          belongs to WaitingRoom, a different component further
          down this file — referencing it from here was a name that
          does not exist in this scope, and the only reason it did
          not throw is that the `&&` guard short-circuited before
          the JSX was ever evaluated. It would have crashed the
          page the moment the feature started working. */}
      {isHost && soft && session.status !== "lobby" && botSeats.length > 0 && askable.length > 0 && (
        <Card>
          <SectionLabel>{t("games.lobby.inviteTitle")}</SectionLabel>
          {askable.map((p) => (
            <GhostBtn
              key={p.id}
              disabled={busy}
              style={{ marginTop: 8, width: "100%" }}
              onClick={() =>
                act(async () => {
                  /* The first seat a bot is holding. Which one hardly
                     matters here — unlike ludo, these boards do not
                     give a seat a colour anybody would choose. */
                  await inviteToSeat(session.id, p.id, botSeats[0]);
                  setAskable((list) => list.filter((x) => x.id !== p.id));
                }, t("feedback.invitedToGame", { name: (p.full_name || "").split(" ")[0] }))
              }
            >
              {p.full_name || t("ludo.seat.someone")}
            </GhostBtn>
          ))}
        </Card>
      )}
      {session.status === "lobby" && (
        <WaitingRoom
          session={session}
          game={game}
          mySeat={mySeat}
          isHost={isHost}
          isInvitee={!!myInvite}
          pendingInvites={pendingInvites}
          inviteNames={inviteNames}
          profile={profile}
          busy={busy}
          act={act}
          navigate={navigate}
          onCallOff={callOff}
          onLeave={leaveTable}
          onAskLeave={() => setConfirmLeave(true)}
          t={t}
          ts={ts}
        />
      )}

      {session.status !== "lobby" && session.game_key === "carrom" && (
        <TablePresence session={session} chat={chat} profile={profile}>
          <CarromRailsController sessionId={session.id} />
        </TablePresence>
      )}

      {session.status !== "lobby" && session.game_key !== "carrom" && (
        <TablePresence session={session} chat={chat} profile={profile}>
        <Board
          session={session}
          mySeat={mySeat}
          moves={moves}
          secondsLeft={secondsLeft}
          busy={busy}
          act={act}
          onPlay={() => act(() => playTurn(session.id))}
          onReclaim={() => act(() => reclaimSeat(session.id), t("games.board.reclaimed"))}
          onPlayAgain={startSameTable}
          onBoast={() =>
            act(
              () =>
                boastToPeople("win", session.id, {
                  game: gameName,
                  link: `/app/games/s/${session.id}`,
                }),
              t("games.board.boastToast")
            )
          }
          t={t}
          ts={ts}
        />
        </TablePresence>
      )}

      {/* Two taps, no typing: the presets land in the same chat table
          the panel below reads, so a remark is history as well as a
          bubble. */}
      {mySeat && session.status === "active" && (
        <QuickChat
          disabled={busy}
          onSend={async (text) => {
            try {
              await sendChat(session.id, profile.id, { body: text });
              await refresh();
            } catch {
              pushToast(t("games.actionError"), { tone: "error", key: "games" });
            }
          }}
        />
      )}

      {mySeat && !(session.status === "finished" && chat.length === 0) && (
        <ChatPanel
          sessionId={session.id}
          chat={chat}
          seats={session.seats}
          profile={profile}
          finished={session.status === "finished"}
          onSent={refresh}
          onError={() => pushToast(t("games.actionError"), { tone: "error", key: "games" })}
          t={t}
          ts={ts}
        />
      )}
    </GamesScreen>
  );
}

/* ── The waiting room IS the board ───────────────────────────────
   After Start you land here: the seats show who is in and who is
   still being waited on, the board sits underneath when the game has
   one to show, and the code hides behind a small share button. When
   the last seat fills, the status flips to active and this whole
   thing is replaced by play — no separate lobby page anywhere.

   Board-OPTIONAL by design: ludo's board lives on the ludo lane's own
   screen (SessionPage redirects there once active), so this renders
   correctly with nothing where a board would be.
   ───────────────────────────────────────────────────────────────── */

function SeatChip({ name, state, seatNo, ts }) {
  // The chip wears its seat colour, so the waiting room and the board
  // agree about who is who before a single move is made.
  const seatColor = SEAT_COLORS[(seatNo - 1) % SEAT_COLORS.length];
  const seatInk = SEAT_INK[(seatNo - 1) % SEAT_INK.length];
  // state: 'you' | 'seated' | 'bot' | 'waiting' | 'open'
  const waiting = state === "waiting";
  const empty = state === "open";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 56,
        padding: "8px 14px",
        borderRadius: 16,
        border: `2px solid ${empty || waiting ? C.warmGray : seatColor}`,
        background: empty || waiting ? "rgba(255,255,255,0.6)" : "#eef3e8",
        opacity: empty ? 0.75 : 1,
        minWidth: 0,
        flex: "1 1 46%",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: empty || waiting ? C.warmGray : seatColor,
          color: empty || waiting ? C.cream : seatInk,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: ts(16),
          fontWeight: 800,
          flex: "0 0 auto",
        }}
      >
        {state === "bot" ? "🤖" : waiting ? "…" : empty ? "+" : (name || "?").trim().charAt(0).toUpperCase()}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            display: "block",
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 700,
            color: empty || waiting ? C.textMuted : C.textMain,
            overflowWrap: "anywhere",
          }}
        >
          {name}
        </span>
      </span>
    </div>
  );
}

function WaitingRoom({
  session, game, mySeat, isHost, isInvitee,
  pendingInvites = [], inviteNames = {}, profile, busy, act, navigate,
  onCallOff, onLeave, onAskLeave, t, ts,
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [posted, setPosted] = useState(false);
  const canPost = profile.role === "saath_icon" || profile.is_org;
  const filled = session.seats.length;
  const pendingBySeat = Object.fromEntries(pendingInvites.map((i) => [i.seat_no, i]));
  const takenSeatNos = new Set(session.seats.map((x) => x.seat_no));

  const pickerStates = useMemo(() => {
    const out = {};
    for (const inv of pendingInvites) out[inv.invitee_id] = "invited";
    for (const x of session.seats) if (x.profile_id) out[x.profile_id] = "seated";
    return out;
  }, [session.seats, pendingInvites]);
  const openAllocations = session.seats_total - filled - pendingInvites.length;

  /* Seat chips, in seat order: who's here, who we're waiting on. */
  /* Each seat says its OWN state. The unbound-invite fallback used to be
     `pendingInvites.filter(…)[0]` evaluated per seat, which handed the
     SAME first invitee to every empty seat — a four-seat table with one
     person invited read "Waiting for Smoke Fam…" three times. An invite
     is now CONSUMED as it is placed, so a seat shows an invitee only if
     an invitation is genuinely outstanding for it, and everything left
     over is an open seat anyone may take. */
  const unboundQueue = pendingInvites.filter(
    (inv) => !takenSeatNos.has(inv.seat_no) && !pendingBySeat[inv.seat_no]
  );
  let unboundNext = 0;
  const chips = Array.from({ length: session.seats_total }, (_, i) => {
    const no = i + 1;
    const seat = session.seats.find((x) => x.seat_no === no);
    if (seat) {
      return {
        key: no,
        name: seat.is_bot
          ? t("games.board.bot")
          : seat.profile_id === profile.id
            ? t("games.board.you")
            : seat.name,
        state: seat.is_bot ? "bot" : seat.profile_id === profile.id ? "you" : "seated",
      };
    }
    const asked = pendingBySeat[no] || unboundQueue[unboundNext];
    if (asked) {
      if (!pendingBySeat[no]) unboundNext += 1; // spent — never reused
      return {
        key: no,
        name: t("games.wait.waitingFor", { name: inviteNames[asked.invitee_id] || "…" }),
        state: "waiting",
      };
    }
    return { key: no, name: t("games.wait.openSeat"), state: "open" };
  });

  return (
    <>
      {session.game_key === "ludo" && (
        <div
          aria-hidden="true"
          style={{
            position: "relative",
            opacity: 0.45,
            filter: "saturate(0.75)",
            pointerEvents: "none",
            marginBottom: 14,
          }}
        >
          <LudoBoard
            state={null}
            seatsInPlay={session.seats_total}
            options={[]}
            currentSeat={-1}
            onPieceTap={() => {}}
          />
        </div>
      )}

      {/* The seats — the chess.com read: who is at this table. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        {chips.map((c) => (
          <SeatChip key={c.key} name={c.name} state={c.state} seatNo={c.key} ts={ts} />
        ))}
      </div>

      {/* The board itself, where this screen has one to show. Ludo's
          lives on its own screen, so nothing renders here for it. */}
      {session.game_key === "snakes" && (
        <div aria-hidden="true" style={{ opacity: 0.55, pointerEvents: "none", marginBottom: 12 }}>
          <SnakesBoard
            seats={session.seats}
            currentSeat={null}
            label={t("games.wait.boardLabel")}
            mySeat={mySeat ? mySeat.seat_no - 1 : null}
          />
        </div>
      )}

      {/* Anyone who wandered in on an open table can sit down. */}
      {!mySeat && !isInvitee && (
        <PrimaryBtn disabled={busy} onClick={() => act(() => claimOpenSeat(session.id))} style={{ marginBottom: 12 }}>
          {t("community.shares.gameOpenCta")}
        </PrimaryBtn>
      )}

      {/* Share + Cancel: two small controls, no paragraphs. */}
      {mySeat && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <GhostBtn
            onClick={() => setShareOpen((o) => !o)}
            aria-expanded={shareOpen}
            aria-label={t("games.wait.share")}
            style={{ padding: "0 16px" }}
          >
            🔗 {t("games.wait.share")}
          </GhostBtn>
          <GhostBtn
            disabled={busy}
            onClick={() => (isHost ? onCallOff() : onAskLeave())}
            style={{ padding: "0 16px" }}
          >
            {isHost ? t("games.wait.cancel") : t("games.wait.leave")}
          </GhostBtn>
        </div>
      )}

      {shareOpen && mySeat && (
        <Card style={{ marginTop: 12 }}>
          <p
            dir="ltr"
            aria-label={session.join_code?.split("").join(" ")}
            style={{
              fontSize: ts(40),
              fontWeight: 800,
              letterSpacing: "0.35em",
              color: C.green,
              margin: "0 0 10px",
              textAlign: "center",
            }}
          >
            {session.join_code}
          </p>
          {/* The code, and the same code as a link one tap from
              WhatsApp. Anyone at the table may share it, not just the
              host — a guest inviting the fourth player is the point. */}
          <ShareTableButton
            code={session.join_code}
            game={game}
            hostName={
              session.seats.find((x) => x.profile_id === session.created_by)?.name || ""
            }
            style={{ marginBottom: 12, textAlign: "center" }}
          />

          {isHost && openAllocations > 0 && (
            <PeoplePicker
              searchable
              states={pickerStates}
              maxPick={Math.max(0, openAllocations)}
              pickedCount={0}
              onToggle={(p) =>
                act(
                  () => inviteToGame(session.id, p.id),
                  t("feedback.invitedToGame", { name: (p.full_name || "").split(" ")[0] })
                )
              }
            />
          )}
          {isHost && canPost && !posted && (
            <GhostBtn
              disabled={busy}
              style={{ marginTop: 12 }}
              onClick={() =>
                act(async () => {
                  await createShare(profile.id, "game_open", session.id, {
                    game_key: session.game_key,
                    name_en: game?.name_en,
                    name_ur: game?.name_ur,
                    seats_total: session.seats_total,
                    seats_taken: session.seats.length,
                  });
                  setPosted(true);
                }, t("games.lobby.openPosted"))
              }
            >
              {t("games.lobby.openPostCta")}
            </GhostBtn>
          )}
          {isHost && game?.timeout_style !== "pass_turn" && (
            <GhostBtn disabled={busy} style={{ marginTop: 12 }} onClick={() => act(() => startWithBots(session.id))}>
              {t("games.lobby.botsCta")}
            </GhostBtn>
          )}
        </Card>
      )}
    </>
  );
}

/* ── Snakes & Ladders board (the rails' reference turn game) ───── */

function Board({ session, mySeat, moves, secondsLeft, busy, onPlay, onReclaim, onBoast, onPlayAgain, t, ts }) {
  const target = Number(session.house_rules?.target) || 100;
  const snakes = session.game_key === "snakes";
  const myTurn =
    session.status === "active" && mySeat && session.current_seat === mySeat.seat_no;
  const lastBySeat = useMemo(() => {
    const out = {};
    for (const m of moves) out[m.seat_no] = m;
    return out;
  }, [moves]);
  const winner = session.seats.find((s) => s.seat_no === session.winner_seat);

  const seatLabel = (seat) =>
    seat.is_bot
      ? `${t("games.board.bot")} ${seat.seat_no}`
      : seat.profile_id === mySeat?.profile_id
        ? t("games.board.you")
        : seat.name || `${seat.seat_no}`;

  return (
    <>
      {session.status === "finished" && winner && (
        <Card style={{ borderColor: C.green, borderWidth: 2, textAlign: "center" }}>
          <p style={{ fontSize: ts(24), fontWeight: 800, margin: 0, color: C.green }}>
            {winner.profile_id === mySeat?.profile_id
              ? t("games.board.wonYou")
              : t("games.board.won", { name: seatLabel(winner) })}{" "}
            <span aria-hidden="true">🎉</span>
          </p>
          {/* Boast — YOUR win, YOUR tap, never automatic. */}
          {winner.profile_id === mySeat?.profile_id && onBoast && (
            <PrimaryBtn disabled={busy} onClick={onBoast} style={{ marginTop: 12 }}>
              📣 {t("games.board.boastCta")}
            </PrimaryBtn>
          )}
          {/* Next obvious step, one tap: the same people, a fresh table. */}
          {mySeat && onPlayAgain && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
              <GhostBtn disabled={busy} onClick={onPlayAgain}>
                🔁 {t("games.board.playAgainCta")}
              </GhostBtn>
            </div>
          )}
        </Card>
      )}

      <Card>
        <BodyText muted style={{ fontWeight: 600 }}>
          {snakes ? t("games.board.targetSnakes") : t("games.board.target", { target })}
        </BodyText>

        {snakes && (
          <div style={{ margin: "4px 0 16px" }}>
            {/* The board walks the token itself; it needs the move to
                know where the dice ended and where the snake began. */}
            <SnakesBoard
              seats={session.seats}
              currentSeat={session.status === "active" ? session.current_seat : null}
              label={t("games.board.boardLabel")}
              lastMove={moves.length ? moves[moves.length - 1] : null}
            />
            <BodyText muted style={{ fontSize: ts(15), margin: "8px 0 0" }}>
              🪜 {t("games.board.legendLadder")} · 🐍 {t("games.board.legendSnake")}
            </BodyText>
          </div>
        )}

        {session.seats.map((seat) => {
          const isTurn = session.status === "active" && session.current_seat === seat.seat_no;
          const last = lastBySeat[seat.seat_no];
          return (
            <div key={seat.seat_no} style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: isTurn ? 800 : 600 }}>
                  {isTurn && <span aria-hidden="true">▶ </span>}
                  {seatLabel(seat)}
                </span>
                <span style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                  {snakes ? t("games.board.at", { cell: seat.score }) : `${seat.score} / ${target}`}
                </span>
                {last && (
                  <span style={{ fontSize: ts(16), color: C.textMuted }}>
                    {last.move?.pass
                      ? t("games.board.passed")
                      : `${t("games.board.rolled", { roll: last.move?.roll ?? "" })} 🎲`}
                    {snakes && !last.move?.pass && last.move?.via === "ladder" && (
                      <> — 🪜 {t("games.board.climbed", { to: last.move.to })}</>
                    )}
                    {snakes && !last.move?.pass && last.move?.via === "snake" && (
                      <> — 🐍 {t("games.board.slid", { to: last.move.to })}</>
                    )}
                    {snakes && !last.move?.pass && last.move?.stuck && (
                      <> — {t("games.board.stuck", { need: last.move.need })}</>
                    )}
                  </span>
                )}
                {seat.presence === "away" && (
                  <span
                    style={{
                      fontSize: ts(15),
                      fontWeight: 700,
                      color: C.brown,
                      background: C.bg,
                      border: `1px solid ${C.warmGray}`,
                      borderRadius: 50,
                      padding: "2px 12px",
                    }}
                  >
                    {t("games.board.away")}
                  </span>
                )}
              </div>
              {!snakes && (
              <div
                role="img"
                aria-label={`${seatLabel(seat)}: ${seat.score} / ${target}`}
                style={{
                  height: 14,
                  background: C.bg,
                  border: `1px solid ${C.warmGray}`,
                  borderRadius: 50,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, (seat.score / target) * 100)}%`,
                    height: "100%",
                    background: isTurn ? C.green : C.olive,
                    borderRadius: 50,
                    transition: "width 0.4s",
                  }}
                />
              </div>
              )}
            </div>
          );
        })}

        {session.status === "active" && (
          <>
            <BodyText
              aria-live="polite"
              style={{ fontWeight: 700, color: myTurn ? C.green : C.textMuted }}
            >
              {myTurn
                ? t("games.board.yourTurn")
                : t("games.board.turnOf", {
                    name: seatLabel(
                      session.seats.find((s) => s.seat_no === session.current_seat) ?? {}
                    ),
                  })}
              {secondsLeft != null && (
                <> · {t("games.board.countdown", { s: secondsLeft })}</>
              )}
            </BodyText>
            {myTurn && (
              <PrimaryBtn disabled={busy} onClick={onPlay} style={{ fontSize: ts(22) }}>
                🎲 {t("games.board.rollCta")}
              </PrimaryBtn>
            )}
            {mySeat?.presence === "away" && (
              <PrimaryBtn disabled={busy} onClick={onReclaim} style={{ marginInlineStart: 10 }}>
                {t("games.board.reclaimCta")}
              </PrimaryBtn>
            )}
          </>
        )}
      </Card>
    </>
  );
}

/* ── Chat + stickers ───────────────────────────────────────────── */

function ChatPanel({ sessionId, chat, seats, profile, finished, onSent, onError, t, ts }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const nameOf = (id) =>
    id === profile.id
      ? t("games.board.you")
      : seats.find((s) => s.profile_id === id)?.name || "…";

  const send = async (payload) => {
    setSending(true);
    try {
      await sendChat(sessionId, profile.id, payload);
      setText("");
      await onSent();
    } catch {
      onError();
    }
    setSending(false);
  };

  return (
    <Card>
      <SectionLabel>{t("games.chat.title")}</SectionLabel>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", maxHeight: 260, overflowY: "auto" }}>
        {chat.map((m) => (
          <li key={m.id} style={{ padding: "6px 0", fontSize: ts(A11Y.minBodyPx), lineHeight: 1.5 }}>
            <strong>{nameOf(m.sender_id)}: </strong>
            {m.sticker && <span style={{ fontSize: ts(26) }}>{m.sticker}</span>}
            {/* STICKERS_WIRING: :sticker/<id>: bodies render as the
                brand SVG; ordinary text unchanged. */}
            {m.body &&
              (parseStickerRef(m.body) ? (
                <Sticker id={parseStickerRef(m.body)} size={96} />
              ) : (
                <span style={{ overflowWrap: "anywhere" }}> {m.body}</span>
              ))}
          </li>
        ))}
      </ul>
      {!finished && (
        <>
          {stickersOpen && (
            <div style={{ marginBottom: 10 }}>
              <StickerPicker
                label={t("games.chat.stickers")}
                onPick={(id) => {
                  setStickersOpen(false);
                  send({ body: stickerRef(id) });
                }}
              />
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) send({ body: text.trim() });
            }}
            style={{ display: "flex", gap: 10 }}
          >
            <GhostBtn
              aria-expanded={stickersOpen}
              aria-label={t("games.chat.stickers")}
              onClick={() => setStickersOpen((o) => !o)}
              style={{ paddingInline: 12 }}
            >
              🌸
            </GhostBtn>
            <input
              type="text"
              value={text}
              maxLength={500}
              placeholder={t("games.chat.placeholder")}
              aria-label={t("games.chat.placeholder")}
              onChange={(e) => setText(e.target.value)}
              style={{ flex: 1 }}
            />
            <PrimaryBtn disabled={sending || !text.trim()} onClick={() => text.trim() && send({ body: text.trim() })}>
              {t("games.chat.sendCta")}
            </PrimaryBtn>
          </form>
          <div
            role="group"
            aria-label={t("games.chat.stickers")}
            style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}
          >
            {GAME_STICKERS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={sending}
                onClick={() => send({ sticker: s })}
                aria-label={`${t("games.chat.stickers")} ${s}`}
                style={{
                  minWidth: A11Y.minTapTargetPx,
                  minHeight: A11Y.minTapTargetPx,
                  fontSize: 26,
                  background: C.white,
                  border: `2px solid ${C.warmGray}`,
                  borderRadius: 12,
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
