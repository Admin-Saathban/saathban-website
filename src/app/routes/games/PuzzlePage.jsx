/* Daily Riddle — one shared bilingual riddle per day, the same for
   everyone. No clock, no losing: guesses are unlimited, history shows
   only what was solved (streak-forgiving by construction), and the
   answer table is unreachable by clients — guessing goes through the
   server RPC. */

import { useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import { useSession } from "../../lib/session.jsx";
import {
  fetchPuzzle,
  fetchMyAttempts,
  guessPuzzle,
  puzzleToday,
  riddlePeople,
  riddleTouch,
  boastToPeople,
} from "../../lib/games.js";
import { createShare } from "../community/communityData.js";
import { GamesScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn } from "./ui.jsx";

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
  const [together, setTogether] = useState(null); // riddle_people() view
  const [gated, setGated] = useState(false); // ineligible (e.g. pending buddy)

  const today = puzzleToday();

  const loadTogether = () => {
    riddlePeople(today)
      .then(setTogether)
      .catch(() => setTogether(null)); // strip is a bonus, never a blocker
  };

  useEffect(() => {
    let alive = true;
    Promise.all([fetchPuzzle(), fetchMyAttempts(profile.id)])
      .then(([p, a]) => {
        if (!alive) return;
        setPuzzle(p);
        setAttempts(a);
        /* No riddle rows under RLS usually means the community gate,
           not a missing riddle — explain gently, never a bare error
           (parity rule: ineligible states explain themselves). */
        if (!p && (profile.role === "saath_buddy" || profile.is_paused)) {
          setGated(true);
        } else {
          setLoadError(!p);
        }
      })
      .catch(() => alive && setLoadError(true));
    loadTogether();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (r.correct) loadTogether(); // the named strip unlocks on solve
    } catch {
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
    }
    setBusy(false);
  };

  const touch = async (person, kind) => {
    setBusy(true);
    try {
      const r = await riddleTouch(person.id, kind, kind === "cheer" ? "👏" : null, today);
      pushToast(
        r.sent
          ? t(kind === "cheer" ? "games.puzzle.together.cheerToast" : "games.puzzle.together.nudgeToast")
          : t("games.puzzle.together.capToast")
      );
      loadTogether();
    } catch {
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
    }
    setBusy(false);
  };

  const boastRiddle = async () => {
    setBusy(true);
    try {
      await boastToPeople("riddle", today);
      pushToast(t("games.puzzle.together.boastToast"));
    } catch {
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
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
      pushToast(t("games.puzzle.shared"));
    } catch {
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
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
      {gated && <BodyText style={{ fontWeight: 600 }}>{t("games.puzzle.gated")}</BodyText>}
      {loadError && !gated && <BodyText role="alert">{t("games.loadError")}</BodyText>}

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

          {solved && !canShare && !shared && !(profile.role === "saath_icon" || profile.is_org) && (
            <BodyText muted style={{ marginTop: 8, fontSize: ts(16) }}>
              {t("games.puzzle.shareIconOnly")}
            </BodyText>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            {canShare && (
              <PrimaryBtn disabled={busy} onClick={share}>
                {t("games.puzzle.shareCta")}
              </PrimaryBtn>
            )}
            {solved && (together?.people?.length ?? 0) > 0 && (
              <GhostBtn disabled={busy} onClick={boastRiddle}>
                📣 {t("games.puzzle.together.boastCta")}
              </GhostBtn>
            )}
          </div>
        </Card>
      )}

      {/* ── Your people today (0029) ──────────────────────────────
          Pre-solve: a count only — no names, no answer-fishing.
          Post-solve: the strip — solved/not-solved, NEVER answers or
          guess counts. Zero connections: warm own-framing, no lonely
          empty grid. */}
      {together && !together.solved && (
        <BodyText muted style={{ fontWeight: 600 }}>
          🧑‍🤝‍🧑{" "}
          {together.solved_count === 0
            ? t("games.puzzle.together.countNone")
            : together.solved_count === 1
              ? t("games.puzzle.together.countOne")
              : t("games.puzzle.together.countLine", { n: together.solved_count })}
        </BodyText>
      )}
      {together?.solved && (together.people?.length ?? 0) === 0 && (
        <BodyText muted style={{ fontWeight: 600 }}>
          🌱 {t("games.puzzle.together.aloneLine")}
        </BodyText>
      )}
      {together?.solved && (together.people?.length ?? 0) > 0 && (
        <>
          <SectionLabel>{t("games.puzzle.together.title")}</SectionLabel>
          <Card>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {together.people.map((p) => (
                <li
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: `1px solid ${C.warmGray}`,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: p.solved ? C.green : C.warmGray,
                      color: C.cream,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      fontWeight: 700,
                      flex: "0 0 auto",
                    }}
                  >
                    {(p.name || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <span style={{ flex: 1, minWidth: 120 }}>
                    <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700 }}>
                      {p.name}
                    </span>
                    <span
                      style={{
                        fontSize: ts(15),
                        fontWeight: 600,
                        color: p.solved ? C.green : C.textMuted,
                      }}
                    >
                      {p.solved
                        ? `✓ ${t("games.puzzle.together.solvedTag")}`
                        : t("games.puzzle.together.notYetTag")}
                    </span>
                  </span>
                  {p.solved ? (
                    p.cheered ? (
                      <span style={{ fontSize: ts(16), fontWeight: 700, color: C.green }}>
                        👏 ✓
                      </span>
                    ) : (
                      <GhostBtn disabled={busy} onClick={() => touch(p, "cheer")}>
                        👏 {t("games.puzzle.together.cheerCta")}
                      </GhostBtn>
                    )
                  ) : p.nudged ? (
                    <span style={{ fontSize: ts(16), fontWeight: 700, color: C.olive }}>
                      🕊️ ✓
                    </span>
                  ) : (
                    <GhostBtn disabled={busy} onClick={() => touch(p, "nudge")}>
                      🕊️ {t("games.puzzle.together.nudgeCta")}
                    </GhostBtn>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
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
    </GamesScreen>
  );
}
