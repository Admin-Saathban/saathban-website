/* Games home: my tables (your-turn first), the Daily Riddle door,
   join-by-code, and the registry with a PEOPLE-FIRST create flow —
   the picker comes before any form (0029: family at one table, not
   adjacent features). */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useFresh } from "../../lib/feedback.jsx";
import { useSession } from "../../lib/session.jsx";
import {
  fetchGames,
  fetchMySessions,
  fetchMyAttempts,
  joinByCode,
  liveSessionOf,
  puzzleToday,
} from "../../lib/games.js";
import { GamesScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn } from "./ui.jsx";
import BoardThumb from "./BoardThumb.jsx";
import OneTableGate from "./OneTableGate.jsx";

function gameName(g, lang) {
  return lang === "ur" ? g.name_ur : g.name_en;
}
function gameTagline(g, lang) {
  return lang === "ur" ? g.tagline_ur : g.tagline_en;
}

export default function GamesHome() {
  const { t, ts, lang } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();

  const [games, setGames] = useState([]);
  const [sessions, setSessions] = useState([]);
  const fresh = useFresh();
  const [solvedToday, setSolvedToday] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState("");
  // The table standing in the way, when someone tries for a second.
  const [blockedBy, setBlockedBy] = useState(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [streak, setStreak] = useState(0);

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
    const myTurn = s.status === "active" && s.current_seat === s.my_seat;
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
            borderColor: myTurn ? C.green : C.warmGray,
            borderWidth: myTurn ? 2 : 1,
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
            <BodyText muted style={{ margin: 0 }}>
              {nextStep(s)}
            </BodyText>
          </div>
          {myTurn && (
            <span
              style={{
                background: C.green,
                color: C.cream,
                borderRadius: 50,
                padding: "8px 16px",
                fontSize: ts(16),
                fontWeight: 700,
                animation: "sb-games-pulse 2s infinite",
              }}
            >
              {t("games.home.yourTurnChip")}
            </span>
          )}
        </Card>
      </Link>
    );
  };

  return (
    <GamesScreen>
      <h1 style={{ fontSize: ts(30), margin: "0 0 6px", color: C.brown }}>{t("games.title")}</h1>
      <BodyText muted>{t("games.intro")}</BodyText>
      {loadError && <BodyText role="alert">{t("games.loadError")}</BodyText>}

      {blockedBy && (
        <OneTableGate
          live={blockedBy}
          gameName={byKey[blockedBy.game_key] ? gameName(byKey[blockedBy.game_key], lang) : blockedBy.game_key}
          onCleared={async () => {
            setBlockedBy(null);
            setSessions(await fetchMySessions(profile.id).catch(() => []));
          }}
          onDismiss={() => setBlockedBy(null)}
        />
      )}

      {/* ── ACTIVE GAME: the one table on the go, first and biggest.
             A board to recognise, whose turn it is in words, and one
             tap to walk back into it. ── */}
      {activeGame && (
        <>
          <SectionLabel>{t("games.home.activeTitle")}</SectionLabel>
          <Link
            {...fresh.props(activeGame.id)}
            to={`/app/games/s/${activeGame.id}`}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <Card
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                borderColor: C.green,
                borderWidth: 2.5,
                borderStyle: "solid",
              }}
            >
              <BoardThumb gameKey={activeGame.game_key} size={64} />
              {/* The chip sits UNDER the words, not beside them: at
                  390px a thumbnail and a chip either side squeezed
                  "Snakes & Ladders" into three broken lines. */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: ts(22), fontWeight: 800, margin: "0 0 4px" }}>
                  {activeGame.title ||
                    (byKey[activeGame.game_key]
                      ? gameName(byKey[activeGame.game_key], lang)
                      : activeGame.game_key)}
                </p>
                {activeGame.title && (
                  <BodyText muted style={{ margin: "0 0 2px" }}>
                    {byKey[activeGame.game_key]
                      ? gameName(byKey[activeGame.game_key], lang)
                      : activeGame.game_key}
                  </BodyText>
                )}
                <BodyText muted style={{ margin: "0 0 10px" }}>
                  {nextStep(activeGame)}
                </BodyText>
                <span
                  style={{
                    display: "inline-block",
                    background: C.green,
                    color: C.cream,
                    borderRadius: 50,
                    padding: "10px 20px",
                    fontSize: ts(A11Y.minBodyPx),
                    fontWeight: 700,
                  }}
                >
                  {activeGame.status === "active" && activeGame.current_seat === activeGame.my_seat
                    ? t("games.home.resumeYourTurn")
                    : t("games.home.resumeCta")}
                </span>
              </div>
            </Card>
          </Link>
          {otherLive.map(renderTable)}
        </>
      )}

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

      {/* ── ONE way to start. A stack of per-game cards asked the
             person to compare three things before they'd decided they
             wanted a game at all; now it's one button, and the choice
             of game comes after. ── */}
      {!pickerOpen ? (
        <PrimaryBtn
          onClick={() => {
            const inTheWay = liveSessionOf(sessions);
            if (inTheWay) {
              setBlockedBy(inTheWay);
              window.scrollTo({ top: 0, behavior: "smooth" });
              return;
            }
            setPickerOpen(true);
          }}
          style={{ width: "100%", marginBottom: 16 }}
        >
          ✚ {t("games.home.startCta")}
        </PrimaryBtn>
      ) : (
        <>
          <SectionLabel>{t("games.home.pickTitle")}</SectionLabel>
          {turnGames.map((g) => (
            <button
              key={g.key}
              type="button"
              disabled={!g.enabled}
              onClick={() => navigate(`/app/games/new/${g.key}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
                minHeight: 76,
                padding: "14px 18px",
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
              <BoardThumb gameKey={g.key} size={48} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: ts(20), fontWeight: 700, color: C.textMain }}>
                  {gameName(g, lang)}
                </span>
                <span style={{ display: "block", fontSize: ts(16), color: C.textMuted }}>
                  {g.enabled ? gameTagline(g, lang) : t("games.home.comingSoon")}
                </span>
              </span>
              <span aria-hidden="true" style={{ fontSize: ts(22), color: C.green, fontWeight: 700 }}>
                ›
              </span>
            </button>
          ))}
          <GhostBtn onClick={() => setPickerOpen(false)}>{t("outdoor.place.formCancel")}</GhostBtn>
        </>
      )}

      {/* ── Past games: folded away. Finished tables must never
             stack up the screen; three at a time, behind a link. ── */}
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
    </GamesScreen>
  );
}
