/* Daily Riddle — one shared bilingual riddle per day, the same for
   everyone. No clock, no losing: guesses are unlimited, history shows
   only what was solved (streak-forgiving by construction), and the
   answer table is unreachable by clients — guessing goes through the
   server RPC. */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  boastToPeopleWorded,
  hasBoasted,
} from "../../lib/games.js";
import { startShareDraft } from "../community/shareDraft.js";
import { fetchShareAudience, namesLine } from "../../lib/shareAudience.js";
import { GamesScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn } from "./ui.jsx";

export default function PuzzlePage() {
  const { t, ts, lang } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();

  const [puzzle, setPuzzle] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState(null); // {correct, guesses, solved}
  /* How many hints are showing: one more each time the person asks, never
     on its own. Remembered for the day on this device, so coming back to
     the riddle does not take away help already given. */
  const [hintsShown, setHintsShown] = useState(0);
  const [lockH, setLockH] = useState(0);
  /* 0 while the height is being HELD: the transition must only run on
     release. With it always on, setting the hold eased the height up from
     nothing and the swap landed before it got there — measured as a
     685→262px snap in one frame. */
  const [settleMs, setSettleMs] = useState(0);
  const answerRef = useRef(null);
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const [tell, setTell] = useState(null);
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
  /* ── HINTS ARE A LADDER (0121) ──
     Each step nudges further and the last is close enough that almost
     anyone gets there, without the answer ever being written. A riddle
     authored before the ladder still has its one hint. Hints never reach
     the server and are not counted anywhere, and the screen says so
     before the first one is taken. */
  const hints = (() => {
    if (!puzzle) return [];
    const ladder = lang === "ur" ? puzzle.hints_ur : puzzle.hints_en;
    if (Array.isArray(ladder) && ladder.filter(Boolean).length) return ladder.filter(Boolean);
    const one = lang === "ur" ? puzzle.hint_ur : puzzle.hint_en;
    return one ? [one] : [];
  })();
  const hintKey = "saathban.riddle.hints." + today;
  useEffect(() => {
    try {
      const n = Number(localStorage.getItem(hintKey));
      if (n > 0) setHintsShown(n);
    } catch { /* nothing remembered is the same as no hints yet */ }
  }, [hintKey]);
  const revealHint = () => {
    setHintsShown((n) => {
      const next = Math.min(n + 1, Math.max(hints.length, 1));
      try { localStorage.setItem(hintKey, String(next)); } catch { /* still shows */ }
      return next;
    });
  };

  const calm = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /* Tapping a button takes focus from the field, and on a phone that
     closes the keyboard and resizes the page under the person's thumb.
     Try it and the hint button leave the field focused, so a wrong guess
     or a hint changes nothing but the words. */
  const keepFocus = (ev) => ev.preventDefault();

  /* A keyboard that IS closing takes a moment to finish resizing the
     viewport. Wait for it (briefly, and not at all if nothing resizes)
     so that its resize and the answer's are never the same frames. */
  const keyboardSettled = () =>
    new Promise((resolve) => {
      const vv = window.visualViewport;
      let timer = setTimeout(done, 180);
      function onResize() {
        clearTimeout(timer);
        timer = setTimeout(done, 120);
      }
      function done() {
        vv?.removeEventListener?.("resize", onResize);
        resolve();
      }
      vv?.addEventListener?.("resize", onResize);
    });

  const submit = async (ev) => {
    ev?.preventDefault?.();
    if (!guess.trim() || busy) return;
    setBusy(true);
    let r;
    try {
      r = await guessPuzzle(today, guess.trim());
    } catch {
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
      setBusy(false);
      return;
    }
    if (r.correct) {
      /* ── A RIGHT ANSWER SETTLES IN PLACE ──
         The form (field, buttons, hints) became one line in a single
         frame, and on a phone the keyboard closed in that same frame:
         two resizes stacked, which is the flicker. So: hold the area's
         height, let the keyboard go and finish, put the answer in, then
         let the held height ease away. */
      const held = answerRef.current ? answerRef.current.offsetHeight : 0;
      const typing = document.activeElement === inputRef.current;
      setLockH(held);
      /* Measured: with three hints open the area gives back 400+px, and a
         fixed 320ms moved 69px in a single frame at the fastest point. The
         ease is as long as the distance needs, so no frame moves much. */
      const ms = calm ? 0 : Math.round(Math.min(900, Math.max(300, held * 1.6)));
      setSettleMs(0);
      if (typing) {
        inputRef.current.blur();
        await keyboardSettled();
      }
      setResult(r);
      setGuess("");
      setBusy(false);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setSettleMs(ms);
          setLockH(0);
        })
      );
      /* the named strip unlocks on solve — after the card has settled,
         so its arrival is a separate, single change */
      setTimeout(loadTogether, ms + 40);
      return;
    }
    setResult(r);
    setGuess("");
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

  /* ── TELLING YOUR PEOPLE SHOWS WHO, AND THE WORDS, FIRST ──
     This sent a notification on the tap, in English words the server
     wrote, and said "Told". Now it opens in place: the names it goes to,
     the words they will read (editable, in the language being used),
     Send, and then who it went to. (0120) */
  const openTell = async () => {
    const first = (profile?.full_name || "").split(" ")[0];
    setTell({
      names: null,
      title: first ? t("share.riddleTitle", { name: first }) : t("share.riddleTitleAnon"),
      body: t("share.riddleBody"),
      status: "editing",
      sent: 0,
    });
    try {
      const [names, already] = await Promise.all([fetchShareAudience("connections"), hasBoasted("riddle", today)]);
      setTell((cur) => cur && { ...cur, names, status: already ? "already" : cur.status });
    } catch {
      setTell((cur) => cur && { ...cur, names: [] });
    }
  };

  const sendTell = async () => {
    if (!tell || !tell.title.trim() || !tell.names || tell.names.length === 0) return;
    setTell((cur) => ({ ...cur, status: "sending" }));
    try {
      const n = await boastToPeopleWorded("riddle", today, {}, tell.title, tell.body);
      setTell((cur) => ({ ...cur, status: "sent", sent: Number(n) || 0 }));
    } catch {
      setTell((cur) => ({ ...cur, status: "editing" }));
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
    }
  };

  /* ── SHARING THE RESULT GOES THROUGH THE COMPOSER ──
     It posted on the tap and said "Shared". Now it opens the community
     composer with the result card on it; the person presses Share there
     and lands on the post. */
  const share = () => {
    startShareDraft(navigate, {
      type: "puzzle_result",
      payload: { puzzle_date: today, guesses: guessCount },
      body: t("share.puzzleBody"),
    });
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

          <div ref={answerRef} style={{ minHeight: lockH + "px", transition: calm || !settleMs ? "none" : "min-height " + settleMs + "ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
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
              {/* Always present, so "not that one" writes into space that
                  is already there instead of pushing the field down. */}
              <BodyText role="status" style={{ fontWeight: 600, color: C.brown, minHeight: lang === "ur" ? "2.2em" : "1.55em" }}>
                {result && !result.correct ? t("games.puzzle.wrong") : ""}
              </BodyText>
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
                  ref={inputRef}
                  id="sb-riddle-guess"
                  type="text"
                  value={guess}
                  placeholder={t("games.puzzle.guessPlaceholder")}
                  onChange={(e) => setGuess(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <PrimaryBtn disabled={busy || !guess.trim()} onPointerDown={keepFocus} onMouseDown={keepFocus} onClick={submit}>
                    {t("games.puzzle.guessCta")}
                  </PrimaryBtn>
                  {hintsShown < hints.length && (
                    <GhostBtn onPointerDown={keepFocus} onMouseDown={keepFocus} onClick={revealHint}>
                      {hintsShown === 0 ? t("games.puzzle.hintCta") : t("games.puzzle.hintMore")}
                    </GhostBtn>
                  )}
                </div>
              </form>
              {hints.length > 0 && hintsShown === 0 && (
                <BodyText muted style={{ marginTop: 10, fontSize: ts(16) }}>
                  {hints.length === 1 ? t("games.puzzle.hintFreeOne") : t("games.puzzle.hintFree", { n: hints.length })}
                </BodyText>
              )}
              {hintsShown > 0 && (
                <ol style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
                  {hints.slice(0, hintsShown).map((h, i) => (
                    <li
                      key={i}
                      aria-live={i === hintsShown - 1 ? "polite" : undefined}
                      style={{ padding: "10px 14px", borderRadius: 14, background: C.ground, border: "1px solid " + C.warmGray, marginBottom: 8 }}
                    >
                      <span style={{ display: "block", fontSize: ts(15), fontWeight: 700, color: C.textMuted }}>
                        💡 {t("games.puzzle.hintLabel", { n: i + 1, total: hints.length })}
                      </span>
                      <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), lineHeight: 1.55, color: C.textMain, overflowWrap: "anywhere" }}>
                        {h}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {hints.length > 1 && hintsShown >= hints.length && (
                <BodyText muted style={{ fontSize: ts(16) }}>{t("games.puzzle.hintsAll")}</BodyText>
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
              <GhostBtn disabled={busy || !!tell} onClick={openTell}>
                📣 {t("games.puzzle.together.boastCta")}
              </GhostBtn>
            )}
          </div>
          </div>
          {tell && (
            <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "2px solid " + C.warmGray, background: C.white }}>
              <p style={{ margin: "0 0 8px", fontSize: ts(19), fontWeight: 700, color: C.textMain }}>{t("share.tellHeading")}</p>
              {tell.status === "already" ? (
                <>
                  <BodyText style={{ margin: "0 0 12px" }}>{t("share.alreadyTold")}</BodyText>
                  <GhostBtn onClick={() => setTell(null)}>{t("share.done")}</GhostBtn>
                </>
              ) : tell.status === "sent" ? (
                <div role="status">
                  <BodyText style={{ margin: "0 0 6px", fontWeight: 600 }}>{t("share.sentTo", { names: namesLine(tell.names, t) })}</BodyText>
                  <BodyText muted style={{ margin: "0 0 10px" }}>
                    {tell.sent === 0 ? t("share.sentNone") : tell.sent === 1 ? t("share.sentCountOne") : t("share.sentCount", { n: tell.sent })}
                  </BodyText>
                  <div style={{ padding: "10px 12px", borderRadius: 12, background: C.ground, border: "1px solid " + C.warmGray, marginBottom: 12 }}>
                    <p style={{ margin: 0, fontSize: ts(A11Y.minBodyPx), fontWeight: 700 }}>{tell.title}</p>
                    {tell.body && <p style={{ margin: "4px 0 0", fontSize: ts(16), color: C.textMuted }}>{tell.body}</p>}
                  </div>
                  <GhostBtn onClick={() => setTell(null)}>{t("share.done")}</GhostBtn>
                </div>
              ) : (
                <>
                  <BodyText muted style={{ margin: "0 0 10px" }}>
                    {tell.names === null
                      ? t("share.loadingNames")
                      : tell.names.length === 0
                        ? t("share.nobodyYet")
                        : t("share.goesTo", { names: namesLine(tell.names, t) })}
                  </BodyText>
                  <label style={{ display: "block", fontSize: ts(16), fontWeight: 600, marginBottom: 10 }}>
                    {t("share.titleLabel")}
                    <input value={tell.title} maxLength={140} onChange={(e) => setTell((cur) => ({ ...cur, title: e.target.value }))} style={{ marginTop: 6 }} />
                  </label>
                  <label style={{ display: "block", fontSize: ts(16), fontWeight: 600, marginBottom: 12 }}>
                    {t("share.bodyLabel")}
                    <textarea rows={2} value={tell.body} maxLength={500} onChange={(e) => setTell((cur) => ({ ...cur, body: e.target.value }))} style={{ marginTop: 6, width: "100%" }} />
                  </label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <PrimaryBtn disabled={tell.status === "sending" || !tell.title.trim() || !tell.names || tell.names.length === 0} onClick={sendTell}>
                      {tell.status === "sending" ? t("share.sending") : t("share.sendCta")}
                    </PrimaryBtn>
                    <GhostBtn onClick={() => setTell(null)}>{t("share.notNow")}</GhostBtn>
                  </div>
                </>
              )}
            </div>
          )}
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
