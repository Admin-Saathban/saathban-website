/* ════════════════════════════════════════════════
   A course or programme — /app/skills/course/:id (and /app/skills/course,
   which is the Saathban course). PRODUCT_DECISIONS §16.

   Modules → a check question after each (optional) → an exam
   (optional) → the badge the admin attached to this course.

   THE CONTENT AND THE CREDENTIAL ARE THE DATABASE'S. The course arrives
   from course_for_me() (0161) in both languages and WITHOUT its correct
   answers; each module answer and the exam are checked by the server,
   which also decides completion and awards the badge. This screen never
   writes progress itself.

   "You may skip straight to the exam — but skipping earns nothing."
   Both halves stay true: the exam is reachable from the first screen,
   and completion (and so the badge) waits until every module is done.

   Completing it here is the same completion Pending and Past read, so
   whichever door the person came through, the course leaves Pending and
   New and appears in Past.

   The badge is purely a credential (§16). Nothing in the copy implies it
   unlocks anything.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import { fetchCourse, answerModule, submitExam, pick, word } from "./growData.js";

export default function CoursePage() {
  const { id } = useParams();
  const ref = id || "saathban-course";
  const { t, ts, meta, lang } = useI18n();
  const navigate = useNavigate();

  const [course, setCourse] = useState(undefined); // undefined = loading, null = not open to them
  const [view, setView] = useState("map"); // map | module | exam | result
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [examAnswers, setExamAnswers] = useState({});
  const [result, setResult] = useState(null); // { kind, badge }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const c = await fetchCourse(ref);
      setCourse(c || null);
      return c || null;
    } catch {
      setCourse(null);
      return null;
    }
  }, [ref]);

  useEffect(() => {
    setCourse(undefined);
    setView("map");
    load();
  }, [load]);

  const done = course?.progress?.modules_done || [];
  const completed = !!course?.progress?.completed_at;
  const modules = course?.modules || [];
  const exam = course?.exam || [];
  const badgeName = course?.badge ? pick(course.badge, "name", lang) : "";

  const finishModule = async () => {
    const m = modules[idx];
    setBusy(true);
    let ok = false;
    try {
      ok = await answerModule(course.id, m.key, m.question ? picked : null);
    } catch {
      setBusy(false);
      pushToast(t("grow.course.saveFailed"), { tone: "error", key: "course" });
      return;
    }
    setBusy(false);
    if (!ok) {
      pushToast(t("grow.course.tryAgain"), { tone: "info", key: "course" });
      return;
    }
    setPicked(null);
    const wasComplete = completed;
    const fresh = await load();
    if (!wasComplete && fresh?.progress?.completed_at) {
      setResult({ kind: "completed", badge: fresh.badge });
      setView("result");
      return;
    }
    setView("map");
  };

  const sendExam = async () => {
    setBusy(true);
    let out;
    try {
      out = await submitExam(course.id, examAnswers);
    } catch {
      setBusy(false);
      pushToast(t("grow.course.saveFailed"), { tone: "error", key: "course" });
      return;
    }
    setBusy(false);
    const wasComplete = completed;
    await load();
    if (!out?.passed) setResult({ kind: "failed" });
    else if (out.completed && !wasComplete) setResult({ kind: "completed", badge: out.badge });
    else if (out.completed) setResult({ kind: "again" });
    else setResult({ kind: "passed_but_skipped" });
    setView("result");
  };

  const btn = (primary) => ({
    minHeight: A11Y.minTapTargetPx,
    padding: "0 20px",
    borderRadius: 50,
    border: primary ? "none" : `2px solid ${C.warmGray}`,
    background: primary ? C.green : C.white,
    color: primary ? C.white : C.textMain,
    fontFamily: "inherit",
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: primary ? 700 : 600,
    cursor: "pointer",
  });

  const option = (chosen) => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    padding: "0 18px",
    marginBottom: 10,
    width: "100%",
    borderRadius: 16,
    border: chosen ? `2.5px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
    background: chosen ? "#EEF3E8" : C.white,
    color: C.textMain,
    fontFamily: "inherit",
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: chosen ? 700 : 500,
    textAlign: "start",
    cursor: "pointer",
  });

  const lh = meta.dir === "rtl" ? meta.lineHeight : 1.25;

  if (course === undefined) {
    return <main aria-busy="true" style={{ minHeight: "100vh", background: C.bg }} />;
  }

  if (course === null) {
    return (
      <main style={{ minHeight: "100vh", background: C.bg, fontFamily: meta.fonts.body, padding: "20px 16px 60px" }}>
        <section data-stage="not-open" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(26), fontWeight: 800, color: C.green, lineHeight: lh, margin: "0 0 12px" }}>
            {t("grow.course.notOpenTitle")}
          </h1>
          <p style={{ fontSize: ts(20), color: C.textMain, lineHeight: 1.6, margin: "0 0 20px" }}>{t("grow.course.notOpenBody")}</p>
          <button type="button" style={btn(true)} onClick={() => navigate("/app/skills")}>
            {t("grow.survey.back")}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: C.bg, fontFamily: meta.fonts.body, padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }} data-course-page={course.id} data-course-slug={course.slug || ""}>
        <p style={{ fontSize: ts(15), fontWeight: 700, color: C.textMuted, margin: "0 0 2px" }}>
          {t(`grow.page.kind.${course.kind}`)}
        </p>
        <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(26), fontWeight: 800, color: C.brown, lineHeight: lh, margin: "0 0 6px" }}>
          {pick(course, "title", lang)}
        </h1>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.6, margin: "0 0 20px" }}>
          {pick(course, "desc", lang)}
        </p>

        {view === "map" && (
          <section data-stage="map">
            {completed && (
              <p data-badge="held" style={{ fontSize: ts(20), fontWeight: 700, color: C.green, margin: "0 0 16px" }}>
                {course.badge ? (
                  <>
                    <span aria-hidden="true">{course.badge.emoji} </span>
                    {t("grow.course.heldBadge", { badge: badgeName })}
                  </>
                ) : (
                  <>✓ {t("grow.course.heldPlain")}</>
                )}
              </p>
            )}
            {!completed && course.badge && (
              <p style={{ fontSize: ts(16), color: C.textMuted, margin: "0 0 14px" }}>
                <span aria-hidden="true">{course.badge.emoji} </span>
                {t("grow.page.earns", { badge: badgeName })}
              </p>
            )}
            {modules.map((m, i) => {
              const finished = done.includes(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  data-module={m.key}
                  data-done={finished ? "yes" : "no"}
                  onClick={() => {
                    setIdx(i);
                    setPicked(null);
                    setView("module");
                  }}
                  style={option(false)}
                >
                  <span aria-hidden="true" style={{ color: C.green, width: 20 }}>{finished ? "✓" : "○"}</span>
                  <span style={{ flex: 1 }}>{pick(m, "title", lang)}</span>
                  {finished && <span style={{ fontSize: ts(15), color: C.textMuted }}>{t("grow.course.moduleDone")}</span>}
                </button>
              );
            })}

            {exam.length > 0 && (
              <>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  <button type="button" style={btn(true)} data-action="exam" onClick={() => setView("exam")}>
                    {t("grow.course.toExam")}
                  </button>
                </div>
                {modules.length > 0 && (
                  <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.6, margin: "12px 0 0" }}>
                    {t("grow.course.skipNote")}
                  </p>
                )}
              </>
            )}
            <div style={{ marginTop: 18 }}>
              <button type="button" style={btn(false)} onClick={() => navigate("/app/skills/courses")}>
                {t("grow.course.leave")}
              </button>
            </div>
          </section>
        )}

        {view === "module" && modules[idx] && (
          <section data-stage="module">
            <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(22), color: C.green, margin: "0 0 10px" }}>
              {pick(modules[idx], "title", lang)}
            </h2>
            <p style={{ fontSize: ts(20), lineHeight: 1.6, color: C.textMain, margin: "0 0 18px", whiteSpace: "pre-line" }}>
              {pick(modules[idx], "body", lang)}
            </p>
            {modules[idx].question ? (
              <>
                <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, margin: "0 0 10px" }}>
                  {word(modules[idx].question, lang)}
                </p>
                {(modules[idx].question.options || []).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPicked(opt.key)}
                    aria-pressed={picked === opt.key}
                    style={option(picked === opt.key)}
                  >
                    <span aria-hidden="true" style={{ color: C.green, width: 18 }}>{picked === opt.key ? "✓" : ""}</span>
                    {word(opt, lang)}
                  </button>
                ))}
              </>
            ) : null}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <button
                type="button"
                style={btn(true)}
                data-action="check"
                disabled={busy || (modules[idx].question && !picked)}
                onClick={finishModule}
              >
                {busy ? "…" : modules[idx].question ? t("grow.course.check") : t("grow.course.markRead")}
              </button>
              <button type="button" style={btn(false)} onClick={() => setView("map")}>
                {t("grow.course.back")}
              </button>
            </div>
          </section>
        )}

        {view === "exam" && (
          <section data-stage="exam">
            <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(22), color: C.green, margin: "0 0 14px" }}>
              {t("grow.course.examTitle")}
            </h2>
            {exam.map((q) => (
              <div key={q.key} style={{ marginBottom: 18 }}>
                <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, margin: "0 0 10px" }}>{word(q, lang)}</p>
                {(q.options || []).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setExamAnswers((cur) => ({ ...cur, [q.key]: opt.key }))}
                    aria-pressed={examAnswers[q.key] === opt.key}
                    style={option(examAnswers[q.key] === opt.key)}
                  >
                    <span aria-hidden="true" style={{ color: C.green, width: 18 }}>
                      {examAnswers[q.key] === opt.key ? "✓" : ""}
                    </span>
                    {word(opt, lang)}
                  </button>
                ))}
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" style={btn(true)} data-action="submit-exam" disabled={busy} onClick={sendExam}>
                {busy ? "…" : t("grow.course.submitExam")}
              </button>
              <button type="button" style={btn(false)} onClick={() => setView("map")}>
                {t("grow.course.back")}
              </button>
            </div>
          </section>
        )}

        {view === "result" && result && (
          <section data-stage="result" data-result={result.kind}>
            <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(24), color: C.green, margin: "0 0 12px" }}>
              {t(`grow.course.result.${result.kind}Title`)}
            </h2>
            <p style={{ fontSize: ts(20), lineHeight: 1.6, color: C.textMain, margin: "0 0 20px" }}>
              {result.kind === "completed"
                ? result.badge
                  ? t("grow.course.result.completedBody", { badge: pick(result.badge, "name", lang) })
                  : t("grow.course.result.completedPlainBody")
                : t(`grow.course.result.${result.kind}Body`)}
            </p>
            {result.kind === "completed" && result.badge && (
              <p aria-hidden="true" style={{ fontSize: 48, margin: "0 0 16px" }}>{result.badge.emoji}</p>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" style={btn(true)} onClick={() => setView("map")}>
                {t("grow.course.back")}
              </button>
              <button type="button" style={btn(false)} onClick={() => navigate("/app/skills/courses")}>
                {t("grow.course.leave")}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
