/* Games home: my tables (your-turn first), the Daily Riddle door,
   and the registry of games with a create-a-table flow. */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import {
  fetchGames,
  fetchMySessions,
  fetchMyAttempts,
  createSession,
  puzzleToday,
} from "../../lib/games.js";
import { GamesScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn, Toast } from "./ui.jsx";

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
  const [solvedToday, setSolvedToday] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(null); // game key with the seats picker open
  const [seats, setSeats] = useState(2);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

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

  const startTable = async (game) => {
    setBusy(true);
    try {
      const id = await createSession(game.key, seats);
      navigate(`/app/games/s/${id}`);
    } catch {
      setToast(t("games.actionError"));
      setBusy(false);
    }
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

      {/* My tables */}
      <SectionLabel>{t("games.home.myTables")}</SectionLabel>
      {tables.length === 0 && <BodyText muted>{t("games.home.empty")}</BodyText>}
      {tables.map((s) => {
        const g = byKey[s.game_key];
        const myTurn = s.status === "active" && s.current_seat === s.my_seat;
        return (
          <Link
            key={s.id}
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
                  {t(`games.home.status${s.status[0].toUpperCase()}${s.status.slice(1)}`)}
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
      })}

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
          ) : creating === g.key ? (
            <div>
              <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 600, margin: "0 0 8px" }}>
                {t("games.create.seatsLabel")}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                {Array.from(
                  { length: g.max_seats - g.min_seats + 1 },
                  (_, i) => g.min_seats + i
                ).map((n) => (
                  <GhostBtn
                    key={n}
                    aria-pressed={seats === n}
                    onClick={() => setSeats(n)}
                    style={
                      seats === n
                        ? { borderColor: C.green, background: C.green, color: C.cream }
                        : undefined
                    }
                  >
                    {n}
                  </GhostBtn>
                ))}
              </div>
              <BodyText muted>{t("games.create.seatsHint")}</BodyText>
              <PrimaryBtn disabled={busy} onClick={() => startTable(g)}>
                {t("games.create.cta")}
              </PrimaryBtn>
            </div>
          ) : (
            <GhostBtn
              onClick={() => {
                setCreating(g.key);
                setSeats(g.min_seats);
              }}
            >
              {t("games.home.playCta")}
            </GhostBtn>
          )}
        </Card>
      ))}

      <Toast text={toast} />
    </GamesScreen>
  );
}
