/* One game session: the lobby (join code, invites, open-table post,
   start-with-bots) and the live board. The board here is the rails'
   reference game, Race to 100 — ludo renders its own under
   routes/games/ludo/. Turn timing is server-owned; this page shows
   the countdown and calls game_tick() when it hits zero so a lapsed
   turn resolves immediately instead of at the next cron minute. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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
  startWithBots,
  claimOpenSeat,
  searchPeople,
  GAME_STICKERS,
} from "../../lib/games.js";
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
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const tickedFor = useRef(null);

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
      setLoadError(!s);
    } catch {
      setLoadError(true);
    }
  }, [sessionId]);

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

  if (loadError && !session) {
    return (
      <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
        <BodyText role="alert">{t("games.loadError")}</BodyText>
      </GamesScreen>
    );
  }
  if (!session) return <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")} />;

  return (
    <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
      <h1 style={{ fontSize: ts(28), margin: "0 0 12px", color: C.brown }}>{gameName}</h1>

      {session.status === "lobby" && (
        <Lobby
          session={session}
          game={game}
          gameName={gameName}
          mySeat={mySeat}
          isHost={isHost}
          profile={profile}
          busy={busy}
          act={act}
          t={t}
          ts={ts}
        />
      )}

      {session.status !== "lobby" && (
        <Board
          session={session}
          mySeat={mySeat}
          moves={moves}
          secondsLeft={secondsLeft}
          busy={busy}
          act={act}
          onPlay={() => act(() => playTurn(session.id))}
          onReclaim={() => act(() => reclaimSeat(session.id), t("games.board.reclaimed"))}
          t={t}
          ts={ts}
        />
      )}

      {mySeat && (
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

function Lobby({ session, game, gameName, mySeat, isHost, profile, busy, act, t, ts }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [posted, setPosted] = useState(false);
  const filled = session.seats.length;
  const canPost = profile.role === "saath_icon" || profile.is_org;

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      searchPeople(query.trim(), [profile.id, ...session.seats.map((s) => s.profile_id).filter(Boolean)])
        .then(setResults)
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, profile.id, session.seats]);

  return (
    <>
      <Card>
        <p style={{ fontSize: ts(20), fontWeight: 700, margin: "0 0 8px" }}>
          {t("games.lobby.title")}
        </p>
        <BodyText muted>{t("games.lobby.codeHint")}</BodyText>
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
        <BodyText style={{ fontWeight: 600 }}>
          {t("games.lobby.seats", { filled, total: session.seats_total })}
        </BodyText>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
          {Array.from({ length: session.seats_total }, (_, i) => {
            const seat = session.seats.find((s) => s.seat_no === i + 1);
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
                <span aria-hidden="true">{seat ? (seat.is_bot ? "🤖" : "🪑") : "▫️"}</span>
                <span style={{ color: seat ? C.textMain : C.textMuted }}>
                  {seat
                    ? seat.is_bot
                      ? t("games.board.bot")
                      : seat.profile_id === profile.id
                        ? t("games.board.you")
                        : seat.name
                    : t("games.lobby.seatEmpty")}
                </span>
              </li>
            );
          })}
        </ul>
        <BodyText muted style={{ margin: 0 }}>
          {t("games.lobby.waiting")}
        </BodyText>
      </Card>

      {!mySeat && (
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
          <SectionLabel>{t("games.lobby.inviteTitle")}</SectionLabel>
          <input
            type="text"
            value={query}
            placeholder={t("games.lobby.invitePlaceholder")}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("games.lobby.inviteTitle")}
          />
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
            {results.map((p) => (
              <li
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "6px 0",
                }}
              >
                <span style={{ flex: 1, fontSize: ts(A11Y.minBodyPx) }}>{p.full_name}</span>
                <GhostBtn
                  disabled={busy}
                  onClick={() =>
                    act(() => inviteToGame(session.id, p.id), t("games.lobby.invited"))
                  }
                >
                  {t("games.lobby.inviteCta")}
                </GhostBtn>
              </li>
            ))}
          </ul>

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
            <GhostBtn disabled={busy} onClick={() => act(() => startWithBots(session.id))}>
              {t("games.lobby.botsCta")}
            </GhostBtn>
          </div>
        </Card>
      )}
    </>
  );
}

/* ── Race to 100 board ─────────────────────────────────────────── */

function Board({ session, mySeat, moves, secondsLeft, busy, onPlay, onReclaim, t, ts }) {
  const target = Number(session.house_rules?.target) || 100;
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
        </Card>
      )}

      <Card>
        <BodyText muted style={{ fontWeight: 600 }}>
          {t("games.board.target", { target })}
        </BodyText>

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
                  {seat.score} / {target}
                </span>
                {last && (
                  <span style={{ fontSize: ts(16), color: C.textMuted }}>
                    {last.move?.pass
                      ? t("games.board.passed")
                      : `${t("games.board.rolled", { roll: last.move?.roll ?? "" })} 🎲`}
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
