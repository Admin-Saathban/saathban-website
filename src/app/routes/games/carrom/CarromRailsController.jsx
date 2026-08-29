/* ════════════════════════════════════════════════
   Carrom on the rails — drives the board from a live game session
   (0022 rails + 0024 executor). Given a sessionId it subscribes to the
   session, renders the board for the current mover, submits each shot for
   server validation via play_turn, and reflects the authoritative state
   back. The rails own turn order, timing (pass-on-timeout), scoring, and
   win/finish; this component only shows and submits.

   This is exactly what the DM "Play carrom" chat-transform embeds inline
   (rails.startCarromInThread → a session id → <CarromRailsController/>),
   with the conversation continuing beneath. Standalone hotseat play lives
   in CarromGame.jsx.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { COLORS as C } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { useSession } from "../../../lib/session.jsx";
import CarromBoard from "./CarromBoard.jsx";
import { initialLayout } from "./physics.js";
import { STRINGS } from "./carromCopy.js";
import { subscribeSession, submitShot, initBoard } from "./rails.js";

export default function CarromRailsController({ sessionId }) {
  const { lang, ts, meta } = useI18n();
  const s = STRINGS[lang] || STRINGS.en;
  const { profile } = useSession();
  const myId = profile?.id;

  const [view, setView] = useState(null); // fetchSession() shape, or null while loading
  const [error, setError] = useState("");
  const [left, setLeft] = useState(null);
  const initTried = useRef(false);

  useEffect(() => {
    if (!sessionId || !myId) return;
    const unsub = subscribeSession(sessionId, myId, (v) => {
      setView(v);
      // Whoever is on the move sets the opening board once.
      if (v.status === "active" && !v.state && v.isMyTurn && !initTried.current) {
        initTried.current = true;
        initBoard(sessionId, initialLayout()).catch(() => { initTried.current = false; });
      }
    });
    return unsub;
  }, [sessionId, myId]);

  // Local countdown for the current turn (display only; the rails enforce it).
  useEffect(() => {
    if (!view || view.status !== "active" || !view.turnStartedAt) { setLeft(null); return; }
    const tick = () => {
      const deadline = new Date(view.turnStartedAt).getTime() + view.turnSeconds * 1000;
      setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [view]);

  const onShoot = async (shot, result) => {
    setError("");
    try {
      await submitShot(sessionId, shot, result);
    } catch (e) {
      setError(e.message || s.errGeneric || "That didn't send.");
    }
  };

  if (!view) {
    return <p role="status" style={{ fontSize: ts(18), color: C.textMuted, textAlign: "center" }}>···</p>;
  }

  const finished = view.status === "finished";
  const iWon = finished && view.winnerSeat0 === view.mySeat0;
  const banner = finished
    ? (iWon ? s.wonLine(s.seat((view.mySeat0 ?? 0) + 1)) : s.wonLine(s.seat((view.winnerSeat0 ?? 0) + 1)))
    : view.isMyTurn
    ? s.turnOf(s.seat((view.mySeat0 ?? 0) + 1))
    : s.turnOf(s.seat((view.currentSeat0 ?? 0) + 1));

  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        background: C.white, border: `1.5px solid ${C.warmGray}`, borderRadius: 16,
        padding: "10px 14px", marginBottom: 12,
      }}>
        <span style={{ fontFamily: meta.fonts.heading, fontSize: ts(20), fontWeight: 700, color: C.green }}>
          {banner}
        </span>
        {!finished && left != null && (
          <span role="timer" aria-label={s.timeLeft} style={{ fontSize: ts(19), fontWeight: 800, color: left <= 10 ? C.error : C.textMuted }}>
            {left}s
          </span>
        )}
      </div>

      <CarromBoard
        state={view.state || initialLayout()}
        seat={view.currentSeat0 ?? 0}
        isYourTurn={!finished && view.isMyTurn}
        onShoot={onShoot}
      />

      {error && (
        <p role="alert" style={{ fontSize: ts(16), color: C.error, textAlign: "center", marginTop: 10 }}>⚠ {error}</p>
      )}
      {!finished && !view.isMyTurn && (
        <p role="status" style={{ fontSize: ts(18), color: C.textMuted, textAlign: "center", marginTop: 12 }}>
          {s.watching || ""}
        </p>
      )}
    </div>
  );
}
