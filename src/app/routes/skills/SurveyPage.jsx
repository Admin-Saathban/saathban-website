/* ════════════════════════════════════════════════
   A survey — /app/skills/survey/:id (and /app/skills/survey, which is
   "Help Saathban's research", PRODUCT_DECISIONS §16).

   Surveys are published from the admin panel; their wording, questions
   and consent text come from the database in both languages
   (survey_for_me, 0163). The research survey is one of them, with §16's
   consent screen and its Icons-only audience held at the database.

   THE CONSENT SCREEN COMES FIRST when the survey has one, and the only
   way past it is to choose. A survey without one opens on its own name
   and description instead — never straight onto a question.

   SAVED AS YOU GO. Each answer is written the moment it is given, so a
   person who is called away has not lost what they said. The survey is
   then not put in front of them again (0163) unless an admin re-offers
   it; opening it by its link still lets them finish.

   "YOU CAN STOP AT ANY POINT" is one honest door, offered on every
   question: Leave — keep what I've said. Nothing is deleted, and it is
   not hidden at the end, because "at any point" means now.
   There is deliberately no "remove my answers" here (owner's standing
   rule). survey_withdraw still exists in the database, unused by the app.

   A SUBMITTED RESPONSE IS FINAL (0118, 0163). Somebody who has answered
   is thanked, never asked again.

   What the research survey deliberately does NOT ask is §16's, and the
   admin screen repeats it for anyone building a new survey: nothing the
   app already knows, nothing about income or willingness to pay, and no
   direct loneliness measurement.

   One question per screen, never a wall of fields.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import {
  fetchSurvey,
  saveSurveyAnswer,
  submitSurvey,
  pick,
  word,
} from "./growData.js";

export default function SurveyPage() {
  const { id } = useParams();
  const ref = id || "research";
  const { t, ts, meta, lang } = useI18n();
  const navigate = useNavigate();

  /* checking | answered | closed | intro | q | done

     CHECKING COMES FIRST, and nothing in it can be pressed: the consent
     button is not offered until the server has said whether this person
     has already answered. */
  const [stage, setStage] = useState("checking");
  const [survey, setSurvey] = useState(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const [draft, setDraft] = useState(""); // the written answer being typed
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const typing = useRef(null);
  /* SAVES RUN ONE AFTER ANOTHER. Tapping Finish blurs the written
     answer, which starts a save; the tap then submitted before that save
     landed, so the survey was closed with the words missing and the save
     refused. Every save now joins one chain, and Finish, Leave and Stop
     wait for it — and two quick taps can never arrive in the wrong order. */
  const chain = useRef(Promise.resolve(true));
  const lastSent = useRef({});

  useEffect(() => {
    let alive = true;
    setStage("checking");
    fetchSurvey(ref)
      .then((s) => {
        if (!alive) return;
        /* Not meant for this account (the research survey is Icons only)
           or not published: back to Grow, as before, rather than a door
           that says no. */
        if (!s) {
          navigate("/app/skills", { replace: true });
          return;
        }
        setSurvey(s);
        setAnswers(s.answers || {});
        lastSent.current = { ...(s.answers || {}) };
        if (s.state === "answered") setStage("answered");
        else if (s.state === "closed") setStage("closed");
        else {
          const firstOpen = (s.questions || []).findIndex((q) => !(q.key in (s.answers || {})));
          setI(firstOpen < 0 ? Math.max(0, (s.questions || []).length - 1) : firstOpen);
          setStage("intro");
        }
      })
      .catch(() => alive && navigate("/app/skills", { replace: true }));
    return () => {
      alive = false;
      window.clearTimeout(typing.current);
    };
  }, [ref, navigate]);

  const questions = survey?.questions || [];
  const q = questions[i];

  useEffect(() => {
    if (q?.type === "text") setDraft(typeof answers[q.key] === "string" ? answers[q.key] : "");
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, q?.key]);

  const persist = useCallback(
    (key, value) => {
      lastSent.current = { ...lastSent.current, [key]: value };
      const run = chain.current.then(async () => {
        try {
          await saveSurveyAnswer(survey.id, key, value);
          setSaved(true);
          return true;
        } catch (e) {
          if (/already answered/i.test(e.message)) {
            setStage("answered");
            return false;
          }
          if (/not open/i.test(e.message)) {
            setStage("closed");
            return false;
          }
          pushToast(t("grow.survey.saveFailed"), { tone: "error", key: "survey" });
          return false;
        }
      });
      chain.current = run;
      return run;
    },
    [survey?.id, t]
  );

  const choose = (opt) => {
    let value;
    if (q.type === "single") value = answers[q.key] === opt ? null : opt;
    else {
      const list = Array.isArray(answers[q.key]) ? answers[q.key] : [];
      value = list.includes(opt) ? list.filter((x) => x !== opt) : [...list, opt];
      if (value.length === 0) value = null;
    }
    setAnswers((cur) => {
      const next = { ...cur };
      if (value === null) delete next[q.key];
      else next[q.key] = value;
      return next;
    });
    persist(q.key, value);
  };

  const isChosen = (opt) => {
    const v = answers[q.key];
    return q.type === "multi" ? (Array.isArray(v) ? v : []).includes(opt) : v === opt;
  };

  const onType = (text) => {
    setDraft(text);
    setSaved(false);
    window.clearTimeout(typing.current);
    const key = q.key;
    typing.current = window.setTimeout(() => flushText(key, text), 900);
  };

  const flushText = async (key, text) => {
    window.clearTimeout(typing.current);
    const value = text.trim() === "" ? null : text;
    if ((lastSent.current[key] ?? null) === value) return chain.current;
    setAnswers((cur) => {
      const next = { ...cur };
      if (value === null) delete next[key];
      else next[key] = value;
      return next;
    });
    return persist(key, value);
  };

  const go = async (to) => {
    if (q?.type === "text") await flushText(q.key, draft);
    setI(to);
  };

  const finish = async () => {
    setBusy(true);
    if (q?.type === "text") await flushText(q.key, draft);
    /* Every answer has landed, in order, before the survey is closed. */
    if ((await chain.current) === false) {
      setBusy(false);
      return;
    }
    try {
      await submitSurvey(survey.id);
      setStage("done");
    } catch (e) {
      if (/already answered/i.test(e.message)) setStage("answered");
      else if (/not open/i.test(e.message)) setStage("closed");
      else pushToast(t("grow.survey.saveFailed"), { tone: "error", key: "survey" });
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (q?.type === "text") await flushText(q.key, draft);
    await chain.current;
    navigate("/app/skills");
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

  const h1 = (color) => ({
    fontFamily: meta.fonts.heading,
    fontSize: ts(26),
    fontWeight: 800,
    color,
    lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.25,
    margin: "0 0 12px",
  });
  const body = { fontSize: ts(20), color: C.textMain, lineHeight: 1.6, margin: "0 0 20px" };

  const hasConsent = !!(survey && (survey.consent_en || survey.consent_ur));
  const started = Object.keys(answers).length > 0;

  return (
    <main style={{ minHeight: "100vh", background: C.bg, fontFamily: meta.fonts.body, padding: "20px 16px 60px" }}>
      <div className="sb-col" style={{ maxWidth: 560, margin: "0 auto", "--sb-col": "560px" }} data-survey-page={survey?.id || ""}>
        {stage === "checking" && <div aria-busy="true" style={{ minHeight: 240 }} />}

        {stage === "answered" && (
          <section data-stage="answered">
            <h1 style={h1(C.green)}>{t("grow.survey.answeredTitle")}</h1>
            <p style={body}>{t("grow.survey.answeredBody")}</p>
            <button type="button" style={btn(true)} onClick={() => navigate("/app/skills")}>
              {t("grow.survey.back")}
            </button>
          </section>
        )}

        {stage === "closed" && (
          <section data-stage="closed">
            <h1 style={h1(C.green)}>{t("grow.survey.closedTitle")}</h1>
            <p style={body}>{t("grow.survey.closedBody")}</p>
            <button type="button" style={btn(true)} onClick={() => navigate("/app/skills")}>
              {t("grow.survey.back")}
            </button>
          </section>
        )}

        {stage === "intro" && survey && (
          <section data-stage={hasConsent ? "consent" : "intro"}>
            <h1 style={h1(C.brown)}>{pick(survey, "title", lang)}</h1>
            {/* The consent wording, in full, before anything else. */}
            <p style={body}>{hasConsent ? pick(survey, "consent", lang) : pick(survey, "desc", lang)}</p>
            {started && (
              <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "-8px 0 18px" }}>
                {t("grow.survey.keptSoFar")}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" style={btn(true)} data-action="begin" onClick={() => setStage("q")}>
                {started ? t("grow.survey.carryOn") : t("grow.survey.begin")}
              </button>
              <button type="button" style={btn(false)} onClick={() => navigate("/app/skills")}>
                {t("grow.survey.notNow")}
              </button>
            </div>
          </section>
        )}

        {stage === "q" && q && (
          <section data-stage="question" data-q={q.key} data-type={q.type}>
            <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 6px" }}>
              {t("grow.survey.step", { n: i + 1, total: questions.length })}
            </p>
            <h1
              style={{
                fontFamily: meta.fonts.heading,
                fontSize: ts(24),
                fontWeight: 700,
                color: C.green,
                lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.3,
                margin: "0 0 6px",
              }}
            >
              {word(q, lang)}
            </h1>
            <p style={{ fontSize: ts(16), color: C.textMuted, margin: "0 0 14px" }}>
              {q.type === "multi" ? t("grow.survey.chooseMany") : q.type === "single" ? t("grow.survey.chooseOne") : t("grow.survey.writeHint")}
            </p>

            {q.type === "text" ? (
              <textarea
                value={draft}
                dir="auto"
                maxLength={4000}
                rows={6}
                aria-label={word(q, lang)}
                onChange={(e) => onType(e.target.value)}
                onBlur={() => flushText(q.key, draft)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  minHeight: 160,
                  padding: 14,
                  borderRadius: 14,
                  border: `1.5px solid ${C.warmGray}`,
                  fontFamily: "inherit",
                  fontSize: ts(A11Y.minBodyPx),
                  lineHeight: 1.6,
                  color: C.textMain,
                  background: C.white,
                  marginBottom: 18,
                }}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                {(q.options || []).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    data-option={opt.key}
                    onClick={() => choose(opt.key)}
                    aria-pressed={isChosen(opt.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      minHeight: 56,
                      padding: "0 18px",
                      borderRadius: 16,
                      border: isChosen(opt.key) ? `2.5px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
                      background: isChosen(opt.key) ? "#EEF3E8" : C.white,
                      color: C.textMain,
                      fontFamily: "inherit",
                      fontSize: ts(A11Y.minBodyPx),
                      fontWeight: isChosen(opt.key) ? 700 : 500,
                      textAlign: "start",
                      cursor: "pointer",
                    }}
                  >
                    {/* Never colour alone (§0.2). */}
                    <span aria-hidden="true" style={{ color: C.green, width: 18 }}>
                      {isChosen(opt.key) ? "✓" : ""}
                    </span>
                    {word(opt, lang)}
                  </button>
                ))}
              </div>
            )}

            <p role="status" style={{ fontSize: ts(15), color: C.textMuted, minHeight: 24, margin: "0 0 10px" }}>
              {saved ? t("grow.survey.saved") : ""}
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {i + 1 < questions.length ? (
                <button type="button" style={btn(true)} data-action="next" onClick={() => go(i + 1)}>
                  {t("grow.survey.next")}
                </button>
              ) : (
                <button type="button" style={btn(true)} data-action="finish" disabled={busy} onClick={finish}>
                  {busy ? "…" : t("grow.survey.finish")}
                </button>
              )}
              {i > 0 && (
                <button type="button" style={btn(false)} data-action="previous" onClick={() => go(i - 1)}>
                  {t("grow.survey.previous")}
                </button>
              )}
            </div>

            {/* Offered on every screen, not hidden at the end — that is
                what "at any point" means. */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22, paddingTop: 16, borderTop: `1px solid ${C.warmGray}` }}>
              <button type="button" style={btn(false)} data-action="leave" onClick={leave}>
                {t("grow.survey.leaveKeep")}
              </button>
            </div>
          </section>
        )}

        {stage === "done" && (
          <section data-stage="done">
            <h1 style={h1(C.green)}>{t("grow.survey.thanksTitle")}</h1>
            <p style={body}>{t("grow.survey.thanksBody")}</p>
            <button type="button" style={btn(true)} onClick={() => navigate("/app/skills")}>
              {t("grow.survey.back")}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
