/* ════════════════════════════════════════════════
   The research survey — PRODUCT_DECISIONS §16. Icons only.

   THE CONSENT SCREEN COMES FIRST, always, and says exactly what §16
   says it says: who sees the answers, who never does, and that you
   can stop at any point. It is not a checkbox buried under a heading
   — it is the whole first screen, and the only way past it is to
   choose.

   "You can stop at any point" is honoured literally: stopping deletes
   the answers (0054's delete policy), rather than setting a flag on a
   row that stays.

   EVERY QUESTION FEEDS A FEATURE (§16). What is deliberately NOT
   asked matters as much as what is:
     · nothing the app already knows — city, area, gender, how they
       heard about Saathban
     · income or willingness to pay — pricing research inside a
       companionship product changes what the app IS to the person
     · direct loneliness measurement — "do you have enough people to
       talk to?" is the question most likely to hurt someone on a bad
       day, alone with their phone

   One question per screen, never a wall of fields (§5's rule, and it
   applies here more than anywhere: a research form that looks like a
   form is a research form nobody finishes).
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import supabase from "../../lib/supabase.js";

/* Each question names the feature it feeds, so a future editor can
   see the §16 rule being kept rather than having to trust it. */
export const QUESTIONS = [
  { key: "could_share", multi: true, options: ["cooking", "teaching", "stitching", "gardening", "stories", "repairs"] }, // → Skills
  { key: "would_mentor", multi: false, options: ["yes", "maybe", "no"] },                                                // → mentoring
  { key: "activities", multi: true, options: ["walking", "games", "religious", "music", "outings"] },                    // → Out & about
  { key: "would_learn", multi: false, options: ["yes", "maybe", "no"] },                                                 // → Grow
  { key: "earning_interest", multi: false, options: ["yes", "maybe", "no"] },                                            // → Earning
  { key: "time_per_week", multi: false, options: ["under2", "two_to_five", "over5"] },                                   // → matching
  { key: "companion_comfort", multi: true, options: ["same_gender", "similar_age", "same_language", "no_preference"] },  // → Buddy allotment
  { key: "matters_most", multi: false, options: ["company", "safety", "learning", "purpose"] },                          // → priorities
];

export default function SurveyPage() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();

  const [stage, setStage] = useState("consent"); // consent | q | done
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [already, setAlready] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase
      .from("survey_responses")
      .select("submitted_at")
      .eq("profile_id", profile.id)
      .maybeSingle()
      .then(({ data }) => alive && data?.submitted_at && setAlready(true));
    return () => { alive = false; };
  }, [profile.id]);

  const q = QUESTIONS[i];

  const toggle = (opt) => {
    setAnswers((cur) => {
      if (!q.multi) return { ...cur, [q.key]: opt };
      const list = cur[q.key] || [];
      return { ...cur, [q.key]: list.includes(opt) ? list.filter((x) => x !== opt) : [...list, opt] };
    });
  };

  const isChosen = (opt) => {
    const v = answers[q.key];
    return q.multi ? (v || []).includes(opt) : v === opt;
  };

  const finish = async () => {
    setBusy(true);
    const { error } = await supabase.from("survey_responses").upsert(
      {
        profile_id: profile.id,
        answers,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    );
    setBusy(false);
    if (error) {
      pushToast(t("grow.survey.saveFailed"), { tone: "error", key: "survey" });
      return;
    }
    setStage("done");
  };

  /* "You can stop at any point." Stopping removes what was said. */
  const stop = async () => {
    await supabase.from("survey_responses").delete().eq("profile_id", profile.id);
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

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: meta.fonts.body,
        padding: "20px 16px 60px",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {stage === "consent" && (
          <section data-stage="consent">
            <h1
              style={{
                fontFamily: meta.fonts.heading,
                fontSize: ts(26),
                fontWeight: 800,
                color: C.brown,
                lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.25,
                margin: "0 0 14px",
              }}
            >
              {t("grow.survey.title")}
            </h1>
            {/* §16's consent wording, in full, before anything else. */}
            <p style={{ fontSize: ts(20), color: C.textMain, lineHeight: 1.6, margin: "0 0 20px" }}>
              {t("grow.survey.consent")}
            </p>
            {already && (
              <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 16px" }}>
                {t("grow.survey.alreadyDone")}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" style={btn(true)} onClick={() => setStage("q")}>
                {t("grow.survey.begin")}
              </button>
              <button type="button" style={btn(false)} onClick={() => navigate("/app/skills")}>
                {t("grow.survey.notNow")}
              </button>
            </div>
          </section>
        )}

        {stage === "q" && q && (
          <section data-stage="question" data-q={q.key}>
            <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 6px" }}>
              {t("grow.survey.step", { n: i + 1, total: QUESTIONS.length })}
            </p>
            <h1
              style={{
                fontFamily: meta.fonts.heading,
                fontSize: ts(24),
                fontWeight: 700,
                color: C.green,
                lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.3,
                margin: "0 0 18px",
              }}
            >
              {t(`grow.survey.q.${q.key}`)}
            </h1>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              {q.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  aria-pressed={isChosen(opt)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    minHeight: 56,
                    padding: "0 18px",
                    borderRadius: 16,
                    border: isChosen(opt) ? `2.5px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
                    background: isChosen(opt) ? "#EEF3E8" : C.white,
                    color: C.textMain,
                    fontFamily: "inherit",
                    fontSize: ts(A11Y.minBodyPx),
                    fontWeight: isChosen(opt) ? 700 : 500,
                    textAlign: "start",
                    cursor: "pointer",
                  }}
                >
                  {/* Never colour alone (§0.2). */}
                  <span aria-hidden="true" style={{ color: C.green, width: 18 }}>
                    {isChosen(opt) ? "✓" : ""}
                  </span>
                  {t(`grow.survey.opt.${opt}`)}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {i + 1 < QUESTIONS.length ? (
                <button type="button" style={btn(true)} onClick={() => setI(i + 1)}>
                  {t("grow.survey.next")}
                </button>
              ) : (
                <button type="button" style={btn(true)} disabled={busy} onClick={finish}>
                  {busy ? "…" : t("grow.survey.finish")}
                </button>
              )}
              {/* Stopping is offered on every screen, not hidden at the
                  end — that is what "at any point" means. */}
              <button type="button" style={btn(false)} onClick={stop}>
                {t("grow.survey.stop")}
              </button>
            </div>
          </section>
        )}

        {stage === "done" && (
          <section data-stage="done">
            <h1
              style={{
                fontFamily: meta.fonts.heading,
                fontSize: ts(26),
                fontWeight: 800,
                color: C.green,
                margin: "0 0 12px",
              }}
            >
              {t("grow.survey.thanksTitle")}
            </h1>
            <p style={{ fontSize: ts(20), color: C.textMain, lineHeight: 1.6, margin: "0 0 20px" }}>
              {t("grow.survey.thanksBody")}
            </p>
            <button type="button" style={btn(true)} onClick={() => navigate("/app/skills")}>
              {t("grow.survey.back")}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
