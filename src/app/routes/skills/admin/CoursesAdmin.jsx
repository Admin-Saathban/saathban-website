/* ════════════════════════════════════════════════
   Grow admin — Courses and programmes.

   Title, description, kind, the badge it awards (a credential badge, a
   sensible default per kind, editable), audience, modules with an
   optional check question, an optional exam, and publish / unpublish
   with the two modes. Every save is a database function that checks the
   admin and writes the audit log (0165); a course that is not a draft
   must be complete in both languages, which the database enforces.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { pushToast } from "../../../lib/feedback.jsx";
import { adminSaveCourse, adminSetCourseStatus, pick, newKey } from "../growData.js";
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
const blankModule = () => ({ key: newKey("m"), title_en: "", title_ur: "", body_en: "", body_ur: "", question: null });
const blankExamQuestion = () => ({ key: newKey("x"), en: "", ur: "", options: blankOptions(), answer: null });
const DEFAULT_BADGE = { course: "course-finished", programme: "programme-finished" };

function badgeLabel(badges, key, lang) {
  const b = (badges || []).find((x) => x.key === key);
  return b ? `${b.emoji} ${pick(b, "name", lang)}` : null;
}

export default function CoursesAdmin({ overview, reload, params, setParams }) {
  const { t, lang } = useI18n();
  const s = useAdminStyles();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const editId = params.get("edit");

  if (editId) {
    const course = editId === "new" ? null : overview.courses.find((c) => c.id === editId);
    if (editId !== "new" && !course) return <Notice tone="error">{t("grow.admin.err.generic")}</Notice>;
    return (
      <CourseEditor
        key={editId}
        course={course}
        badges={overview.badges}
        onClose={() => setParams({ tab: "courses" })}
        onSaved={async () => {
          await reload();
          setParams({ tab: "courses" });
        }}
      />
    );
  }

  const setStatus = async (course, status) => {
    setBusy(course.id);
    setError("");
    try {
      await adminSetCourseStatus(course.id, status);
      await reload();
      pushToast(t(`grow.admin.statusSet.${status}`), { key: "grow-admin" });
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section data-admin-tab="courses">
      <div style={{ ...s.row, justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ ...s.h2, margin: 0 }}>{t("grow.admin.tabs.courses")}</h2>
        <Btn data-action="new-course" onClick={() => setParams({ tab: "courses", edit: "new" })}>
          {t("grow.admin.newCourse")}
        </Btn>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {overview.courses.length === 0 && <p style={s.muted}>{t("grow.admin.noCourses")}</p>}
      {overview.courses.map((c) => (
        <article key={c.id} data-admin-course={c.id} data-slug={c.slug || ""} style={s.card}>
          <div style={{ ...s.row, marginBottom: 6 }}>
            <StatusPill status={c.status} />
            <span style={{ ...s.muted, margin: 0 }}>{t(`grow.page.kind.${c.kind}`)}</span>
          </div>
          <h3 style={s.h3}>{pick(c, "title", lang) || t("grow.admin.untitled")}</h3>
          <p style={s.muted} data-admin-badge={c.badge_key || ""}>
            {c.badge_key ? t("grow.admin.awards", { badge: badgeLabel(overview.badges, c.badge_key, lang) || c.badge_key }) : t("grow.admin.noBadge")}
          </p>
          <p style={s.muted}>{t("grow.admin.forAudience", { who: audienceText(c.audience, t) })}</p>
          <p style={s.muted}>{t("grow.admin.courseCounts", { part: c.part_way, done: c.completed })}</p>
          {c.pending_id && <p style={{ ...s.muted, color: C.green, fontWeight: 700 }}>✓ {t("grow.admin.inPending")}</p>}
          <div style={{ ...s.row, marginBottom: 8 }}>
            <Btn kind="secondary" data-action="edit-course" onClick={() => setParams({ tab: "courses", edit: c.id })}>
              {t("grow.admin.edit")}
            </Btn>
          </div>
          <StatusControls status={c.status} kind="course" busy={busy === c.id} onSet={(st) => setStatus(c, st)} />
        </article>
      ))}
    </section>
  );
}

function CourseEditor({ course, badges, onClose, onSaved }) {
  const { t, lang, ts } = useI18n();
  const s = useAdminStyles();
  const [form, setForm] = useState(() => ({
    kind: course?.kind || "course",
    title_en: course?.title_en || "",
    title_ur: course?.title_ur || "",
    desc_en: course?.desc_en || "",
    desc_ur: course?.desc_ur || "",
    badge_key: course ? course.badge_key || "" : DEFAULT_BADGE.course,
    audience: course?.audience || [],
    modules: course?.content?.modules || [],
    exam: course?.content?.exam || [],
  }));
  const [badgeTouched, setBadgeTouched] = useState(!!course);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setModule = (i, patch) => set({ modules: form.modules.map((m, k) => (k === i ? { ...m, ...patch } : m)) });
  const setExam = (i, patch) => set({ exam: form.exam.map((q, k) => (k === i ? { ...q, ...patch } : q)) });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await adminSaveCourse(course?.id, {
        kind: form.kind,
        title_en: form.title_en,
        title_ur: form.title_ur,
        desc_en: form.desc_en,
        desc_ur: form.desc_ur,
        badge_key: form.badge_key || "",
        audience: form.audience,
        content: { modules: form.modules, exam: form.exam },
      });
      pushToast(t("grow.admin.saved"), { key: "grow-admin" });
      await onSaved();
    } catch (e) {
      setError(errorMessage(e, t));
      setSaving(false);
    }
  };

  const radio = { display: "flex", alignItems: "center", gap: 10, minHeight: A11Y.minTapTargetPx, fontSize: 17, cursor: "pointer" };

  return (
    <section data-admin-editor="course" data-course-id={course?.id || "new"}>
      <h2 style={s.h2}>{course ? t("grow.admin.editCourse") : t("grow.admin.newCourse")}</h2>
      {course && <div style={{ marginBottom: 12 }}><StatusPill status={course.status} /></div>}

      <fieldset style={{ border: "none", padding: 0, margin: "0 0 14px" }} data-field="kind">
        <legend style={s.label}>{t("grow.admin.kind")}</legend>
        {["course", "programme"].map((k) => (
          <label key={k} style={radio}>
            <input
              type="radio"
              name="course-kind"
              checked={form.kind === k}
              onChange={() => set({ kind: k, ...(badgeTouched ? {} : { badge_key: DEFAULT_BADGE[k] }) })}
              style={{ width: 22, height: 22 }}
            />
            {t(`grow.page.kind.${k}`)}
          </label>
        ))}
      </fieldset>

      <Bilingual name="title" label={t("grow.admin.title_")} en={form.title_en} ur={form.title_ur} onEn={(v) => set({ title_en: v })} onUr={(v) => set({ title_ur: v })} />
      <Bilingual name="desc" multiline label={t("grow.admin.description")} en={form.desc_en} ur={form.desc_ur} onEn={(v) => set({ desc_en: v })} onUr={(v) => set({ desc_ur: v })} />

      <div style={{ margin: "0 0 14px" }}>
        <label htmlFor="grow-course-badge" style={s.label}>{t("grow.admin.badge")}</label>
        <p style={s.muted}>{t("grow.admin.badgeHint")}</p>
        <select
          id="grow-course-badge"
          data-field="badge"
          value={form.badge_key || ""}
          onChange={(e) => {
            setBadgeTouched(true);
            set({ badge_key: e.target.value });
          }}
          style={{ ...s.input, fontSize: ts(17) }}
        >
          {(badges || []).map((b) => (
            <option key={b.key} value={b.key}>
              {b.emoji} {pick(b, "name", lang)}
              {b.key === DEFAULT_BADGE[form.kind] ? ` — ${t("grow.admin.defaultBadge")}` : ""}
            </option>
          ))}
          <option value="">{t("grow.admin.noBadgeOption")}</option>
        </select>
      </div>

      <AudiencePicker value={form.audience} onChange={(a) => set({ audience: a })} />

      <h3 style={{ ...s.h3, marginTop: 18 }}>{t("grow.admin.modules")}</h3>
      <p style={s.muted}>{t("grow.admin.modulesHint")}</p>
      {form.modules.map((m, i) => (
        <div key={m.key} data-module-editor={i} style={{ ...s.card, background: "#FAFBFA" }}>
          <p style={{ ...s.label, color: C.green }}>{t("grow.admin.moduleN", { n: i + 1 })}</p>
          <Bilingual name={`module-${i}-title`} label={t("grow.admin.moduleTitle")} en={m.title_en} ur={m.title_ur} onEn={(v) => setModule(i, { title_en: v })} onUr={(v) => setModule(i, { title_ur: v })} />
          <Bilingual name={`module-${i}-body`} multiline label={t("grow.admin.moduleBody")} en={m.body_en} ur={m.body_ur} onEn={(v) => setModule(i, { body_en: v })} onUr={(v) => setModule(i, { body_ur: v })} />
          <label style={radio}>
            <input
              type="checkbox"
              checked={!!m.question}
              onChange={(e) => setModule(i, { question: e.target.checked ? { en: "", ur: "", options: blankOptions(), answer: null } : null })}
              style={{ width: 22, height: 22 }}
            />
            {t("grow.admin.askCheck")}
          </label>
          {m.question && (
            <>
              <Bilingual
                name={`module-${i}-question`}
                label={t("grow.admin.checkQuestion")}
                en={m.question.en}
                ur={m.question.ur}
                onEn={(v) => setModule(i, { question: { ...m.question, en: v } })}
                onUr={(v) => setModule(i, { question: { ...m.question, ur: v } })}
              />
              <OptionsEditor
                name={`module-${i}`}
                options={m.question.options}
                onChange={(o) => setModule(i, { question: { ...m.question, options: o } })}
                answer={m.question.answer}
                onAnswer={(k) => setModule(i, { question: { ...m.question, answer: k } })}
              />
            </>
          )}
          <div style={s.row}>
            <Btn kind="secondary" small disabled={i === 0} onClick={() => set({ modules: moveItem(form.modules, i, -1) })}>{t("grow.admin.moveUp")}</Btn>
            <Btn kind="secondary" small disabled={i === form.modules.length - 1} onClick={() => set({ modules: moveItem(form.modules, i, 1) })}>{t("grow.admin.moveDown")}</Btn>
            <Btn kind="danger" small onClick={() => set({ modules: form.modules.filter((_, k) => k !== i) })}>{t("grow.admin.remove")}</Btn>
          </div>
        </div>
      ))}
      <Btn kind="secondary" data-action="add-module" onClick={() => set({ modules: [...form.modules, blankModule()] })}>
        {t("grow.admin.addModule")}
      </Btn>

      <h3 style={{ ...s.h3, marginTop: 22 }}>{t("grow.admin.exam")}</h3>
      <p style={s.muted}>{t("grow.admin.examHint")}</p>
      {form.exam.map((q, i) => (
        <div key={q.key} data-exam-editor={i} style={{ ...s.card, background: "#FAFBFA" }}>
          <p style={{ ...s.label, color: C.green }}>{t("grow.admin.questionN", { n: i + 1 })}</p>
          <Bilingual name={`exam-${i}`} label={t("grow.admin.question")} en={q.en} ur={q.ur} onEn={(v) => setExam(i, { en: v })} onUr={(v) => setExam(i, { ur: v })} />
          <OptionsEditor name={`exam-${i}`} options={q.options} onChange={(o) => setExam(i, { options: o })} answer={q.answer} onAnswer={(k) => setExam(i, { answer: k })} />
          <div style={s.row}>
            <Btn kind="secondary" small disabled={i === 0} onClick={() => set({ exam: moveItem(form.exam, i, -1) })}>{t("grow.admin.moveUp")}</Btn>
            <Btn kind="secondary" small disabled={i === form.exam.length - 1} onClick={() => set({ exam: moveItem(form.exam, i, 1) })}>{t("grow.admin.moveDown")}</Btn>
            <Btn kind="danger" small onClick={() => set({ exam: form.exam.filter((_, k) => k !== i) })}>{t("grow.admin.remove")}</Btn>
          </div>
        </div>
      ))}
      <Btn kind="secondary" data-action="add-exam-question" onClick={() => set({ exam: [...form.exam, blankExamQuestion()] })}>
        {t("grow.admin.addExamQuestion")}
      </Btn>

      <div style={{ position: "sticky", bottom: 0, background: C.bg, padding: "14px 0", marginTop: 20, borderTop: `1px solid ${C.warmGray}` }}>
        {error && <Notice tone="error">{error}</Notice>}
        <div style={s.row}>
          <Btn data-action="save-course" disabled={saving} onClick={save}>{saving ? "…" : t("grow.admin.save")}</Btn>
          <Btn kind="secondary" onClick={onClose}>{t("grow.admin.cancel")}</Btn>
        </div>
      </div>
    </section>
  );
}
