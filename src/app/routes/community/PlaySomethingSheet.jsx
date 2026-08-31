/* ════════════════════════════════════════════════
   Play something — POSTS_SPEC.md §9.2, from the reconnect row.

   "Tapping a game creates the table with her seat held, sends the
   invite, and lands you on the board. No menu, no confirm step."

   One tap creates the table, reserves her seat and opens the board,
   using the two calls the games lane owns.

   WHAT ARRIVES IS NOT THE SAME FOR ALL THREE, and the first version of
   this comment said it was. Ludo and snakes are seated with bots, so
   the board is playable the instant it appears and her invitation takes
   over a chair a bot is holding. CARROM HAS NO BOT PLAYER BY DESIGN —
   start_with_bots refuses it outright — so what opens is a table
   WAITING FOR HER, not a game in progress, and her seat is reserved
   against a seat number with no row behind it yet (migration 0098).

   That difference must never turn into copy promising a game is about
   to start: for carrom it would be false. Nothing user-facing here says
   it — the sheet only names the three games — and it must stay that
   way.

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

/* `waits` is the one sub-line reason §9.2 asks for that can actually be
   computed. Carrom has no computer player, so its table waits for her
   instead of starting — and three tiles that look identical, one of
   which opens a waiting room, is a surprise nobody asked for. The games
   lane flagged the same gap on their Games home; this is the same defect
   in my sheet, so it is fixed here rather than left as theirs. */
const GAMES = [
  { key: "ludo", glyph: "🎲" },
  { key: "carrom", glyph: "🎯", waits: true },
  { key: "snakes", glyph: "🪜" },
];

export default function PlaySomethingSheet({ person, onClose }) {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const first = (person?.full_name || "").trim().split(" ")[0] || "";
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const start = async (gameKey) => {
    if (starting || !person?.id) return;
    setStarting(true);
    setError("");
    try {
      const path = await openQuickTable(gameKey);
      const id = String(path).split("/").pop();
      /* Seat 1 is the first seat that is not the host's — a bot's chair in
         ludo and snakes, a seat number with no row behind it in carrom.
         inviteToSeat takes both shapes since 0098; before that, tapping
         Carrom here threw "That seat is not free" because the function
         only knew how to take over a bot.

         Not swallowed: "her seat is held" is the whole promise of the
         tap, so if the invitation fails the person is told rather than
         landed on a board that is quietly just theirs. */
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
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span>{t(`people.thread.game_${g.key}`)}</span>
              {g.waits ? (
                <span style={{ fontSize: ts(15), fontWeight: 500, color: C.textMuted }}>
                  {t("community.feed.reconnect.playWaits", { name: first })}
                </span>
              ) : null}
            </span>
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
