/* ════════════════════════════════════════════════
   /app/vetting — the Saath-Buddy application (build step 8, applicant
   side), wired to Supabase. Long, deliberately (SPEC.md): volunteers
   are matched with isolated seniors, and this form is where the bar
   is set.

   Lifecycle:
     mount  → read own applications (RLS-scoped).
              live one (status ≠ rejected)  → pipeline status screen
              recent rejection (< 90 days)  → cooldown screen
              otherwise                     → the seven-step form
     submit → upload CNIC photo + selfie to the PRIVATE buddy-documents
              bucket (own-folder paths, migration 0008), then call
              submit_buddy_application() (migration 0004). The RPC's
              rejections render as kind error screens, never raw errors.

   Route is registered in AppRoot behind RequireAuth roles=["saath_buddy"];
   the RPC re-checks role and standing server-side regardless.

   Answers auto-save to this device (localStorage; photos can't persist,
   so a restored draft asks for them again). The draft clears on submit.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { COLORS as C } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import {
  STEPS,
  INITIAL_APPLICATION,
  INITIAL_REFS,
  validateStep,
  validateAll,
  buildPayload,
  DRAFT_KEY,
} from "./vettingData.js";
import {
  uploadBuddyDocument,
  submitBuddyApplication,
  fetchOwnApplications,
  liveApplication,
  cooldownDaysLeft,
  classifySubmitError,
  currentUserId,
} from "./supabaseVetting.js";
import { ApplicationStatus, KindErrorScreen } from "./screens.jsx";
import AppHeader from "../../components/AppHeader.jsx";
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

function clearDraft() {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
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

/* AppHeader wraps every state this form renders (loading, status
   screens, refusals, the form itself) — see HEADER_WIRING.md. */
export default function VettingForm() {
  return (
    <>
      <AppHeader />
      <VettingFormInner />
    </>
  );
}

function VettingFormInner() {
  const { t, meta } = useI18n();
  const draft = useRef(loadDraft()).current;
  const [app, setAppState] = useState({ ...INITIAL_APPLICATION, ...(draft?.app || {}) });
  const [refs, setRefs] = useState(draft?.refs || INITIAL_REFS);
  const [files, setFiles] = useState({ cnic: null, selfie: null });
  const [stepIndex, setStepIndex] = useState(draft?.stepIndex || 0);
  const [errors, setErrors] = useState({});

  // What the route shows: resolving | form | status | refused
  const [phase, setPhase] = useState("resolving");
  const [application, setApplication] = useState(null); // live row for the status screen
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [refusal, setRefusal] = useState(null); // { code, daysLeft }

  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState(""); // "photos" | "sending"
  const [submitError, setSubmitError] = useState("");
  const headingRef = useRef(null);

  const step = STEPS[stepIndex];
  const StepBody = STEP_COMPONENTS[step.id];

  /* On mount: does this account already have an application? */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchOwnApplications();
        if (cancelled) return;
        const live = liveApplication(rows);
        if (live) {
          clearDraft(); // a live application makes the draft stale
          setApplication(live);
          setPhase("status");
          return;
        }
        const daysLeft = cooldownDaysLeft(rows);
        if (daysLeft > 0) {
          setRefusal({ code: "cooldown", daysLeft });
          setPhase("refused");
          return;
        }
        setPhase("form");
      } catch {
        // Can't read (offline, expired session mid-page…): show the form —
        // the RPC re-checks everything server-side at submit anyway.
        if (!cancelled) setPhase("form");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setApp = (patch) => {
    setAppState((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const setFilesAndClear = (next) => {
    setFiles(next);
    setErrors((prev) => {
      const cleared = { ...prev };
      if (next.cnic) delete cleared.cnic_photo_path;
      if (next.selfie) delete cleared.selfie_path;
      return cleared;
    });
  };

  // Auto-save the draft (photos can't be persisted; they re-ask on restore).
  useEffect(() => {
    if (phase !== "form") return;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ app, refs, stepIndex }));
      }
    } catch {
      /* storage full or blocked — the form still works, just without drafts */
    }
  }, [app, refs, stepIndex, phase]);

  // New step: scroll up and move focus to the step heading.
  useEffect(() => {
    if (phase !== "form") return;
    if (typeof window !== "undefined") window.scrollTo(0, 0);
    headingRef.current?.focus();
  }, [stepIndex, phase]);

  const goTo = (i) => {
    setErrors({});
    setStepIndex(i);
  };

  const back = () => stepIndex > 0 && goTo(stepIndex - 1);

  const continueOrSubmit = async () => {
    if (step.id !== "review") {
      const e = validateStep(step.id, app, refs, files);
      if (Object.keys(e).length > 0) {
        setErrors(e);
        return;
      }
      setErrors({});
      setStepIndex(stepIndex + 1);
      return;
    }

    // Review step → full validation, then the real submission.
    const all = validateAll(app, refs, files);
    if (Object.keys(all).length > 0) {
      const firstBroken = STEPS.findIndex(
        (s) =>
          s.id !== "review" &&
          Object.keys(validateStep(s.id, app, refs, files)).length > 0
      );
      setErrors(all);
      setStepIndex(firstBroken);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      // 1. Photos into the private bucket, under the applicant's own folder.
      setSubmitStage("photos");
      const uid = await currentUserId();
      const [cnicPath, selfiePath] = await Promise.all([
        uploadBuddyDocument(uid, "cnic", files.cnic),
        uploadBuddyDocument(uid, "selfie", files.selfie),
      ]);

      // 2. The application itself.
      setSubmitStage("sending");
      await submitBuddyApplication(
        buildPayload(app, refs, {
          cnic_photo_path: cnicPath,
          selfie_path: selfiePath,
        })
      );

      // 3. Read back our own row — the status screen shows the truth
      //    from the database, not an assumption.
      clearDraft();
      const rows = await fetchOwnApplications();
      setApplication(liveApplication(rows) || { status: "pending", created_at: new Date().toISOString() });
      setJustSubmitted(true);
      setPhase("status");
      if (typeof window !== "undefined") window.scrollTo(0, 0);
    } catch (err) {
      const code = classifySubmitError(err.message);
      if (code === "duplicate") {
        // Someone submitted from another tab or device — show that one.
        try {
          const rows = await fetchOwnApplications();
          const live = liveApplication(rows);
          if (live) {
            clearDraft();
            setApplication(live);
            setPhase("status");
            return;
          }
        } catch {
          /* fall through to the generic banner */
        }
        setSubmitError("vetting.form.duplicate");
      } else if (code === "under18" || code === "blocked") {
        setRefusal({ code });
        setPhase("refused");
        if (typeof window !== "undefined") window.scrollTo(0, 0);
      } else if (code === "cooldown") {
        let daysLeft = 0;
        try {
          daysLeft = cooldownDaysLeft(await fetchOwnApplications());
        } catch {
          /* the screen copes with 0 */
        }
        setRefusal({ code, daysLeft });
        setPhase("refused");
        if (typeof window !== "undefined") window.scrollTo(0, 0);
      } else {
        // A locale key or a server message — t() renders either.
        setSubmitError(err.message || "vetting.form.generic");
      }
    } finally {
      setSubmitting(false);
      setSubmitStage("");
    }
  };

  const errorCount = Object.keys(errors).length;

  /* ─── Non-form phases ─── */

  if (phase === "resolving") {
    return (
      <main className="vt-root" style={pageStyle}>
        <style>{css}</style>
        <div style={columnStyle}>
          <p role="status" style={{ fontSize: 19, color: C.textMuted, marginTop: 48, textAlign: "center" }}>
            {t("vetting.form.oneMoment")}
          </p>
        </div>
      </main>
    );
  }

  if (phase === "status") {
    return (
      <main className="vt-root" style={pageStyle}>
        <style>{css}</style>
        <div style={columnStyle}>
          <ApplicationStatus application={application} justSubmitted={justSubmitted} />
        </div>
      </main>
    );
  }

  if (phase === "refused") {
    return (
      <main className="vt-root" style={pageStyle}>
        <style>{css}</style>
        <div style={columnStyle}>
          <KindErrorScreen
            code={refusal.code}
            daysLeft={refusal.daysLeft || 0}
            onRetry={() => setPhase("form")}
          />
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
          <h1 style={{ ...h1Style, fontFamily: meta.fonts.heading }}>
            {t("vetting.form.title")}
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: C.textMuted, margin: "10px 0 0" }}>
            {t("vetting.form.intro")}
          </p>
        </header>

        {/* Progress */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.green, margin: "0 0 8px" }}>
            {t("vetting.form.stepOf", {
              n: stepIndex + 1,
              total: STEPS.length,
              title: t(step.titleKey),
            })}
          </p>
          <div
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-label={t("vetting.form.stepAria", { n: stepIndex + 1, total: STEPS.length })}
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
            fontFamily: meta.fonts.heading,
            fontSize: 26,
            fontWeight: 700,
            color: C.brown,
            margin: "0 0 12px",
            outline: "none",
          }}
        >
          {t(step.titleKey)}
        </h2>

        {errorCount > 0 && (
          <p role="alert" style={alertStyle}>
            {errorCount === 1
              ? t("vetting.form.oneIssue")
              : t("vetting.form.manyIssues", { n: errorCount })}
          </p>
        )}

        {submitError && (
          <p role="alert" style={alertStyle}>
            {t(submitError)}
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
            files={files}
            setFiles={setFilesAndClear}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={back}
                disabled={submitting}
                style={{
                  flex: "1 1 140px",
                  minHeight: 56,
                  borderRadius: 50,
                  border: `2px solid ${C.green}`,
                  background: C.white,
                  color: C.green,
                  fontSize: 19,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {t("vetting.form.back")}
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
                fontFamily: "inherit",
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {step.id === "review"
                ? submitting
                  ? submitStage === "photos"
                    ? t("vetting.form.savingPhotos")
                    : t("vetting.form.sending")
                  : t("vetting.form.sendCta")
                : t("vetting.form.continueCta")}
            </button>
          </div>
        </form>

        <p style={{ fontSize: 18, color: C.textMuted, margin: "24px 0 0", lineHeight: 1.5 }}>
          {t("vetting.form.draftNote")}
        </p>
      </div>
    </main>
  );
}

// Font family is inherited from the LanguageProvider wrapper, so the
// whole flow flips to Nastaliq under Urdu automatically.
const pageStyle = {
  minHeight: "100vh",
  background: C.bg,
  color: C.textMain,
  fontSize: 18,
};

const columnStyle = {
  maxWidth: 640,
  margin: "0 auto",
  padding: "24px 16px 64px",
};

const h1Style = {
  fontSize: "clamp(1.7rem, 5vw, 2.2rem)",
  fontWeight: 700,
  color: C.green,
  lineHeight: 1.2,
  margin: 0,
};

const alertStyle = {
  fontSize: 18,
  lineHeight: 1.5,
  fontWeight: 700,
  color: C.cream,
  background: C.brown,
  borderRadius: 14,
  padding: "12px 16px",
  margin: "0 0 18px",
};
