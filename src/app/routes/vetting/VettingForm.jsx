/* ════════════════════════════════════════════════
   /app/vetting — the Saath-Buddy application (build step 8, applicant
   side), on mock submission. Long, deliberately (SPEC.md): volunteers
   are matched with isolated seniors, and this form is where the bar
   is set.

   Seven steps: identity → profile (languages emphasised) → motivation
   → experience → references → declarations → review. Field keys are
   the buddy_applications columns; submission goes through
   mockSubmit.js, a stand-in for submit_buddy_application().

   Answers auto-save to this device (localStorage) — a form this long
   must survive a closed tab. The draft clears on submit.

   NOT yet registered in AppRoot.jsx — see VETTING_WIRING.md.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { COLORS as C, FONTS } from "../../../shared/tokens.js";
import {
  STEPS,
  INITIAL_APPLICATION,
  INITIAL_REFS,
  validateStep,
  validateAll,
  buildPayload,
  DRAFT_KEY,
} from "./vettingData.js";
import { mockSubmitBuddyApplication } from "./mockSubmit.js";
import {
  StepIdentity,
  StepProfile,
  StepMotivation,
  StepExperience,
  StepReferences,
  StepDeclarations,
  StepReview,
} from "./steps.jsx";

const css = `
  .vt-root, .vt-root * { box-sizing: border-box; }
  .vt-root { -webkit-font-smoothing: antialiased; }
  .vt-root button { -webkit-tap-highlight-color: transparent; }
  .vt-root :focus-visible { outline: 3px solid ${C.green}; outline-offset: 2px; }
  .vt-root input::placeholder, .vt-root textarea::placeholder { color: ${C.textMuted}; opacity: 0.8; }
  .vt-step { animation: vtFade 0.35s ease both; }
  @keyframes vtFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) {
    .vt-root *, .vt-step { animation: none !important; transition: none !important; }
  }
`;

function loadDraft() {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const STEP_COMPONENTS = {
  identity: StepIdentity,
  profile: StepProfile,
  motivation: StepMotivation,
  experience: StepExperience,
  references: StepReferences,
  declarations: StepDeclarations,
  review: StepReview,
};

export default function VettingForm() {
  const draft = useRef(loadDraft()).current;
  const [app, setAppState] = useState({ ...INITIAL_APPLICATION, ...(draft?.app || {}) });
  const [refs, setRefs] = useState(draft?.refs || INITIAL_REFS);
  const [stepIndex, setStepIndex] = useState(draft?.stepIndex || 0);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedId, setSubmittedId] = useState(null);
  const headingRef = useRef(null);

  const step = STEPS[stepIndex];
  const StepBody = STEP_COMPONENTS[step.id];

  const setApp = (patch) => {
    setAppState((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  // Auto-save the draft; cleared on successful submit.
  useEffect(() => {
    try {
      if (typeof localStorage !== "undefined" && !submittedId) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ app, refs, stepIndex }));
      }
    } catch {
      /* storage full or blocked — the form still works, just without drafts */
    }
  }, [app, refs, stepIndex, submittedId]);

  // New step: scroll up and move focus to the step heading.
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo(0, 0);
    headingRef.current?.focus();
  }, [stepIndex]);

  const goTo = (i) => {
    setErrors({});
    setStepIndex(i);
  };

  const back = () => stepIndex > 0 && goTo(stepIndex - 1);

  const continueOrSubmit = async () => {
    if (step.id !== "review") {
      const e = validateStep(step.id, app, refs);
      if (Object.keys(e).length > 0) {
        setErrors(e);
        return;
      }
      setErrors({});
      setStepIndex(stepIndex + 1);
      return;
    }

    // Review step → full validation, then mock submission.
    const all = validateAll(app, refs);
    if (Object.keys(all).length > 0) {
      const firstBroken = STEPS.findIndex(
        (s) =>
          s.id !== "review" &&
          Object.keys(validateStep(s.id, app, refs)).length > 0
      );
      setErrors(all);
      setStepIndex(firstBroken);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const { id } = await mockSubmitBuddyApplication(buildPayload(app, refs));
      try {
        if (typeof localStorage !== "undefined") localStorage.removeItem(DRAFT_KEY);
      } catch { /* ignore */ }
      setSubmittedId(id);
    } catch (err) {
      setSubmitError(err.message || "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const errorCount = Object.keys(errors).length;

  /* ─── Submitted: what happens next ─── */
  if (submittedId) {
    return (
      <main className="vt-root" style={pageStyle}>
        <style>{css}</style>
        <div style={columnStyle}>
          <div
            className="vt-step"
            style={{
              background: C.white,
              border: `2px solid ${C.sage}`,
              borderRadius: 22,
              padding: "28px 22px",
              marginTop: 24,
            }}
          >
            <p aria-hidden="true" style={{ fontSize: 44, margin: "0 0 8px" }}>🌱</p>
            <h1 style={{ ...h1Style, marginBottom: 12 }}>Application received</h1>
            <p style={{ fontSize: 19, lineHeight: 1.6, color: C.textMain, margin: "0 0 20px" }}>
              Thank you — genuinely. What happens next, in order:
            </p>
            <ol style={{ margin: "0 0 20px", paddingLeft: 24 }}>
              {[
                "A member of our team reads your application — your own words first.",
                "We call you for a proper conversation.",
                "We phone both of your references. Please do let them know.",
                "If everything fits, you begin a probation period alongside an experienced Buddy.",
                "Then you're an active Saath-Buddy.",
              ].map((line) => (
                <li key={line} style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 10 }}>
                  {line}
                </li>
              ))}
            </ol>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: C.textMuted, margin: 0 }}>
              Until your application is fully approved you won't be matched with
              anyone — that protection is the whole point of the process. We'll
              reach you by email and phone at every stage.
            </p>
            <p style={{ fontSize: 18, color: C.textMuted, marginTop: 16, marginBottom: 0 }}>
              (Development preview — nothing was actually sent. Reference:{" "}
              {submittedId.slice(0, 8)})
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* ─── The form ─── */
  return (
    <main className="vt-root" style={pageStyle}>
      <style>{css}</style>
      <div style={columnStyle}>
        <header style={{ margin: "8px 0 20px" }}>
          <h1 style={h1Style}>Become a Saath-Buddy</h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: C.textMuted, margin: "10px 0 0" }}>
            This application is thorough on purpose: Saath-Buddies are matched
            with seniors who place real trust in us. It takes about ten
            minutes, and your answers save on this device as you go.
          </p>
        </header>

        {/* Progress */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.green, margin: "0 0 8px" }}>
            Step {stepIndex + 1} of {STEPS.length} — {step.title}
          </p>
          <div
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
            style={{ display: "flex", gap: 5 }}
          >
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                style={{
                  flex: 1,
                  height: 10,
                  borderRadius: 5,
                  background: i <= stepIndex ? C.green : C.warmGray,
                }}
              />
            ))}
          </div>
        </div>

        <h2
          ref={headingRef}
          tabIndex={-1}
          style={{
            fontFamily: FONTS.serif,
            fontSize: 26,
            fontWeight: 700,
            color: C.brown,
            margin: "0 0 12px",
            outline: "none",
          }}
        >
          {step.title}
        </h2>

        {errorCount > 0 && (
          <p
            role="alert"
            style={{
              fontSize: 18,
              lineHeight: 1.5,
              fontWeight: 700,
              color: C.cream,
              background: C.brown,
              borderRadius: 14,
              padding: "12px 16px",
              margin: "0 0 18px",
            }}
          >
            {errorCount === 1
              ? "One thing needs your attention below."
              : `${errorCount} things need your attention below.`}
          </p>
        )}

        {submitError && (
          <p
            role="alert"
            style={{
              fontSize: 18,
              lineHeight: 1.5,
              fontWeight: 700,
              color: C.cream,
              background: C.brown,
              borderRadius: 14,
              padding: "12px 16px",
              margin: "0 0 18px",
            }}
          >
            {submitError}
          </p>
        )}

        <form
          className="vt-step"
          key={step.id}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            continueOrSubmit();
          }}
        >
          <StepBody
            app={app}
            setApp={setApp}
            refs={refs}
            setRefs={setRefs}
            errors={errors}
            goTo={goTo}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={back}
                style={{
                  flex: "1 1 140px",
                  minHeight: 56,
                  borderRadius: 50,
                  border: `2px solid ${C.green}`,
                  background: C.white,
                  color: C.green,
                  fontSize: 19,
                  fontWeight: 700,
                  fontFamily: FONTS.sans,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: "2 1 200px",
                minHeight: 56,
                borderRadius: 50,
                border: "none",
                background: C.green,
                color: C.cream,
                fontSize: 19,
                fontWeight: 700,
                fontFamily: FONTS.sans,
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {step.id === "review"
                ? submitting
                  ? "Sending…"
                  : "Send my application"
                : "Continue"}
            </button>
          </div>
        </form>

        <p style={{ fontSize: 18, color: C.textMuted, margin: "24px 0 0", lineHeight: 1.5 }}>
          Not ready to finish? Everything you've entered stays saved on this
          device — come back any time.
        </p>
      </div>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: C.bg,
  fontFamily: FONTS.sans,
  color: C.textMain,
  fontSize: 18,
};

const columnStyle = {
  maxWidth: 640,
  margin: "0 auto",
  padding: "24px 16px 64px",
};

const h1Style = {
  fontFamily: FONTS.serif,
  fontSize: "clamp(1.7rem, 5vw, 2.2rem)",
  fontWeight: 700,
  color: C.green,
  lineHeight: 1.2,
  margin: 0,
};
