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
   to start: for a game that seats no bot it would be false. Nothing here says
   it — the sheet only names the games on offer — and it must stay that
   way.

   WHAT IS NOT HERE, and it is the half the spec asks for that cannot be
   built yet. §9.2 wants "the games you both play", with a sub-line
   giving a reason where one exists ("You played this together in May").
   Nothing computes that: the games lane confirms there is finished-table
   history and a count-only helper for two people, but no "games you both
   play" list and no first-played date. So this offers the games on offer
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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y, MEANING } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { MotionStyles } from "../../lib/motion.jsx";
import { GhostBtn, BodyText } from "./ui.jsx";
import { openQuickTable } from "../games/quickTable.js";
import { inviteToSeat, fetchGames } from "../../lib/games.js";
import { useSession } from "../../lib/session.jsx";
import { playedTogether, playedWhen } from "./playedTogether.js";
import Icon from "../../components/Icon.jsx";
import useBackToClose from "../../components/useBackToClose";

/* GLYPHS ONLY. The games themselves come from the registry.

   This used to be a hardcoded list of three with `waits: true` written
   against a game by name. That is the trap games.js already warns about
   one layer down — callers computing a game's behaviour from something
   other than the games table, and being silently wrong. Hardcoding the
   NAME is the same mistake with better odds: it happens to be right
   today and is wrong the moment a fourth game is added, with no error
   to say so.

   `waits` is derived from timeout_style === "pass_turn", which is the
   actual reason: a pass_turn game has no bot player, so start_with_bots
   refuses it and the table waits for her instead of starting. A new
   pass_turn game gets the sub-line without anybody remembering to add
   it here; a new bot game correctly gets none.

   Names come from the registry too, which carries both languages —
   people.thread.game_* only exists for the three that were known when
   that chooser was written. */
const GLYPH = { ludo: "dice", snakes: "snakes" };

export default function PlaySomethingSheet({ person, onClose }) {
  useBackToClose(true, onClose);
  const { t, ts, lang } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const first = (person?.full_name || "").trim().split(" ")[0] || "";
  const [games, setGames] = useState(null);   /* null = still loading */
  const [shared, setShared] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchGames()
            /* Enabled AND seats at least two. Deriving the list from the
         registry immediately put Daily Riddle in this sheet — seats 1-1,
         a solo puzzle nobody can be invited to — which the hardcoded
         list of three had hidden rather than answered. The criterion is
         not a name and not a kind: it is whether a second person can sit
         down, which is the only thing this sheet is for. */
      .then((rows) => { if (alive) setGames((rows || []).filter((g) => g.enabled && (g.max_seats || 0) >= 2)); })
      /* A failure here used to read as "there are no games", which is
         a statement about the app rather than about the request that
         failed. The shared-games map below keeps its empty fallback on
         purpose: that one is enrichment, and an empty map degrades
         honestly without claiming anything. */
      .catch((e) => { if (alive) { setGames([]); setError(t("common.loadError")); } });
    playedTogether(profile?.id, person?.id)
      .then((m) => { if (alive) setShared(m); })
      .catch(() => { if (alive) setShared(new Map()); });
  return () => { alive = false; };
  }, [profile?.id, person?.id]);

  const start = async (game) => {
    if (starting || !person?.id) return;
    setStarting(true);
    setError("");
    try {
      /* The ROW, not the key. openQuickTable reads the registry when it
         is handed a bare key, and this sheet has already fetched every
         row to build the list — so passing the key would buy a second
         query for something sitting in state. Seat count comes off
         max_seats either way; this only decides who pays for it. */
      const path = await openQuickTable(game);
      const id = String(path).split("/").pop();
      /* Seat 1 is the first seat that is not the host's — a bot's chair in
         ludo and snakes, or a seat number with no row behind it yet.
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

  /* Component scope, not effect scope. This was first inserted before
     the useEffect's CLEANUP return — the effect's `return () => {}` is
     also a line beginning `return (`, so the anchor matched the wrong
     one and `ordered` was scoped to the effect. The sheet then threw
     "ordered is not defined" and rendered nothing at all. */
  const withHistory = (g) => (shared ? shared.get(g.key) : null) || null;
  const ordered = (games || []).slice().sort((a, b) => {
  const A = withHistory(a), B = withHistory(b);
  if (!!A !== !!B) return A ? -1 : 1;
  if (A && B) return new Date(B.at || 0) - new Date(A.at || 0);
  return 0;
  });

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

        {games === null ? (
          <BodyText muted role="status">{t("common.loading")}</BodyText>
        ) : null}

        {/* §9.2 — THE GAMES YOU BOTH PLAY, FIRST.

            A game the two of them have actually finished together
            leads, most recent first, and carries the reason. The rest
            follow with no sub-line, because a reason invented for them
            would be the app claiming a memory that does not exist.

            The others are not dropped. §9.2 says "the games you both
            play", but two people who have never played would then get
            an empty sheet from a button offering to play — so the
            shared ones are promoted rather than the rest hidden. That
            is my call where the spec assumed a shared history exists;
            flagged in the report. */}
        {(ordered || []).map((g) => (
          <button
            key={g.key}
            type="button"
            disabled={starting}
            onClick={() => start(g)}
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
            <Icon name={GLYPH[g.key] || "dice"} size={26} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span>{lang === "ur" ? g.name_ur : g.name_en}</span>
              {(() => {
                /* The REASON first, the caveat second. "You played this
                   together in May" is what §9.2 asks for and is the
                   warmer of the two; the waiting note only earns the
                   line when there is no memory to put there. */
                const h = withHistory(g);
                const when = h ? playedWhen(h.at, lang) : null;
                const text = when
                  ? t("community.feed.reconnect.playedIn", { month: when })
                  : g.timeout_style === "pass_turn"
                    ? t("community.feed.reconnect.playWaits", { name: first })
                    : null;
                return text ? (
                  <span style={{ fontSize: ts(15), fontWeight: 500, color: C.textMuted }}>{text}</span>
                ) : null;
              })()}
            </span>
          </button>
        ))}

        {error ? (
          <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
            <Icon name="warn" size={17} style={{ verticalAlign: "-3px", marginInlineEnd: 6, color: MEANING.warning }} />{error}
          </BodyText>
        ) : null}

        <GhostBtn onClick={onClose} style={{ width: "100%" }}>
          {t("outdoor.place.formCancel")}
        </GhostBtn>
      </div>
    </div>
  );
}
