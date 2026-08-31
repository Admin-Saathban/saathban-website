/* Games home: my tables (your-turn first), the Daily Riddle door,
   join-by-code, and the registry with a PEOPLE-FIRST create flow —
   the picker comes before any form (0029: family at one table, not
   adjacent features). */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useFresh } from "../../lib/feedback.jsx";
import { useSession } from "../../lib/session.jsx";
import { openQuickTable } from "./quickTable.js";
import {
  fetchGames,
  fetchMySessions,
  fetchMyAttempts,
  joinByCode,
  liveSessionOf,
  liveSessionsOf,
  leaveSession,
  fetchTablePeople,
  puzzleToday,
} from "../../lib/games.js";
import { GamesScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn } from "./ui.jsx";
import { SEAT_COLORS, SEAT_INK } from "./seatColors.js";
import BoardThumb from "./BoardThumb.jsx";
import OneTableGate from "./OneTableGate.jsx";

function gameName(g, lang) {
  return lang === "ur" ? g.name_ur : g.name_en;
}
function gameTagline(g, lang) {
  return lang === "ur" ? g.tagline_ur : g.tagline_en;
}


/* ── WHO IS AT THIS TABLE (§9) ─────────────────────────────────
   "Live tables first, with who is in them." A row of seat-coloured
   faces, in seat order, so the card is a table with people at it
   rather than a row about a game.

   Bots are drawn, not hidden. A four-seat table showing one face
   would read as a table nobody came to; three of those seats are
   somebody to play against, and saying so plainly is kinder than
   an empty row. They are dimmer and they carry a dot rather than
   an initial, so a bot is never mistaken for a person — the
   difference is shape and opacity, not colour alone. */
function Faces({ players, size = 30 }) {
  const { t } = useI18n();
  if (!players?.length) return null;
  const label = players
    .map((p) => (p.is_bot ? t("ludo.seat.bot") : p.is_me ? t("ludo.seat.you") : p.name || t("ludo.seat.someone")))
    .join(", ");
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }} aria-label={label}>
      {players.map((p, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            marginInlineStart: i ? -8 : 0,
            background: SEAT_COLORS[p.seat % SEAT_COLORS.length],
            color: SEAT_INK[p.seat % SEAT_INK.length],
            border: `2px solid ${C.cream}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: Math.round(size * 0.46),
            opacity: p.is_bot ? 0.45 : 1,
          }}
        >
          {p.is_bot ? "\u00B7" : (p.name || "").trim().charAt(0).toUpperCase() || "\u00B7"}
        </span>
      ))}
    </span>
  );
}
export default function GamesHome() {
  const { t, ts, lang } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  /* §8: a tap opens a TABLE, not a form. The old tile went to
     /app/games/new/:key; that screen still exists for anything that
     links to it, but nothing here does any more. */
  const [opening, setOpening] = useState(null);
  const openTable = async (key) => {
    if (opening) return;

    /* TAPPING A GAME OPENS THAT GAME.

       This sent you to whatever table you already had, whichever
       game you tapped — so with a ludo table open, Carrom and
       Snakes & Ladders both opened ludo. I wrote it that way to
       answer the one-game-at-a-time rule, and answered it by
       making two of the three games unreachable. A rule about how
       many tables you may hold is not a reason to send you to the
       wrong game.

       Same game: back to your table, which is what you meant.
       Different game: the old table is left first — the server
       hands your seat to a bot so anybody else at it plays on —
       and the game you tapped opens. Still one table at a time,
       and the tap does what it says. */
    const mine = liveSessionOf(await fetchMySessions(profile.id).catch(() => []));
    if (mine) {
      if (mine.game_key === key) {
        navigate(mine.game_key === "ludo" ? `/app/games/ludo/${mine.id}` : `/app/games/s/${mine.id}`);
        return;
      }
      setOpening(key);
      try {
        await leaveSession(mine.id);
      } catch {
        /* if it will not let go, the create below fails honestly */
      }
    }
    setOpening(key);
    try {
      navigate(await openQuickTable(key));
    } catch {
      setOpening(null);
    }
  };

  const [games, setGames] = useState([]);
  const [sessions, setSessions] = useState([]);
  const fresh = useFresh();
  const [solvedToday, setSolvedToday] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  /* Painted once, when there is nothing left to arrive. */
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState("");
  // The table standing in the way, when someone tries for a second.
  const [blockedBy, setBlockedBy] = useState(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  /* §9: who is at each live table, keyed by session. */
  const [peopleAt, setPeopleAt] = useState(new Map());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [g, s, attempts] = await Promise.all([
          fetchGames(),
          fetchMySessions(profile.id),
          fetchMyAttempts(profile.id),
        ]);
        if (!alive) return;
        setGames(g);
        setSessions(s);
        /* The faces, for the live tables only — a history page's
           worth of seats is not worth fetching to draw two rows. */
        fetchTablePeople(
          s.filter((x) => ["active", "lobby"].includes(x.status)).map((x) => x.id),
          profile.id
        )
          .then((m) => alive && setPeopleAt(m))
          .catch(() => {});
        // A table made a moment ago glows once when they come back to
        // this list (FLOW.md: every created thing presents itself).
        try {
          const justMade = sessionStorage.getItem("saathban.app.freshTable");
          if (justMade && s.some((row) => row.id === justMade)) {
            sessionStorage.removeItem("saathban.app.freshTable");
            setTimeout(() => fresh.mark(justMade), 0);
          }
        } catch {
          /* storage off — no glow, no harm */
        }
        const solved = attempts.filter((a) => a.solved_at);
        setSolvedCount(solved.length);
        /* Consecutive solved days ending today (or yesterday, so the
           streak survives until the day is actually missed). */
        const days = new Set(solved.map((a) => a.puzzle_date));
        let n = 0;
        for (let i = 0; i < 400; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          if (days.has(key)) n += 1;
          else if (i > 0) break;
        }
        setStreak(n);
        setSolvedToday(solved.some((a) => a.puzzle_date === puzzleToday()));
      } catch {
        if (alive) setLoadError(true);
      } finally {
        /* In `finally`, so a failed fetch shows the error rather
           than holding the placeholder on screen for ever. */
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile.id]);

  const byKey = useMemo(() => Object.fromEntries(games.map((g) => [g.key, g])), [games]);
  const tables = sessions.filter((s) => byKey[s.game_key]?.kind === "turns");
  const turnGames = games.filter((g) => g.kind === "turns");

  const submitCode = async (e) => {
    e.preventDefault();
    if (busy || code.replace(/\D/g, "").length < 6) return;
    // A code is another way to end up at a second table.
    const inTheWay = liveSessionOf(sessions);
    if (inTheWay) {
      setBlockedBy(inTheWay);
      return;
    }
    setBusy(true);
    setCodeMsg("");
    try {
      const r = await joinByCode(code);
      if (r.result === "joined") {
        navigate(`/app/games/s/${r.session_id}`);
        return;
      }
      setCodeMsg(t(r.result === "filled" ? "games.code.filled" : "games.code.noTable"));
    } catch {
      setCodeMsg(t("games.code.slow"));
    }
    setBusy(false);
  };

  const live = tables.filter((s) => s.status !== "finished" && s.status !== "cancelled");
  // ONE live table at a time: the first IS the active game. Any others
  // (seeded before this rule) sit quietly beneath it rather than
  // vanishing.
  const activeGame = live[0] ?? null;
  const otherLive = live.slice(1);
  const past = tables.filter((s) => s.status === "finished" || s.status === "cancelled");
  const recent = past.slice(0, 3);
  const nextStep = (s) =>
    s.status === "lobby"
      ? t("games.home.nextLobby")
      : s.status === "finished"
        ? t("games.home.nextFinished")
        : s.current_seat === s.my_seat
          ? t(
              // Per game: carrom flicks a striker, ludo rolls and moves,
              // dice games just roll — never "tap to roll" at a carrom board.
              s.game_key === "carrom"
                ? "games.home.nextYourTurnCarrom"
                : s.game_key === "ludo"
                  ? "games.home.nextYourTurnLudo"
                  : s.game_key === "snakes" || s.game_key === "race100"
                    ? "games.home.nextYourTurn"
                    : "games.home.nextYourTurnOther"
            )
          : t("games.home.nextTheirTurn");
  const renderTable = (s) => {
    const g = byKey[s.game_key];
    return (
      <Link
        key={s.id}
        {...fresh.props(s.id)}
        to={`/app/games/s/${s.id}`}
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        <Card
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            borderColor: C.warmGray,
            borderWidth: 1,
            borderStyle: "solid",
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: ts(20), fontWeight: 700, margin: "0 0 4px" }}>
              {s.title || (g ? gameName(g, lang) : s.game_key)}
            </p>
            {/* Named tables still say which game they are — a history
                list of occasions you cannot identify is its own
                problem. */}
            {s.title && (
              <BodyText muted style={{ margin: "0 0 2px" }}>
                {g ? gameName(g, lang) : s.game_key}
              </BodyText>
            )}
            {/* No "it's your move". The row says which game and who
                is at it; whether it is your turn is the board's to
                say, once you have chosen to go there. */}
            {/* §9: who is at it, on every live table and not only
                the first one. */}
            <span style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
              <Faces players={peopleAt.get(s.id)} size={28} />
            </span>
          </div>
          {/* No pulsing "Your move". It was the loudest thing on
              the screen and it was the nag in miniature — a green
              pill, animated, telling you to go and play. Whose turn
              it is is the board's to say. */}
        </Card>
      </Link>
    );
  };

  return (
    <GamesScreen>
      <h1 style={{ fontSize: ts(30), margin: "0 0 6px", color: C.brown }}>{t("games.title")}</h1>
      {/* §9: "One line of text maximum on the whole screen." The
          heading is the screen's name and stays; the paragraph
          underneath it — "A table is always open — play with
          neighbours, or let the bots keep you company" — was the
          product explaining itself to somebody who had already
          arrived. The tables below say it by existing. */}
      {loadError && <BodyText role="alert">{t("games.loadError")}</BodyText>}

      {/* Nothing until everything. The heading above is already
          drawn and does not move, so the screen reads as settled
          while it waits rather than as half-built. */}
      {!ready && (
        <div
          aria-hidden="true"
          style={{ height: 220, borderRadius: 18, background: "rgba(0,0,0,0.03)" }}
        />
      )}
      {ready && (
        <>

      {blockedBy && (
        <OneTableGate
          live={blockedBy}
          all={liveSessionsOf(tables)}
          gameName={byKey[blockedBy.game_key] ? gameName(byKey[blockedBy.game_key], lang) : blockedBy.game_key}
          onCleared={async () => {
            setBlockedBy(null);
            setSessions(await fetchMySessions(profile.id).catch(() => []));
          }}
          onDismiss={() => setBlockedBy(null)}
        />
      )}

      {/* YOUR TABLES. Quiet.

          This was a tall bordered card reading "YOUR GAME / It's
          your move — tap to roll and move a piece" over a filled
          "Your move" pill. That is the same nag that was taken off
          Home, wearing the same clothes, and the objection has not
          changed: a game is entered deliberately. A screen that
          tells you it is your move is a screen asking you to play
          rather than waiting for you to want to.

          What §9 asks for stays — live tables first, with the faces
          of whoever is at them — because a table you are already at
          is a fact about your evening. It is a row now, not a
          summons: the game, who is there, and nothing telling you
          what to do about it. */}
      {live.length > 0 && (
        <>
          <SectionLabel>{t("games.home.activeTitle")}</SectionLabel>
          {live.map(renderTable)}
        </>
      )}

      {/* ── ONE way to start. A stack of per-game cards asked the
             person to compare three things before they'd decided they
             wanted a game at all; now it's one button, and the choice
             of game comes after. ── */}
      {/* §9: the games, always on the screen and never behind a
          button. This was a `pickerOpen` ternary that started
          false, so the screen a person met had no games on it —
          only controls for reaching them. It is also why §8's
          tap-to-open-a-table had nothing to tap. */}
          <SectionLabel>{t("games.home.pickTitle")}</SectionLabel>
          {turnGames.map((g) => (
            <button
              key={g.key}
              type="button"
              disabled={!g.enabled}
              onClick={() => openTable(g.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
                minHeight: 104,
                padding: "16px 18px",
                marginBottom: 10,
                background: C.white,
                border: `2px solid ${C.warmGray}`,
                borderRadius: 18,
                fontFamily: "inherit",
                textAlign: "start",
                cursor: g.enabled ? "pointer" : "default",
                opacity: g.enabled ? 1 : 0.5,
              }}
            >
              {/* §9: A GAME IS AN OBJECT, NOT A LIST ROW. The board
                  is big enough to recognise across a room, the name
                  is the only text, and the whole tile is the tap.

                  The tagline goes. "Flick, pocket, and cover the
                  Queen. A calm table for two" is a good sentence and
                  it was three lines of prose in front of a game the
                  board already announces — §9 allows one line of
                  text on this screen and spends it on the heading.
                  A game that is not open yet still says so, because
                  that is not description, it is the state of the
                  thing being tapped. */}
              <BoardThumb gameKey={g.key} size={72} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: ts(24), fontWeight: 800, color: C.textMain }}>
                  {gameName(g, lang)}
                </span>
                {!g.enabled && (
                  <span style={{ display: "block", fontSize: ts(16), color: C.textMuted }}>
                    {t("games.home.comingSoon")}
                  </span>
                )}
              </span>
              <span aria-hidden="true" style={{ fontSize: ts(22), color: C.green, fontWeight: 700 }}>
                ›
              </span>
            </button>
          ))}

      {/* ── Past games: folded away. Finished tables must never
             stack up the screen; three at a time, behind a link. ── */}
      {/* §9: the riddle and the join-by-code box, AFTER the games.
          They were between the tables and the games, which is two
          pieces of furniture in front of the thing the screen is
          for. Both are answers to "something else", and something
          else comes after. */}
      {/* ── Daily Riddle. Bright and inviting while it waits; once
             today's is solved the card goes QUIET — done is done, and
             a solved thing should stop competing for attention. It
             stays tappable to look back at, and wakes up bright again
             at the new day. ── */}
      <Link
        to="/app/games/puzzle"
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        <Card
          style={
            solvedToday
              ? { background: "#f2efe9", borderColor: C.warmGray }
              : { background: C.creamDark ?? C.bg, borderColor: C.olive, borderWidth: 2 }
          }
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span aria-hidden="true" style={{ fontSize: 34, opacity: solvedToday ? 0.45 : 1 }}>
              🧩
            </span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <p
                style={{
                  fontSize: ts(21),
                  fontWeight: 700,
                  margin: "0 0 4px",
                  color: solvedToday ? C.textMuted : C.textMain,
                }}
              >
                {t("games.puzzle.title")}
              </p>
              {solvedToday ? (
                <BodyText muted style={{ margin: 0 }}>
                  {t("games.home.puzzleDone")}
                  {streak > 1 && <> · {t("games.home.puzzleStreak", { n: streak })}</>}
                </BodyText>
              ) : (
                <BodyText style={{ margin: 0, fontWeight: 600 }}>
                  {t("games.home.puzzleCta")}
                </BodyText>
              )}
            </div>
            {!solvedToday && (
              <span
                style={{
                  background: C.green,
                  color: C.cream,
                  borderRadius: 50,
                  padding: "10px 20px",
                  fontSize: ts(A11Y.minBodyPx),
                  fontWeight: 700,
                }}
              >
                {t("games.home.openCta")}
              </span>
            )}
          </div>
        </Card>
      </Link>

      {/* Join by code — prominent, large digits, LTR-pinned so the
          six digits read the same under Urdu. */}
      <Card>
        {!codeOpen ? (
          <GhostBtn onClick={() => setCodeOpen(true)} aria-expanded={false}>
            🔢 {t("games.code.cta")}
          </GhostBtn>
        ) : (
          <form onSubmit={submitCode}>
            <p style={{ fontSize: ts(20), fontWeight: 700, margin: "0 0 4px" }}>
              {t("games.code.title")}
            </p>
            <BodyText muted>{t("games.code.hint")}</BodyText>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
              aria-label={t("games.code.title")}
              dir="ltr"
              style={{
                fontSize: ts(30),
                letterSpacing: "0.35em",
                textAlign: "center",
                fontWeight: 800,
                marginBottom: 12,
              }}
            />
            {codeMsg && (
              <BodyText role="status" style={{ color: C.brown, fontWeight: 600 }}>
                {codeMsg}
              </BodyText>
            )}
            <PrimaryBtn
              type="submit"
              onClick={submitCode}
              disabled={busy || code.replace(/\D/g, "").length < 6}
            >
              {t("games.code.go")}
            </PrimaryBtn>
          </form>
        )}
      </Card>

      {past.length > 0 && (
        <>
          <SectionLabel>{t("games.home.pastTitle")}</SectionLabel>
          {!pastOpen ? (
            <GhostBtn onClick={() => setPastOpen(true)} aria-expanded={false}>
              {t("games.home.pastSee", { n: past.length })}
            </GhostBtn>
          ) : (
            <>
              {recent.map(renderTable)}
              {/* Was a dead end: a line saying "and 112 more" with
                  nowhere to go. D2 gives it a destination. */}
              {past.length > recent.length && (
                <GhostBtn onClick={() => navigate("/app/games/history")} style={{ width: "100%" }}>
                  {t("games.home.pastMore", { n: past.length - recent.length })}
                </GhostBtn>
              )}
              <GhostBtn onClick={() => setPastOpen(false)} aria-expanded>
                {t("games.home.pastHide")}
              </GhostBtn>
            </>
          )}
        </>
      )}
        </>
      )}
    </GamesScreen>
  );
}
