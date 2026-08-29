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
  puzzleToday,
} from "../../lib/games.js";
import { GamesScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn } from "./ui.jsx";

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

  const live = tables.filter((s) => s.status !== "finished");
  const recent = tables.filter((s) => s.status === "finished").slice(0, 3);
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
              {g ? gameName(g, lang) : s.game_key}
            </p>
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

      {/* Daily Riddle door */}
      <Card style={{ background: C.creamDark ?? C.bg, borderColor: C.olive }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span aria-hidden="true" style={{ fontSize: 34 }}>
            🧩
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: ts(21), fontWeight: 700, margin: "0 0 4px" }}>
              {t("games.puzzle.title")}
            </p>
            <BodyText muted style={{ margin: 0 }}>
              {solvedToday ? t("games.home.puzzleSolved") : t("games.home.puzzleCta")}
              {solvedCount > 0 && <> — {t("games.puzzle.daysSolved", { n: solvedCount })}</>}
            </BodyText>
          </div>
          <PrimaryBtn onClick={() => navigate("/app/games/puzzle")}>
            {t("games.home.openCta")}
          </PrimaryBtn>
        </div>
      </Card>

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

      {/* My tables — live ones only; finished games sit below the
          registry as a short "recent" list, so "Open a table" is
          never buried under old boards. Every card says its next
          step in one sentence. */}
      <SectionLabel>{t("games.home.myTables")}</SectionLabel>
      {live.length === 0 && <BodyText muted>{t("games.home.empty")}</BodyText>}
      {live.map(renderTable)}

      {/* Registry */}
      <SectionLabel>{t("games.create.title")}</SectionLabel>
      {turnGames.map((g) => (
        <Card key={g.key}>
          <p style={{ fontSize: ts(21), fontWeight: 700, margin: "0 0 4px" }}>
            {gameName(g, lang)}
          </p>
          <BodyText muted>{gameTagline(g, lang)}</BodyText>
          {!g.enabled ? (
            <BodyText muted style={{ fontWeight: 600, margin: 0 }}>
              {t("games.home.comingSoon")}
            </BodyText>
          ) : (
            /* One tap → the compact setup screen (seats, who, Start). */
            <GhostBtn onClick={() => navigate(`/app/games/new/${g.key}`)}>
              {t("games.home.playCta")}
            </GhostBtn>
          )}
        </Card>
      ))}

      {recent.length > 0 && (
        <>
          <SectionLabel>{t("games.home.recentTitle")}</SectionLabel>
          {recent.map(renderTable)}
        </>
      )}
    </GamesScreen>
  );
}
