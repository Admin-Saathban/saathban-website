/* ════════════════════════════════════════════════
   Play something — POSTS_SPEC.md §9.2, from the reconnect row.

   "Tapping a game creates the table with her seat held, sends the
   invite, and lands you on the board. No menu, no confirm step."

   That is exactly what one tap here does, using the two calls the games
   lane already owns: openQuickTable seats the bots so the board is
   playable the moment it appears, and inviteToSeat hands one named seat
   to her while the bot goes on holding it — so the table does not stall
   while she decides, and she is not required to be online for the tap
   to make sense.

   WHAT IS NOT HERE, and it is the half the spec asks for that cannot be
   built yet. §9.2 wants "the games you both play", with a sub-line
   giving a reason where one exists ("You played this together in May").
   Nothing computes that: the games lane confirms there is finished-table
   history and a count-only helper for two people, but no "games you both
   play" list and no first-played date. So this offers the three games
   plainly, in a fixed order, with no sub-lines — fewer claims rather
   than invented ones. The filter is a query somebody has to write.

   Deliberately NOT reusing ThreadPage's chooser, which looks the same
   and is not: that one first hunts for a live table already embedded in
   the conversation, because one board per conversation is its rule.
   There is no conversation here, so that lookup would have nothing to
   search and the shared version would have to be told which of two
   behaviours it was having.

   Strings are the thread chooser's — people.thread.* — because they are
   already written in both languages and already say this exact thing.
   No new locale keys.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { MotionStyles } from "../../lib/motion.jsx";
import { GhostBtn, BodyText } from "./ui.jsx";
import { openQuickTable } from "../games/quickTable.js";
import { inviteToSeat } from "../../lib/games.js";

const GAMES = [
  { key: "ludo", glyph: "🎲" },
  { key: "carrom", glyph: "🎯" },
  { key: "snakes", glyph: "🪜" },
];

export default function PlaySomethingSheet({ person, onClose }) {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const start = async (gameKey) => {
    if (starting || !person?.id) return;
    setStarting(true);
    setError("");
    try {
      const path = await openQuickTable(gameKey);
      const id = String(path).split("/").pop();
      /* Seat 1 is the first seat that is not the host's. The invite is
         attempted after the table exists, so a failure here still leaves
         a playable board rather than nothing — but it is not swallowed,
         because "her seat is held" is the whole promise of the tap. */
      await inviteToSeat(id, person.id, 1);
      onClose?.();
      navigate(path);
    } catch (e) {
      setError(e?.message || "");
      setStarting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="sb-dim"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(0,0,0,0.38)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <MotionStyles />
      <div
        className="sb-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t("people.thread.playWhich")}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          background: C.bg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: "18px 16px 24px",
        }}
      >
        <h2 style={{ fontSize: ts(22), fontWeight: 800, color: C.brown, margin: "0 0 12px" }}>
          {t("people.thread.playWhich")}
        </h2>

        {GAMES.map((g) => (
          <button
            key={g.key}
            type="button"
            disabled={starting}
            onClick={() => start(g.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              width: "100%",
              minHeight: Math.max(72, A11Y.minTapTargetPx),
              padding: "12px 18px",
              marginBottom: 10,
              background: C.white,
              border: `2px solid ${C.warmGray}`,
              borderRadius: 18,
              fontFamily: "inherit",
              fontSize: ts(20),
              fontWeight: 700,
              color: C.textMain,
              textAlign: "start",
              cursor: starting ? "default" : "pointer",
              opacity: starting ? 0.6 : 1,
            }}
          >
            <span aria-hidden="true" style={{ fontSize: ts(26) }}>{g.glyph}</span>
            {t(`people.thread.game_${g.key}`)}
          </button>
        ))}

        {error ? (
          <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
            ⚠ {error}
          </BodyText>
        ) : null}

        <GhostBtn onClick={onClose} style={{ width: "100%" }}>
          {t("outdoor.place.formCancel")}
        </GhostBtn>
      </div>
    </div>
  );
}
