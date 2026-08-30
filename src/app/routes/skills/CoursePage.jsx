/* ════════════════════════════════════════════════
   The Saathban course — PRODUCT_DECISIONS §16.

   Modules → a quiz after each → a final exam → a credential badge.
   Ten to twenty minutes, and it RESUMES where you left off, because
   a course a person cannot put down is a course they do not start.

   "You may skip straight to the exam — but skipping earns nothing."
   Both halves are real here: the exam is genuinely reachable from the
   first screen, and the badge is refused by the server (0062) unless
   the modules are done. The screen never pretends the skip is barred;
   it tells the truth about what it earns.

   The badge is purely a credential (§16). Nothing in the app reads it
   as permission, and the copy never implies it unlocks anything.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import supabase from "../../lib/supabase.js";

/* Three modules, each with one question. Kept short on purpose: §16
   budgets the whole course at 10-20 minutes including the exam. */
export const MODULES = [
  { key: "what_saathban_is", quiz: ["company", "a_hospital", "a_shop"], answer: "company" },
  { key: "keeping_people_safe", quiz: ["never_money", "always_money", "sometimes"], answer: "never_money" },
  { key: "being_good_company", quiz: ["listen", "advise", "correct"], answer: "listen" },
];
const EXAM = [
  { key: "exam_money", options: ["refuse_and_report", "send_once", "ask_family"], answer: "refuse_and_report" },
  { key: "exam_quiet", options: ["check_in_warmly", "ignore", "tell_everyone"], answer: "check_in_warmly" },
];

export default function CoursePage() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();

  const [done, setDone] = useState([]);
  const [badgeAt, setBadgeAt] = useState(null);
  const [view, setView] = useState("map"); // map | module | exam | result
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [examAnswers, setExamAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase
      .from("course_progress")
      .select("modules_done, badge_at")
      .eq("profile_id", profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        setDone(data.modules_done || []);
        setBadgeAt(data.badge_at || null);
      });
    return () => { alive = false; };
  }, [profile.id]);

  const save = async (patch) => {
    await supabase.from("course_progress").upsert(
      { profile_id: profile.id, updated_at: new Date().toISOString(), ...patch },
      { onConflict: "profile_id" }
    );
  };

  const finishModule = async () => {
    const m = MODULES[idx];
    if (picked !== m.answer) {
      pushToast(t("grow.course.tryAgain"), { tone: "info", key: "course" });
      return;
    }
    const next = [...new Set([...done, m.key])];
    setDone(next);
    setPicked(null);
    await save({ modules_done: next });
    setView("map");
  };

  const submitExam = async () => {
    setBusy(true);
    const passed = EXAM.every((q) => examAnswers[q.key] === q.answer);
    if (!passed) {
      setBusy(false);
      setResult("failed");
      setView("result");
      return;
    }
    await save({ exam_passed_at: new Date().toISOString() });
    /* The server decides the credential, not this screen. */
    const { data: awarded } = await supabase.rpc("course_award", { p_modules: done });
    setBusy(false);
    setResult(awarded ? "badge" : "passed_but_skipped");
    if (awarded) setBadgeAt(new Date().toISOString());
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

  return (
    <main style={{ minHeight: "100vh", background: C.bg, fontFamily: meta.fonts.body, padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(26),
            fontWeight: 800,
            color: C.brown,
            lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.25,
            margin: "0 0 6px",
          }}
        >
          {t("grow.course.title")}
        </h1>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 20px" }}>
          {t("grow.course.intro")}
        </p>

        {view === "map" && (
          <section data-stage="map">
            {badgeAt && (
              <p data-badge="held" style={{ fontSize: ts(20), fontWeight: 700, color: C.green, margin: "0 0 16px" }}>
                🏅 {t("grow.course.held")}
              </p>
            )}
            {MODULES.map((m, i) => {
              const finished = done.includes(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  data-module={m.key}
                  onClick={() => { setIdx(i); setPicked(null); setView("module"); }}
                  style={option(false)}
                >
                  <span aria-hidden="true" style={{ color: C.green, width: 20 }}>{finished ? "✓" : "○"}</span>
                  <span style={{ flex: 1 }}>{t(`grow.course.module.${m.key}`)}</span>
                </button>
              );
            })}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <button type="button" style={btn(true)} data-action="exam" onClick={() => setView("exam")}>
                {t("grow.course.toExam")}
              </button>
            </div>
            {/* The skip is honest about what it earns — §16 says
                skipping is allowed, not that it is free. */}
            <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "12px 0 0" }}>
              {t("grow.course.skipNote")}
            </p>
          </section>
        )}

        {view === "module" && (
          <section data-stage="module">
            <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(22), color: C.green, margin: "0 0 10px" }}>
              {t(`grow.course.module.${MODULES[idx].key}`)}
            </h2>
            <p style={{ fontSize: ts(20), lineHeight: 1.6, color: C.textMain, margin: "0 0 18px" }}>
              {t(`grow.course.body.${MODULES[idx].key}`)}
            </p>
            <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, margin: "0 0 10px" }}>
              {t(`grow.course.q.${MODULES[idx].key}`)}
            </p>
            {MODULES[idx].quiz.map((opt) => (
              <button key={opt} type="button" onClick={() => setPicked(opt)} aria-pressed={picked === opt} style={option(picked === opt)}>
                <span aria-hidden="true" style={{ color: C.green, width: 18 }}>{picked === opt ? "✓" : ""}</span>
                {t(`grow.course.opt.${opt}`)}
              </button>
            ))}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <button type="button" style={btn(true)} disabled={!picked} onClick={finishModule}>
                {t("grow.course.check")}
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
            {EXAM.map((q) => (
              <div key={q.key} style={{ marginBottom: 18 }}>
                <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, margin: "0 0 10px" }}>
                  {t(`grow.course.q.${q.key}`)}
                </p>
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setExamAnswers((c) => ({ ...c, [q.key]: opt }))}
                    aria-pressed={examAnswers[q.key] === opt}
                    style={option(examAnswers[q.key] === opt)}
                  >
                    <span aria-hidden="true" style={{ color: C.green, width: 18 }}>
                      {examAnswers[q.key] === opt ? "✓" : ""}
                    </span>
                    {t(`grow.course.opt.${opt}`)}
                  </button>
                ))}
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" style={btn(true)} disabled={busy} onClick={submitExam}>
                {busy ? "…" : t("grow.course.submitExam")}
              </button>
              <button type="button" style={btn(false)} onClick={() => setView("map")}>
                {t("grow.course.back")}
              </button>
            </div>
          </section>
        )}

        {view === "result" && (
          <section data-stage="result" data-result={result}>
            <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(24), color: C.green, margin: "0 0 12px" }}>
              {t(`grow.course.result.${result}Title`)}
            </h2>
            <p style={{ fontSize: ts(20), lineHeight: 1.6, color: C.textMain, margin: "0 0 20px" }}>
              {t(`grow.course.result.${result}Body`)}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" style={btn(true)} onClick={() => setView("map")}>
                {t("grow.course.back")}
              </button>
              <button type="button" style={btn(false)} onClick={() => navigate("/app/skills")}>
                {t("grow.course.leave")}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
