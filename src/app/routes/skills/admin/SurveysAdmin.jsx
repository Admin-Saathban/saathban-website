/* ════════════════════════════════════════════════
   Grow admin — Surveys.

   The builder (name, description, optional consent screen, questions:
   single choice, multiple choice, written; audience), publish /
   unpublish with the two modes, and the people who dismissed or left a
   survey part-way, with how many times each dismissed it and a re-offer
   to one person or to everyone who dismissed.

   Answers are never shown here. Reading them is the Results tab, super
   admins only, on the record (0166).
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { APP_COLORS as C } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { pushToast } from "../../../lib/feedback.jsx";
import { ROLE_DISPLAY } from "../../../constants/roles.js";
import {
  adminReofferSurvey,
  adminSaveSurvey,
  adminSetSurveyStatus,
  adminSurveyPeople,
  newKey,
  pick,
} from "../growData.js";
import {
  AudiencePicker,
  Bilingual,
  Btn,
  Notice,
  OptionsEditor,
  StatusControls,
  StatusPill,
  audienceText,
  errorMessage,
  moveItem,
  useAdminStyles,
} from "./ui.jsx";

const blankOptions = () => [
  { key: newKey("o"), en: "", ur: "" },
  { key: newKey("o"), en: "", ur: "" },
];
const blankQuestion = () => ({ key: newKey("q"), type: "single", en: "", ur: "", options: blankOptions() });

export default function SurveysAdmin({ overview, reload, params, setParams, isSuper }) {
  const { t, lang } = useI18n();
  const s = useAdminStyles();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const editId = params.get("edit");
  const peopleId = params.get("people");

  if (editId) {
    const survey = editId === "new" ? null : overview.surveys.find((x) => x.id === editId);
    if (editId !== "new" && !survey) return <Notice tone="error">{t("grow.admin.err.generic")}</Notice>;
    return (
      <SurveyEditor
        key={editId}
        survey={survey}
        onClose={() => setParams({ tab: "surveys" })}
        onSaved={async () => {
          await reload();
          setParams({ tab: "surveys" });
        }}
      />
    );
  }
  if (peopleId) {
    const survey = overview.surveys.find((x) => x.id === peopleId);
    return <SurveyPeople survey={survey} onClose={() => setParams({ tab: "surveys" })} onChanged={reload} />;
  }

  const setStatus = async (survey, status) => {
    setBusy(survey.id);
    setError("");
    try {
      await adminSetSurveyStatus(survey.id, status);
      await reload();
      pushToast(t(`grow.admin.statusSet.${status}`), { key: "grow-admin" });
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section data-admin-tab="surveys">
      <div style={{ ...s.row, justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ ...s.h2, margin: 0 }}>{t("grow.admin.tabs.surveys")}</h2>
        <Btn data-action="new-survey" onClick={() => setParams({ tab: "surveys", edit: "new" })}>
          {t("grow.admin.newSurvey")}
        </Btn>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {overview.surveys.map((sv) => (
        <article key={sv.id} data-admin-survey={sv.id} data-slug={sv.slug || ""} style={s.card}>
          <div style={{ ...s.row, marginBottom: 6 }}>
            <StatusPill status={sv.status} />
          </div>
          <h3 style={s.h3}>{pick(sv, "title", lang) || t("grow.admin.untitled")}</h3>
          <p style={s.muted}>{t("grow.admin.forAudience", { who: audienceText(sv.audience, t) })}</p>
          <p style={s.muted} data-survey-counts>
            {t("grow.admin.surveyCounts", { submitted: sv.submitted, part: sv.part_way, dismissed: sv.dismissed_people })}
          </p>
          {sv.pending_id && <p style={{ ...s.muted, color: C.green, fontWeight: 700 }}>✓ {t("grow.admin.inPending")}</p>}
          <div style={{ ...s.row, marginBottom: 8 }}>
            <Btn kind="secondary" data-action="edit-survey" onClick={() => setParams({ tab: "surveys", edit: sv.id })}>
              {t("grow.admin.edit")}
            </Btn>
            <Btn kind="secondary" data-action="survey-people" onClick={() => setParams({ tab: "surveys", people: sv.id })}>
              {t("grow.admin.peopleButton")}
            </Btn>
            {isSuper && (
              <Btn kind="secondary" data-action="survey-results" onClick={() => setParams({ tab: "results", survey: sv.id })}>
                {t("grow.admin.resultsButton")}
              </Btn>
            )}
          </div>
          <StatusControls status={sv.status} kind="survey" busy={busy === sv.id} onSet={(st) => setStatus(sv, st)} />
        </article>
      ))}
    </section>
  );
}

function SurveyEditor({ survey, onClose, onSaved }) {
  const { t, ts } = useI18n();
  const s = useAdminStyles();
  const locked = !!survey?.has_answers;
  const isResearch = survey?.slug === "research";
  const [form, setForm] = useState(() => ({
    title_en: survey?.title_en || "",
    title_ur: survey?.title_ur || "",
    desc_en: survey?.desc_en || "",
    desc_ur: survey?.desc_ur || "",
    consent_en: survey?.consent_en || "",
    consent_ur: survey?.consent_ur || "",
    audience: survey?.audience || [],
    questions: survey?.questions || [blankQuestion()],
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setQ = (i, patch) => set({ questions: form.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) });

  const save = async () => {
    setSaving(true);
    setError("");
    const questions = form.questions.map((q) =>
      q.type === "text" ? { key: q.key, type: q.type, en: q.en, ur: q.ur } : { key: q.key, type: q.type, en: q.en, ur: q.ur, options: q.options || [] }
    );
    const payload = {
      title_en: form.title_en,
      title_ur: form.title_ur,
      desc_en: form.desc_en,
      desc_ur: form.desc_ur,
      consent_en: form.consent_en,
      consent_ur: form.consent_ur,
      questions,
    };
    if (!isResearch) payload.audience = form.audience;
    try {
      await adminSaveSurvey(survey?.id, payload);
      pushToast(t("grow.admin.saved"), { key: "grow-admin" });
      await onSaved();
    } catch (e) {
      setError(errorMessage(e, t));
      setSaving(false);
    }
  };

  return (
    <section data-admin-editor="survey" data-survey-id={survey?.id || "new"}>
      <h2 style={s.h2}>{survey ? t("grow.admin.editSurvey") : t("grow.admin.newSurvey")}</h2>
      {survey && <div style={{ marginBottom: 12 }}><StatusPill status={survey.status} /></div>}

      {/* §16, for whoever builds the next one. */}
      <Notice>{t("grow.admin.surveyGuidance")}</Notice>

      <Bilingual name="title" label={t("grow.admin.surveyName")} en={form.title_en} ur={form.title_ur} onEn={(v) => set({ title_en: v })} onUr={(v) => set({ title_ur: v })} />
      <Bilingual name="desc" multiline label={t("grow.admin.description")} hint={t("grow.admin.surveyDescHint")} en={form.desc_en} ur={form.desc_ur} onEn={(v) => set({ desc_en: v })} onUr={(v) => set({ desc_ur: v })} />
      <Bilingual name="consent" multiline label={t("grow.admin.consent")} hint={t("grow.admin.consentHint")} en={form.consent_en} ur={form.consent_ur} onEn={(v) => set({ consent_en: v })} onUr={(v) => set({ consent_ur: v })} />

      {isResearch ? (
        <p style={s.muted}>{t("grow.admin.researchAudience", { who: ROLE_DISPLAY.saath_icon })}</p>
      ) : (
        <AudiencePicker value={form.audience} onChange={(a) => set({ audience: a })} />
      )}

      <h3 style={{ ...s.h3, marginTop: 18 }}>{t("grow.admin.questions")}</h3>
      {locked && <Notice>{t("grow.admin.lockedNote")}</Notice>}
      {form.questions.map((q, i) => (
        <div key={q.key} data-question-editor={i} style={{ ...s.card, background: "#FAFBFA" }}>
          <p style={{ ...s.label, color: C.green }}>{t("grow.admin.questionN", { n: i + 1 })}</p>
          <label style={{ display: "block", margin: "0 0 12px" }}>
            <span style={s.label}>{t("grow.admin.questionType")}</span>
            <select
              data-field="type"
              value={q.type}
              disabled={locked}
              onChange={(e) => {
                const type = e.target.value;
                setQ(i, { type, options: type === "text" ? undefined : q.options?.length ? q.options : blankOptions() });
              }}
              style={{ ...s.input, fontSize: ts(17) }}
            >
              <option value="single">{t("grow.admin.type.single")}</option>
              <option value="multi">{t("grow.admin.type.multi")}</option>
              <option value="text">{t("grow.admin.type.text")}</option>
            </select>
          </label>
          <Bilingual name={`question-${i}`} label={t("grow.admin.question")} en={q.en} ur={q.ur} onEn={(v) => setQ(i, { en: v })} onUr={(v) => setQ(i, { ur: v })} />
          {q.type !== "text" && (
            <OptionsEditor name={`question-${i}`} options={q.options} onChange={(o) => setQ(i, { options: o })} locked={locked} />
          )}
          {!locked && (
            <div style={s.row}>
              <Btn kind="secondary" small disabled={i === 0} onClick={() => set({ questions: moveItem(form.questions, i, -1) })}>{t("grow.admin.moveUp")}</Btn>
              <Btn kind="secondary" small disabled={i === form.questions.length - 1} onClick={() => set({ questions: moveItem(form.questions, i, 1) })}>{t("grow.admin.moveDown")}</Btn>
              {form.questions.length > 1 && (
                <Btn kind="danger" small onClick={() => set({ questions: form.questions.filter((_, k) => k !== i) })}>{t("grow.admin.remove")}</Btn>
              )}
            </div>
          )}
        </div>
      ))}
      {!locked && (
        <Btn kind="secondary" data-action="add-question" onClick={() => set({ questions: [...form.questions, blankQuestion()] })}>
          {t("grow.admin.addQuestion")}
        </Btn>
      )}

      <div style={{ position: "sticky", bottom: 0, background: C.bg, padding: "14px 0", marginTop: 20, borderTop: `1px solid ${C.warmGray}` }}>
        {error && <Notice tone="error">{error}</Notice>}
        <div style={s.row}>
          <Btn data-action="save-survey" disabled={saving} onClick={save}>{saving ? "…" : t("grow.admin.save")}</Btn>
          <Btn kind="secondary" onClick={onClose}>{t("grow.admin.cancel")}</Btn>
        </div>
      </div>
    </section>
  );
}

function SurveyPeople({ survey, onClose, onChanged }) {
  const { t, lang } = useI18n();
  const s = useAdminStyles();
  const [people, setPeople] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dateLocale = lang === "ur" ? "ur-PK" : "en-GB";
  const fmt = (d) => new Date(d).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" });

  const load = useCallback(async () => {
    if (!survey) return;
    try {
      setPeople(await adminSurveyPeople(survey.id));
      setError("");
    } catch (e) {
      setError(errorMessage(e, t));
      setPeople([]);
    }
  }, [survey, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (!survey) return <Notice tone="error">{t("grow.admin.err.generic")}</Notice>;

  const reoffer = async (profileId) => {
    setBusy(true);
    setError("");
    try {
      const n = await adminReofferSurvey(survey.id, profileId);
      pushToast(profileId ? t("grow.admin.reofferedOne") : t("grow.admin.reofferedAll", { n }), { key: "grow-admin" });
      await load();
      await onChanged();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const canReoffer = survey.status === "published" || survey.status === "closing";

  return (
    <section data-admin-people={survey.id}>
      <h2 style={s.h2}>{t("grow.admin.peopleTitle", { survey: pick(survey, "title", lang) })}</h2>
      <p style={s.muted}>{t("grow.admin.peopleAudited")}</p>
      {!canReoffer && <Notice>{t("grow.admin.err.publishFirst")}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <div style={{ ...s.row, marginBottom: 14 }}>
        <Btn data-action="reoffer-all" disabled={busy || !canReoffer} onClick={() => reoffer(null)}>
          {t("grow.admin.reofferAll")}
        </Btn>
        <Btn kind="secondary" onClick={onClose}>{t("grow.admin.back")}</Btn>
      </div>
      {people === null ? (
        <p aria-busy="true" style={s.muted}>···</p>
      ) : people.length === 0 ? (
        <p style={s.muted}>{t("grow.admin.noPeople")}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {people.map((p) => (
            <li key={p.profile_id} data-person={p.profile_id} data-dismiss-count={p.dismiss_count} style={s.card}>
              <p style={{ ...s.h3, margin: "0 0 2px" }}>{p.full_name}</p>
              <p style={s.muted}>{ROLE_DISPLAY[p.role] || p.role}</p>
              {p.dismiss_count > 0 && (
                <p style={s.body} data-dismissals>
                  {t(p.dismiss_count === 1 ? "grow.admin.dismissedOnce" : "grow.admin.dismissedTimes", { n: p.dismiss_count })}
                  {p.last_dismissed_at ? ` · ${t("grow.admin.lastOn", { date: fmt(p.last_dismissed_at) })}` : ""}
                  {p.last_kind === "withdrew" ? ` · ${t("grow.admin.withdrewNote")}` : ""}
                </p>
              )}
              {p.part_way && <p style={s.body}>◐ {t("grow.admin.partWay")}</p>}
              {p.reoffered_at && <p style={s.muted}>{t("grow.admin.reofferedOn", { date: fmt(p.reoffered_at) })}</p>}
              <p style={{ ...s.muted, fontWeight: 700 }} data-offered-now={p.offered_now ? "yes" : "no"}>
                {p.offered_now ? `✓ ${t("grow.admin.shownNow")}` : t("grow.admin.notShownNow")}
              </p>
              {!p.offered_now && (
                <Btn kind="secondary" small data-action="reoffer-one" disabled={busy || !canReoffer} onClick={() => reoffer(p.profile_id)}>
                  {t("grow.admin.reofferOne")}
                </Btn>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
