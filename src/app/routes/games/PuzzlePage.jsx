/* Daily Riddle — one shared bilingual riddle per day, the same for
   everyone. No clock, no losing: guesses are unlimited, history shows
   only what was solved (streak-forgiving by construction), and the
   answer table is unreachable by clients — guessing goes through the
   server RPC. */

import { useEffect, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { fetchPuzzle, fetchMyAttempts, guessPuzzle, puzzleToday } from "../../lib/games.js";
import { createShare } from "../community/communityData.js";
import { GamesScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn, Toast } from "./ui.jsx";

export default function PuzzlePage() {
  const { t, ts, lang } = useI18n();
  const { profile } = useSession();

  const [puzzle, setPuzzle] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState(null); // {correct, guesses, solved}
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const [toast, setToast] = useState("");

  const today = puzzleToday();

  useEffect(() => {
    let alive = true;
    Promise.all([fetchPuzzle(), fetchMyAttempts(profile.id)])
      .then(([p, a]) => {
        if (!alive) return;
        setPuzzle(p);
        setAttempts(a);
        setLoadError(!p);
      })
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, [profile.id]);

  const todayAttempt = attempts.find((a) => a.puzzle_date === today);
  const solved = result?.solved || !!todayAttempt?.solved_at;
  const guessCount = result?.guesses ?? todayAttempt?.guesses ?? 0;
  const solvedCount =
    attempts.filter((a) => a.solved_at).length +
    (result?.correct && !todayAttempt?.solved_at ? 1 : 0);

  const riddle = puzzle ? (lang === "ur" ? puzzle.riddle_ur : puzzle.riddle_en) : "";
  const hint = puzzle ? (lang === "ur" ? puzzle.hint_ur : puzzle.hint_en) : "";

  const submit = async (e) => {
    e.preventDefault();
    if (!guess.trim() || busy) return;
    setBusy(true);
    try {
      const r = await guessPuzzle(today, guess.trim());
      setResult(r);
      setGuess("");
    } catch {
      setToast(t("games.actionError"));
    }
    setBusy(false);
  };

  const share = async () => {
    setBusy(true);
    try {
      await createShare(profile.id, "puzzle_result", null, {
        puzzle_date: today,
        guesses: guessCount,
      });
      setShared(true);
      setToast(t("games.puzzle.shared"));
    } catch {
      setToast(t("games.actionError"));
    }
    setBusy(false);
  };

  const canShare = (profile.role === "saath_icon" || profile.is_org) && solved && !shared;

  return (
    <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
      <h1 style={{ fontSize: ts(30), margin: "0 0 6px", color: C.brown }}>
        🧩 {t("games.puzzle.title")}
      </h1>
      <BodyText muted>{t("games.puzzle.intro")}</BodyText>
      {loadError && <BodyText role="alert">{t("games.loadError")}</BodyText>}

      {puzzle && (
        <Card>
          <p style={{ fontSize: ts(24), lineHeight: 1.6, fontWeight: 600, margin: "0 0 16px" }}>
            {riddle}
          </p>

          {solved ? (
            <BodyText style={{ fontWeight: 700, color: C.green }} aria-live="polite">
              ✓{" "}
              {result?.correct
                ? guessCount === 1
                  ? t("games.puzzle.correctOne")
                  : t("games.puzzle.correct", { n: guessCount })
                : t("games.puzzle.solved")}
            </BodyText>
          ) : (
            <>
              {result && !result.correct && (
                <BodyText role="status" style={{ fontWeight: 600, color: C.brown }}>
                  {t("games.puzzle.wrong")}
                </BodyText>
              )}
              <form onSubmit={submit}>
                <label
                  htmlFor="sb-riddle-guess"
                  style={{
                    display: "block",
                    fontSize: ts(A11Y.minBodyPx),
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  {t("games.puzzle.guessLabel")}
                </label>
                <input
                  id="sb-riddle-guess"
                  type="text"
                  value={guess}
                  placeholder={t("games.puzzle.guessPlaceholder")}
                  onChange={(e) => setGuess(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <PrimaryBtn disabled={busy || !guess.trim()} onClick={submit}>
                    {t("games.puzzle.guessCta")}
                  </PrimaryBtn>
                  {hint && !showHint && (
                    <GhostBtn onClick={() => setShowHint(true)}>
                      {t("games.puzzle.hintCta")}
                    </GhostBtn>
                  )}
                </div>
              </form>
              {showHint && (
                <BodyText muted style={{ marginTop: 12 }}>
                  💡 {hint}
                </BodyText>
              )}
            </>
          )}

          {canShare && (
            <PrimaryBtn disabled={busy} onClick={share} style={{ marginTop: 8 }}>
              {t("games.puzzle.shareCta")}
            </PrimaryBtn>
          )}
        </Card>
      )}

      {attempts.length > 0 && (
        <>
          <SectionLabel>{t("games.puzzle.historyTitle")}</SectionLabel>
          {solvedCount > 0 && (
            <BodyText muted>{t("games.puzzle.daysSolved", { n: solvedCount })}</BodyText>
          )}
          <Card>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {attempts.slice(0, 14).map((a) => (
                <li
                  key={a.puzzle_date}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    minHeight: A11Y.minTapTargetPx,
                    fontSize: ts(A11Y.minBodyPx),
                    borderBottom: `1px solid ${C.warmGray}`,
                  }}
                >
                  <span style={{ flex: 1 }}>{a.puzzle_date}</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: a.solved_at ? C.green : C.textMuted,
                    }}
                  >
                    {a.solved_at
                      ? `✓ ${t("games.puzzle.historySolvedIn", { n: a.guesses })}`
                      : t("games.puzzle.historyOpen")}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Toast text={toast} />
    </GamesScreen>
  );
}
