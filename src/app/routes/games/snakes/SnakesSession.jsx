/* ════════════════════════════════════════════════
   A snakes table: the setup room while seats are filling, the board
   once they are full, and the winner's moment at the end.

   THIS SCREEN OWNS ITS OWN ATMOSPHERE. No app header, no bottom bar —
   see SnakesRoutes. What chrome there is sits ON the table: the two
   solid dark controls, the row of player circles, and nothing else.

   WHAT IS BORROWED FROM LUDO, ON PURPOSE. The chat panel, the profile
   cards with their per-person mutes, and the settings sheet with its
   two sliders are ludo's components, imported and used as they are.
   The owner asked for "the same" and the honest way to build the same
   thing is not to build it again — a second chat panel would drift
   from the first inside a month, and the mute list is the kind of
   thing that must not have two implementations.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../../../lib/i18n.jsx";
import { useSession } from "../../../lib/session.jsx";
import {
  fetchSession, fetchMoves, playTurn, gameTick, leaveSession,
} from "../../../lib/games.js";
import { playSound, startAmbience, stopAmbience, unlockSound } from "../../../lib/sound.js";
import SnakesBoard from "./SnakesBoard.jsx";
import SnakesSetup from "./SnakesSetup.jsx";
import Celebration from "./Celebration.jsx";
import useTokenWalk from "./useTokenWalk.js";
import { boardFor, seatColorIdx } from "./design.js";
import { colorOf } from "./skins.js";
import ChatPanel from "../ludo/ChatPanel.jsx";
import SnakesSettings from "./SnakesSettings.jsx";
import PlayerCard from "../ludo/PlayerCard.jsx";
import Icon from "../../../components/Icon.jsx";

/* The owner's control colour — solid, dark, the same object ludo
   uses, so a person moving between the two games keeps their
   bearings. */
const CTRL = "#1E2226";

function Ctrl({ onClick, label, children, badge = 0 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        position: "relative",
        width: 48, height: 48, borderRadius: 14,
        background: CTRL,
        border: "1px solid rgba(255,255,255,.12)",
        color: "#F2ECDF",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", flexShrink: 0,
      }}
    >
      {children}
      {badge > 0 && (
        <span style={{
          position: "absolute", top: -4, insetInlineEnd: -4,
          minWidth: 18, height: 18, borderRadius: 9, background: "#C8202C",
          color: "#fff", fontSize: 11, fontWeight: 800,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "0 4px",
        }}>{badge > 9 ? "9+" : badge}</span>
      )}
    </button>
  );
}

/* One player, as a circle on the table — their colour, their initial,
   and a ring when it is their turn. */
function SeatCircle({ seat, colorIdx, active, onOpen, t }) {
  const c = colorOf(colorIdx);
  const name = seat.name || (seat.is_bot ? t("games.board.bot") : t("msg.someone"));
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={name}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        background: "none", border: "none", padding: 0, cursor: "pointer", minWidth: 54,
      }}
    >
      <span style={{
        width: 42, height: 42, borderRadius: "50%",
        background: `linear-gradient(150deg, ${c.light}, ${c.body} 60%, ${c.deep})`,
        color: c.ink, fontWeight: 800, fontSize: 17,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        boxShadow: active
          ? `0 0 0 3px #E0A81E, 0 2px 8px rgba(0,0,0,.5)`
          : "0 2px 8px rgba(0,0,0,.5)",
      }}>
        {(name || "?").trim().charAt(0).toUpperCase()}
      </span>
      <span style={{
        fontSize: 12, color: "#D8D2C4", maxWidth: 56,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {name.split(" ")[0]}
      </span>
      <span style={{ fontSize: 11, color: "#9A9384", fontWeight: 700 }}>{seat.score ?? 0}</span>
    </button>
  );
}

export default function SnakesSession() {
  const { sessionId } = useParams();
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const myId = profile?.id;

  const [session, setSession] = useState(null);
  const [moves, setMoves] = useState([]);
  const [error, setError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cardSeat, setCardSeat] = useState(null);
  const [rolling, setRolling] = useState(false);
  const seenRef = useRef(0);

  /* Keyed on the COUNTS, not on the session object. fetchSession
     returns a fresh object every 2.6 seconds; memoising on it rebuilt
     the board every poll, which rebuilt play(), which is exactly the
     instability the hook was just fixed for. */
  const bKey = `${session?.house_rules?.snakes ?? ""}:${session?.house_rules?.ladders ?? ""}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const board = useMemo(() => boardFor(session), [bKey]);

  const load = useCallback(async () => {
    try {
      const s = await fetchSession(sessionId);
      if (!s) { setError("gone"); return; }
      setSession(s);
    } catch (e) { setError(e.message || "load"); }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  /* THE MUSIC IS ASKED FOR ONCE, HERE, and the setup room is inside
     this same component — which is what stops the bed restarting at
     the door the owner asked it to survive. sound.js defers a stop by
     a beat as well, so even a remount cannot tear it in half. */
  useEffect(() => {
    startAmbience("snakes");
    return () => stopAmbience();
  }, []);

  /* Poll. The rails are server-owned; this screen only reads. */
  useEffect(() => {
    const id = setInterval(() => { load(); gameTick(sessionId).catch(() => {}); }, 2600);
    return () => clearInterval(id);
  }, [load, sessionId]);

  const active = session?.status === "active";
  const finished = session?.status === "finished";

  /* ── the walking piece ───────────────────────────────────────── */
  const { frame, play } = useTokenWalk(board, load);

  /* New moves are played out, oldest first. seenRef is the high-water
     mark so a poll that returns the same move twice does not walk the
     piece twice. */
  useEffect(() => {
    if (!active && !finished) return undefined;
    let alive = true;
    const pull = async () => {
      try {
        const fresh = await fetchMoves(sessionId, seenRef.current);
        if (!alive || !fresh?.length) return;
        seenRef.current = fresh[fresh.length - 1].id;
        setMoves((m) => [...m, ...fresh]);
        const last = fresh[fresh.length - 1];
        if (last?.move) play(last.seat_no, last.move);
      } catch { /* a dropped poll is not an error a player needs */ }
    };
    pull();
    const id = setInterval(pull, 1500);
    return () => { alive = false; clearInterval(id); };
  }, [active, finished, sessionId, play]);

  const mySeat = useMemo(
    () => (session?.seats || []).find((s) => s.profile_id === myId) || null,
    [session, myId]
  );
  const myTurn = active && mySeat && session.current_seat === mySeat.seat_no;

  const roll = async () => {
    if (!myTurn || rolling || frame) return;
    setRolling(true);
    unlockSound();
    try { await playTurn(sessionId); await load(); }
    catch (e) { setError(e.message || "turn"); }
    finally { setRolling(false); }
  };

  /* ── tokens ──────────────────────────────────────────────────── */
  const tokens = useMemo(() => {
    if (!session) return [];
    return (session.seats || []).map((s) => {
      const moving = frame && frame.seat === s.seat_no;
      return {
        key: `seat-${s.seat_no}`,
        cell: moving ? frame.cell : (s.score ?? 0),
        at: moving ? frame.at : null,
        colorIdx: seatColorIdx(session, s.seat_no),
        name: s.name || t("games.board.bot"),
      };
    });
  }, [session, frame, t]);

  /* A TABLE THAT WAS CALLED OFF IS NOT A TABLE.

     Found by looking: a lobby left sitting is cancelled by the rails'
     own tick, and this screen only knew about lobby, active and
     finished — so a cancelled table fell through to the LAST branch
     and drew a live board with everybody on square zero, waiting for
     a turn that was never coming. Falling through to the most
     specific screen is the wrong default; the fall-through here is
     now the board only when the board is really what this is. */
  if (session?.status === "cancelled") {
    return <Centered><p>{t("games.wait.calledOff")}</p></Centered>;
  }

  /* A TABLE WITH NOBODY AT IT IS NOT A TABLE EITHER, and this one is
     the quiet failure rather than the loud one.

     game_seats is behind can_view_game(), so a reader who is not a
     participant gets ZERO ROWS AND NO ERROR — PostgREST answers 200
     with []. Nothing throws. The board then drew itself perfectly:
     paper, snakes, ladders, and not one piece on it.

     It is easy to reach without doing anything wrong. Miss enough
     turns and the rails hand your seat to a bot; you are no longer a
     participant, and the table you were sitting at five minutes ago
     becomes a beautiful empty board. Say so instead. */
  if (session && !finished && (session.seats || []).length === 0) {
    return <Centered><p>{t("games.wait.calledOff")}</p></Centered>;
  }

  if (error === "gone") {
    return <Centered><p>{t("games.wait.calledOff")}</p></Centered>;
  }
  if (!session) return <Centered><p aria-live="polite">···</p></Centered>;

  /* ── the setup room ──────────────────────────────────────────── */
  if (session.status === "lobby") {
    return (
      <SnakesSetup
        session={session}
        myId={myId}
        onChanged={load}
        onLeave={() => navigate("/app/games")}
      />
    );
  }

  const winner = finished
    ? (session.seats || []).find((s) => s.seat_no === session.winner_seat)
    : null;

  return (
    <>
      {/* ── the players ── */}
      <div style={{
        display: "flex", gap: 10, padding: "10px 12px 4px",
        overflowX: "auto", justifyContent: "center", flexShrink: 0,
      }}>
        {(session.seats || []).map((s) => (
          <SeatCircle
            key={s.seat_no}
            seat={s}
            colorIdx={seatColorIdx(session, s.seat_no)}
            active={active && session.current_seat === s.seat_no}
            onOpen={() => setCardSeat(s)}
            t={t}
          />
        ))}
      </div>

      {/* ── the board ── */}
      <div style={{
        flex: 1, minHeight: 0, display: "flex",
        alignItems: "center", justifyContent: "center", padding: "4px 12px",
      }}>
        <SnakesBoard
          board={board}
          tokens={tokens}
          colorSet={session.house_rules?.colorSet || "classic"}
          highlight={frame?.cell ?? null}
          size={Math.min(380, typeof window !== "undefined" ? window.innerWidth - 28 : 360)}
        />
      </div>

      {/* ── the controls ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 14px calc(10px + env(safe-area-inset-bottom, 0px))",
        flexShrink: 0,
      }}>
        <Ctrl onClick={() => navigate("/app/games")} label={t("games.board.backHome")}>
          <Icon name="back" size={22} />
        </Ctrl>
        <Ctrl onClick={() => setChatOpen(true)} label={t("ludo.chat.toggle")}>
          <Icon name="messages" size={22} />
        </Ctrl>

        <button
          type="button"
          onClick={roll}
          disabled={!myTurn || rolling || !!frame}
          style={{
            flex: 1, minHeight: 52, borderRadius: 16, border: "none",
            background: myTurn && !frame ? "#9A4A8E" : "rgba(255,255,255,.10)",
            color: myTurn && !frame ? "#fff" : "#A8A296",
            fontSize: ts(18), fontWeight: 800,
            cursor: myTurn && !frame ? "pointer" : "default",
          }}
        >
          {finished
            ? t("snakes.over")
            : myTurn
              ? (frame ? "···" : t("games.board.rollCta"))
              : t("snakes.waitTurn")}
        </button>

        <Ctrl onClick={() => setSettingsOpen(true)} label={t("ludo.settings.title")}>
          <Icon name="more" size={22} />
        </Ctrl>
      </div>

      {chatOpen && (
        <ChatPanel
          sessionId={sessionId}
          myId={myId}
          seats={session.seats || []}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}
      {settingsOpen && (
        <SnakesSettings
          board={board}
          onClose={() => setSettingsOpen(false)}
          onLeave={async () => {
            try { await leaveSession(sessionId); } catch { /* the door still opens */ }
            navigate("/app/games");
          }}
        />
      )}
      {cardSeat && (
        <PlayerCard
          sessionId={sessionId}
          seat={cardSeat.seat_no}
          row={cardSeat}
          isMe={cardSeat.profile_id === myId}
          myProfileId={myId}
          myName={profile?.full_name}
          onClose={() => setCardSeat(null)}
        />
      )}
      {winner && (
        <Celebration
          colorIdx={seatColorIdx(session, winner.seat_no)}
          name={winner.name || t("games.board.bot")}
          onDone={() => {}}
        />
      )}
    </>
  );
}

function Centered({ children }) {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      color: "#D8D2C4", fontSize: 18,
    }}>
      {children}
    </div>
  );
}
