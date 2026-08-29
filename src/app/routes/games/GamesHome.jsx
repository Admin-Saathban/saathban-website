/* Games home: my tables (your-turn first), the Daily Riddle door,
   join-by-code, and the registry with a PEOPLE-FIRST create flow —
   the picker comes before any form (0029: family at one table, not
   adjacent features). */

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
  inviteToGame,
  joinByCode,
  puzzleToday,
} from "../../lib/games.js";
import PeoplePicker from "./PeoplePicker.jsx";
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
  const [creating, setCreating] = useState(null); // game key with the people picker open
  const [picked, setPicked] = useState([]); // chosen people, in tap order
  const [extraSeats, setExtraSeats] = useState(0); // bot/open seats past the people
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
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

  /* People first: seats = you + everyone you tapped + any extra
     seats you left for bots or the community. Invites go out the
     moment the table exists (server-idempotent — a retry can't
     double-invite anyone). */
  const startTable = async (game) => {
    if (busy) return;
    setBusy(true);
    try {
      const seats = Math.min(
        game.max_seats,
        Math.max(game.min_seats, picked.length + 1 + extraSeats)
      );
      const id = await createSession(game.key, seats);
      for (const p of picked.slice(0, seats - 1)) {
        try {
          await inviteToGame(id, p.id);
        } catch {
          /* one refused invite must not strand the table */
        }
      }
      navigate(`/app/games/s/${id}`);
    } catch {
      setToast(t("games.actionError"));
      setBusy(false);
    }
  };

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
          ? t("games.home.nextYourTurn")
          : t("games.home.nextTheirTurn");
  const renderTable = (s) => {
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
          ) : creating === g.key ? (
            <div>
              {/* PEOPLE FIRST — the picker before any form. */}
              <p style={{ fontSize: ts(20), fontWeight: 700, margin: "0 0 2px" }}>
                {t("games.picker.title")}
              </p>
              <BodyText muted>{t("games.picker.intro")}</BodyText>
              <PeoplePicker
                states={Object.fromEntries(picked.map((p) => [p.id, "picked"]))}
                maxPick={g.max_seats - 1}
                pickedCount={picked.length}
                onToggle={(p) =>
                  setPicked((cur) =>
                    cur.some((x) => x.id === p.id)
                      ? cur.filter((x) => x.id !== p.id)
                      : [...cur, p]
                  )
                }
              />
              {/* Then bots / open seats as the explicit fallback. */}
              {picked.length + 1 < g.max_seats && (
                <div style={{ marginTop: 12 }}>
                  <BodyText muted style={{ marginBottom: 6 }}>
                    {t("games.picker.botNote")}
                  </BodyText>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {Array.from(
                      { length: g.max_seats - Math.max(g.min_seats, picked.length + 1) + 1 },
                      (_, i) => i
                    ).map((n) => (
                      <GhostBtn
                        key={n}
                        aria-pressed={extraSeats === n}
                        onClick={() => setExtraSeats(n)}
                        style={
                          extraSeats === n
                            ? { borderColor: C.green, background: C.green, color: C.cream }
                            : undefined
                        }
                      >
                        +{n}
                      </GhostBtn>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <PrimaryBtn disabled={busy} onClick={() => startTable(g)}>
                  {picked.length === 0
                    ? t("games.picker.continueNone")
                    : picked.length === 1
                      ? t("games.picker.continueOne")
                      : t("games.picker.continueCta", { n: picked.length })}
                </PrimaryBtn>
                <GhostBtn
                  onClick={() => {
                    setCreating(null);
                    setPicked([]);
                    setExtraSeats(0);
                  }}
                >
                  {t("outdoor.place.formCancel")}
                </GhostBtn>
              </div>
            </div>
          ) : (
            <GhostBtn
              onClick={() => {
                setCreating(g.key);
                setPicked([]);
                setExtraSeats(0);
              }}
            >
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

      <Toast text={toast} />
    </GamesScreen>
  );
}
