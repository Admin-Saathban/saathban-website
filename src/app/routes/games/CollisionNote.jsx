/* ════════════════════════════════════════════════
   "You tapped one game and you are looking at another."

   GAMES_IMMERSION_SPEC §8.2 said: handle the one-game-at-a-time
   collision AT THE TABLE rather than as a prose interstitial. That
   landed — GamesHome takes a second tap straight to the table you
   already have, with no wall of text in the way.

   And it produced this, which is worse than the wall it replaced:
   tapping any game silently opens your existing
   LUDO table. Three buttons, one destination, nothing said. Measured on
   the deployed build — every game returned the identical session
   URL. From the owner's chair that does not read as "you already have a
   table", it reads as "that game is broken", and the other games
   look unreachable.

   Taking somebody to their existing table is the honest answer only if
   the table says why they are there. Silence turns a correct redirect
   into a wrong game.

   So: ONE line, on the board, naming what they asked for — not a screen
   before the game, which is what §8.2 forbids. The way out is the door
   already on the table, which asks warmly and hands the seat to a bot,
   so this points at that rather than adding a second way to leave.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { useLocation } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import Icon from "../../components/Icon.jsx";

export default function CollisionNote() {
  const { t, ts } = useI18n();
  const { state } = useLocation();
  const [gone, setGone] = useState(false);

  const wanted = state?.sbWantedName;
  if (!wanted || gone) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "0 8px 8px",
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.10)",
        color: "#fff",
      }}
    >
      <Icon name="warn" size={18} />
      <span style={{ flex: 1, fontSize: ts(15), lineHeight: 1.4 }}>
        {t("games.collision.line", { game: wanted })}
      </span>
      {/* Dismissible, because it is news rather than a decision — and it
          must not sit over the board for the rest of the game. */}
      <button
        type="button"
        onClick={() => setGone(true)}
        aria-label={t("common.dismiss")}
        style={{
          minHeight: A11Y.minTapTargetPx,
          minWidth: A11Y.minTapTargetPx,
          border: "none",
          background: "none",
          color: "#fff",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
