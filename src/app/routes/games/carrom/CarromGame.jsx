/* ════════════════════════════════════════════════
   Carrom — standalone hotseat controller (1v1, one device). Ties the
   board to the pure turn logic and a per-turn countdown, proving the
   whole game plays end to end with NO rails dependency. It is also the
   reference the rails controller mirrors: swap `newGame/applyShotResult/
   applyTimeout` (local) for create-session / submit-move / server-tick
   (rails) and the board + banner are unchanged. See CARROM_WIRING.md.

   Warm, calm, senior-friendly: a big turn banner, a plain-words result
   line (foul / missed / your go again / won), a forgiving countdown.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { COLORS as C } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import CarromBoard from "./CarromBoard.jsx";
import { newGame, applyShotResult, applyTimeout, TURN_SECONDS } from "./gameLogic.js";
import { STRINGS } from "./carromCopy.js";

const SEAT_COLOUR = ["#3a2a1e", "#faf3e9"]; // seat 0 dark coins, seat 1 light

export default function CarromGame({ turnSeconds = TURN_SECONDS }) {
  const { lang, ts, meta } = useI18n();
  const s = STRINGS[lang] || STRINGS.en;
  const [game, setGame] = useState(() => newGame(2));
  const [left, setLeft] = useState(turnSeconds);
  const gameRef = useRef(game);
  gameRef.current = game;

  // Per-turn countdown. Reset whenever the turn changes; a lapse is a
  // MISSED turn (pass, no shot) — carrom's rule.
  useEffect(() => {
    if (game.status !== "active") return;
    setLeft(turnSeconds);
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          setGame((g) => applyTimeout(g));
          return turnSeconds;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [game.turn, game.status, turnSeconds]);

  const onShoot = (_shot, result) => {
    setGame((g) => applyShotResult(g, result));
  };

  const resultLine = () => {
    const m = game.message;
    if (!m) return s.aimHint;
    const who = s.seat(m.seat + 1);
    switch (m.kind) {
      case "win": return s.wonLine(who);
      case "foul": return s.foulLine(who);
      case "missed": return s.missedLine(who);
      case "score": return m.queen === "pocketed_covered" ? s.queenLine(who) : s.scoreLine(who);
      case "miss": return s.turnPassLine;
      default: return s.aimHint;
    }
  };

  const turnName = s.seat(game.seat + 1);
  const finished = game.status === "finished";

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "8px 12px 24px" }}>
      {/* Turn banner */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          background: C.white, border: `1.5px solid ${C.warmGray}`, borderRadius: 16,
          padding: "12px 16px", marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: "50%", background: SEAT_COLOUR[game.seat], border: `2px solid ${C.brown}`, display: "inline-block" }} />
          <span style={{ fontFamily: meta.fonts.heading, fontSize: ts(22), fontWeight: 700, color: C.green }}>
            {finished ? s.wonLine(s.seat(game.winner + 1)) : s.turnOf(turnName)}
          </span>
        </div>
        {!finished && (
          <span role="timer" aria-label={s.timeLeft} style={{
            fontSize: ts(20), fontWeight: 800,
            color: left <= 10 ? C.error : C.textMuted, minWidth: 44, textAlign: "end",
          }}>
            {left}s
          </span>
        )}
      </div>

      <CarromBoard
        state={game.state}
        seat={game.seat}
        isYourTurn={!finished}
        onShoot={onShoot}
      />

      {/* Plain-words result / hint line */}
      <p role="status" style={{ fontSize: ts(18), color: C.textMain, textAlign: "center", margin: "14px 0 0", minHeight: 26, lineHeight: 1.5 }}>
        {resultLine()}
      </p>

      {finished && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setGame(newGame(2))}
            style={{
              minHeight: 56, padding: "0 28px", borderRadius: 50, border: "none",
              background: C.green, color: C.cream, fontSize: ts(19), fontWeight: 700,
              fontFamily: "inherit", cursor: "pointer",
            }}
          >
            {s.playAgain}
          </button>
        </div>
      )}
    </div>
  );
}
