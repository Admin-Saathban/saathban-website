/* "Your turn" chips for the Icon hub — self-contained: fetches its
   own data, renders nothing when no table is waiting on you. The hub
   lane wires it with one import (GAMES_WIRING.md). */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { fetchGames, fetchMySessions } from "../../lib/games.js";

export default function YourTurnChips() {
  const { t, ts, lang } = useI18n();
  const { profile } = useSession();
  const [waiting, setWaiting] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all([fetchGames(), fetchMySessions(profile.id)])
        .then(([games, sessions]) => {
          if (!alive) return;
          const byKey = Object.fromEntries(games.map((g) => [g.key, g]));
          setWaiting(
            sessions
              .filter((s) => s.status === "active" && s.current_seat === s.my_seat)
              .map((s) => ({
                id: s.id,
                name:
                  (lang === "ur" ? byKey[s.game_key]?.name_ur : byKey[s.game_key]?.name_en) ??
                  s.game_key,
              }))
          );
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, [profile.id, lang]);

  if (!waiting.length) return null;

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "0 0 16px" }}>
      {waiting.map((w) => (
        <Link
          key={w.id}
          to={`/app/games/s/${w.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: A11Y.minTapTargetPx,
            padding: "0 20px",
            borderRadius: 50,
            background: C.green,
            color: C.cream,
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <span aria-hidden="true">🎲</span>
          {t("games.home.yourTurnChip")} — {w.name}
        </Link>
      ))}
    </div>
  );
}
