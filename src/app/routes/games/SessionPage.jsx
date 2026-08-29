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
  respondInvite,
  fetchMyInvites,
  fetchSessionInvites,
  fetchNames,
  createSession,
  gamePeople,
  boastToPeople,
  startWithBots,
  claimOpenSeat,
  GAME_STICKERS,
} from "../../lib/games.js";
import PeoplePicker from "./PeoplePicker.jsx";
/* Carrom has its own board on the rails; ludo has its own route.
   Everything else is the reference Race to 100 board below. */
import CarromRailsController from "./carrom/CarromRailsController.jsx";
import SnakesBoard from "./snakes/SnakesBoard.jsx";
import { Navigate } from "react-router-dom";
import { createShare } from "../community/communityData.js";
import { GamesScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn, Toast } from "./ui.jsx";
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
  const [filledInfo, setFilledInfo] = useState(null); // respond → 'filled'
  const [inviteNames, setInviteNames] = useState({}); // invitee id → name
  const [loadError, setLoadError] = useState(false);
  const [notMine, setNotMine] = useState(false); // RLS: not a table I'm at
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const tickedFor = useRef(null);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
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

  const game = useMemo(
    () => games.find((g) => g.key === session?.game_key),
    [games, session]
  );
  const gameName = game ? (lang === "ur" ? game.name_ur : game.name_en) : "";
  const mySeat = session?.seats.find((s) => s.profile_id === profile.id);
  const isHost = session?.created_by === profile.id;

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
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (doneMsg) setToast(doneMsg);
    } catch {
      setToast(t("games.actionError"));
    }
    setBusy(false);
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
        // Nothing left to do here: say so, then take them home.
        setToast(t("games.lobby.declinedQuiet"));
        window.setTimeout(() => navigate("/app/games"), 1400);
        return;
      }
      await refresh();
    } catch {
      setToast(t("games.actionError"));
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
      setToast(t("games.actionError"));
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
          <BodyText muted role="status">···</BodyText>
        )}
      </GamesScreen>
    );
  }
  // After every hook: a ludo table lives on the ludo lane's own screen —
  // never the generic board (which reads as Race to 100).
  // The LOBBY stays on the rails (invite card, picker, spoken code —
  // ludo's own screen has none of those); the board is ludo's.
  if (session.game_key === "ludo" && session.status !== "lobby") {
    return <Navigate to={`/app/games/ludo/${session.id}`} replace />;
  }

  return (
    <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
      <h1 style={{ fontSize: ts(28), margin: "0 0 12px", color: C.brown }}>{gameName}</h1>

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

      {session.status === "lobby" && (
        <Lobby
          session={session}
          game={game}
          gameName={gameName}
          mySeat={mySeat}
          isHost={isHost}
          isInvitee={!!myInvite}
          pendingInvites={pendingInvites}
          inviteNames={inviteNames}
          profile={profile}
          busy={busy}
          act={act}
          t={t}
          ts={ts}
        />
      )}

      {session.status !== "lobby" && session.game_key === "carrom" && (
        <CarromRailsController sessionId={session.id} />
      )}

      {session.status !== "lobby" && session.game_key !== "carrom" && (
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
      )}

      {mySeat && !(session.status === "finished" && chat.length === 0) && (
        <ChatPanel
          sessionId={session.id}
          chat={chat}
          seats={session.seats}
          profile={profile}
          finished={session.status === "finished"}
          onSent={refresh}
          onError={() => setToast(t("games.actionError"))}
          t={t}
          ts={ts}
        />
      )}

      <Toast text={toast} />
    </GamesScreen>
  );
}

/* ── Lobby ─────────────────────────────────────────────────────── */

function Lobby({
  session,
  game,
  gameName,
  mySeat,
  isHost,
  isInvitee,
  pendingInvites = [],
  inviteNames = {},
  profile,
  busy,
  act,
  t,
  ts,
}) {
  const [posted, setPosted] = useState(false);
  const filled = session.seats.length;
  const canPost = profile.role === "saath_icon" || profile.is_org;

  // People-first invite states for the picker: seated beats invited.
  const pickerStates = useMemo(() => {
    const out = {};
    for (const inv of pendingInvites) out[inv.invitee_id] = "invited";
    for (const s of session.seats) if (s.profile_id) out[s.profile_id] = "seated";
    return out;
  }, [session.seats, pendingInvites]);
  const openAllocations =
    session.seats_total - filled - pendingInvites.length;

  const hostName = session.seats.find((s) => s.profile_id === session.created_by)?.name;
  const missing = session.seats_total - filled;
  const pendingBySeat = Object.fromEntries(pendingInvites.map((i) => [i.seat_no, i]));
  // THE one plain sentence for where this table stands right now.
  const statusLine = isInvitee
    ? t("games.lobby.invitedIntro", { host: hostName || "…" })
    : !mySeat
      ? t("games.lobby.openIntro")
      : missing === 1
        ? t("games.lobby.waitingForOne")
        : t("games.lobby.waitingFor", { n: missing });

  return (
    <>
      <Card>
        <p style={{ fontSize: ts(20), fontWeight: 700, margin: "0 0 8px" }}>
          {t("games.lobby.title")}
        </p>
        <BodyText style={{ fontWeight: 600 }}>{statusLine}</BodyText>
        {mySeat && <BodyText muted>{t("games.lobby.codeHint")}</BodyText>}
        {mySeat && (
        <p
          aria-label={session.join_code?.split("").join(" ")}
          style={{
            fontSize: ts(40),
            fontWeight: 800,
            letterSpacing: "0.35em",
            color: C.green,
            margin: "0 0 12px",
            textAlign: "center",
          }}
        >
          {session.join_code}
        </p>
        )}
        <BodyText style={{ fontWeight: 600 }}>
          {t("games.lobby.seats", { filled, total: session.seats_total })}
        </BodyText>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
          {Array.from({ length: session.seats_total }, (_, i) => {
            const seat = session.seats.find((s) => s.seat_no === i + 1);
            const asked = !seat ? pendingBySeat[i + 1] : null;
            return (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minHeight: A11Y.minTapTargetPx,
                  fontSize: ts(A11Y.minBodyPx),
                  borderBottom: `1px solid ${C.warmGray}`,
                }}
              >
                <span aria-hidden="true">{seat ? (seat.is_bot ? "🤖" : "🪑") : asked ? "✉️" : "▫️"}</span>
                <span style={{ color: seat ? C.textMain : C.textMuted }}>
                  {seat
                    ? seat.is_bot
                      ? t("games.board.bot")
                      : seat.profile_id === profile.id
                        ? t("games.board.you")
                        : seat.name
                    : asked
                      ? t("games.lobby.askedRow", { name: inviteNames[asked.invitee_id] || "…" })
                      : t("games.lobby.seatEmpty")}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {!mySeat && !isInvitee && (
        <PrimaryBtn
          disabled={busy}
          onClick={() => act(() => claimOpenSeat(session.id))}
          style={{ marginBottom: 16 }}
        >
          {t("community.shares.gameOpenCta")}
        </PrimaryBtn>
      )}

      {isHost && (
        <Card>
          <SectionLabel>{t("games.picker.title")}</SectionLabel>
          <BodyText muted>{t("games.picker.intro")}</BodyText>
          {/* One tap invites — the RPC is idempotent, so a double-tap
              can never double-invite or re-notify. */}
          <PeoplePicker
            states={pickerStates}
            maxPick={Math.max(0, openAllocations)}
            pickedCount={0}
            onToggle={(p) =>
              act(() => inviteToGame(session.id, p.id), t("games.lobby.invited"))
            }
          />

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            {canPost && !posted && (
              <GhostBtn
                disabled={busy}
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
            {/* Carrom passes turns on timeout and has no bot player —
                a bot seat would be an empty chair with a clock. */}
            {game?.timeout_style !== "pass_turn" && (
              <GhostBtn disabled={busy} onClick={() => act(() => startWithBots(session.id))}>
                {t("games.lobby.botsCta")}
              </GhostBtn>
            )}
          </div>
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
            <SnakesBoard
              seats={session.seats}
              currentSeat={session.status === "active" ? session.current_seat : null}
              label={t("games.board.boardLabel")}
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
