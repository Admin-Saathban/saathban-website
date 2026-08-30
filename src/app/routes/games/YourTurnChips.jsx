/* "Your turn" chips for the Icon hub — self-contained: fetches its
   own data, renders nothing when no table is waiting on you. The hub
   lane wires it with one import (GAMES_WIRING.md). */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { fetchGames, fetchMySessions, isDormant } from "../../lib/games.js";

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
              /* TONIGHT §3.2 — "a chip only ever appears when it is
                 genuinely that person's move in a LIVE table".

                 The old test was status + whose seat it is, which is
                 true of an abandoned table for ever: the Icon's home
                 carried "Your move — Ludo" against a table whose turn
                 had been open since the previous day, on every screen,
                 permanently. It was not wrong about whose turn it was.
                 It was wrong that there was a game going on. */
              .filter(
                (s) =>
                  s.status === "active" &&
                  s.current_seat != null &&
                  s.my_seat != null &&
                  s.current_seat === s.my_seat &&
                  !isDormant(s)
              )
              .map((s) => ({
                id: s.id,
                gameKey: s.game_key,
                at: s.turn_started_at || s.created_at || "",
                name:
                  (lang === "ur" ? byKey[s.game_key]?.name_ur : byKey[s.game_key]?.name_en) ??
                  s.game_key,
              }))
              /* ONE CHIP PER GAME, NEWEST FIRST, AT MOST THREE.

                 A person is meant to have one table at a time, and the
                 home screen must stay readable when the data says
                 otherwise — walked on the deployed preview, the Icon
                 home carried ELEVEN identical "Your move — Ludo" pills
                 stacked down the page, which is what the user was
                 looking at when they said the chips were wrong.

                 Deduping by game is the honest summary: the chip's job
                 is "there is a Ludo waiting for you", and the eleventh
                 copy of that sentence adds nothing a person can act on.
                 The cap is the backstop for the same thing across
                 different games. */
              .sort((a, b) => String(b.at).localeCompare(String(a.at)))
              .filter((s, i, all) => all.findIndex((x) => x.gameKey === s.gameKey) === i)
              .slice(0, 3)
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
